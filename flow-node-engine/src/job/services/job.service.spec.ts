/**
 * JobService 单元测试
 * 测试作业服务的核心功能
 */
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { vi, describe, it, expect, beforeEach, afterEach, Mocked } from 'vitest';

import { DeadLetterJob } from '../entities/dead-letter-job.entity';
import { ExternalWorkerJob, ExternalWorkerJobStatus } from '../entities/external-worker-job.entity';
import { Job, JobType, JobStatus } from '../entities/job.entity';
import { TimerJob, TimerType, TimerJobStatus } from '../entities/timer-job.entity';
import { JobService, JobEventType, JobEvent } from './job.service';

// Mock 数据
const mockJob: Job = {
  id_: 'job-123',
  type_: JobType.ASYNC_SERVICE,
  status_: JobStatus.PENDING,
  process_inst_id_: 'process-123',
  execution_id_: 'execution-123',
  process_def_id_: 'process-def-123',
  process_def_key_: 'test-process',
  task_id_: 'task-123',
  activity_id_: 'activity-123',
  activity_name_: 'Test Activity',
  element_type_: 'serviceTask',
  callback_config_: null,
  due_date_: new Date(),
  duration_: null,
  handler_type_: 'testHandler',
  handler_config_: JSON.stringify({ url: 'http://test.com' }),
  payload_: JSON.stringify({ data: 'test' }),
  exception_message_: null,
  exception_stack_trace_: null,
  retry_count_: 0,
  max_retries_: 3,
  retry_wait_time_: 5000,
  next_retry_time_: null,
  priority_: 50,
  exclusive_: false,
  locked_by_: null,
  locked_until_: null,
  tenant_id_: 'tenant-123',
  create_time_: new Date(),
  start_time_: null,
  end_time_: null,
  timeout_: 300000,
  callback_url_: null,
  extra_data_: null,
};

const mockTimerJob: TimerJob = {
  id_: 'timer-123',
  timer_type_: TimerType.DATE,
  timer_expression_: '2024-12-31T23:59:59Z',
  due_date_: new Date('2024-12-31T23:59:59Z'),
  executed_time_: null,
  status_: TimerJobStatus.PENDING,
  process_inst_id_: 'process-123',
  execution_id_: 'execution-123',
  process_def_id_: 'process-def-123',
  process_def_key_: 'test-process',
  activity_id_: 'timer-activity-123',
  activity_name_: 'Timer Event',
  element_type_: 'timerEventDefinition',
  max_executions_: 1,
  execution_count_: 0,
  next_execution_time_: null,
  repeat_: false,
  repeat_interval_: null,
  end_time_: null,
  callback_config_: null,
  payload_: null,
  exception_message_: null,
  retry_count_: 0,
  max_retries_: 3,
  locked_by_: null,
  locked_until_: null,
  tenant_id_: 'tenant-123',
  create_time_: new Date(),
  extra_data_: null,
};

const mockExternalWorkerJob: any = {
  id_: 'external-123',
  topic_: 'test-topic',
  status_: ExternalWorkerJobStatus.PENDING,
  process_inst_id_: 'process-123',
  execution_id_: 'execution-123',
  process_def_id_: 'process-def-123',
  activity_id_: 'activity-123',
  payload_: JSON.stringify({ task: 'do-something' }),
  variables_: JSON.stringify({ input: 'value' }),
  lock_duration_: 300000,
  max_retries_: 3,
  retry_count_: 0,
  retry_wait_time_: 5000,
  next_retry_time_: null,
  priority_: 50,
  timeout_: 600000,
  callback_url_: null,
  worker_id_: null,
  claimed_time_: null,
  lock_expiry_time_: null,
  output_variables_: null,
  exception_message_: null,
  error_code_: null,
  error_details_: null,
  end_time_: null,
  tenant_id_: 'tenant-123',
  create_time_: new Date(),
  extra_data_: null,
};

