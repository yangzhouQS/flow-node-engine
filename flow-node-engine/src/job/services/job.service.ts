/**
 * 作业服务
 * 提供作业的创建、查询、执行、重试、死信处理等功能
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull, Between } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import {
  CreateJobDto,
  JobQueryDto,
  JobResultDto,
  CreateTimerJobDto,
  TimerJobQueryDto,
  CreateExternalWorkerJobDto,
  CompleteExternalWorkerJobDto,
  FailExternalWorkerJobDto,
  ExternalWorkerJobQueryDto,
  FetchAndLockDto,
  DeadLetterJobQueryDto,
  ProcessDeadLetterJobDto,
  JobStatisticsDto,
} from '../dto/job.dto';
import { DeadLetterJob } from '../entities/dead-letter-job.entity';
import { ExternalWorkerJob, ExternalWorkerJobStatus } from '../entities/external-worker-job.entity';
import { Job, JobType, JobStatus } from '../entities/job.entity';
import { TimerJob, TimerType, TimerJobStatus } from '../entities/timer-job.entity';

/**
 * 作业事件类型
 */
export enum JobEventType {
  JOB_CREATED = 'job.created',
  JOB_STARTED = 'job.started',
  JOB_COMPLETED = 'job.completed',
  JOB_FAILED = 'job.failed',
  JOB_RETRY = 'job.retry',
  JOB_DEAD_LETTER = 'job.dead_letter',
  TIMER_TRIGGERED = 'job.timer_triggered',
  EXTERNAL_WORKER_CLAIMED = 'job.external_worker_claimed',
}

/**
 * 作业事件接口
 */
export interface JobEvent {
  jobId: string;
  type: JobEventType;
  jobType: JobType | TimerType | string;
  data: any;
  timestamp: Date;
}

