import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { DeadLetterJob } from '../entities/dead-letter-job.entity';
import { Job, JobType, JobStatus } from '../entities/job.entity';

import { JobService, JobEvent, JobEventType } from './job.service';

/**
 * 异步执行器配置
 */
export interface AsyncExecutorConfig {
  /** 是否启用异步执行 */
  enabled: boolean;
  /** 并发执行的最大作业数 */
  maxConcurrentJobs: number;
  /** 作业获取的批量大小 */
  acquireBatchSize: number;
  /** 锁定超时时间（毫秒） */
  lockTimeout: number;
  /** 执行间隔（毫秒） */
  executionInterval: number;
  /** 重试次数 */
  maxRetries: number;
  /** 重试等待时间（毫秒） */
  retryWaitTime: number;
  /** 是否启用优雅关闭 */
  gracefulShutdown: boolean;
  /** 关闭超时时间（毫秒） */
  shutdownTimeout: number;
}

/**
 * 作业执行器接口
 */
export interface JobExecutor {
  /** 执行器类型 */
  type: JobType;
  /** 执行作业 */
  execute(job: Job): Promise<void>;
}

/**
 * 异步执行器服务
 * 负责异步作业的调度和执行
 */
@Injectable()
export class AsyncExecutorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AsyncExecutorService.name);
  private readonly executors: Map<JobType, JobExecutor> = new Map();
  private readonly activeJobs: Set<string> = new Set();
  private isRunning = false;
  private executionTimer?: NodeJS.Timeout;
  private shutdownPromise?: Promise<void>;
  private resolveShutdown?: () => void;

  private readonly config: AsyncExecutorConfig = {
    enabled: true,
    maxConcurrentJobs: 10,
    acquireBatchSize: 5,
    lockTimeout: 300000, // 5分钟
    executionInterval: 1000, // 1秒
    maxRetries: 3,
    retryWaitTime: 1000,
    gracefulShutdown: true,
    shutdownTimeout: 30000,
  };

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(DeadLetterJob)
    private readonly deadLetterJobRepository: Repository<DeadLetterJob>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
    private readonly jobService: JobService,
  ) {}

  /**
   * 模块初始化时启动执行器
   */
  async onModuleInit(): Promise<void> {
    if (this.config.enabled) {
      await this.start();
    }
  }

  /**
   * 模块销毁时停止执行器
   */
  async onModuleDestroy(): Promise<void> {
    await this.stop();
  }

  /**
   * 注册作业执行器
   * @param executor 作业执行器
   */
  registerExecutor(executor: JobExecutor): void {
    this.executors.set(executor.type, executor);
    this.logger.log(`注册作业执行器: ${executor.type}`);
  }

  /**
   * 启动异步执行器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('异步执行器已在运行中');
      return;
    }

    this.isRunning = true;
    this.logger.log('启动异步执行器');

    // 开始执行循环
    this.scheduleNextExecution();
  }

  /**
   * 停止异步执行器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.logger.log('停止异步执行器');

    // 清除定时器
    if (this.executionTimer) {
      clearTimeout(this.executionTimer);
      this.executionTimer = undefined;
    }

    // 等待活动作业完成
    if (this.config.gracefulShutdown && this.activeJobs.size > 0) {
      this.logger.log(`等待 ${this.activeJobs.size} 个活动作业完成...`);
      
      this.shutdownPromise = new Promise((resolve) => {
        this.resolveShutdown = resolve;
      });

      // 设置超时
      const timeout = setTimeout(() => {
        this.logger.warn('关闭超时，强制停止');
        this.resolveShutdown?.();
      }, this.config.shutdownTimeout);

      await this.shutdownPromise;
      clearTimeout(timeout);
    }

    this.logger.log('异步执行器已停止');
  }

  /**
   * 获取执行器状态
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    config: AsyncExecutorConfig;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs.size,
      config: this.config,
    };
  }

  /**
   * 调度下一次执行
   */
  private scheduleNextExecution(): void {
    if (!this.isRunning) {
      return;
    }

    this.executionTimer = setTimeout(() => {
      this.executeJobs().finally(() => {
        this.scheduleNextExecution();
      });
    }, this.config.executionInterval);
  }

  /**
   * 执行作业
   */
  private async executeJobs(): Promise<void> {
    // 检查并发限制
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      return;
    }

    try {
      // 获取可执行的作业
      const jobs = await this.acquireJobs();
      
      for (const job of jobs) {
        if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
          break;
        }

        // 异步执行作业
        this.executeJobAsync(job).catch((error) => {
          this.logger.error(`作业 ${job.id_} 执行失败:`, error);
        });
      }
    } catch (error) {
      this.logger.error('获取作业失败:', error);
    }
  }

  /**
   * 获取可执行的作业
   */
  private async acquireJobs(): Promise<Job[]> {
    const now = new Date();
    const lockOwner = `executor-${process.pid}-${uuidv4()}`;

    // 查找可执行的作业
    const jobs = await this.jobRepository
      .createQueryBuilder('job')
      .where('job.status_ = :status', { status: JobStatus.PENDING })
      .andWhere('job.due_date_ <= :now', { now })
      .andWhere('(job.lock_owner_ IS NULL OR job.lock_until_ < :now)', { now })
      .orderBy('job.create_time_', 'ASC')
      .take(this.config.acquireBatchSize)
      .getMany();

    // 锁定作业
    const lockedJobs: Job[] = [];
    for (const job of jobs) {
      const locked = await this.lockJob(job.id_, lockOwner);
      if (locked) {
        job.locked_by_ = lockOwner;
        job.locked_until_ = new Date(Date.now() + this.config.lockTimeout);
        lockedJobs.push(job);
      }
    }

    return lockedJobs;
  }

  /**
   * 锁定作业
   */
  private async lockJob(jobId: string, lockOwner: string): Promise<boolean> {
    const result = await this.dataSource
      .createQueryBuilder()
      .update(Job)
      .set({
        locked_by_: lockOwner,
        locked_until_: new Date(Date.now() + this.config.lockTimeout),
      })
      .where('id_ = :id', { id: jobId })
      .andWhere('(locked_by_ IS NULL OR locked_until_ < :now)', { now: new Date() })
      .execute();

    return result.affected === 1;
  }

  /**
   * 异步执行作业
   */
  private async executeJobAsync(job: Job): Promise<void> {
    this.activeJobs.add(job.id_);

    try {
      await this.executeJob(job);
    } finally {
      this.activeJobs.delete(job.id_);

      // 检查是否需要完成关闭
      if (!this.isRunning && this.activeJobs.size === 0 && this.resolveShutdown) {
        this.resolveShutdown();
      }
    }
  }

  /**
   * 执行单个作业
   */
  private async executeJob(job: Job): Promise<void> {
    const startTime = Date.now();
    this.logger.debug(`开始执行作业: ${job.id_}, 类型: ${job.type_}`);

    try {
      // 发送作业开始事件
      await this.emitJobEvent(JobEventType.EXECUTION_STARTED, job);

      // 获取执行器
      const executor = this.executors.get(job.type_ as JobType);
      if (!executor) {
        throw new Error(`未找到作业类型 ${job.type_} 的执行器`);
      }

      // 执行作业
      await executor.execute(job);

      // 更新作业状态为已完成
      job.status_ = JobStatus.COMPLETED;
      job.end_time_ = new Date();
      job.duration_ = Date.now() - startTime;
      await this.jobRepository.save(job);

      // 发送作业完成事件
      await this.emitJobEvent(JobEventType.EXECUTION_COMPLETED, job);

      this.logger.debug(`作业执行完成: ${job.id_}, 耗时: ${job.duration_}ms`);
    } catch (error) {
      await this.handleJobFailure(job, error);
    }
  }

  /**
   * 处理作业失败
   */
  private async handleJobFailure(job: Job, error: any): Promise<void> {
    this.logger.error(`作业 ${job.id_} 执行失败:`, error);

    job.retry_count_ = (job.retry_count_ || 0) + 1;
    job.exception_message_ = error?.message || 'Unknown error';
    job.exception_stack_trace_ = error?.stack || null;

    // 检查是否需要重试
    if (job.retry_count_ < (job.max_retries_ || this.config.maxRetries)) {
      // 设置重试时间
      const retryDelay = Math.pow(2, job.retry_count_) * this.config.retryWaitTime;
      job.due_date_ = new Date(Date.now() + retryDelay);
      job.status_ = JobStatus.PENDING;
      job.locked_by_ = null;
      job.locked_until_ = null;

      await this.jobRepository.save(job);

      // 发送重试事件
      await this.emitJobEvent(JobEventType.EXECUTION_FAILED, job, error);

      this.logger.debug(`作业 ${job.id_} 将在 ${retryDelay}ms 后重试 (第 ${job.retry_count_} 次)`);
    } else {
      // 超过最大重试次数，移到死信队列
      await this.moveToDeadLetter(job, error);
    }
  }

  /**
   * 移动作业到死信队列
   */
  private async moveToDeadLetter(job: Job, error: any): Promise<void> {
    // 创建死信作业
    const deadLetterJob = new DeadLetterJob();
    deadLetterJob.id_ = job.id_;
    deadLetterJob.type_ = job.type_;
    deadLetterJob.process_inst_id_ = job.process_inst_id_;
    deadLetterJob.execution_id_ = job.execution_id_;
    deadLetterJob.process_def_id_ = job.process_def_id_;
    deadLetterJob.process_def_key_ = job.process_def_key_;
    deadLetterJob.activity_id_ = job.activity_id_;
    deadLetterJob.activity_name_ = job.activity_name_;
    deadLetterJob.element_type_ = job.element_type_;
    deadLetterJob.callback_config_ = job.callback_config_;
    deadLetterJob.payload_ = job.payload_;
    deadLetterJob.exception_message_ = error?.message || 'Unknown error';
    deadLetterJob.exception_stack_trace_ = error?.stack || null;
    deadLetterJob.retry_count_ = job.retry_count_;
    deadLetterJob.max_retries_ = job.max_retries_ || this.config.maxRetries;
    deadLetterJob.tenant_id_ = job.tenant_id_;
    deadLetterJob.create_time_ = new Date();

    await this.deadLetterJobRepository.save(deadLetterJob);

    // 删除原作业
    await this.jobRepository.remove(job);

    // 发送死信事件
    await this.emitJobEvent(JobEventType.MOVED_TO_DEAD_LETTER, deadLetterJob as any, error);

    this.logger.warn(`作业 ${job.id_} 已移到死信队列`);
  }

  /**
   * 发送作业事件
   */
  private async emitJobEvent(eventType: JobEventType, job: Job | DeadLetterJob, error?: any): Promise<void> {
    const event: JobEvent = {
      type: eventType,
      jobId: job.id_,
      jobType: job.type_ as JobType,
      data: job,
      processInstanceId: job.process_inst_id_ || undefined,
      executionId: job.execution_id_ || undefined,
      activityId: job.activity_id_ || undefined,
      timestamp: new Date(),
      error: error ? {
        message: error.message,
        stack: error.stack,
      } : undefined,
    };

    await this.eventEmitter.emit(`job.${eventType}`, event);
  }

  /**
   * 手动触发作业执行
   * @param jobId 作业ID
   */
  async triggerJob(jobId: string): Promise<boolean> {
    const job = await this.jobRepository.findOne({
      where: { id_: jobId },
    });

    if (!job) {
      return false;
    }

    if (job.status_ !== JobStatus.PENDING) {
      return false;
    }

    // 立即执行
    job.due_date_ = new Date();
    await this.jobRepository.save(job);

    return true;
  }

  /**
   * 重试死信作业
   * @param deadLetterJobId 死信作业ID
   */
  async retryDeadLetterJob(deadLetterJobId: string): Promise<Job | null> {
    const deadLetterJob = await this.deadLetterJobRepository.findOne({
      where: { id_: deadLetterJobId },
    });

    if (!deadLetterJob) {
      return null;
    }

    // 创建新作业
    const job = new Job();
    job.id_ = uuidv4();
    job.type_ = deadLetterJob.type_;
    job.process_inst_id_ = deadLetterJob.process_inst_id_;
    job.execution_id_ = deadLetterJob.execution_id_;
    job.process_def_id_ = deadLetterJob.process_def_id_;
    job.process_def_key_ = deadLetterJob.process_def_key_;
    job.activity_id_ = deadLetterJob.activity_id_;
    job.activity_name_ = deadLetterJob.activity_name_;
    job.element_type_ = deadLetterJob.element_type_;
    job.callback_config_ = deadLetterJob.callback_config_;
    job.payload_ = deadLetterJob.payload_;
    job.status_ = JobStatus.PENDING;
    job.retry_count_ = 0;
    job.max_retries_ = deadLetterJob.max_retries_;
    job.tenant_id_ = deadLetterJob.tenant_id_;
    job.due_date_ = new Date();
    job.create_time_ = new Date();

    const savedJob = await this.jobRepository.save(job);

    // 删除死信作业
    await this.deadLetterJobRepository.remove(deadLetterJob);

    this.logger.log(`死信作业 ${deadLetterJobId} 已重新创建为 ${savedJob.id_}`);

    return savedJob;
  }

  /**
   * 获取执行器统计信息
   */
  async getStatistics(): Promise<{
    pendingJobs: number;
    activeJobs: number;
    completedJobs: number;
    deadLetterJobs: number;
  }> {
    const [pendingJobs, completedJobs, deadLetterJobs] = await Promise.all([
      this.jobRepository.count({ where: { status_: JobStatus.PENDING } }),
      this.jobRepository.count({ where: { status_: JobStatus.COMPLETED } }),
      this.deadLetterJobRepository.count(),
    ]);

    return {
      pendingJobs,
      activeJobs: this.activeJobs.size,
      completedJobs,
      deadLetterJobs,
    };
  }
}
