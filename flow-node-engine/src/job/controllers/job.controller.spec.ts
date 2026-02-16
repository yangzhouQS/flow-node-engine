import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CreateJobDto,
  JobQueryDto,
  CreateTimerJobDto,
  TimerJobQueryDto,
  CreateExternalWorkerJobDto,
  ExternalWorkerJobQueryDto,
  FetchAndLockDto,
  CompleteExternalWorkerJobDto,
  FailExternalWorkerJobDto,
  DeadLetterJobQueryDto,
  ProcessDeadLetterJobDto,
} from '../dto/job.dto';
import { JobService } from '../services/job.service';
import { JobController } from './job.controller';

describe('JobController', () => {
  let controller: JobController;
  let service: JobService;

  const mockJobService = {
    createJob: vi.fn(),
    getJobById: vi.fn(),
    queryJobs: vi.fn(),
    getPendingJobs: vi.fn(),
    executeJob: vi.fn(),
    retryJob: vi.fn(),
    deleteJob: vi.fn(),
    getStatistics: vi.fn(),
    createTimerJob: vi.fn(),
    queryTimerJobs: vi.fn(),
    cancelTimerJob: vi.fn(),
    createExternalWorkerJob: vi.fn(),
    queryExternalWorkerJobs: vi.fn(),
    fetchAndLock: vi.fn(),
    completeExternalWorkerJob: vi.fn(),
    failExternalWorkerJob: vi.fn(),
    queryDeadLetterJobs: vi.fn(),
    processDeadLetterJob: vi.fn(),
  };

  const mockJob = {
    id: 'job-1',
    jobType: 'ASYNC_CONTINUATION',
    processInstanceId: 'process-1',
    executionId: 'execution-1',
    processDefinitionId: 'definition-1',
    retries: 3,
    exceptionMessage: null,
    dueDate: new Date(),
    createTime: new Date(),
    tenantId: 'tenant-1',
  };

  const mockTimerJob = {
    id: 'timer-job-1',
    jobType: 'TIMER',
    processInstanceId: 'process-1',
    duedate: new Date(),
    timerExpression: 'PT5M',
    createTime: new Date(),
  };

  const mockExternalWorkerJob = {
    id: 'external-job-1',
    jobType: 'EXTERNAL_WORKER',
    topic: 'test-topic',
    processInstanceId: 'process-1',
    lockOwner: null,
    lockExpirationTime: null,
    createTime: new Date(),
  };

  const mockDeadLetterJob = {
    id: 'dead-letter-job-1',
    jobType: 'ASYNC_CONTINUATION',
    processInstanceId: 'process-1',
    exceptionMessage: 'Test exception',
    createTime: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobController],
      providers: [
        {
          provide: JobService,
          useValue: mockJobService,
        },
      ],
    }).compile();

    controller = module.get<JobController>(JobController);
    service = module.get<JobService>(JobService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ==================== 通用作业API测试 ====================

  describe('createJob', () => {
    it('should create a job successfully', async () => {
      const dto: CreateJobDto = {
        jobType: 'ASYNC_CONTINUATION',
        processInstanceId: 'process-1',
        executionId: 'execution-1',
        processDefinitionId: 'definition-1',
      };

      mockJobService.createJob.mockResolvedValue(mockJob);

      const result = await controller.createJob(dto);

      expect(service.createJob).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockJob);
    });

    it('should throw BadRequestException when creation fails', async () => {
      const dto: CreateJobDto = {
        jobType: 'ASYNC_CONTINUATION',
      };

      mockJobService.createJob.mockRejectedValue(new Error('Creation failed'));

      await expect(controller.createJob(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getJobById', () => {
    it('should return a job by id', async () => {
      mockJobService.getJobById.mockResolvedValue(mockJob);

      const result = await controller.getJobById('job-1');

      expect(service.getJobById).toHaveBeenCalledWith('job-1');
      expect(result).toEqual(mockJob);
    });

    it('should throw NotFoundException when job not found', async () => {
      mockJobService.getJobById.mockResolvedValue(null);

      await expect(controller.getJobById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('queryJobs', () => {
    it('should return a list of jobs', async () => {
      const query: JobQueryDto = { page: 1, pageSize: 10 };

      mockJobService.queryJobs.mockResolvedValue({ list: [mockJob], total: 1 });

      const result = await controller.queryJobs(query);

      expect(service.queryJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual({ list: [mockJob], total: 1 });
    });
  });

  describe('getPendingJobs', () => {
    it('should return pending jobs with default limit', async () => {
      mockJobService.getPendingJobs.mockResolvedValue([mockJob]);

      const result = await controller.getPendingJobs();

      expect(service.getPendingJobs).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockJob]);
    });

    it('should return pending jobs with custom limit', async () => {
      mockJobService.getPendingJobs.mockResolvedValue([mockJob]);

      const result = await controller.getPendingJobs(20);

      expect(service.getPendingJobs).toHaveBeenCalledWith(20);
      expect(result).toEqual([mockJob]);
    });
  });

  describe('executeJob', () => {
    it('should execute a job successfully', async () => {
      const mockResult = { success: true, jobId: 'job-1' };

      mockJobService.executeJob.mockResolvedValue(mockResult);

      const result = await controller.executeJob('job-1');

      expect(service.executeJob).toHaveBeenCalledWith('job-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('retryJob', () => {
    it('should retry a job successfully', async () => {
      mockJobService.retryJob.mockResolvedValue(undefined);

      await controller.retryJob('job-1');

      expect(service.retryJob).toHaveBeenCalledWith('job-1');
    });

    it('should throw NotFoundException when job not found', async () => {
      mockJobService.retryJob.mockRejectedValue(new Error('作业不存在'));

      await expect(controller.retryJob('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for other errors', async () => {
      mockJobService.retryJob.mockRejectedValue(new Error('Other error'));

      await expect(controller.retryJob('job-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteJob', () => {
    it('should delete a job successfully', async () => {
      mockJobService.deleteJob.mockResolvedValue(undefined);

      await controller.deleteJob('job-1');

      expect(service.deleteJob).toHaveBeenCalledWith('job-1');
    });
  });

  describe('getStatistics', () => {
    it('should return job statistics', async () => {
      const mockStats = {
        totalJobs: 100,
        pendingJobs: 50,
        completedJobs: 40,
        failedJobs: 10,
        timerJobs: 20,
        externalWorkerJobs: 15,
        deadLetterJobs: 5,
      };

      mockJobService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics();

      expect(service.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  // ==================== 定时器作业API测试 ====================

  describe('createTimerJob', () => {
    it('should create a timer job successfully', async () => {
      const dto: CreateTimerJobDto = {
        jobType: 'TIMER',
        processInstanceId: 'process-1',
        duedate: new Date(),
        timerExpression: 'PT5M',
      };

      mockJobService.createTimerJob.mockResolvedValue(mockTimerJob);

      const result = await controller.createTimerJob(dto);

      expect(service.createTimerJob).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockTimerJob);
    });
  });

  describe('queryTimerJobs', () => {
    it('should return a list of timer jobs', async () => {
      const query: TimerJobQueryDto = { page: 1, pageSize: 10 };

      mockJobService.queryTimerJobs.mockResolvedValue({ list: [mockTimerJob], total: 1 });

      const result = await controller.queryTimerJobs(query);

      expect(service.queryTimerJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual({ list: [mockTimerJob], total: 1 });
    });
  });

  describe('cancelTimerJob', () => {
    it('should cancel a timer job successfully', async () => {
      mockJobService.cancelTimerJob.mockResolvedValue(undefined);

      await controller.cancelTimerJob('timer-job-1');

      expect(service.cancelTimerJob).toHaveBeenCalledWith('timer-job-1');
    });
  });

  // ==================== 外部工作者作业API测试 ====================

  describe('createExternalWorkerJob', () => {
    it('should create an external worker job successfully', async () => {
      const dto: CreateExternalWorkerJobDto = {
        jobType: 'EXTERNAL_WORKER',
        topic: 'test-topic',
        processInstanceId: 'process-1',
      };

      mockJobService.createExternalWorkerJob.mockResolvedValue(mockExternalWorkerJob);

      const result = await controller.createExternalWorkerJob(dto);

      expect(service.createExternalWorkerJob).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockExternalWorkerJob);
    });
  });

  describe('queryExternalWorkerJobs', () => {
    it('should return a list of external worker jobs', async () => {
      const query: ExternalWorkerJobQueryDto = { page: 1, pageSize: 10 };

      mockJobService.queryExternalWorkerJobs.mockResolvedValue({ list: [mockExternalWorkerJob], total: 1 });

      const result = await controller.queryExternalWorkerJobs(query);

      expect(service.queryExternalWorkerJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual({ list: [mockExternalWorkerJob], total: 1 });
    });
  });

  describe('fetchAndLock', () => {
    it('should fetch and lock jobs successfully', async () => {
      const dto: FetchAndLockDto = {
        worker_id_: 'worker-1',
        topic: 'test-topic',
        maxTasks: 10,
        lockDuration: 60000,
      };

      mockJobService.fetchAndLock.mockResolvedValue([mockExternalWorkerJob]);

      const result = await controller.fetchAndLock(dto);

      expect(service.fetchAndLock).toHaveBeenCalledWith(dto);
      expect(result).toEqual([mockExternalWorkerJob]);
    });
  });

  describe('completeExternalWorkerJob', () => {
    it('should complete an external worker job successfully', async () => {
      const dto: CompleteExternalWorkerJobDto = {
        jobId: 'external-job-1',
        workerId: 'worker-1',
        variables: { result: 'success' },
      };

      mockJobService.completeExternalWorkerJob.mockResolvedValue(undefined);

      await controller.completeExternalWorkerJob(dto);

      expect(service.completeExternalWorkerJob).toHaveBeenCalledWith(dto);
    });

    it('should throw BadRequestException when completion fails', async () => {
      const dto: CompleteExternalWorkerJobDto = {
        jobId: 'external-job-1',
        workerId: 'worker-1',
      };

      mockJobService.completeExternalWorkerJob.mockRejectedValue(new Error('Completion failed'));

      await expect(controller.completeExternalWorkerJob(dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('failExternalWorkerJob', () => {
    it('should mark an external worker job as failed', async () => {
      const dto: FailExternalWorkerJobDto = {
        jobId: 'external-job-1',
        workerId: 'worker-1',
        errorMessage: 'Task failed',
      };

      mockJobService.failExternalWorkerJob.mockResolvedValue(undefined);

      await controller.failExternalWorkerJob(dto);

      expect(service.failExternalWorkerJob).toHaveBeenCalledWith(dto);
    });

    it('should throw BadRequestException when marking as failed fails', async () => {
      const dto: FailExternalWorkerJobDto = {
        jobId: 'external-job-1',
        workerId: 'worker-1',
      };

      mockJobService.failExternalWorkerJob.mockRejectedValue(new Error('Fail operation failed'));

      await expect(controller.failExternalWorkerJob(dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ==================== 死信作业API测试 ====================

  describe('queryDeadLetterJobs', () => {
    it('should return a list of dead letter jobs', async () => {
      const query: DeadLetterJobQueryDto = { page: 1, pageSize: 10 };

      mockJobService.queryDeadLetterJobs.mockResolvedValue({ list: [mockDeadLetterJob], total: 1 });

      const result = await controller.queryDeadLetterJobs(query);

      expect(service.queryDeadLetterJobs).toHaveBeenCalledWith(query);
      expect(result).toEqual({ list: [mockDeadLetterJob], total: 1 });
    });
  });

  describe('processDeadLetterJob', () => {
    it('should process a dead letter job successfully', async () => {
      const dto: ProcessDeadLetterJobDto = {
        id_: 'dead-letter-job-1',
        action: 'RETRY',
      };

      mockJobService.processDeadLetterJob.mockResolvedValue(undefined);

      await controller.processDeadLetterJob(dto);

      expect(service.processDeadLetterJob).toHaveBeenCalledWith(dto);
    });

    it('should throw BadRequestException when processing fails', async () => {
      const dto: ProcessDeadLetterJobDto = {
        deadLetterJobId: 'dead-letter-job-1',
        action: 'RETRY',
      };

      mockJobService.processDeadLetterJob.mockRejectedValue(new Error('Processing failed'));

      await expect(controller.processDeadLetterJob(dto)).rejects.toThrow(BadRequestException);
    });
  });
});
