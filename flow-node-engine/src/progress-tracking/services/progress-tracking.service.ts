/**
 * 进度追踪服务
 * 提供进度创建、更新、查询、统计、预警等功能
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import {
  CreateProgressDto,
  UpdateProgressDto,
  ProgressQueryDto,
  ProgressStatisticsQueryDto,
  ProgressStatisticsDto,
  ProgressDashboardDto,
  CreateProgressMetricDto,
  ProgressMetricQueryDto,
} from '../dto/progress.dto';
import { ProgressMetric, MetricType, MetricCategory } from '../entities/progress-metric.entity';
import { Progress, ProgressStatus, ProgressType } from '../entities/progress.entity';


/**
 * 进度事件类型
 */
export enum ProgressEventType {
  PROGRESS_CREATED = 'progress.created',
  PROGRESS_UPDATED = 'progress.updated',
  PROGRESS_COMPLETED = 'progress.completed',
  PROGRESS_CANCELLED = 'progress.cancelled',
  PROGRESS_WARNING = 'progress.warning',
  PROGRESS_TIMEOUT = 'progress.timeout',
}

/**
 * 进度事件接口
 */
export interface ProgressEvent {
  progressId: string;
  type: ProgressEventType;
  data: Partial<Progress>;
  timestamp: Date;
}

/**
 * 流程实例事件（来自核心引擎）
 */
export interface ProcessInstanceEvent {
  processInstanceId: string;
  processDefinitionId: string;
  processDefinitionKey: string;
  eventType: 'started' | 'completed' | 'cancelled' | 'suspended';
  variables?: Record<string, any>;
  timestamp: Date;
}

/**
 * 任务事件（来自任务模块）
 */
export interface TaskEvent {
  taskId: string;
  taskDefinitionKey: string;
  processInstanceId: string;
  processDefinitionId: string;
  eventType: 'created' | 'assigned' | 'completed' | 'deleted';
  assignee?: string;
  name?: string;
  timestamp: Date;
}

