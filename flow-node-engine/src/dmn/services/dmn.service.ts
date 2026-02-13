import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DmnDecisionEntity, DmnDecisionStatus, HitPolicy, AggregationType } from '../entities/dmn-decision.entity';
import { DmnExecutionEntity, DmnExecutionStatus } from '../entities/dmn-execution.entity';
import {
  CreateDecisionDto,
  UpdateDecisionDto,
  QueryDecisionDto,
  DecisionResponseDto,
  ExecuteDecisionDto,
  DecisionResultDto,
  ExecutionHistoryDto,
} from '../dto/dmn.dto';
import { RuleEngineExecutorService } from './rule-engine-executor.service';

/**
 * DMN决策服务
 * 提供决策表的管理和执行功能
 */
@Injectable()
export class DmnService {
  private readonly logger = new Logger(DmnService.name);

  constructor(
    @InjectRepository(DmnDecisionEntity)
    private readonly decisionRepository: Repository<DmnDecisionEntity>,
    @InjectRepository(DmnExecutionEntity)
    private readonly executionRepository: Repository<DmnExecutionEntity>,
    private readonly ruleEngineExecutor: RuleEngineExecutorService,
  ) {}

  /**
   * 创建决策
   */
  async createDecision(dto: CreateDecisionDto): Promise<DecisionResponseDto> {
    // 检查Key是否已存在
    const existing = await this.decisionRepository.findOne({
      where: { decisionKey: dto.decisionKey, tenantId: dto.tenantId || null },
    });

    if (existing) {
      throw new BadRequestException(`Decision with key '${dto.decisionKey}' already exists`);
    }

    const decision = this.decisionRepository.create({
      id: uuidv4(),
      decisionKey: dto.decisionKey,
      name: dto.name,
      description: dto.description,
      category: dto.category,
      version: 1,
      status: DmnDecisionStatus.DRAFT,
      hitPolicy: dto.hitPolicy,
      aggregation: dto.aggregation || AggregationType.NONE,
      inputs: JSON.stringify(dto.inputs),
      outputs: JSON.stringify(dto.outputs),
      rules: JSON.stringify(dto.rules),
      ruleCount: dto.rules.length,
      tenantId: dto.tenantId,
      extra: dto.extra ? JSON.stringify(dto.extra) : null,
      createTime: new Date(),
    });

    await this.decisionRepository.save(decision);

    return this.toResponseDto(decision);
  }

  /**
   * 更新决策
   */
  async updateDecision(id: string, dto: UpdateDecisionDto): Promise<DecisionResponseDto> {
    const decision = await this.decisionRepository.findOne({ where: { id } });

    if (!decision) {
      throw new NotFoundException(`Decision with id '${id}' not found`);
    }

    // 已发布的决策不能修改
    if (decision.status === DmnDecisionStatus.PUBLISHED) {
      throw new BadRequestException('Cannot update a published decision. Create a new version instead.');
    }

    // 更新字段
    if (dto.name !== undefined) decision.name = dto.name;
    if (dto.description !== undefined) decision.description = dto.description;
    if (dto.category !== undefined) decision.category = dto.category;
    if (dto.hitPolicy !== undefined) decision.hitPolicy = dto.hitPolicy;
    if (dto.aggregation !== undefined) decision.aggregation = dto.aggregation;
    if (dto.inputs !== undefined) decision.inputs = JSON.stringify(dto.inputs);
    if (dto.outputs !== undefined) decision.outputs = JSON.stringify(dto.outputs);
    if (dto.rules !== undefined) {
      decision.rules = JSON.stringify(dto.rules);
      decision.ruleCount = dto.rules.length;
    }
    if (dto.extra !== undefined) decision.extra = JSON.stringify(dto.extra);

    decision.updateTime = new Date();
    await this.decisionRepository.save(decision);

    return this.toResponseDto(decision);
  }

  /**
   * 发布决策
   */
  async publishDecision(id: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionRepository.findOne({ where: { id } });

    if (!decision) {
      throw new NotFoundException(`Decision with id '${id}' not found`);
    }

    if (decision.status === DmnDecisionStatus.PUBLISHED) {
      throw new BadRequestException('Decision is already published');
    }

    // 验证决策表
    const validation = await this.ruleEngineExecutor.validateDecision(id);
    if (!validation.valid) {
      throw new BadRequestException(`Decision validation failed: ${validation.errors.join(', ')}`);
    }

    decision.status = DmnDecisionStatus.PUBLISHED;
    decision.publishTime = new Date();
    decision.updateTime = new Date();

    await this.decisionRepository.save(decision);

    return this.toResponseDto(decision);
  }

