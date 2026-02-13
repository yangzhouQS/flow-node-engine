import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';

import { TimerJob, TimerType, TimerJobStatus } from '../entities/timer-job.entity';
import { JobService } from './job.service';

/**
 * 创建定时器选项
 */
export interface CreateTimerOptions {
  /** 定时器类型 */
  timerType: TimerType;
  /** 定时器表达式（ISO 8601日期时间、持续时间或CRON表达式） */
  timerExpression: string;
  /** 关联的流程实例ID */
  processInstanceId?: string;
  /** 关联的执行ID */
  executionId?: string;
  /** 关联的流程定义ID */
  processDefinitionId?: string;
  /** 关联的流程定义Key */
  processDefinitionKey?: string;
  /** 关联的活动ID */
  activityId?: string;
  /** 关联的活动名称 */
  activityName?: string;
  /** 元素类型 */
  elementType?: string;
  /** 最大执行次数 */
  maxExecutions?: number;
  /** 是否重复执行 */
  repeat?: boolean;
  /** 重复间隔（毫秒） */
  repeatInterval?: number;
  /** 结束时间 */
  endTime?: Date;
  /** 回调配置 */
  callbackConfig?: Record<string, any>;
  /** 作业载荷 */
  payload?: Record<string, any>;
  /** 租户ID */
  tenantId?: string;
  /** 扩展数据 */
  extraData?: Record<string, any>;
}

/**
 * 定时器回调参数
 */
export interface TimerCallbackArgs {
  timerJob: TimerJob;
  processInstanceId?: string;
  executionId?: string;
  activityId?: string;
  payload?: Record<string, any>;
}

/**
 * 定时器服务
 * 负责定时器的创建、调度、执行和取消
 */
@Injectable()
export class TimerService {
  private readonly logger = new Logger(TimerService.name);
  private readonly callbacks: Map<string, (args: TimerCallbackArgs) => Promise<void>> = new Map();

  constructor(
    @InjectRepository(TimerJob)
    private readonly timerJobRepository: Repository<TimerJob>,
    private readonly dataSource: DataSource,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly jobService: JobService,
  ) {}

  /**
   * 注册定时器回调
   * @param callbackType 回调类型
   * @param callback 回调函数
   */
  registerCallback(
    callbackType: string,
    callback: (args: TimerCallbackArgs) => Promise<void>,
  ): void {
    this.callbacks.set(callbackType, callback);
    this.logger.log(`注册定时器回调: ${callbackType}`);
  }

  /**
   * 创建定时器
   * @param options 定时器选项
   */
  async createTimer(options: CreateTimerOptions): Promise<TimerJob> {
    const timerJob = new TimerJob();
    timerJob.id_ = uuidv4();
    timerJob.timer_type_ = options.timerType;
    timerJob.timer_expression_ = options.timerExpression;
    timerJob.process_inst_id_ = options.processInstanceId || null;
    timerJob.execution_id_ = options.executionId || null;
    timerJob.process_def_id_ = options.processDefinitionId || null;
    timerJob.process_def_key_ = options.processDefinitionKey || null;
    timerJob.activity_id_ = options.activityId || null;
    timerJob.activity_name_ = options.activityName || null;
    timerJob.element_type_ = options.elementType || null;
    timerJob.max_executions_ = options.maxExecutions || null;
    timerJob.repeat_ = options.repeat || false;
    timerJob.repeat_interval_ = options.repeatInterval || null;
    timerJob.end_time_ = options.endTime || null;
    timerJob.callback_config_ = options.callbackConfig ? JSON.stringify(options.callbackConfig) : null;
    timerJob.payload_ = options.payload ? JSON.stringify(options.payload) : null;
    timerJob.tenant_id_ = options.tenantId || null;
    timerJob.extra_data_ = options.extraData || null;
    timerJob.status_ = TimerJobStatus.PENDING;
    timerJob.execution_count_ = 0;
    timerJob.retry_count_ = 0;
    timerJob.max_retries_ = 3;

    // 计算到期时间
    timerJob.due_date_ = this.calculateDueDate(options.timerType, options.timerExpression);

    // 如果是循环定时器，设置下次执行时间
    if (options.repeat && timerJob.due_date_) {
      timerJob.next_execution_time_ = timerJob.due_date_;
    }

    const savedJob = await this.timerJobRepository.save(timerJob);
    this.logger.debug(`创建定时器: ${savedJob.id_}, 到期时间: ${savedJob.due_date_}`);

    // 动态添加定时任务
    await this.scheduleTimer(savedJob);

    return savedJob;
  }