@Injectable()
export class ProgressTrackingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProgressTrackingService.name);
  
  /** 预警检查间隔配置（毫秒） */
  private warningCheckInterval = 60000;
  
  /** 超时检查间隔配置（毫秒） */
  private timeoutCheckInterval = 30000;
  
  /** 预警阈值（百分比，低于此值触发预警） */
  private warningThreshold = 20;

  /** 定时器引用 */
  private warningTimer?: ReturnType<typeof setInterval>;
  private timeoutTimer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(Progress)
    private readonly progressRepository: Repository<Progress>,
    @InjectRepository(ProgressMetric)
    private readonly metricRepository: Repository<ProgressMetric>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.logger.log('进度追踪服务初始化...');
    this.startWarningCheck();
    this.startTimeoutCheck();
  }

  async onModuleDestroy() {
    this.logger.log('进度追踪服务销毁...');
    if (this.warningTimer) {
      clearInterval(this.warningTimer);
    }
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
    }
  }

  // ==================== 进度管理 ====================

  /**
   * 创建进度记录
   */
  async createProgress(dto: CreateProgressDto): Promise<Progress> {
    const progress = this.progressRepository.create({
      id_: dto.id_ || uuidv4().replace(/-/g, ''),
      type_: dto.type_ || ProgressType.PROCESS_INSTANCE,
      process_inst_id_: dto.process_inst_id_,
      task_id_: dto.task_id_,
      process_def_id_: dto.process_def_id_,
      task_def_key_: dto.task_def_key_,
      name_: dto.name_,
      description_: dto.description_,
      status_: ProgressStatus.NOT_STARTED,
      percentage_: 0,
      total_steps_: dto.total_steps_ || 0,
      completed_steps_: 0,
      estimated_duration_: dto.estimated_duration_,
      estimated_end_time_: dto.estimated_end_time_,
      extra_data_: dto.extra_data_,
      tenant_id_: dto.tenant_id_,
    });

    const saved = await this.progressRepository.save(progress);
    
    // 发送进度创建事件
    await this.emitProgressEvent(ProgressEventType.PROGRESS_CREATED, saved);
    
    // 记录指标
    await this.recordMetric({
      id_: uuidv4().replace(/-/g, ''),
      name_: 'progress_created_total',
      type_: MetricType.COUNTER,
      category_: MetricCategory.PROCESS,
      value_: 1,
      process_inst_id_: dto.process_inst_id_,
      labels_: { type: dto.type_ || ProgressType.PROCESS_INSTANCE },
    });

    return saved;
  }

  /**
   * 更新进度
   */
  async updateProgress(id: string, dto: UpdateProgressDto): Promise<Progress> {
    const progress = await this.getProgressById(id);
    if (!progress) {
      throw new Error(`进度记录不存在: ${id}`);
    }

    // 更新字段
    if (dto.status_ !== undefined) {
      progress.status_ = dto.status_;
    }
    if (dto.percentage_ !== undefined) {
      progress.percentage_ = dto.percentage_;
    }
    if (dto.completed_steps_ !== undefined) {
      progress.completed_steps_ = dto.completed_steps_;
    }
    if (dto.current_step_name_ !== undefined) {
      progress.current_step_name_ = dto.current_step_name_;
    }
    if (dto.current_step_description_ !== undefined) {
      progress.current_step_description_ = dto.current_step_description_;
    }
    if (dto.end_time_ !== undefined) {
      progress.end_time_ = dto.end_time_;
    }
    if (dto.is_warning_ !== undefined) {
      progress.is_warning_ = dto.is_warning_;
    }
    if (dto.warning_message_ !== undefined) {
      progress.warning_message_ = dto.warning_message_;
    }
    if (dto.is_timeout_ !== undefined) {
      progress.is_timeout_ = dto.is_timeout_;
    }
    if (dto.extra_data_ !== undefined) {
      progress.extra_data_ = { ...progress.extra_data_, ...dto.extra_data_ };
    }

    // 自动计算持续时间
    if (progress.end_time_ && progress.start_time_) {
      progress.actual_duration_ = progress.end_time_.getTime() - progress.start_time_.getTime();
    }

    const saved = await this.progressRepository.save(progress);

    // 根据状态发送不同事件
    if (dto.status_ === ProgressStatus.COMPLETED) {
      await this.emitProgressEvent(ProgressEventType.PROGRESS_COMPLETED, saved);
    } else if (dto.status_ === ProgressStatus.CANCELLED) {
      await this.emitProgressEvent(ProgressEventType.PROGRESS_CANCELLED, saved);
    } else if (dto.is_warning_) {
      await this.emitProgressEvent(ProgressEventType.PROGRESS_WARNING, saved);
    } else if (dto.is_timeout_) {
      await this.emitProgressEvent(ProgressEventType.PROGRESS_TIMEOUT, saved);
    } else {
      await this.emitProgressEvent(ProgressEventType.PROGRESS_UPDATED, saved);
    }

    return saved;
  }

  /**
   * 根据ID获取进度
   */
  async getProgressById(id: string): Promise<Progress | null> {
    return this.progressRepository.findOne({ where: { id_: id } });
  }

  /**
   * 根据流程实例ID获取进度
   */
  async getProgressByProcessInstanceId(processInstanceId: string): Promise<Progress | null> {
    return this.progressRepository.findOne({
      where: { process_inst_id_: processInstanceId, type_: ProgressType.PROCESS_INSTANCE },
    });
  }

  /**
   * 根据任务ID获取进度
   */
  async getProgressByTaskId(taskId: string): Promise<Progress | null> {
    return this.progressRepository.findOne({
      where: { task_id_: taskId, type_: ProgressType.TASK },
    });
  }

  /**
   * 查询进度列表
   */
  async queryProgress(query: ProgressQueryDto): Promise<{ list: Progress[]; total: number }> {
    const queryBuilder = this.progressRepository.createQueryBuilder('p');

    if (query.process_inst_id_) {
      queryBuilder.andWhere('p.process_inst_id_ = :processInstId', {
        processInstId: query.process_inst_id_,
      });
    }
    if (query.task_id_) {
      queryBuilder.andWhere('p.task_id_ = :taskId', { taskId: query.task_id_ });
    }
    if (query.process_def_id_) {
      queryBuilder.andWhere('p.process_def_id_ = :processDefId', {
        processDefId: query.process_def_id_,
      });
    }
    if (query.type_) {
      queryBuilder.andWhere('p.type_ = :type', { type: query.type_ });
    }
    if (query.status_) {
      queryBuilder.andWhere('p.status_ = :status', { status: query.status_ });
    }
    if (query.is_warning_ !== undefined) {
      queryBuilder.andWhere('p.is_warning_ = :isWarning', { isWarning: query.is_warning_ });
    }
    if (query.is_timeout_ !== undefined) {
      queryBuilder.andWhere('p.is_timeout_ = :isTimeout', { isTimeout: query.is_timeout_ });
    }
    if (query.tenant_id_) {
      queryBuilder.andWhere('p.tenant_id_ = :tenantId', { tenantId: query.tenant_id_ });
    }

    queryBuilder.orderBy('p.create_time_', 'DESC');

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();
    return { list, total };
  }

  /**
   * 删除进度
   */
  async deleteProgress(id: string): Promise<void> {
    await this.progressRepository.delete({ id_: id });
  }

  // ==================== 进度计算 ====================

  /**
   * 计算流程实例进度
   * 基于已完成的任务数量和总任务数量
   */
  async calculateProcessProgress(processInstanceId: string): Promise<number> {
    // 获取流程实例的进度记录
    const progress = await this.getProgressByProcessInstanceId(processInstanceId);
    if (!progress) {
      return 0;
    }

    // 如果已完成步骤和总步骤都有值，直接计算
    if (progress.total_steps_ > 0) {
      return Math.round((progress.completed_steps_ / progress.total_steps_) * 100);
    }

    // 否则返回当前百分比
    return progress.percentage_;
  }

  /**
   * 更新流程实例进度
   * 当任务完成时调用
   */
  async updateProcessProgressOnTaskComplete(
    processInstanceId: string,
    taskDefinitionKey: string,
  ): Promise<Progress> {
    const progress = await this.getProgressByProcessInstanceId(processInstanceId);
    if (!progress) {
      // 如果不存在进度记录，创建一个
      return this.createProgress({
        id_: uuidv4().replace(/-/g, ''),
        process_inst_id_: processInstanceId,
        type_: ProgressType.PROCESS_INSTANCE,
        total_steps_: 1,
      });
    }

    // 增加已完成步骤
    const completedSteps = progress.completed_steps_ + 1;
    const totalSteps = progress.total_steps_ || completedSteps;
    const percentage = Math.round((completedSteps / totalSteps) * 100);

    return this.updateProgress(progress.id_, {
      completed_steps_: completedSteps,
      percentage_: Math.min(percentage, 99), // 最大99%，完成时设为100%
      current_step_name_: taskDefinitionKey,
    });
  }

  /**
   * 完成流程实例进度
   */
  async completeProcessProgress(processInstanceId: string): Promise<Progress> {
    const progress = await this.getProgressByProcessInstanceId(processInstanceId);
    if (!progress) {
      throw new Error(`流程实例进度不存在: ${processInstanceId}`);
    }

    return this.updateProgress(progress.id_, {
      status_: ProgressStatus.COMPLETED,
      percentage_: 100,
      end_time_: new Date(),
    });
  }

  // ==================== 统计功能 ====================

  /**
   * 获取进度统计
   */
  async getStatistics(query: ProgressStatisticsQueryDto): Promise<ProgressStatisticsDto> {
    const queryBuilder = this.progressRepository.createQueryBuilder('p');

    // 添加过滤条件
    if (query.process_def_key_) {
      queryBuilder.andWhere('p.process_def_id_ LIKE :processDefKey', {
        processDefKey: `%${query.process_def_key_}%`,
      });
    }
    if (query.process_def_id_) {
      queryBuilder.andWhere('p.process_def_id_ = :processDefId', {
        processDefId: query.process_def_id_,
      });
    }
    if (query.start_time) {
      queryBuilder.andWhere('p.start_time_ >= :startTime', { startTime: query.start_time });
    }
    if (query.end_time) {
      queryBuilder.andWhere('p.start_time_ <= :endTime', { endTime: query.end_time });
    }
    if (query.tenant_id_) {
      queryBuilder.andWhere('p.tenant_id_ = :tenantId', { tenantId: query.tenant_id_ });
    }

    // 只统计流程实例类型
    queryBuilder.andWhere('p.type_ = :type', { type: ProgressType.PROCESS_INSTANCE });

    const progresses = await queryBuilder.getMany();

    // 计算统计数据
    const statistics: ProgressStatisticsDto = {
      total_instances: progresses.length,
      in_progress_instances: progresses.filter((p) => p.status_ === ProgressStatus.IN_PROGRESS)
        .length,
      completed_instances: progresses.filter((p) => p.status_ === ProgressStatus.COMPLETED).length,
      cancelled_instances: progresses.filter((p) => p.status_ === ProgressStatus.CANCELLED).length,
      warning_instances: progresses.filter((p) => p.is_warning_).length,
      timeout_instances: progresses.filter((p) => p.is_timeout_).length,
      avg_percentage: 0,
      avg_duration: 0,
      by_status: {},
      by_process_def: {},
    };

    // 计算平均百分比
    if (progresses.length > 0) {
      const totalPercentage = progresses.reduce((sum, p) => sum + p.percentage_, 0);
      statistics.avg_percentage = Math.round(totalPercentage / progresses.length);
    }

    // 计算平均持续时间（仅已完成的）
    const completedWithDuration = progresses.filter(
      (p) => p.status_ === ProgressStatus.COMPLETED && p.actual_duration_,
    );
    if (completedWithDuration.length > 0) {
      const totalDuration = completedWithDuration.reduce(
        (sum, p) => sum + (p.actual_duration_ || 0),
        0,
      );
      statistics.avg_duration = Math.round(totalDuration / completedWithDuration.length);
    }

    // 按状态分组统计
    statistics.by_status = progresses.reduce(
      (acc, p) => {
        acc[p.status_] = (acc[p.status_] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 按流程定义分组统计
    statistics.by_process_def = progresses.reduce(
      (acc, p) => {
        const key = p.process_def_id_ || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return statistics;
  }

  /**
   * 获取进度看板数据
   */
  async getDashboard(tenantId?: string): Promise<ProgressDashboardDto> {
    const now = new Date();
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 最近24小时

    // 获取概览统计
    const statistics = await this.getStatistics({
      start_time: startTime,
      end_time: now,
      tenant_id_: tenantId,
    });

    // 获取预警列表
    const warnings = await this.progressRepository.find({
      where: {
        is_warning_: true,
        tenant_id_: tenantId || IsNull(),
      },
      order: { warning_time_: 'DESC' },
      take: 10,
    });

    // 获取超时列表
    const timeouts = await this.progressRepository.find({
      where: {
        is_timeout_: true,
        tenant_id_: tenantId || IsNull(),
      },
      order: { create_time_: 'DESC' },
      take: 10,
    });

    // 获取趋势数据（按小时分组）
    const trendData = await this.getTrendData(startTime, now, tenantId);

    // 获取按流程定义分布
    const processDefDistribution = await this.getProcessDefDistribution(tenantId);

    return {
      time_range: {
        start: startTime,
        end: now,
      },
      overview: {
        total: statistics.total_instances,
        in_progress: statistics.in_progress_instances,
        completed: statistics.completed_instances,
        warning: statistics.warning_instances,
        timeout: statistics.timeout_instances,
      },
      trend: trendData,
      by_process_def: processDefDistribution,
      warnings: warnings.map((w) => ({
        id: w.id_,
        process_inst_id: w.process_inst_id_ || '',
        name: w.name_ || '',
        warning_message: w.warning_message_ || '',
        warning_time: w.warning_time_ || w.create_time_,
      })),
      timeouts: timeouts.map((t) => ({
        id: t.id_,
        process_inst_id: t.process_inst_id_ || '',
        name: t.name_ || '',
        timeout_time: t.create_time_,
      })),
    };
  }

  /**
   * 获取趋势数据
   */
  private async getTrendData(
    startTime: Date,
    endTime: Date,
    tenantId?: string,
  ): Promise<{ time: string; total: number; completed: number }[]> {
    const queryBuilder = this.progressRepository
      .createQueryBuilder('p')
      .select([
        "DATE_FORMAT(p.create_time_, '%Y-%m-%d %H:00') as time",
        'COUNT(*) as total',
        "SUM(CASE WHEN p.status_ = 'COMPLETED' THEN 1 ELSE 0 END) as completed",
      ])
      .where('p.create_time_ >= :startTime', { startTime })
      .andWhere('p.create_time_ <= :endTime', { endTime })
      .andWhere('p.type_ = :type', { type: ProgressType.PROCESS_INSTANCE });

    if (tenantId) {
      queryBuilder.andWhere('p.tenant_id_ = :tenantId', { tenantId });
    }

    queryBuilder.groupBy("DATE_FORMAT(p.create_time_, '%Y-%m-%d %H:00')");
    queryBuilder.orderBy('time', 'ASC');

    const result = await queryBuilder.getRawMany();
    return result.map((r) => ({
      time: r.time,
      total: parseInt(r.total, 10),
      completed: parseInt(r.completed, 10),
    }));
  }

  /**
   * 获取流程定义分布
   */
  private async getProcessDefDistribution(
    tenantId?: string,
  ): Promise<{ process_def_key: string; process_def_name: string; count: number; percentage: number }[]> {
    const queryBuilder = this.progressRepository
      .createQueryBuilder('p')
      .select(['p.process_def_id_ as process_def_key', 'COUNT(*) as count'])
      .where('p.type_ = :type', { type: ProgressType.PROCESS_INSTANCE });

    if (tenantId) {
      queryBuilder.andWhere('p.tenant_id_ = :tenantId', { tenantId });
    }

    queryBuilder.groupBy('p.process_def_id_');
    queryBuilder.orderBy('count', 'DESC');
    queryBuilder.limit(10);

    const result = await queryBuilder.getRawMany();
    const total = result.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

    return result.map((r) => ({
      process_def_key: r.process_def_key || 'unknown',
      process_def_name: r.process_def_key || 'unknown',
      count: parseInt(r.count, 10),
      percentage: total > 0 ? Math.round((parseInt(r.count, 10) / total) * 100) : 0,
    }));
  }

  // ==================== 预警功能 ====================

  /**
   * 启动预警检查
   */
  private startWarningCheck() {
    this.warningTimer = setInterval(async () => {
      try {
        await this.checkWarnings();
      } catch (error) {
        this.logger.error('预警检查失败', error);
      }
    }, this.warningCheckInterval);
  }

  /**
   * 启动超时检查
   */
  private startTimeoutCheck() {
    this.timeoutTimer = setInterval(async () => {
      try {
        await this.checkTimeouts();
      } catch (error) {
        this.logger.error('超时检查失败', error);
      }
    }, this.timeoutCheckInterval);
  }

  /**
   * 检查预警
   * 检查进度低于阈值且预计超时的记录
   */
  private async checkWarnings() {
    // 查找进行中且未预警的记录
    const progresses = await this.progressRepository.find({
      where: {
        status_: ProgressStatus.IN_PROGRESS,
        is_warning_: false,
        is_timeout_: false,
      },
    });

    const now = new Date();

    for (const progress of progresses) {
      // 检查是否需要预警
      let isWarning = false;
      let warningMessage = '';

      // 检查预计超时
      if (progress.estimated_end_time_ && progress.estimated_end_time_ < now) {
        isWarning = true;
        warningMessage = '流程预计已超时';
      }

      // 检查进度滞后（进度低于时间进度）
      if (progress.estimated_duration_ && progress.start_time_) {
        const elapsedTime = now.getTime() - progress.start_time_.getTime();
        const expectedPercentage = Math.min(
          100,
          Math.round((elapsedTime / progress.estimated_duration_) * 100),
        );
        if (progress.percentage_ < expectedPercentage - this.warningThreshold) {
          isWarning = true;
          warningMessage = `进度滞后，当前${progress.percentage_}%，预期${expectedPercentage}%`;
        }
      }

      if (isWarning) {
        await this.updateProgress(progress.id_, {
          is_warning_: true,
          warning_message_: warningMessage,
        });
        this.logger.warn(`进度预警: ${progress.id_} - ${warningMessage}`);
      }
    }
  }

  /**
   * 检查超时
   * 检查已超过预计结束时间的记录
   */
  private async checkTimeouts() {
    const now = new Date();

    // 查找已超时但未标记的记录
    const progresses = await this.progressRepository
      .createQueryBuilder('p')
      .where('p.status_ = :status', { status: ProgressStatus.IN_PROGRESS })
      .andWhere('p.is_timeout_ = :isTimeout', { isTimeout: false })
      .andWhere('p.estimated_end_time_ < :now', { now })
      .getMany();

    for (const progress of progresses) {
      await this.updateProgress(progress.id_, {
        is_timeout_: true,
        is_warning_: true,
        warning_message_: '流程已超时',
      });
      this.logger.warn(`进度超时: ${progress.id_}`);
    }
  }

  // ==================== 事件监听 ====================

  /**
   * 监听流程实例启动事件
   */
  @OnEvent('process.instance.started')
  async handleProcessInstanceStarted(event: ProcessInstanceEvent) {
    this.logger.debug(`收到流程实例启动事件: ${event.processInstanceId}`);
    
    // 创建进度记录
    await this.createProgress({
      id_: `progress_${event.processInstanceId}`,
      process_inst_id_: event.processInstanceId,
      process_def_id_: event.processDefinitionId,
      type_: ProgressType.PROCESS_INSTANCE,
      name_: `流程实例 ${event.processInstanceId}`,
    });
  }

  /**
   * 监听流程实例完成事件
   */
  @OnEvent('process.instance.completed')
  async handleProcessInstanceCompleted(event: ProcessInstanceEvent) {
    this.logger.debug(`收到流程实例完成事件: ${event.processInstanceId}`);
    
    // 完成进度记录
    try {
      await this.completeProcessProgress(event.processInstanceId);
    } catch (error) {
      this.logger.warn(`完成进度记录失败: ${event.processInstanceId}`, error);
    }
  }

  /**
   * 监听流程实例取消事件
   */
  @OnEvent('process.instance.cancelled')
  async handleProcessInstanceCancelled(event: ProcessInstanceEvent) {
    this.logger.debug(`收到流程实例取消事件: ${event.processInstanceId}`);
    
    // 取消进度记录
    const progress = await this.getProgressByProcessInstanceId(event.processInstanceId);
    if (progress) {
      await this.updateProgress(progress.id_, {
        status_: ProgressStatus.CANCELLED,
        end_time_: new Date(),
      });
    }
  }

  /**
   * 监听任务完成事件
   */
  @OnEvent('task.completed')
  async handleTaskCompleted(event: TaskEvent) {
    this.logger.debug(`收到任务完成事件: ${event.taskId}`);
    
    // 更新流程进度
    if (event.processInstanceId) {
      try {
        await this.updateProcessProgressOnTaskComplete(
          event.processInstanceId,
          event.taskDefinitionKey,
        );
      } catch (error) {
        this.logger.warn(`更新流程进度失败: ${event.processInstanceId}`, error);
      }
    }
  }

  // ==================== 指标管理 ====================

  /**
   * 记录指标
   */
  async recordMetric(dto: CreateProgressMetricDto): Promise<ProgressMetric> {
    const metric = this.metricRepository.create({
      id_: dto.id_,
      name_: dto.name_,
      description_: dto.description_,
      type_: dto.type_ || MetricType.GAUGE,
      category_: dto.category_ || MetricCategory.PROCESS,
      value_: dto.value_,
      unit_: dto.unit_,
      process_inst_id_: dto.process_inst_id_,
      task_id_: dto.task_id_,
      process_def_key_: dto.process_def_key_,
      progress_id_: dto.progress_id_,
      labels_: dto.labels_,
      collect_time_: dto.collect_time_ || new Date(),
      expire_time_: dto.expire_time_,
      tenant_id_: dto.tenant_id_,
    });

    return this.metricRepository.save(metric);
  }

  /**
   * 查询指标
   */
  async queryMetrics(query: ProgressMetricQueryDto): Promise<{ list: ProgressMetric[]; total: number }> {
    const queryBuilder = this.metricRepository.createQueryBuilder('m');

    if (query.name_) {
      queryBuilder.andWhere('m.name_ = :name', { name: query.name_ });
    }
    if (query.category_) {
      queryBuilder.andWhere('m.category_ = :category', { category: query.category_ });
    }
    if (query.process_inst_id_) {
      queryBuilder.andWhere('m.process_inst_id_ = :processInstId', {
        processInstId: query.process_inst_id_,
      });
    }
    if (query.process_def_key_) {
      queryBuilder.andWhere('m.process_def_key_ = :processDefKey', {
        processDefKey: query.process_def_key_,
      });
    }
    if (query.start_time) {
      queryBuilder.andWhere('m.collect_time_ >= :startTime', { startTime: query.start_time });
    }
    if (query.end_time) {
      queryBuilder.andWhere('m.collect_time_ <= :endTime', { endTime: query.end_time });
    }

    queryBuilder.orderBy('m.collect_time_', 'DESC');

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();
    return { list, total };
  }

  /**
   * 获取Prometheus格式的指标
   */
  async getPrometheusMetrics(): Promise<string> {
    const metrics = await this.metricRepository
      .createQueryBuilder('m')
      .where('m.collect_time_ >= :startTime', {
        startTime: new Date(Date.now() - 60 * 60 * 1000), // 最近1小时
      })
      .getMany();

    // 按名称分组
    const groupedMetrics = metrics.reduce(
      (acc, m) => {
        if (!acc[m.name_]) {
          acc[m.name_] = [];
        }
        acc[m.name_].push(m);
        return acc;
      },
      {} as Record<string, ProgressMetric[]>,
    );

    // 生成Prometheus格式输出
    const lines: string[] = [];
    for (const [name, metricList] of Object.entries(groupedMetrics)) {
      const firstMetric = metricList[0];
      lines.push(`# HELP ${name} ${firstMetric.description_ || name}`);
      lines.push(`# TYPE ${name} ${firstMetric.type_.toLowerCase()}`);

      for (const metric of metricList) {
        const labels = metric.labels_ || {};
        const labelStr = Object.entries(labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        const labelPart = labelStr ? `{${labelStr}}` : '';
        lines.push(`${name}${labelPart} ${metric.value_}`);
      }
    }

    return lines.join('\n');
  }

  // ==================== 辅助方法 ====================

  /**
   * 发送进度事件
   */
  private async emitProgressEvent(eventType: ProgressEventType, progress: Progress): Promise<void> {
    const event: ProgressEvent = {
      progressId: progress.id_,
      type: eventType,
      data: progress,
      timestamp: new Date(),
    };

    this.eventEmitter.emit(eventType, event);
    
    // 同时发送通用进度事件
    this.eventEmitter.emit('progress.changed', event);
  }

  /**
   * 清理过期指标
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredMetrics(): Promise<void> {
    const now = new Date();
    const result = await this.metricRepository
      .createQueryBuilder()
      .delete()
      .where('expire_time_ IS NOT NULL AND expire_time_ < :now', { now })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`清理了 ${result.affected} 条过期指标`);
    }
  }
}
