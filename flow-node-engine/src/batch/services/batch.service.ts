import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { 
  CreateBatchDto, 
  UpdateBatchDto, 
  QueryBatchDto, 
  QueryBatchPartDto,
  BatchResponseDto,
  BatchPartResponseDto,
  BatchStatisticsDto,
  BatchPartItemDto,
} from '../dto/batch.dto';
import { BatchPartEntity, BatchPartStatus } from '../entities/batch-part.entity';
import { BatchEntity, BatchStatus, BatchType } from '../entities/batch.entity';

/**
 * 批处理执行器接口
 */
export interface BatchExecutor {
  /** 执行器类型 */
  type: string;
  /** 执行单个批处理部分 */
  execute(part: BatchPartEntity, batch: BatchEntity): Promise<{ success: boolean; result?: any; error?: string }>;
}

/**
 * 批处理配置
 */
export interface BatchConfig {
  /** 是否启用批处理 */
  enabled: boolean;
  /** 每次处理的最大数量 */
  batchSize: number;
  /** 处理间隔（毫秒） */
  processInterval: number;
  /** 最大并发批处理数 */
  maxConcurrentBatches: number;
  /** 批处理超时时间（毫秒） */
  timeout: number;
  /** 是否自动清理已完成的批处理 */
  autoCleanup: boolean;
  /** 自动清理保留天数 */
  cleanupRetentionDays: number;
}