  /**
   * 创建新版本
   */
  async createNewVersion(id: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionRepository.findOne({ where: { id } });

    if (!decision) {
      throw new NotFoundException(`Decision with id '${id}' not found`);
    }

    // 获取最新版本号
    const latestVersion = await this.decisionRepository.findOne({
      where: { decisionKey: decision.decisionKey, tenantId: decision.tenantId },
      order: { version: 'DESC' },
    });

    const newVersion = latestVersion ? latestVersion.version + 1 : 1;

    // 创建新版本
    const newDecision = this.decisionRepository.create({
      id: uuidv4(),
      decisionKey: decision.decisionKey,
      name: decision.name,
      description: decision.description,
      category: decision.category,
      version: newVersion,
      status: DmnDecisionStatus.DRAFT,
      hitPolicy: decision.hitPolicy,
      aggregation: decision.aggregation,
      inputs: decision.inputs,
      outputs: decision.outputs,
      rules: decision.rules,
      ruleCount: decision.ruleCount,
      tenantId: decision.tenantId,
      extra: decision.extra,
      createTime: new Date(),
    });

    await this.decisionRepository.save(newDecision);

    return this.toResponseDto(newDecision);
  }

  /**
   * 挂起决策
   */
  async suspendDecision(id: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionRepository.findOne({ where: { id } });

    if (!decision) {
      throw new NotFoundException(`Decision with id '${id}' not found`);
    }

    if (decision.status !== DmnDecisionStatus.PUBLISHED) {
      throw new BadRequestException('Only published decisions can be suspended');
    }

    decision.status = DmnDecisionStatus.SUSPENDED;
    decision.updateTime = new Date();

    await this.decisionRepository.save(decision);

    return this.toResponseDto(decision);
  }

  /**
   * 激活决策
   */
  async activateDecision(id: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionRepository.findOne({ where: { id } });

    if (!decision) {
      throw new NotFoundException(`Decision with id '${id}' not found`);
    }

    if (decision.status !== DmnDecisionStatus.SUSPENDED) {
      throw new BadRequestException('Only suspended decisions can be activated');
    }

    decision.status = DmnDecisionStatus.PUBLISHED;
    decision.updateTime = new Date();

    await this.decisionRepository.save(decision);

    return this.toResponseDto(decision);
  }

  /**
   * 删除决策
   */
  async deleteDecision(id: string): Promise<void> {
    const decision = await this.decisionRepository.findOne({ where: { id } });

    if (!decision) {
      throw new NotFoundException(`Decision with id '${id}' not found`);
    }

    if (decision.status === DmnDecisionStatus.PUBLISHED) {
      throw new BadRequestException('Cannot delete a published decision');
    }

    await this.decisionRepository.remove(decision);
  }

  /**
   * 查询决策
   */
  async queryDecisions(dto: QueryDecisionDto): Promise<{ data: DecisionResponseDto[]; total: number }> {
    const queryBuilder = this.decisionRepository.createQueryBuilder('decision');

    if (dto.id) {
      queryBuilder.andWhere('decision.id = :id', { id: dto.id });
    }

    if (dto.decisionKey) {
      queryBuilder.andWhere('decision.decisionKey LIKE :key', { key: `%${dto.decisionKey}%` });
    }

    if (dto.name) {
      queryBuilder.andWhere('decision.name LIKE :name', { name: `%${dto.name}%` });
    }

    if (dto.status) {
      queryBuilder.andWhere('decision.status = :status', { status: dto.status });
    }

    if (dto.category) {
      queryBuilder.andWhere('decision.category = :category', { category: dto.category });
    }

    if (dto.tenantId) {
      queryBuilder.andWhere('decision.tenantId = :tenantId', { tenantId: dto.tenantId });
    }

    if (dto.version) {
      queryBuilder.andWhere('decision.version = :version', { version: dto.version });
    }

    queryBuilder.orderBy('decision.createTime', 'DESC');

    const page = dto.page || 1;
    const size = dto.size || 20;
    queryBuilder.skip((page - 1) * size).take(size);

    const [decisions, total] = await queryBuilder.getManyAndCount();

    return {
      data: decisions.map((d) => this.toResponseDto(d)),
      total,
    };
  }

  /**
   * 获取决策详情
   */
  async getDecision(id: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionRepository.findOne({ where: { id } });

    if (!decision) {
      throw new NotFoundException(`Decision with id '${id}' not found`);
    }

    return this.toResponseDto(decision);
  }

  /**
   * 通过Key获取最新版本的决策
   */
  async getDecisionByKey(key: string, tenantId?: string): Promise<DecisionResponseDto> {
    const queryBuilder = this.decisionRepository.createQueryBuilder('decision');
    queryBuilder
      .where('decision.decisionKey = :key', { key })
      .andWhere('decision.status = :status', { status: DmnDecisionStatus.PUBLISHED })
      .orderBy('decision.version', 'DESC')
      .limit(1);

    if (tenantId) {
      queryBuilder.andWhere('decision.tenantId = :tenantId', { tenantId });
    }

    const decision = await queryBuilder.getOne();

    if (!decision) {
      throw new NotFoundException(`Decision with key '${key}' not found`);
    }

    return this.toResponseDto(decision);
  }