const mockDeadLetterJob: any = {
  id_: 'deadletter-123',
  original_job_id_: 'job-failed-123',
  type_: JobType.ASYNC_SERVICE,
  process_inst_id_: 'process-123',
  execution_id_: 'execution-123',
  process_def_id_: 'process-def-123',
  process_def_key_: 'test-process',
  task_id_: 'task-123',
  handler_type_: 'testHandler',
  handler_config_: JSON.stringify({ url: 'http://test.com' }),
  payload_: JSON.stringify({ data: 'test' }),
  exception_message_: 'Job failed after max retries',
  exception_stack_trace_: 'Error stack trace...',
  failed_time_: new Date(),
  total_retries_: 3,
  processed_: false,
  processed_time_: null,
  processed_action_: null,
  processed_note_: null,
  tenant_id_: 'tenant-123',
  create_time_: new Date(),
  extra_data_: null,
};

describe('JobService', () => {
  let service: JobService;
  let jobRepository: Mocked<Repository<Job>>;
  let deadLetterJobRepository: Mocked<Repository<DeadLetterJob>>;
  let timerJobRepository: Mocked<Repository<TimerJob>>;
  let externalWorkerJobRepository: Mocked<Repository<ExternalWorkerJob>>;
  let eventEmitter: Mocked<EventEmitter2>;
  let dataSource: Mocked<DataSource>;

  beforeEach(async () => {
    // 创建 mock repositories
    jobRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as any;

    deadLetterJobRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as any;

    timerJobRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as any;

    externalWorkerJobRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as any;

    eventEmitter = {
      emit: vi.fn(),
    } as any;

    dataSource = {} as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        { provide: 'JobRepository', useValue: jobRepository },
        { provide: 'DeadLetterJobRepository', useValue: deadLetterJobRepository },
        { provide: 'TimerJobRepository', useValue: timerJobRepository },
        { provide: 'ExternalWorkerJobRepository', useValue: externalWorkerJobRepository },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: DataSource, useValue: dataSource },
      ],
    })
      .overrideProvider('JobRepository')
      .useValue(jobRepository)
      .overrideProvider('DeadLetterJobRepository')
      .useValue(deadLetterJobRepository)
      .overrideProvider('TimerJobRepository')
      .useValue(timerJobRepository)
      .overrideProvider('ExternalWorkerJobRepository')
      .useValue(externalWorkerJobRepository)
      .compile();

    service = module.get<JobService>(JobService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== 通用作业管理测试 ====================

  describe('createJob', () => {
    it('应该成功创建作业', async () => {
      const createDto = {
        id_: 'job-123',
        type_: JobType.ASYNC_SERVICE,
        process_inst_id_: 'process-123',
        handler_type_: 'testHandler',
        handler_config_: JSON.stringify({ url: 'http://test.com' }),
        payload_: JSON.stringify({ data: 'test' }),
      };

      jobRepository.create.mockReturnValue(mockJob);
      jobRepository.save.mockResolvedValue(mockJob);

      const result = await service.createJob(createDto);

      expect(jobRepository.create).toHaveBeenCalled();
      expect(jobRepository.save).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        JobEventType.JOB_CREATED,
        expect.objectContaining({
          jobId: mockJob.id_,
          type: JobEventType.JOB_CREATED,
        })
      );
      expect(result).toEqual(mockJob);
    });

    it('应该使用自定义ID创建作业', async () => {
      const customId = 'custom-job-id-123';
      const createDto = {
        id_: customId,
        type_: JobType.MESSAGE,
        process_inst_id_: 'process-123',
      };

      const jobWithCustomId = { ...mockJob, id_: customId, type_: JobType.MESSAGE };
      jobRepository.create.mockReturnValue(jobWithCustomId);
      jobRepository.save.mockResolvedValue(jobWithCustomId);

      const result = await service.createJob(createDto);

      expect(result.id_).toBe(customId);
    });

    it('应该使用默认值创建作业', async () => {
      const createDto = {
        id_: 'job-default',
        type_: JobType.SIGNAL,
      };

      const defaultJob = { ...mockJob, type_: JobType.SIGNAL };
      jobRepository.create.mockReturnValue(defaultJob);
      jobRepository.save.mockResolvedValue(defaultJob);

      const result = await service.createJob(createDto);

      expect(jobRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          max_retries_: 3,
          retry_wait_time_: 5000,
          priority_: 50,
          exclusive_: false,
          timeout_: 300000,
        })
      );
    });
  });

  describe('getJobById', () => {
    it('应该返回指定ID的作业', async () => {
      jobRepository.findOne.mockResolvedValue(mockJob);

      const result = await service.getJobById('job-123');

      expect(jobRepository.findOne).toHaveBeenCalledWith({
        where: { id_: 'job-123' },
      });
      expect(result).toEqual(mockJob);
    });

    it('作业不存在时应该返回null', async () => {
      jobRepository.findOne.mockResolvedValue(null);

      const result = await service.getJobById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('queryJobs', () => {
    it('应该返回分页作业列表', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockJob], 1]),
      };
      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.queryJobs({ page: 1, pageSize: 20 });

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该根据类型过滤作业', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockJob], 1]),
      };
      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryJobs({ type_: JobType.ASYNC_SERVICE });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'j.type_ = :type',
        expect.objectContaining({ type: JobType.ASYNC_SERVICE })
      );
    });

    it('应该根据状态过滤作业', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockJob], 1]),
      };
      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryJobs({ status_: JobStatus.PENDING });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'j.status_ = :status',
        expect.objectContaining({ status: JobStatus.PENDING })
      );
    });

    it('应该根据流程实例ID过滤作业', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockJob], 1]),
      };
      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryJobs({ process_inst_id_: 'process-123' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'j.process_inst_id_ = :processInstId',
        expect.objectContaining({ processInstId: 'process-123' })
      );
    });
  });

  describe('getPendingJobs', () => {
    it('应该返回待执行的作业列表', async () => {
      jobRepository.find.mockResolvedValue([mockJob]);

      const result = await service.getPendingJobs(10);

      expect(jobRepository.find).toHaveBeenCalledWith({
        where: { status_: JobStatus.PENDING },
        order: { priority_: 'DESC', create_time_: 'ASC' },
        take: 10,
      });
      expect(result).toHaveLength(1);
    });

    it('应该使用默认限制数量', async () => {
      jobRepository.find.mockResolvedValue([]);

      await service.getPendingJobs();

      expect(jobRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  describe('lockJob', () => {
    it('应该成功锁定作业', async () => {
      jobRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.lockJob('job-123');

      expect(result).toBe(true);
      expect(jobRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id_: 'job-123',
          status_: JobStatus.PENDING,
          locked_by_: expect.anything(),
        }),
        expect.objectContaining({
          status_: JobStatus.RUNNING,
          locked_by_: expect.stringContaining('executor_'),
        })
      );
    });

    it('作业已被锁定时应该返回false', async () => {
      jobRepository.update.mockResolvedValue({ affected: 0 } as any);

      const result = await service.lockJob('job-123');

      expect(result).toBe(false);
    });
  });

  describe('executeJob', () => {
    it('应该成功执行作业', async () => {
      const runningJob = { ...mockJob, status_: JobStatus.RUNNING };
      jobRepository.findOne.mockResolvedValue(runningJob);
      jobRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.executeJob('job-123');

      expect(result.success_).toBe(true);
      expect(result.job_id_).toBe('job-123');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        JobEventType.JOB_STARTED,
        expect.any(Object)
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        JobEventType.JOB_COMPLETED,
        expect.any(Object)
      );
    });

    it('作业不存在时应该返回失败结果', async () => {
      jobRepository.findOne.mockResolvedValue(null);

      const result = await service.executeJob('nonexistent');

      expect(result.success_).toBe(false);
      expect(result.error_message_).toBe('作业不存在');
    });

    it('执行失败时应该更新状态为FAILED', async () => {
      const failingJob = {
        ...mockJob,
        type_: JobType.ASYNC_SERVICE,
      };
      jobRepository.findOne.mockResolvedValue(failingJob);
      jobRepository.update.mockResolvedValue({ affected: 1 } as any);

      // Mock executeAsyncServiceJob to throw error
      const originalExecute = (service as any).executeAsyncServiceJob;
      (service as any).executeAsyncServiceJob = vi.fn().mockRejectedValue(new Error('Execution failed'));

      const result = await service.executeJob('job-123');

      expect(result.success_).toBe(false);
      expect(result.error_message_).toBe('Execution failed');
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        JobEventType.JOB_FAILED,
        expect.any(Object)
      );

      // Restore original method
      (service as any).executeAsyncServiceJob = originalExecute;
    });
  });

  describe('retryJob', () => {
    it('应该重试失败的作业', async () => {
      const failedJob = {
        ...mockJob,
        status_: JobStatus.FAILED,
        retry_count_: 1,
        max_retries_: 3,
        retry_wait_time_: 5000,
      };
      jobRepository.findOne.mockResolvedValue(failedJob);
      jobRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.retryJob('job-123');

      expect(jobRepository.update).toHaveBeenCalledWith(
        { id_: 'job-123' },
        expect.objectContaining({
          status_: JobStatus.PENDING,
          retry_count_: 2,
        })
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        JobEventType.JOB_RETRY,
        expect.any(Object)
      );
    });

    it('超过最大重试次数应该移入死信队列', async () => {
      const maxRetriedJob = {
        ...mockJob,
        status_: JobStatus.FAILED,
        retry_count_: 3,
        max_retries_: 3,
      };
      jobRepository.findOne.mockResolvedValue(maxRetriedJob);
      deadLetterJobRepository.create.mockReturnValue(mockDeadLetterJob);
      deadLetterJobRepository.save.mockResolvedValue(mockDeadLetterJob);
      jobRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.retryJob('job-123');

      expect(deadLetterJobRepository.save).toHaveBeenCalled();
      expect(jobRepository.delete).toHaveBeenCalledWith({ id_: 'job-123' });
    });

    it('作业不存在时应该抛出错误', async () => {
      jobRepository.findOne.mockResolvedValue(null);

      await expect(service.retryJob('nonexistent')).rejects.toThrow('作业不存在');
    });
  });

  describe('moveToDeadLetter', () => {
    it('应该将作业移入死信队列', async () => {
      const failedJob = {
        ...mockJob,
        status_: JobStatus.FAILED,
        exception_message_: 'Job failed',
        retry_count_: 3,
      };
      deadLetterJobRepository.create.mockReturnValue(mockDeadLetterJob);
      deadLetterJobRepository.save.mockResolvedValue(mockDeadLetterJob);
      jobRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.moveToDeadLetter(failedJob);

      expect(deadLetterJobRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          original_job_id_: failedJob.id_,
          type_: failedJob.type_,
          exception_message_: failedJob.exception_message_,
          total_retries_: failedJob.retry_count_,
        })
      );
      expect(jobRepository.delete).toHaveBeenCalledWith({ id_: failedJob.id_ });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        JobEventType.JOB_DEAD_LETTER,
        expect.any(Object)
      );
      expect(result).toEqual(mockDeadLetterJob);
    });
  });

  describe('deleteJob', () => {
    it('应该删除作业', async () => {
      jobRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteJob('job-123');

      expect(jobRepository.delete).toHaveBeenCalledWith({ id_: 'job-123' });
    });
  });

  // ==================== 定时器作业管理测试 ====================

  describe('createTimerJob', () => {
    it('应该成功创建定时器作业', async () => {
      const createDto = {
        id_: 'timer-123',
        timer_type_: TimerType.DATE,
        timer_expression_: '2024-12-31T23:59:59Z',
        due_date_: new Date('2024-12-31T23:59:59Z'),
        process_inst_id_: 'process-123',
      };

      timerJobRepository.create.mockReturnValue(mockTimerJob);
      timerJobRepository.save.mockResolvedValue(mockTimerJob);

      const result = await service.createTimerJob(createDto);

      expect(timerJobRepository.create).toHaveBeenCalled();
      expect(timerJobRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockTimerJob);
    });

    it('应该创建循环定时器作业', async () => {
      const createDto = {
        id_: 'timer-cycle-123',
        timer_type_: TimerType.CYCLE,
        timer_expression_: 'R5/PT1H',
        due_date_: new Date(),
        repeat_: true,
        repeat_interval_: 3600000,
        max_executions_: 5,
      };

      const cycleTimerJob = {
        ...mockTimerJob,
        timer_type_: TimerType.CYCLE,
        repeat_: true,
        repeat_interval_: 3600000,
        max_executions_: 5,
      };
      timerJobRepository.create.mockReturnValue(cycleTimerJob);
      timerJobRepository.save.mockResolvedValue(cycleTimerJob);

      const result = await service.createTimerJob(createDto);

      expect(result.repeat_).toBe(true);
      expect(result.max_executions_).toBe(5);
    });
  });

  describe('queryTimerJobs', () => {
    it('应该返回分页定时器作业列表', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockTimerJob], 1]),
      };
      timerJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.queryTimerJobs({ page: 1, pageSize: 20 });

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该根据到期时间范围过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      };
      timerJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const dueBefore = new Date('2024-12-31');
      const dueAfter = new Date('2024-01-01');
      await service.queryTimerJobs({ due_before: dueBefore, due_after: dueAfter });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.due_date_ < :dueBefore',
        expect.objectContaining({ dueBefore })
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.due_date_ > :dueAfter',
        expect.objectContaining({ dueAfter })
      );
    });
  });

  describe('cancelTimerJob', () => {
    it('应该取消定时器作业', async () => {
      timerJobRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.cancelTimerJob('timer-123');

      expect(timerJobRepository.update).toHaveBeenCalledWith(
        { id_: 'timer-123', status_: TimerJobStatus.PENDING },
        { status_: TimerJobStatus.CANCELLED }
      );
    });
  });

  // ==================== 外部工作者作业管理测试 ====================

  describe('createExternalWorkerJob', () => {
    it('应该成功创建外部工作者作业', async () => {
      const createDto = {
        id_: 'external-123',
        topic_: 'test-topic',
        process_inst_id_: 'process-123',
        payload_: JSON.stringify({ task: 'do-something' }),
      };

      externalWorkerJobRepository.create.mockReturnValue(mockExternalWorkerJob);
      externalWorkerJobRepository.save.mockResolvedValue(mockExternalWorkerJob);

      const result = await service.createExternalWorkerJob(createDto);

      expect(externalWorkerJobRepository.create).toHaveBeenCalled();
      expect(externalWorkerJobRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockExternalWorkerJob);
    });
  });

  describe('fetchAndLock', () => {
    it('应该获取并锁定作业', async () => {
      const fetchDto = {
        worker_id_: 'worker-123',
        max_tasks_: 10,
        topics_: [
          {
            topic_name_: 'test-topic',
            lock_duration_: 300000,
          },
        ],
      };

      externalWorkerJobRepository.find.mockResolvedValue([mockExternalWorkerJob]);
      externalWorkerJobRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.fetchAndLock(fetchDto);

      expect(result).toHaveLength(1);
      expect(result[0].status_).toBe(ExternalWorkerJobStatus.CLAIMED);
      expect(result[0].worker_id_).toBe('worker-123');
    });

    it('应该限制获取的作业数量', async () => {
      const fetchDto = {
        worker_id_: 'worker-123',
        max_tasks_: 1,
        topics_: [
          {
            topic_name_: 'test-topic',
            lock_duration_: 300000,
          },
        ],
      };

      const jobs = [
        mockExternalWorkerJob,
        { ...mockExternalWorkerJob, id_: 'external-456' },
      ];
      externalWorkerJobRepository.find.mockResolvedValue(jobs);
      externalWorkerJobRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.fetchAndLock(fetchDto);

      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('没有可用作业时应该返回空数组', async () => {
      const fetchDto = {
        worker_id_: 'worker-123',
        max_tasks_: 10,
        topics_: [
          {
            topic_name_: 'empty-topic',
            lock_duration_: 300000,
          },
        ],
      };

      externalWorkerJobRepository.find.mockResolvedValue([]);

      const result = await service.fetchAndLock(fetchDto);

      expect(result).toHaveLength(0);
    });
  });

  describe('completeExternalWorkerJob', () => {
    it('应该完成外部工作者作业', async () => {
      const completeDto = {
        job_id_: 'external-123',
        worker_id_: 'worker-123',
        variables_: { result: 'success' },
      };

      const claimedJob = {
        ...mockExternalWorkerJob,
        status_: ExternalWorkerJobStatus.CLAIMED,
        worker_id_: 'worker-123',
      };
      externalWorkerJobRepository.findOne.mockResolvedValue(claimedJob);
      externalWorkerJobRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.completeExternalWorkerJob(completeDto);

      expect(externalWorkerJobRepository.update).toHaveBeenCalledWith(
        { id_: 'external-123' },
        expect.objectContaining({
          status_: ExternalWorkerJobStatus.COMPLETED,
          output_variables_: JSON.stringify({ result: 'success' }),
        })
      );
    });

    it('作业不属于工作者时应该抛出错误', async () => {
      const completeDto = {
        job_id_: 'external-123',
        worker_id_: 'wrong-worker',
        variables_: {},
      };

      const claimedJob = {
        ...mockExternalWorkerJob,
        worker_id_: 'worker-123',
      };
      externalWorkerJobRepository.findOne.mockResolvedValue(claimedJob);

      await expect(service.completeExternalWorkerJob(completeDto)).rejects.toThrow(
        '作业不属于此工作者'
      );
    });

    it('作业不存在时应该抛出错误', async () => {
      const completeDto = {
        job_id_: 'nonexistent',
        worker_id_: 'worker-123',
        variables_: {},
      };

      externalWorkerJobRepository.findOne.mockResolvedValue(null);

      await expect(service.completeExternalWorkerJob(completeDto)).rejects.toThrow(
        '作业不存在'
      );
    });
  });

  describe('failExternalWorkerJob', () => {
    it('应该标记作业失败并重试', async () => {
      const failDto = {
        job_id_: 'external-123',
        worker_id_: 'worker-123',
        error_message_: 'Task failed',
        retry_timeout_: 5000,
      };

      const claimedJob = {
        ...mockExternalWorkerJob,
        status_: ExternalWorkerJobStatus.CLAIMED,
        worker_id_: 'worker-123',
        retry_count_: 0,
        max_retries_: 3,
      };
      externalWorkerJobRepository.findOne.mockResolvedValue(claimedJob);
      externalWorkerJobRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.failExternalWorkerJob(failDto);

      expect(externalWorkerJobRepository.update).toHaveBeenCalledWith(
        { id_: 'external-123' },
        expect.objectContaining({
          status_: ExternalWorkerJobStatus.PENDING,
          retry_count_: 1,
          exception_message_: 'Task failed',
        })
      );
    });

    it('超过最大重试次数应该标记为失败', async () => {
      const failDto = {
        job_id_: 'external-123',
        worker_id_: 'worker-123',
        error_message_: 'Task failed permanently',
      };

      const claimedJob = {
        ...mockExternalWorkerJob,
        status_: ExternalWorkerJobStatus.CLAIMED,
        worker_id_: 'worker-123',
        retry_count_: 2,
        max_retries_: 3,
      };
      externalWorkerJobRepository.findOne.mockResolvedValue(claimedJob);
      externalWorkerJobRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.failExternalWorkerJob(failDto);

      expect(externalWorkerJobRepository.update).toHaveBeenCalledWith(
        { id_: 'external-123' },
        expect.objectContaining({
          status_: ExternalWorkerJobStatus.FAILED,
          retry_count_: 3,
        })
      );
    });
  });

  describe('queryExternalWorkerJobs', () => {
    it('应该返回分页外部工作者作业列表', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockExternalWorkerJob], 1]),
      };
      externalWorkerJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.queryExternalWorkerJobs({ page: 1, pageSize: 20 });

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该根据主题过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      };
      externalWorkerJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryExternalWorkerJobs({ topic_: 'test-topic' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'e.topic_ = :topic',
        expect.objectContaining({ topic: 'test-topic' })
      );
    });
  });

  // ==================== 死信作业管理测试 ====================

  describe('queryDeadLetterJobs', () => {
    it('应该返回分页死信作业列表', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockDeadLetterJob], 1]),
      };
      deadLetterJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.queryDeadLetterJobs({ page: 1, pageSize: 20 });

      expect(result.list).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该根据处理状态过滤', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      };
      deadLetterJobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryDeadLetterJobs({ processed_: false });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'd.processed_ = :processed',
        expect.objectContaining({ processed: false })
      );
    });
  });

  describe('processDeadLetterJob', () => {
    it('应该重试死信作业', async () => {
      const processDto = {
        id_: 'deadletter-123',
        action_: 'RETRY' as const,
      };

      deadLetterJobRepository.findOne.mockResolvedValue(mockDeadLetterJob);
      deadLetterJobRepository.update.mockResolvedValue({ affected: 1 } as any);
      jobRepository.create.mockReturnValue(mockJob);
      jobRepository.save.mockResolvedValue(mockJob);

      await service.processDeadLetterJob(processDto);

      expect(jobRepository.save).toHaveBeenCalled();
      expect(deadLetterJobRepository.update).toHaveBeenCalledWith(
        { id_: 'deadletter-123' },
        expect.objectContaining({
          processed_: true,
          processed_action_: 'RETRY',
        })
      );
    });

    it('应该删除死信作业', async () => {
      const processDto = {
        id_: 'deadletter-123',
        action_: 'DELETE' as const,
      };

      deadLetterJobRepository.findOne.mockResolvedValue(mockDeadLetterJob);
      deadLetterJobRepository.delete.mockResolvedValue({ affected: 1 } as any);
      deadLetterJobRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.processDeadLetterJob(processDto);

      expect(deadLetterJobRepository.delete).toHaveBeenCalledWith({ id_: 'deadletter-123' });
    });

    it('应该忽略死信作业', async () => {
      const processDto = {
        id_: 'deadletter-123',
        action_: 'IGNORE' as const,
        note_: 'Known issue',
      };

      deadLetterJobRepository.findOne.mockResolvedValue(mockDeadLetterJob);
      deadLetterJobRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.processDeadLetterJob(processDto);

      expect(deadLetterJobRepository.update).toHaveBeenCalledWith(
        { id_: 'deadletter-123' },
        expect.objectContaining({
          processed_: true,
          processed_action_: 'IGNORE',
          processed_note_: 'Known issue',
        })
      );
    });

    it('死信作业不存在时应该抛出错误', async () => {
      const processDto = {
        id_: 'nonexistent',
        action_: 'DELETE' as const,
      };

      deadLetterJobRepository.findOne.mockResolvedValue(null);

      await expect(service.processDeadLetterJob(processDto)).rejects.toThrow(
        '死信作业不存在'
      );
    });
  });

  // ==================== 统计功能测试 ====================

  describe('getStatistics', () => {
    it('应该返回作业统计信息', async () => {
      jobRepository.count.mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20) // pending
        .mockResolvedValueOnce(5) // running
        .mockResolvedValueOnce(70) // completed
        .mockResolvedValueOnce(5); // failed
      deadLetterJobRepository.count.mockResolvedValue(3);

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { type: 'ASYNC_SERVICE', count: '50' },
          { type: 'MESSAGE', count: '30' },
          { type: 'SIGNAL', count: '20' },
        ]),
      };
      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Mock for byPriority query
      const mockPriorityQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { priority: '50', count: '60' },
          { priority: '100', count: '40' },
        ]),
      };
      jobRepository.createQueryBuilder.mockReturnValue(mockPriorityQueryBuilder as any);

      // Mock for completed jobs with time
      jobRepository.find.mockResolvedValue([
        { start_time_: new Date('2024-01-01T10:00:00Z'), end_time_: new Date('2024-01-01T10:00:05Z') },
        { start_time_: new Date('2024-01-01T11:00:00Z'), end_time_: new Date('2024-01-01T11:00:10Z') },
      ] as any);

      const result = await service.getStatistics();

      expect(result.total_jobs).toBe(100);
      expect(result.pending_jobs).toBe(20);
      expect(result.running_jobs).toBe(5);
      expect(result.completed_jobs).toBe(70);
      expect(result.failed_jobs).toBe(5);
      expect(result.dead_letter_jobs).toBe(3);
    });

    it('没有完成的作业时平均执行时间应该为0', async () => {
      jobRepository.count.mockResolvedValue(0);
      deadLetterJobRepository.count.mockResolvedValue(0);

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
      };
      jobRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      jobRepository.find.mockResolvedValue([]);

      const result = await service.getStatistics();

      expect(result.avg_execution_time).toBe(0);
    });
  });

  // ==================== 生命周期测试 ====================

  describe('onModuleInit', () => {
    it('应该初始化服务并启动定时器', async () => {
      await service.onModuleInit();

      // 验证定时器已启动（通过检查私有属性）
      expect((service as any).timerCheckInterval).toBeDefined();
      expect((service as any).lockCleanupInterval).toBeDefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('应该清理定时器', async () => {
      // 先初始化
      await service.onModuleInit();

      // 保存定时器引用
      const timerInterval = (service as any).timerCheckInterval;
      const lockInterval = (service as any).lockCleanupInterval;

      // 然后销毁
      await service.onModuleDestroy();

      // 验证定时器已被销毁（_destroyed 属性为 true）
      expect(timerInterval._destroyed).toBe(true);
      expect(lockInterval._destroyed).toBe(true);
    });
  });
});