@Injectable()
export class JobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobService.name);

  /** 执行器ID */
  private readonly executorId: string;

  /** 锁过期时间（毫秒） */
  private readonly lockDuration = 300000; // 5分钟

  /** 定时器检查间隔 */
  private timerCheckInterval?: ReturnType<typeof setInterval>;

  /** 锁清理间隔 */
  private lockCleanupInterval?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    @InjectRepository(DeadLetterJob)
    private readonly deadLetterJobRepository: Repository<DeadLetterJob>,
    @InjectRepository(TimerJob)
    private readonly timerJobRepository: Repository<TimerJob>,
    @InjectRepository(ExternalWorkerJob)
    private readonly externalWorkerJobRepository: Repository<ExternalWorkerJob>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.executorId = `executor_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
  }

  async onModuleInit() {
    this.logger.log(`作业服务初始化，执行器ID: ${this.executorId}`);
    this.startTimerCheck();
    this.startLockCleanup();
  }

  async onModuleDestroy() {
    this.logger.log('作业服务销毁...');
    if (this.timerCheckInterval) {
      clearInterval(this.timerCheckInterval);
    }
    if (this.lockCleanupInterval) {
      clearInterval(this.lockCleanupInterval);
    }
  }

  // ==================== 通用作业管理 ====================

  /**
   * 创建作业
   */
  async createJob(dto: CreateJobDto): Promise<Job> {
    const job = this.jobRepository.create({
      id_: dto.id_ || uuidv4().replace(/-/g, ''),
      type_: dto.type_,
      status_: JobStatus.PENDING,
      process_inst_id_: dto.process_inst_id_,
      execution_id_: dto.execution_id_,
      process_def_id_: dto.process_def_id_,
      task_id_: dto.task_id_,
      handler_type_: dto.handler_type_,
      handler_config_: dto.handler_config_,
      payload_: dto.payload_,
      max_retries_: dto.max_retries_ || 3,
      retry_wait_time_: dto.retry_wait_time_ || 5000,
      priority_: dto.priority_ || 50,
      exclusive_: dto.exclusive_ || false,
      timeout_: dto.timeout_ || 300000,
      callback_url_: dto.callback_url_,
      tenant_id_: dto.tenant_id_,
      extra_data_: dto.extra_data_,
    });

    const saved = await this.jobRepository.save(job);
    await this.emitJobEvent(JobEventType.JOB_CREATED, dto.type_, saved);
    return saved;
  }

  /**
   * 根据ID获取作业
   */
  async getJobById(id: string): Promise<Job | null> {
    return this.jobRepository.findOne({ where: { id_: id } });
  }

  /**
   * 查询作业列表
   */
  async queryJobs(query: JobQueryDto): Promise<{ list: Job[]; total: number }> {
    const queryBuilder = this.jobRepository.createQueryBuilder('j');

    if (query.type_) {
      queryBuilder.andWhere('j.type_ = :type', { type: query.type_ });
    }
    if (query.status_) {
      queryBuilder.andWhere('j.status_ = :status', { status: query.status_ });
    }
    if (query.process_inst_id_) {
      queryBuilder.andWhere('j.process_inst_id_ = :processInstId', {
        processInstId: query.process_inst_id_,
      });
    }
    if (query.execution_id_) {
      queryBuilder.andWhere('j.execution_id_ = :executionId', { executionId: query.execution_id_ });
    }
    if (query.process_def_id_) {
      queryBuilder.andWhere('j.process_def_id_ = :processDefId', {
        processDefId: query.process_def_id_,
      });
    }
    if (query.tenant_id_) {
      queryBuilder.andWhere('j.tenant_id_ = :tenantId', { tenantId: query.tenant_id_ });
    }
    if (query.exclusive_ !== undefined) {
      queryBuilder.andWhere('j.exclusive_ = :exclusive', { exclusive: query.exclusive_ });
    }

    queryBuilder.orderBy('j.priority_', 'DESC').addOrderBy('j.create_time_', 'ASC');

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();
    return { list, total };
  }

  /**
   * 获取待执行作业
   */
  async getPendingJobs(limit = 10): Promise<Job[]> {
    return this.jobRepository.find({
      where: {
        status_: JobStatus.PENDING,
      },
      order: {
        priority_: 'DESC',
        create_time_: 'ASC',
      },
      take: limit,
    });
  }

  /**
   * 锁定作业
   */
  async lockJob(jobId: string): Promise<boolean> {
    const now = new Date();
    const lockUntil = new Date(now.getTime() + this.lockDuration);

    const result = await this.jobRepository.update(
      {
        id_: jobId,
        status_: JobStatus.PENDING,
        locked_by_: IsNull(),
      },
      {
        status_: JobStatus.RUNNING,
        locked_by_: this.executorId,
        locked_until_: lockUntil,
        start_time_: now,
      },
    );

    return result.affected ? result.affected > 0 : false;
  }

  /**
   * 执行作业
   */
  async executeJob(jobId: string): Promise<JobResultDto> {
    const job = await this.getJobById(jobId);
    if (!job) {
      return {
        job_id_: jobId,
        success_: false,
        error_message_: '作业不存在',
      };
    }

    await this.emitJobEvent(JobEventType.JOB_STARTED, job.type_ as JobType, job);

    try {
      // 根据作业类型执行不同的处理逻辑
      let result: any;
      switch (job.type_) {
        case JobType.ASYNC_SERVICE:
          result = await this.executeAsyncServiceJob(job);
          break;
        case JobType.MESSAGE:
          result = await this.executeMessageJob(job);
          break;
        case JobType.SIGNAL:
          result = await this.executeSignalJob(job);
          break;
        default:
          result = { message: '作业类型未实现' };
      }

      // 更新作业状态为完成
      await this.jobRepository.update(
        { id_: jobId },
        {
          status_: JobStatus.COMPLETED,
          end_time_: new Date(),
          locked_by_: null,
          locked_until_: null,
        },
      );

      await this.emitJobEvent(JobEventType.JOB_COMPLETED, job.type_ as JobType, {
        ...job,
        result,
      });

      return {
        job_id_: jobId,
        success_: true,
        result_: JSON.stringify(result),
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      const errorStack = (error as Error).stack;

      this.logger.error(`作业执行失败: ${jobId}`, error);

      // 更新作业状态
      await this.jobRepository.update(
        { id_: jobId },
        {
          status_: JobStatus.FAILED,
          exception_message_: errorMessage,
          exception_stack_trace_: errorStack,
          end_time_: new Date(),
          locked_by_: null,
          locked_until_: null,
        },
      );

      await this.emitJobEvent(JobEventType.JOB_FAILED, job.type_ as JobType, {
        ...job,
        error: errorMessage,
      });

      return {
        job_id_: jobId,
        success_: false,
        error_message_: errorMessage,
      };
    }
  }

  /**
   * 重试作业
   */
  async retryJob(jobId: string): Promise<void> {
    const job = await this.getJobById(jobId);
    if (!job) {
      throw new Error(`作业不存在: ${jobId}`);
    }

    if (job.retry_count_ >= job.max_retries_) {
      // 超过最大重试次数，移入死信队列
      await this.moveToDeadLetter(job);
      return;
    }

    // 更新重试信息
    const nextRetryTime = new Date(Date.now() + job.retry_wait_time_);
    await this.jobRepository.update(
      { id_: jobId },
      {
        status_: JobStatus.PENDING,
        retry_count_: job.retry_count_ + 1,
        next_retry_time_: nextRetryTime,
        locked_by_: null,
        locked_until_: null,
        exception_message_: null,
        exception_stack_trace_: null,
      },
    );

    await this.emitJobEvent(JobEventType.JOB_RETRY, job.type_ as JobType, job);
  }

  /**
   * 移入死信队列
   */
  async moveToDeadLetter(job: Job): Promise<DeadLetterJob> {
    const deadLetterJob = this.deadLetterJobRepository.create({
      id_: uuidv4().replace(/-/g, ''),
      original_job_id_: job.id_,
      type_: job.type_,
      process_inst_id_: job.process_inst_id_,
      execution_id_: job.execution_id_,
      process_def_id_: job.process_def_id_,
      process_def_key_: job.process_def_key_,
      task_id_: job.task_id_,
      handler_type_: job.handler_type_,
      handler_config_: job.handler_config_,
      payload_: job.payload_,
      exception_message_: job.exception_message_,
      exception_stack_trace_: job.exception_stack_trace_,
      failed_time_: new Date(),
      total_retries_: job.retry_count_,
      processed_: false,
      tenant_id_: job.tenant_id_,
      extra_data_: job.extra_data_,
    });

    const saved = await this.deadLetterJobRepository.save(deadLetterJob);

    // 删除原作业
    await this.jobRepository.delete({ id_: job.id_ });

    await this.emitJobEvent(JobEventType.JOB_DEAD_LETTER, job.type_ as JobType, deadLetterJob);

    return saved;
  }

  /**
   * 删除作业
   */
  async deleteJob(id: string): Promise<void> {
    await this.jobRepository.delete({ id_: id });
  }

  // ==================== 定时器作业管理 ====================

  /**
   * 创建定时器作业
   */
  async createTimerJob(dto: CreateTimerJobDto): Promise<TimerJob> {
    const timerJob = this.timerJobRepository.create({
      id_: dto.id_ || uuidv4().replace(/-/g, ''),
      timer_type_: dto.timer_type_,
      timer_expression_: dto.timer_expression_,
      due_date_: dto.due_date_,
      status_: TimerJobStatus.PENDING,
      process_inst_id_: dto.process_inst_id_,
      execution_id_: dto.execution_id_,
      process_def_id_: dto.process_def_id_,
      activity_id_: dto.activity_id_,
      activity_name_: dto.activity_name_,
      max_executions_: dto.max_executions_,
      repeat_: dto.repeat_ || false,
      repeat_interval_: dto.repeat_interval_,
      end_time_: dto.end_time_,
      callback_config_: dto.callback_config_,
      payload_: dto.payload_,
      tenant_id_: dto.tenant_id_,
      extra_data_: dto.extra_data_,
    });

    return this.timerJobRepository.save(timerJob);
  }

  /**
   * 查询定时器作业
   */
  async queryTimerJobs(query: TimerJobQueryDto): Promise<{ list: TimerJob[]; total: number }> {
    const queryBuilder = this.timerJobRepository.createQueryBuilder('t');

    if (query.timer_type_) {
      queryBuilder.andWhere('t.timer_type_ = :timerType', { timerType: query.timer_type_ });
    }
    if (query.status_) {
      queryBuilder.andWhere('t.status_ = :status', { status: query.status_ });
    }
    if (query.process_inst_id_) {
      queryBuilder.andWhere('t.process_inst_id_ = :processInstId', {
        processInstId: query.process_inst_id_,
      });
    }
    if (query.process_def_key_) {
      queryBuilder.andWhere('t.process_def_key_ = :processDefKey', {
        processDefKey: query.process_def_key_,
      });
    }
    if (query.due_before) {
      queryBuilder.andWhere('t.due_date_ < :dueBefore', { dueBefore: query.due_before });
    }
    if (query.due_after) {
      queryBuilder.andWhere('t.due_date_ > :dueAfter', { dueAfter: query.due_after });
    }
    if (query.tenant_id_) {
      queryBuilder.andWhere('t.tenant_id_ = :tenantId', { tenantId: query.tenant_id_ });
    }

    queryBuilder.orderBy('t.due_date_', 'ASC');

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();
    return { list, total };
  }

  /**
   * 取消定时器作业
   */
  async cancelTimerJob(id: string): Promise<void> {
    await this.timerJobRepository.update(
      { id_: id, status_: TimerJobStatus.PENDING },
      { status_: TimerJobStatus.CANCELLED },
    );
  }

  /**
   * 获取到期定时器
   */
  private async getDueTimerJobs(): Promise<TimerJob[]> {
    const now = new Date();
    return this.timerJobRepository.find({
      where: {
        status_: TimerJobStatus.PENDING,
        due_date_: Between(new Date(0), now),
      },
      order: {
        due_date_: 'ASC',
      },
      take: 50,
    });
  }

  /**
   * 执行定时器作业
   */
  private async executeTimerJob(timerJob: TimerJob): Promise<void> {
    try {
      this.logger.debug(`执行定时器作业: ${timerJob.id_}`);

      // 发送定时器触发事件
      await this.emitJobEvent(JobEventType.TIMER_TRIGGERED, timerJob.timer_type_, timerJob);

      // 更新执行状态
      if (timerJob.repeat_ && (!timerJob.max_executions_ || timerJob.execution_count_ < timerJob.max_executions_)) {
        // 重复执行
        const nextExecutionTime = new Date(Date.now() + (timerJob.repeat_interval_ || 0));
        await this.timerJobRepository.update(
          { id_: timerJob.id_ },
          {
            execution_count_: timerJob.execution_count_ + 1,
            executed_time_: new Date(),
            next_execution_time_: nextExecutionTime,
            due_date_: nextExecutionTime,
          },
        );
      } else {
        // 单次执行完成
        await this.timerJobRepository.update(
          { id_: timerJob.id_ },
          {
            status_: TimerJobStatus.EXECUTED,
            executed_time_: new Date(),
            execution_count_: timerJob.execution_count_ + 1,
          },
        );
      }
    } catch (error) {
      this.logger.error(`定时器作业执行失败: ${timerJob.id_}`, error);
      await this.timerJobRepository.update(
        { id_: timerJob.id_ },
        {
          status_: TimerJobStatus.FAILED,
          exception_message_: (error as Error).message,
        },
      );
    }
  }

  // ==================== 外部工作者作业管理 ====================

  /**
   * 创建外部工作者作业
   */
  async createExternalWorkerJob(dto: CreateExternalWorkerJobDto): Promise<ExternalWorkerJob> {
    const job = this.externalWorkerJobRepository.create({
      id_: dto.id_ || uuidv4().replace(/-/g, ''),
      topic_: dto.topic_,
      status_: ExternalWorkerJobStatus.PENDING,
      process_inst_id_: dto.process_inst_id_,
      execution_id_: dto.execution_id_,
      process_def_id_: dto.process_def_id_,
      activity_id_: dto.activity_id_,
      payload_: dto.payload_,
      variables_: dto.variables_,
      lock_duration_: dto.lock_duration_ || 300000,
      max_retries_: dto.max_retries_ || 3,
      priority_: dto.priority_ || 50,
      timeout_: dto.timeout_ || 600000,
      callback_url_: dto.callback_url_,
      tenant_id_: dto.tenant_id_,
      extra_data_: dto.extra_data_,
    });

    return this.externalWorkerJobRepository.save(job);
  }

  /**
   * 获取并锁定作业（外部工作者）
   */
  async fetchAndLock(dto: FetchAndLockDto): Promise<ExternalWorkerJob[]> {
    const jobs: ExternalWorkerJob[] = [];
    const maxTasks = dto.max_tasks_ || 10;

    for (const topic of dto.topics_) {
      const availableJobs = await this.externalWorkerJobRepository.find({
        where: {
          topic_: topic.topic_name_,
          status_: ExternalWorkerJobStatus.PENDING,
        },
        order: dto.use_priority_
          ? { priority_: 'DESC', create_time_: 'ASC' }
          : { create_time_: 'ASC' },
        take: maxTasks - jobs.length,
      });

      for (const job of availableJobs) {
        if (jobs.length >= maxTasks) break;

        // 锁定作业
        const lockExpiry = new Date(Date.now() + topic.lock_duration_);
        await this.externalWorkerJobRepository.update(
          { id_: job.id_, status_: ExternalWorkerJobStatus.PENDING },
          {
            status_: ExternalWorkerJobStatus.CLAIMED,
            worker_id_: dto.worker_id_,
            claimed_time_: new Date(),
            lock_expiry_time_: lockExpiry,
            lock_duration_: topic.lock_duration_,
          },
        );

        job.status_ = ExternalWorkerJobStatus.CLAIMED;
        job.worker_id_ = dto.worker_id_;
        jobs.push(job);
      }
    }

    return jobs;
  }

  /**
   * 完成外部工作者作业
   */
  async completeExternalWorkerJob(dto: CompleteExternalWorkerJobDto): Promise<void> {
    const job = await this.externalWorkerJobRepository.findOne({
      where: { id_: dto.job_id_ },
    });

    if (!job) {
      throw new Error(`作业不存在: ${dto.job_id_}`);
    }

    if (job.worker_id_ !== dto.worker_id_) {
      throw new Error('作业不属于此工作者');
    }

    await this.externalWorkerJobRepository.update(
      { id_: dto.job_id_ },
      {
        status_: ExternalWorkerJobStatus.COMPLETED,
        output_variables_: JSON.stringify(dto.variables_ || {}),
        end_time_: new Date(),
      },
    );
  }

  /**
   * 外部工作者作业失败
   */
  async failExternalWorkerJob(dto: FailExternalWorkerJobDto): Promise<void> {
    const job = await this.externalWorkerJobRepository.findOne({
      where: { id_: dto.job_id_ },
    });

    if (!job) {
      throw new Error(`作业不存在: ${dto.job_id_}`);
    }

    if (job.worker_id_ !== dto.worker_id_) {
      throw new Error('作业不属于此工作者');
    }

    const retryCount = job.retry_count_ + 1;
    const shouldRetry = retryCount < job.max_retries_;

    if (shouldRetry) {
      const nextRetryTime = new Date(Date.now() + (dto.retry_timeout_ || job.retry_wait_time_ || 5000));
      await this.externalWorkerJobRepository.update(
        { id_: dto.job_id_ },
        {
          status_: ExternalWorkerJobStatus.PENDING,
          retry_count_: retryCount,
          next_retry_time_: nextRetryTime,
          exception_message_: dto.error_message_,
          error_code_: dto.error_code_,
          error_details_: JSON.stringify(dto.error_details_ || {}),
          worker_id_: null,
          lock_expiry_time_: null,
        },
      );
    } else {
      await this.externalWorkerJobRepository.update(
        { id_: dto.job_id_ },
        {
          status_: ExternalWorkerJobStatus.FAILED,
          retry_count_: retryCount,
          exception_message_: dto.error_message_,
          error_code_: dto.error_code_,
          error_details_: JSON.stringify(dto.error_details_ || {}),
          end_time_: new Date(),
        },
      );
    }
  }

  /**
   * 查询外部工作者作业
   */
  async queryExternalWorkerJobs(
    query: ExternalWorkerJobQueryDto,
  ): Promise<{ list: ExternalWorkerJob[]; total: number }> {
    const queryBuilder = this.externalWorkerJobRepository.createQueryBuilder('e');

    if (query.topic_) {
      queryBuilder.andWhere('e.topic_ = :topic', { topic: query.topic_ });
    }
    if (query.status_) {
      queryBuilder.andWhere('e.status_ = :status', { status: query.status_ });
    }
    if (query.process_inst_id_) {
      queryBuilder.andWhere('e.process_inst_id_ = :processInstId', {
        processInstId: query.process_inst_id_,
      });
    }
    if (query.worker_id_) {
      queryBuilder.andWhere('e.worker_id_ = :workerId', { workerId: query.worker_id_ });
    }
    if (query.tenant_id_) {
      queryBuilder.andWhere('e.tenant_id_ = :tenantId', { tenantId: query.tenant_id_ });
    }

    queryBuilder.orderBy('e.priority_', 'DESC').addOrderBy('e.create_time_', 'ASC');

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();
    return { list, total };
  }

  // ==================== 死信作业管理 ====================

  /**
   * 查询死信作业
   */
  async queryDeadLetterJobs(
    query: DeadLetterJobQueryDto,
  ): Promise<{ list: DeadLetterJob[]; total: number }> {
    const queryBuilder = this.deadLetterJobRepository.createQueryBuilder('d');

    if (query.original_job_id_) {
      queryBuilder.andWhere('d.original_job_id_ = :originalJobId', {
        originalJobId: query.original_job_id_,
      });
    }
    if (query.type_) {
      queryBuilder.andWhere('d.type_ = :type', { type: query.type_ });
    }
    if (query.process_inst_id_) {
      queryBuilder.andWhere('d.process_inst_id_ = :processInstId', {
        processInstId: query.process_inst_id_,
      });
    }
    if (query.processed_ !== undefined) {
      queryBuilder.andWhere('d.processed_ = :processed', { processed: query.processed_ });
    }
    if (query.tenant_id_) {
      queryBuilder.andWhere('d.tenant_id_ = :tenantId', { tenantId: query.tenant_id_ });
    }

    queryBuilder.orderBy('d.create_time_', 'DESC');

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    queryBuilder.skip((page - 1) * pageSize).take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();
    return { list, total };
  }

  /**
   * 处理死信作业
   */
  async processDeadLetterJob(dto: ProcessDeadLetterJobDto): Promise<void> {
    const deadLetterJob = await this.deadLetterJobRepository.findOne({
      where: { id_: dto.id_ },
    });

    if (!deadLetterJob) {
      throw new Error(`死信作业不存在: ${dto.id_}`);
    }

    switch (dto.action_) {
      case 'RETRY':
        // 重新创建作业
        await this.createJob({
          id_: uuidv4().replace(/-/g, ''),
          type_: deadLetterJob.type_ as JobType,
          process_inst_id_: deadLetterJob.process_inst_id_,
          execution_id_: deadLetterJob.execution_id_,
          process_def_id_: deadLetterJob.process_def_id_,
          handler_type_: deadLetterJob.handler_type_,
          handler_config_: deadLetterJob.handler_config_,
          payload_: deadLetterJob.payload_,
          tenant_id_: deadLetterJob.tenant_id_,
        });
        break;
      case 'DELETE':
        // 删除死信作业
        await this.deadLetterJobRepository.delete({ id_: dto.id_ });
        break;
      case 'IGNORE':
        // 标记为已处理
        break;
    }

    // 更新处理状态
    await this.deadLetterJobRepository.update(
      { id_: dto.id_ },
      {
        processed_: true,
        processed_time_: new Date(),
        processed_action_: dto.action_,
        processed_note_: dto.note_,
      },
    );
  }

  // ==================== 统计功能 ====================

  /**
   * 获取作业统计
   */
  async getStatistics(): Promise<JobStatisticsDto> {
    const [
      totalJobs,
      pendingJobs,
      runningJobs,
      completedJobs,
      failedJobs,
      deadLetterJobs,
    ] = await Promise.all([
      this.jobRepository.count(),
      this.jobRepository.count({ where: { status_: JobStatus.PENDING } }),
      this.jobRepository.count({ where: { status_: JobStatus.RUNNING } }),
      this.jobRepository.count({ where: { status_: JobStatus.COMPLETED } }),
      this.jobRepository.count({ where: { status_: JobStatus.FAILED } }),
      this.deadLetterJobRepository.count(),
    ]);

    // 按类型分组统计
    const byTypeResult = await this.jobRepository
      .createQueryBuilder('j')
      .select('j.type_', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('j.type_')
      .getRawMany();

    const byType: Record<string, number> = {};
    for (const row of byTypeResult) {
      byType[row.type] = parseInt(row.count, 10);
    }

    // 按优先级分组统计
    const byPriorityResult = await this.jobRepository
      .createQueryBuilder('j')
      .select('j.priority_', 'priority')
      .addSelect('COUNT(*)', 'count')
      .groupBy('j.priority_')
      .getRawMany();

    const byPriority: Record<string, number> = {};
    for (const row of byPriorityResult) {
      byPriority[row.priority] = parseInt(row.count, 10);
    }

    // 计算平均执行时间
    const completedWithTime = await this.jobRepository.find({
      where: {
        status_: JobStatus.COMPLETED,
        start_time_: Not(IsNull()),
        end_time_: Not(IsNull()),
      },
    });

    let avgExecutionTime = 0;
    if (completedWithTime.length > 0) {
      const totalTime = completedWithTime.reduce((sum, job) => {
        if (job.start_time_ && job.end_time_) {
          return sum + (job.end_time_.getTime() - job.start_time_.getTime());
        }
        return sum;
      }, 0);
      avgExecutionTime = Math.round(totalTime / completedWithTime.length);
    }

    return {
      total_jobs: totalJobs,
      pending_jobs: pendingJobs,
      running_jobs: runningJobs,
      completed_jobs: completedJobs,
      failed_jobs: failedJobs,
      dead_letter_jobs: deadLetterJobs,
      by_type: byType,
      by_priority: byPriority,
      avg_execution_time: avgExecutionTime,
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 执行异步服务任务作业
   */
  private async executeAsyncServiceJob(job: Job): Promise<any> {
    // TODO: 实现异步服务任务执行逻辑
    this.logger.debug(`执行异步服务任务: ${job.id_}`);
    return { message: '异步服务任务执行完成' };
  }

  /**
   * 执行消息作业
   */
  private async executeMessageJob(job: Job): Promise<any> {
    // TODO: 实现消息事件执行逻辑
    this.logger.debug(`执行消息作业: ${job.id_}`);
    return { message: '消息作业执行完成' };
  }

  /**
   * 执行信号作业
   */
  private async executeSignalJob(job: Job): Promise<any> {
    // TODO: 实现信号事件执行逻辑
    this.logger.debug(`执行信号作业: ${job.id_}`);
    return { message: '信号作业执行完成' };
  }

  /**
   * 启动定时器检查
   */
  private startTimerCheck() {
    this.timerCheckInterval = setInterval(async () => {
      try {
        const dueTimers = await this.getDueTimerJobs();
        for (const timer of dueTimers) {
          await this.executeTimerJob(timer);
        }
      } catch (error) {
        this.logger.error('定时器检查失败', error);
      }
    }, 1000); // 每秒检查一次
  }

  /**
   * 启动锁清理
   */
  private startLockCleanup() {
    this.lockCleanupInterval = setInterval(async () => {
      try {
        const now = new Date();
        // 清理过期的作业锁
        await this.jobRepository.update(
          {
            locked_until_: Between(new Date(0), now),
            status_: JobStatus.RUNNING,
          },
          {
            status_: JobStatus.PENDING,
            locked_by_: null,
            locked_until_: null,
          },
        );

        // 清理过期的外部工作者作业锁
        await this.externalWorkerJobRepository.update(
          {
            lock_expiry_time_: Between(new Date(0), now),
            status_: ExternalWorkerJobStatus.CLAIMED,
          },
          {
            status_: ExternalWorkerJobStatus.PENDING,
            worker_id_: null,
            lock_expiry_time_: null,
          },
        );
      } catch (error) {
        this.logger.error('锁清理失败', error);
      }
    }, 60000); // 每分钟清理一次
  }

  /**
   * 发送作业事件
   */
  private async emitJobEvent(eventType: JobEventType, jobType: string, data: any): Promise<void> {
    const event: JobEvent = {
      jobId: data.id_,
      type: eventType,
      jobType: jobType as any,
      data,
      timestamp: new Date(),
    };

    this.eventEmitter.emit(eventType, event);
    this.eventEmitter.emit('job.event', event);
  }
}