@Injectable()
export class BatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BatchService.name);
  private readonly executors: Map<string, BatchExecutor> = new Map();
  private processingBatches: Set<string> = new Set();
  private isProcessing = false;
  private config: BatchConfig = {
    enabled: true,
    batchSize: 50,
    processInterval: 5000,
    maxConcurrentBatches: 5,
    timeout: 300000, // 5分钟
    autoCleanup: true,
    cleanupRetentionDays: 30,
  };

  constructor(
    @InjectRepository(BatchEntity)
    private readonly batchRepository: Repository<BatchEntity>,
    @InjectRepository(BatchPartEntity)
    private readonly batchPartRepository: Repository<BatchPartEntity>,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    this.logger.log('Batch service initialized');
  }

  onModuleDestroy() {
    this.logger.log('Batch service destroyed');
  }

  /**
   * 注册批处理执行器
   */
  registerExecutor(executor: BatchExecutor): void {
    this.executors.set(executor.type, executor);
    this.logger.log(`Registered batch executor for type: ${executor.type}`);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ==================== 批处理管理 ====================

  /**
   * 创建批处理
   */
  async createBatch(dto: CreateBatchDto, userId?: string): Promise<BatchEntity> {
    const batchId = uuidv4();
    
    const batch = this.batchRepository.create({
      id: batchId,
      type: dto.type,
      description: dto.description,
      config: dto.config ? JSON.stringify(dto.config) : null,
      searchKey: dto.searchKey,
      searchKey2: dto.searchKey2,
      tenantId: dto.tenantId,
      createUser: userId,
      async: dto.async ?? true,
      priority: dto.priority ?? 0,
      maxRetries: dto.maxRetries ?? 3,
      status: BatchStatus.PENDING,
      total: 0,
      processedTotal: 0,
      successTotal: 0,
      failTotal: 0,
    });

    await this.batchRepository.save(batch);

    // 如果有数据项，创建批处理部分
    if (dto.items && dto.items.length > 0) {
      await this.addBatchParts(batch.id, dto.items, dto.tenantId);
    }

    this.logger.log(`Created batch: ${batchId}, type: ${dto.type}`);
    return batch;
  }

  /**
   * 添加批处理数据项
   */
  async addBatchParts(batchId: string, items: BatchPartItemDto[], tenantId?: string): Promise<BatchPartEntity[]> {
    const batch = await this.getBatchById(batchId);
    if (!batch) {
      throw new NotFoundException(`Batch not found: ${batchId}`);
    }

    if (batch.status !== BatchStatus.PENDING) {
      throw new BadRequestException(`Cannot add parts to batch with status: ${batch.status}`);
    }

    const parts: BatchPartEntity[] = [];
    for (const item of items) {
      const part = this.batchPartRepository.create({
        id: uuidv4(),
        batchId,
        type: item.type,
        data: JSON.stringify(item.data),
        tenantId,
        status: BatchPartStatus.PENDING,
        retryCount: 0,
      });
      parts.push(part);
    }

    await this.batchPartRepository.save(parts);

    // 更新批处理总数
    await this.batchRepository.update(batchId, {
      total: batch.total + items.length,
    });

    return parts;
  }

  /**
   * 获取批处理
   */
  async getBatchById(id: string): Promise<BatchEntity | null> {
    return this.batchRepository.findOne({ where: { id } });
  }

  /**
   * 查询批处理列表
   */
  async queryBatches(dto: QueryBatchDto): Promise<{ data: BatchEntity[]; total: number }> {
    const queryBuilder = this.batchRepository.createQueryBuilder('batch');

    if (dto.id) {
      queryBuilder.andWhere('batch.id = :id', { id: dto.id });
    }
    if (dto.type) {
      queryBuilder.andWhere('batch.type = :type', { type: dto.type });
    }
    if (dto.status) {
      queryBuilder.andWhere('batch.status = :status', { status: dto.status });
    }
    if (dto.searchKey) {
      queryBuilder.andWhere('batch.searchKey = :searchKey', { searchKey: dto.searchKey });
    }
    if (dto.tenantId) {
      queryBuilder.andWhere('batch.tenantId = :tenantId', { tenantId: dto.tenantId });
    }
    if (dto.createUser) {
      queryBuilder.andWhere('batch.createUser = :createUser', { createUser: dto.createUser });
    }

    queryBuilder.orderBy('batch.priority', 'DESC')
      .addOrderBy('batch.createTime', 'ASC');

    const page = dto.page ?? 1;
    const size = dto.size ?? 20;
    queryBuilder.skip((page - 1) * size).take(size);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  /**
   * 更新批处理
   */
  async updateBatch(id: string, dto: UpdateBatchDto): Promise<BatchEntity> {
    const batch = await this.getBatchById(id);
    if (!batch) {
      throw new NotFoundException(`Batch not found: ${id}`);
    }

    Object.assign(batch, {
      ...dto,
      updateTime: new Date(),
    });

    return this.batchRepository.save(batch);
  }

  /**
   * 取消批处理
   */
  async cancelBatch(id: string): Promise<BatchEntity> {
    const batch = await this.getBatchById(id);
    if (!batch) {
      throw new NotFoundException(`Batch not found: ${id}`);
    }

    if (batch.status === BatchStatus.COMPLETED || batch.status === BatchStatus.CANCELLED) {
      throw new BadRequestException(`Cannot cancel batch with status: ${batch.status}`);
    }

    // 更新批处理状态
    batch.status = BatchStatus.CANCELLED;
    batch.updateTime = new Date();
    await this.batchRepository.save(batch);

    // 取消所有待处理的部分
    await this.batchPartRepository.update(
      { batchId: id, status: BatchPartStatus.PENDING },
      { status: BatchPartStatus.SKIPPED }
    );

    return batch;
  }

  /**
   * 删除批处理
   */
  async deleteBatch(id: string): Promise<void> {
    const batch = await this.getBatchById(id);
    if (!batch) {
      throw new NotFoundException(`Batch not found: ${id}`);
    }

    // 先删除所有部分
    await this.batchPartRepository.delete({ batchId: id });
    // 再删除批处理
    await this.batchRepository.delete({ id });
    
    this.logger.log(`Deleted batch: ${id}`);
  }

  // ==================== 批处理部分管理 ====================

  /**
   * 获取批处理部分
   */
  async getBatchPartById(id: string): Promise<BatchPartEntity | null> {
    return this.batchPartRepository.findOne({ where: { id } });
  }

  /**
   * 查询批处理部分列表
   */
  async queryBatchParts(dto: QueryBatchPartDto): Promise<{ data: BatchPartEntity[]; total: number }> {
    const queryBuilder = this.batchPartRepository.createQueryBuilder('part');

    queryBuilder.andWhere('part.batchId = :batchId', { batchId: dto.batchId });

    if (dto.status) {
      queryBuilder.andWhere('part.status = :status', { status: dto.status });
    }

    queryBuilder.orderBy('part.createTime', 'ASC');

    const page = dto.page ?? 1;
    const size = dto.size ?? 50;
    queryBuilder.skip((page - 1) * size).take(size);

    const [data, total] = await queryBuilder.getManyAndCount();
    return { data, total };
  }

  /**
   * 重试失败的批处理部分
   */
  async retryFailedParts(batchId: string): Promise<number> {
    const batch = await this.getBatchById(batchId);
    if (!batch) {
      throw new NotFoundException(`Batch not found: ${batchId}`);
    }

    // 查找所有失败的部分
    const failedParts = await this.batchPartRepository.find({
      where: { batchId, status: BatchPartStatus.FAILED },
    });

    if (failedParts.length === 0) {
      return 0;
    }

    // 重置状态为待处理
    await this.batchPartRepository.update(
      { batchId, status: BatchPartStatus.FAILED },
      { status: BatchPartStatus.PENDING, retryCount: 0, errorMessage: null, errorDetails: null }
    );

    // 重置批处理状态
    if (batch.status === BatchStatus.FAILED) {
      batch.status = BatchStatus.PENDING;
      batch.failTotal = 0;
      batch.processedTotal = batch.successTotal;
      batch.errorMessage = null;
      await this.batchRepository.save(batch);
    }

    this.logger.log(`Reset ${failedParts.length} failed parts for batch: ${batchId}`);
    return failedParts.length;
  }

  // ==================== 批处理执行 ====================

  /**
   * 定时执行批处理
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async processBatches(): Promise<void> {
    if (!this.config.enabled || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      // 获取待处理的批处理
      const pendingBatches = await this.batchRepository.find({
        where: { status: BatchStatus.PENDING },
        order: { priority: 'DESC', createTime: 'ASC' },
        take: this.config.maxConcurrentBatches,
      });

      // 同时获取正在执行但可能需要继续处理的批处理
      const runningBatches = await this.batchRepository.find({
        where: { status: BatchStatus.RUNNING },
        order: { updateTime: 'ASC' },
        take: this.config.maxConcurrentBatches - pendingBatches.length,
      });

      const batchesToProcess = [...pendingBatches, ...runningBatches];

      for (const batch of batchesToProcess) {
        if (this.processingBatches.has(batch.id)) {
          continue;
        }

        this.processingBatches.add(batch.id);
        this.executeBatch(batch).finally(() => {
          this.processingBatches.delete(batch.id);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 执行单个批处理
   */
  async executeBatch(batch: BatchEntity): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 更新状态为执行中
      if (batch.status === BatchStatus.PENDING) {
        batch.status = BatchStatus.RUNNING;
        await queryRunner.manager.save(batch);
      }

      // 获取待处理的部分
      const pendingParts = await queryRunner.manager.find(BatchPartEntity, {
        where: { batchId: batch.id, status: BatchPartStatus.PENDING },
        take: this.config.batchSize,
      });

      if (pendingParts.length === 0) {
        // 检查是否所有部分都已处理
        const remainingParts = await queryRunner.manager.count(BatchPartEntity, {
          where: { batchId: batch.id, status: In([BatchPartStatus.PENDING, BatchPartStatus.RUNNING]) },
        });

        if (remainingParts === 0) {
          // 批处理完成
          batch.status = batch.failTotal > 0 ? BatchStatus.FAILED : BatchStatus.COMPLETED;
          batch.completeTime = new Date();
          await queryRunner.manager.save(batch);
          this.logger.log(`Batch completed: ${batch.id}, status: ${batch.status}`);
        }

        await queryRunner.commitTransaction();
        return;
      }

      // 获取执行器
      const executor = this.executors.get(batch.type);
      if (!executor) {
        throw new Error(`No executor registered for batch type: ${batch.type}`);
      }

      // 执行每个部分
      for (const part of pendingParts) {
        await this.executeBatchPart(queryRunner, batch, part, executor);
      }

      // 更新批处理统计
      await this.updateBatchStats(queryRunner, batch.id);

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error executing batch ${batch.id}: ${error.message}`);
      
      // 更新批处理错误状态
      batch.errorMessage = error.message;
      await this.batchRepository.save(batch);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 执行单个批处理部分
   */
  private async executeBatchPart(
    queryRunner: any,
    batch: BatchEntity,
    part: BatchPartEntity,
    executor: BatchExecutor,
  ): Promise<void> {
    part.status = BatchPartStatus.RUNNING;
    part.startTime = new Date();
    await queryRunner.manager.save(part);

    try {
      const result = await executor.execute(part, batch);

      if (result.success) {
        part.status = BatchPartStatus.COMPLETED;
        part.result = result.result ? JSON.stringify(result.result) : null;
      } else {
        part.retryCount += 1;
        
        if (part.retryCount >= batch.maxRetries) {
          part.status = BatchPartStatus.FAILED;
          part.errorMessage = result.error || 'Unknown error';
        } else {
          part.status = BatchPartStatus.PENDING;
        }
      }

      part.completeTime = new Date();
      await queryRunner.manager.save(part);
    } catch (error) {
      part.retryCount += 1;
      
      if (part.retryCount >= batch.maxRetries) {
        part.status = BatchPartStatus.FAILED;
        part.errorMessage = error.message;
        part.errorDetails = error.stack;
      } else {
        part.status = BatchPartStatus.PENDING;
      }

      await queryRunner.manager.save(part);
    }
  }

  /**
   * 更新批处理统计
   */
  private async updateBatchStats(queryRunner: any, batchId: string): Promise<void> {
    const stats = await queryRunner.manager
      .createQueryBuilder(BatchPartEntity, 'part')
      .select('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN part.status = :completed THEN 1 ELSE 0 END)', 'successTotal')
      .addSelect('SUM(CASE WHEN part.status = :failed THEN 1 ELSE 0 END)', 'failTotal')
      .addSelect('SUM(CASE WHEN part.status IN (:...processed) THEN 1 ELSE 0 END)', 'processedTotal')
      .where('part.batchId = :batchId', { batchId })
      .setParameters({
        completed: BatchPartStatus.COMPLETED,
        failed: BatchPartStatus.FAILED,
        processed: [BatchPartStatus.COMPLETED, BatchPartStatus.FAILED, BatchPartStatus.SKIPPED],
      })
      .getRawOne();

    await queryRunner.manager.update(BatchEntity, batchId, {
      processedTotal: parseInt(stats.processedTotal) || 0,
      successTotal: parseInt(stats.successTotal) || 0,
      failTotal: parseInt(stats.failTotal) || 0,
      updateTime: new Date(),
    });
  }

  // ==================== 统计和清理 ====================

  /**
   * 获取批处理统计
   */
  async getStatistics(tenantId?: string): Promise<BatchStatisticsDto> {
    const batchQuery = this.batchRepository.createQueryBuilder('batch');
    const partQuery = this.batchPartRepository.createQueryBuilder('part');

    if (tenantId) {
      batchQuery.andWhere('batch.tenantId = :tenantId', { tenantId });
      partQuery.andWhere('part.tenantId = :tenantId', { tenantId });
    }

    const [
      totalBatches,
      pendingBatches,
      runningBatches,
      completedBatches,
      failedBatches,
      cancelledBatches,
      totalParts,
      pendingParts,
      completedParts,
      failedParts,
    ] = await Promise.all([
      batchQuery.getCount(),
      batchQuery.clone().andWhere('batch.status = :status', { status: BatchStatus.PENDING }).getCount(),
      batchQuery.clone().andWhere('batch.status = :status', { status: BatchStatus.RUNNING }).getCount(),
      batchQuery.clone().andWhere('batch.status = :status', { status: BatchStatus.COMPLETED }).getCount(),
      batchQuery.clone().andWhere('batch.status = :status', { status: BatchStatus.FAILED }).getCount(),
      batchQuery.clone().andWhere('batch.status = :status', { status: BatchStatus.CANCELLED }).getCount(),
      partQuery.getCount(),
      partQuery.clone().andWhere('part.status = :status', { status: BatchPartStatus.PENDING }).getCount(),
      partQuery.clone().andWhere('part.status = :status', { status: BatchPartStatus.COMPLETED }).getCount(),
      partQuery.clone().andWhere('part.status = :status', { status: BatchPartStatus.FAILED }).getCount(),
    ]);

    return {
      totalBatches,
      pendingBatches,
      runningBatches,
      completedBatches,
      failedBatches,
      cancelledBatches,
      totalParts,
      pendingParts,
      completedParts,
      failedParts,
    };
  }

  /**
   * 定时清理已完成的批处理
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldBatches(): Promise<void> {
    if (!this.config.autoCleanup) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.cleanupRetentionDays);

    const oldBatches = await this.batchRepository.find({
      where: {
        status: In([BatchStatus.COMPLETED, BatchStatus.CANCELLED]),
        completeTime: LessThanOrEqual(cutoffDate),
      },
      select: ['id'],
    });

    if (oldBatches.length === 0) {
      return;
    }

    const batchIds = oldBatches.map(b => b.id);

    // 删除部分
    await this.batchPartRepository.delete({ batchId: In(batchIds) });
    // 删除批处理
    await this.batchRepository.delete({ id: In(batchIds) });

    this.logger.log(`Cleaned up ${oldBatches.length} old batches`);
  }

  // ==================== 转换方法 ====================

  /**
   * 转换为响应DTO
   */
  toResponseDto(batch: BatchEntity): BatchResponseDto {
    const progress = batch.total > 0 ? Math.round((batch.processedTotal / batch.total) * 100) : 0;
    
    return {
      id: batch.id,
      type: batch.type,
      total: batch.total,
      processedTotal: batch.processedTotal,
      successTotal: batch.successTotal,
      failTotal: batch.failTotal,
      status: batch.status,
      config: batch.config ? JSON.parse(batch.config) : undefined,
      searchKey: batch.searchKey,
      searchKey2: batch.searchKey2,
      tenantId: batch.tenantId,
      createUser: batch.createUser,
      createTime: batch.createTime,
      updateTime: batch.updateTime,
      completeTime: batch.completeTime,
      description: batch.description,
      async: batch.async,
      priority: batch.priority,
      errorMessage: batch.errorMessage,
      progress,
    };
  }

  /**
   * 转换部分为响应DTO
   */
  toPartResponseDto(part: BatchPartEntity): BatchPartResponseDto {
    return {
      id: part.id,
      batchId: part.batchId,
      type: part.type,
      status: part.status,
      data: part.data ? JSON.parse(part.data) : undefined,
      result: part.result ? JSON.parse(part.result) : undefined,
      errorMessage: part.errorMessage,
      retryCount: part.retryCount,
      createTime: part.createTime,
      startTime: part.startTime,
      completeTime: part.completeTime,
    };
  }
}