  /**
   * 执行决策
   */
  async executeDecision(dto: ExecuteDecisionDto): Promise<DecisionResultDto> {
    return this.ruleEngineExecutor.execute(dto);
  }

  /**
   * 获取执行历史
   */
  async getExecutionHistory(
    decisionId?: string,
    processInstanceId?: string,
    page: number = 1,
    size: number = 20,
  ): Promise<{ data: ExecutionHistoryDto[]; total: number }> {
    const queryBuilder = this.executionRepository.createQueryBuilder('execution');

    if (decisionId) {
      queryBuilder.andWhere('execution.decisionId = :decisionId', { decisionId });
    }

    if (processInstanceId) {
      queryBuilder.andWhere('execution.processInstanceId = :processInstanceId', {
        processInstanceId,
      });
    }

    queryBuilder.orderBy('execution.createTime', 'DESC');

    queryBuilder.skip((page - 1) * size).take(size);

    const [executions, total] = await queryBuilder.getManyAndCount();

    return {
      data: executions.map((e) => this.toExecutionHistoryDto(e)),
      total,
    };
  }

  /**
   * 获取决策统计
   */
  async getDecisionStatistics(id: string): Promise<{
    totalExecutions: number;
    successCount: number;
    failedCount: number;
    noMatchCount: number;
    avgExecutionTime: number;
  }> {
    const decision = await this.decisionRepository.findOne({ where: { id } });

    if (!decision) {
      throw new NotFoundException(`Decision with id '${id}' not found`);
    }

    const stats = await this.executionRepository
      .createQueryBuilder('execution')
      .select('COUNT(*)', 'totalExecutions')
      .addSelect(
        'SUM(CASE WHEN execution.status = :success THEN 1 ELSE 0 END)',
        'successCount',
      )
      .addSelect(
        'SUM(CASE WHEN execution.status = :failed THEN 1 ELSE 0 END)',
        'failedCount',
      )
      .addSelect(
        'SUM(CASE WHEN execution.status = :noMatch THEN 1 ELSE 0 END)',
        'noMatchCount',
      )
      .addSelect('AVG(execution.executionTimeMs)', 'avgExecutionTime')
      .where('execution.decisionId = :decisionId', { decisionId: id })
      .setParameters({
        success: DmnExecutionStatus.SUCCESS,
        failed: DmnExecutionStatus.FAILED,
        noMatch: DmnExecutionStatus.NO_MATCH,
      })
      .getRawOne();

    return {
      totalExecutions: parseInt(stats.totalExecutions) || 0,
      successCount: parseInt(stats.successCount) || 0,
      failedCount: parseInt(stats.failedCount) || 0,
      noMatchCount: parseInt(stats.noMatchCount) || 0,
      avgExecutionTime: parseFloat(stats.avgExecutionTime) || 0,
    };
  }

  /**
   * 验证决策
   */
  async validateDecision(id: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    return this.ruleEngineExecutor.validateDecision(id);
  }

  /**
   * 转换为响应DTO
   */
  private toResponseDto(decision: DmnDecisionEntity): DecisionResponseDto {
    return {
      id: decision.id,
      decisionKey: decision.decisionKey,
      name: decision.name,
      version: decision.version,
      status: decision.status,
      description: decision.description,
      category: decision.category,
      hitPolicy: decision.hitPolicy,
      aggregation: decision.aggregation,
      inputs: decision.inputs ? JSON.parse(decision.inputs) : [],
      outputs: decision.outputs ? JSON.parse(decision.outputs) : [],
      ruleCount: decision.ruleCount,
      tenantId: decision.tenantId,
      createTime: decision.createTime,
      publishTime: decision.publishTime,
    };
  }

  /**
   * 转换为执行历史DTO
   */
  private toExecutionHistoryDto(execution: DmnExecutionEntity): ExecutionHistoryDto {
    return {
      id: execution.id,
      decisionId: execution.decisionId,
      decisionKey: execution.decisionKey,
      decisionVersion: execution.decisionVersion,
      status: execution.status,
      inputData: execution.inputData ? JSON.parse(execution.inputData) : undefined,
      outputResult: execution.outputResult ? JSON.parse(execution.outputResult) : undefined,
      matchedCount: execution.matchedCount,
      executionTimeMs: execution.executionTimeMs,
      processInstanceId: execution.processInstanceId,
      activityId: execution.activityId,
      createTime: execution.createTime,
    };
  }
}