  /**
   * 取消定时器
   * @param timerId 定时器ID
   */
  async cancelTimer(timerId: string): Promise<boolean> {
    const timerJob = await this.timerJobRepository.findOne({
      where: { id_: timerId },
    });

    if (!timerJob) {
      return false;
    }

    // 更新状态为已取消
    timerJob.status_ = TimerJobStatus.CANCELLED;
    await this.timerJobRepository.save(timerJob);

    // 移除调度器中的任务
    try {
      const jobName = this.getJobName(timerJob.id_);
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
      }
      if (this.schedulerRegistry.doesExist('timeout', jobName)) {
        this.schedulerRegistry.deleteTimeout(jobName);
      }
      if (this.schedulerRegistry.doesExist('interval', jobName)) {
        this.schedulerRegistry.deleteInterval(jobName);
      }
    } catch (e) {
      // 任务可能不存在，忽略错误
    }

    this.logger.debug(`取消定时器: ${timerId}`);
    return true;
  }

  /**
   * 取消流程实例的所有定时器
   * @param processInstanceId 流程实例ID
   */
  async cancelTimersByProcessInstance(processInstanceId: string): Promise<number> {
    const timerJobs = await this.timerJobRepository.find({
      where: {
        process_inst_id_: processInstanceId,
        status_: TimerJobStatus.PENDING,
      },
    });

    let count = 0;
    for (const job of timerJobs) {
      const cancelled = await this.cancelTimer(job.id_);
      if (cancelled) {
        count++;
      }
    }

    this.logger.debug(`取消流程实例 ${processInstanceId} 的 ${count} 个定时器`);
    return count;
  }

  /**
   * 取消执行的所有定时器
   * @param executionId 执行ID
   */
  async cancelTimersByExecution(executionId: string): Promise<number> {
    const timerJobs = await this.timerJobRepository.find({
      where: {
        execution_id_: executionId,
        status_: TimerJobStatus.PENDING,
      },
    });

    let count = 0;
    for (const job of timerJobs) {
      const cancelled = await this.cancelTimer(job.id_);
      if (cancelled) {
        count++;
      }
    }

    this.logger.debug(`取消执行 ${executionId} 的 ${count} 个定时器`);
    return count;
  }

  /**
   * 获取定时器
   * @param timerId 定时器ID
   */
  async getTimer(timerId: string): Promise<TimerJob | null> {
    return this.timerJobRepository.findOne({
      where: { id_: timerId },
    });
  }

  /**
   * 获取流程实例的定时器列表
   * @param processInstanceId 流程实例ID
   */
  async getTimersByProcessInstance(processInstanceId: string): Promise<TimerJob[]> {
    return this.timerJobRepository.find({
      where: { process_inst_id_: processInstanceId },
      order: { due_date_: 'ASC' },
    });
  }

  /**
   * 获取待执行的定时器
   * @param limit 限制数量
   */
  async getPendingTimers(limit = 100): Promise<TimerJob[]> {
    const now = new Date();
    return this.timerJobRepository.find({
      where: {
        status_: TimerJobStatus.PENDING,
        due_date_: LessThanOrEqual(now),
      },
      take: limit,
      order: { due_date_: 'ASC' },
    });
  }

  /**
   * 定时检查并执行到期的定时器
   * 每5秒执行一次
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async executeDueTimers(): Promise<void> {
    const now = new Date();
    
    // 查找到期且未锁定的定时器
    const dueTimers = await this.timerJobRepository
      .createQueryBuilder('timer')
      .where('timer.status_ = :status', { status: TimerJobStatus.PENDING })
      .andWhere('timer.due_date_ <= :now', { now })
      .andWhere('(timer.locked_by_ IS NULL OR timer.locked_until_ < :now)', { now })
      .take(50)
      .getMany();

    for (const timer of dueTimers) {
      try {
        await this.executeTimer(timer);
      } catch (error) {
        this.logger.error(`执行定时器 ${timer.id_} 失败:`, error);
      }
    }
  }

  /**
   * 执行定时器
   * @param timerJob 定时器作业
   */
  async executeTimer(timerJob: TimerJob): Promise<void> {
    const lockId = `executor-${process.pid}-${Date.now()}`;
    const lockTimeout = new Date(Date.now() + 60000); // 1分钟锁定超时

    // 尝试获取锁
    const lockAcquired = await this.acquireLock(timerJob.id_, lockId, lockTimeout);
    if (!lockAcquired) {
      this.logger.debug(`定时器 ${timerJob.id_} 已被其他执行器锁定`);
      return;
    }

    try {
      this.logger.debug(`执行定时器: ${timerJob.id_}`);

      // 解析回调配置
      let callbackConfig: Record<string, any> = {};
      if (timerJob.callback_config_) {
        try {
          callbackConfig = JSON.parse(timerJob.callback_config_);
        } catch (e) {
          this.logger.warn(`解析回调配置失败: ${timerJob.callback_config_}`);
        }
      }

      // 解析载荷
      let payload: Record<string, any> = {};
      if (timerJob.payload_) {
        try {
          payload = JSON.parse(timerJob.payload_);
        } catch (e) {
          this.logger.warn(`解析载荷失败: ${timerJob.payload_}`);
        }
      }

      // 执行回调
      const callbackType = callbackConfig.type || 'default';
      const callback = this.callbacks.get(callbackType);

      if (callback) {
        await callback({
          timerJob,
          processInstanceId: timerJob.process_inst_id_ || undefined,
          executionId: timerJob.execution_id_ || undefined,
          activityId: timerJob.activity_id_ || undefined,
          payload,
        });
      } else {
        this.logger.warn(`未找到定时器回调类型: ${callbackType}`);
      }

      // 更新执行状态
      if (timerJob.repeat_ && (!timerJob.max_executions_ || timerJob.execution_count_ < timerJob.max_executions_)) {
        // 重复定时器
        timerJob.execution_count_ += 1;
        timerJob.due_date_ = this.calculateNextDueDate(timerJob);
        timerJob.next_execution_time_ = timerJob.due_date_;
        timerJob.locked_by_ = null;
        timerJob.locked_until_ = null;

        // 检查是否达到结束时间
        if (timerJob.end_time_ && timerJob.due_date_ > timerJob.end_time_) {
          timerJob.status_ = TimerJobStatus.EXECUTED;
          timerJob.executed_time_ = new Date();
        }
      } else {
        // 单次定时器
        timerJob.status_ = TimerJobStatus.EXECUTED;
        timerJob.executed_time_ = new Date();
        timerJob.execution_count_ += 1;
      }

      await this.timerJobRepository.save(timerJob);
    } catch (error) {
      // 执行失败，更新状态
      timerJob.retry_count_ += 1;
      timerJob.locked_by_ = null;
      timerJob.locked_until_ = null;

      if (timerJob.retry_count_ >= timerJob.max_retries_) {
        timerJob.status_ = TimerJobStatus.FAILED;
        timerJob.exception_message_ = error?.message || 'Unknown error';
      } else {
        // 重试：延迟执行
        timerJob.due_date_ = new Date(Date.now() + Math.pow(2, timerJob.retry_count_) * 1000);
      }

      await this.timerJobRepository.save(timerJob);
      throw error;
    } finally {
      // 释放锁
      await this.releaseLock(timerJob.id_);
    }
  }

  /**
   * 获取锁定
   */
  private async acquireLock(timerId: string, lockId: string, lockUntil: Date): Promise<boolean> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(TimerJob)
      .set({
        locked_by_: lockId,
        locked_until_: lockUntil,
      })
      .where('id_ = :id', { id: timerId })
      .andWhere('(locked_by_ IS NULL OR locked_until_ < :now)', { now: new Date() })
      .execute();

    return result.affected === 1;
  }

  /**
   * 释放锁定
   */
  private async releaseLock(timerId: string): Promise<void> {
    await this.dataSource
      .createQueryBuilder()
      .update(TimerJob)
      .set({
        locked_by_: null,
        locked_until_: null,
      })
      .where('id_ = :id', { id: timerId })
      .execute();
  }

  /**
   * 计算到期时间
   */
  private calculateDueDate(timerType: TimerType, expression: string): Date {
    const now = new Date();

    switch (timerType) {
      case TimerType.DATE:
        // ISO 8601 日期时间格式
        return new Date(expression);

      case TimerType.DURATION:
        // ISO 8601 持续时间格式（如 PT5M 表示5分钟）
        return this.parseDuration(expression, now);

      case TimerType.CYCLE:
        // CRON 表达式或循环表达式
        return this.parseCron(expression, now);

      default:
        throw new Error(`不支持的定时器类型: ${timerType}`);
    }
  }

  /**
   * 计算下次执行时间
   */
  private calculateNextDueDate(timerJob: TimerJob): Date {
    if (timerJob.repeat_interval_) {
      return new Date(Date.now() + timerJob.repeat_interval_);
    }

    if (timerJob.timer_type_ === TimerType.CYCLE) {
      return this.parseCron(timerJob.timer_expression_, new Date());
    }

    // 默认：基于当前时间加上间隔
    const interval = timerJob.due_date_.getTime() - timerJob.create_time_.getTime();
    return new Date(Date.now() + interval);
  }

  /**
   * 解析ISO 8601持续时间
   */
  private parseDuration(expression: string, baseDate: Date): Date {
    // 简化解析：支持 PTnS, PTnM, PTnH, PnD 格式
    const regex = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
    const match = expression.match(regex);

    if (!match) {
      throw new Error(`无效的持续时间表达式: ${expression}`);
    }

    const days = parseInt(match[1] || '0', 10);
    const hours = parseInt(match[2] || '0', 10);
    const minutes = parseInt(match[3] || '0', 10);
    const seconds = parseInt(match[4] || '0', 10);

    const durationMs = ((days * 24 + hours) * 60 + minutes) * 60 * 1000 + seconds * 1000;
    return new Date(baseDate.getTime() + durationMs);
  }

  /**
   * 解析CRON表达式
   */
  private parseCron(expression: string, baseDate: Date): Date {
    // 简化实现：使用cron-parser库（需要安装）
    // 这里返回一个简单的延迟时间
    // 实际实现应使用 cron-parser 或类似库
    if (expression.startsWith('R/')) {
      // 重复表达式 R/PT5M 表示每5分钟重复
      const durationExpr = expression.substring(2);
      return this.parseDuration(durationExpr, baseDate);
    }

    // 默认：5分钟后
    return new Date(baseDate.getTime() + 5 * 60 * 1000);
  }

  /**
   * 调度定时器
   */
  private async scheduleTimer(timerJob: TimerJob): Promise<void> {
    if (timerJob.status_ !== TimerJobStatus.PENDING) {
      return;
    }

    const jobName = this.getJobName(timerJob.id_);
    const delay = Math.max(0, timerJob.due_date_.getTime() - Date.now());

    if (delay <= 0) {
      // 立即执行
      await this.executeTimer(timerJob);
      return;
    }

    // 使用setTimeout调度
    const timeout = setTimeout(async () => {
      try {
        await this.executeTimer(timerJob);
      } catch (error) {
        this.logger.error(`定时执行失败: ${timerJob.id_}`, error);
      }
    }, delay);

    this.schedulerRegistry.addTimeout(jobName, timeout);
  }

  /**
   * 获取任务名称
   */
  private getJobName(timerId: string): string {
    return `timer_${timerId}`;
  }

  /**
   * 清理过期定时器
   * 每小时执行一次
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredTimers(): Promise<number> {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7天前

    const result = await this.timerJobRepository
      .createQueryBuilder()
      .delete()
      .where('status_ IN (:...statuses)', { statuses: [TimerJobStatus.EXECUTED, TimerJobStatus.CANCELLED] })
      .andWhere('executed_time_ < :cutoff', { cutoff: cutoffDate })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`清理了 ${result.affected} 个过期定时器`);
    }

    return result.affected || 0;
  }

  /**
   * 获取定时器统计信息
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    executed: number;
    failed: number;
    cancelled: number;
  }> {
    const [total, pending, executed, failed, cancelled] = await Promise.all([
      this.timerJobRepository.count(),
      this.timerJobRepository.count({ where: { status_: TimerJobStatus.PENDING } }),
      this.timerJobRepository.count({ where: { status_: TimerJobStatus.EXECUTED } }),
      this.timerJobRepository.count({ where: { status_: TimerJobStatus.FAILED } }),
      this.timerJobRepository.count({ where: { status_: TimerJobStatus.CANCELLED } }),
    ]);

    return { total, pending, executed, failed, cancelled };
  }
}
