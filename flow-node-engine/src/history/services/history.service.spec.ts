import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';

import { HistoricActivityInstance, ActivityType } from '../entities/historic-activity-instance.entity';
import { HistoricProcessInstance } from '../entities/historic-process-instance.entity';
import { HistoricTaskInstance, HistoricTaskStatus } from '../entities/historic-task-instance.entity';
import { HistoryService } from './history.service';

describe('HistoryService', () => {
  let service: HistoryService;
  let activityRepository: Mocked<Repository<HistoricActivityInstance>>;
  let taskRepository: Mocked<Repository<HistoricTaskInstance>>;
  let processRepository: Mocked<Repository<HistoricProcessInstance>>;

  const mockActivityInstance: HistoricActivityInstance = {
    id: 'activity-1',
    processInstanceId: 'process-1',
    processDefinitionId: 'proc-def-1',
    activityId: 'task-1',
    activityName: 'User Task 1',
    activityType: ActivityType.USER_TASK,
    assignee: 'user1',
    startTime: new Date('2026-01-01T10:00:00Z'),
    endTime: new Date('2026-01-01T11:00:00Z'),
    duration: 3600000,
  };

  const mockTaskInstance: any = {
    id: 'task-1',
    taskId: 'runtime-task-1',
    taskDefinitionKey: 'userTask1',
    taskDefinitionId: 'task-def-1',
    taskDefinitionVersion: 1,
    processInstanceId: 'process-1',
    processDefinitionId: 'proc-def-1',
    processDefinitionKey: 'test-process',
    processDefinitionVersion: 1,
    executionId: 'execution-1',
    name: 'User Task 1',
    description: 'Test task',
    assignee: 'user1',
    assigneeFullName: 'Test User',
    owner: 'owner1',
    priority: 50,
    createTime: new Date('2026-01-01T10:00:00Z'),
    completionTime: new Date('2026-01-01T11:00:00Z'),
    duration: 3600000,
    deleteReason: null,
    status: HistoricTaskStatus.COMPLETED,
    category: 'test',
    tenantId: 'tenant-1',
    formKey: 'form-1',
    formData: { field1: 'value1' },
    variables: { var1: 'value1' },
  };

  const mockProcessInstance: HistoricProcessInstance = {
    id: 'process-1',
    processInstanceId: 'runtime-process-1',
    processDefinitionId: 'proc-def-1',
    processDefinitionKey: 'test-process',
    processDefinitionVersion: 1,
    processDefinitionName: 'Test Process',
    businessKey: 'biz-1',
    startUserId: 'user1',
    startTime: new Date('2026-01-01T09:00:00Z'),
    endTime: new Date('2026-01-01T12:00:00Z'),
    duration: 10800000,
    status: 'COMPLETED',
    name: 'Test Process Instance',
    description: 'Test description',
    tenantId: 'tenant-1',
    callbackId: null,
    callbackType: null,
  };

  beforeEach(async () => {
    const mockQueryBuilder = {
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn(),
      getMany: vi.fn(),
      getOne: vi.fn(),
    } as unknown as SelectQueryBuilder<any>;

    const mockActivityRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    };

    const mockTaskRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    };

    const mockProcessRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        {
          provide: getRepositoryToken(HistoricActivityInstance),
          useValue: mockActivityRepo,
        },
        {
          provide: getRepositoryToken(HistoricTaskInstance),
          useValue: mockTaskRepo,
        },
        {
          provide: getRepositoryToken(HistoricProcessInstance),
          useValue: mockProcessRepo,
        },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
    activityRepository = module.get(getRepositoryToken(HistoricActivityInstance));
    taskRepository = module.get(getRepositoryToken(HistoricTaskInstance));
    processRepository = module.get(getRepositoryToken(HistoricProcessInstance));
  });

  describe('findHistoricActivityInstances', () => {
    it('应该返回分页的历史活动实例列表', async () => {
      const mockQueryBuilder = activityRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockActivityInstance], 1]);

      const result = await service.findHistoricActivityInstances({ page: 1, pageSize: 10 });

      expect(result.activities).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.activities[0]).toEqual(mockActivityInstance);
    });

    it('应该支持processInstanceId过滤', async () => {
      const mockQueryBuilder = activityRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockActivityInstance], 1]);

      await service.findHistoricActivityInstances({ processInstanceId: 'process-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'activity.processInstanceId = :processInstanceId',
        { processInstanceId: 'process-1' }
      );
    });

    it('应该支持processDefinitionId过滤', async () => {
      const mockQueryBuilder = activityRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockActivityInstance], 1]);

      await service.findHistoricActivityInstances({ processDefinitionId: 'proc-def-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'activity.processDefinitionId = :processDefinitionId',
        { processDefinitionId: 'proc-def-1' }
      );
    });

    it('应该支持activityType过滤', async () => {
      const mockQueryBuilder = activityRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockActivityInstance], 1]);

      await service.findHistoricActivityInstances({ activityType: 'userTask' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'activity.activityType = :activityType',
        { activityType: 'userTask' }
      );
    });

    it('应该支持assignee过滤', async () => {
      const mockQueryBuilder = activityRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockActivityInstance], 1]);

      await service.findHistoricActivityInstances({ assignee: 'user1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'activity.assignee = :assignee',
        { assignee: 'user1' }
      );
    });

    it('应该支持时间范围过滤', async () => {
      const mockQueryBuilder = activityRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockActivityInstance], 1]);

      await service.findHistoricActivityInstances({
        startTimeStart: '2026-01-01',
        startTimeEnd: '2026-01-31',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'activity.startTime BETWEEN :startTimeStart AND :startTimeEnd',
        expect.objectContaining({
          startTimeStart: expect.any(Date),
          startTimeEnd: expect.any(Date),
        })
      );
    });
  });

  describe('findHistoricActivityInstanceById', () => {
    it('应该返回历史活动实例', async () => {
      activityRepository.findOne.mockResolvedValue(mockActivityInstance);

      const result = await service.findHistoricActivityInstanceById('activity-1');

      expect(result).toEqual(mockActivityInstance);
    });

    it('活动实例不存在时应抛出NotFoundException', async () => {
      activityRepository.findOne.mockResolvedValue(null);

      await expect(service.findHistoricActivityInstanceById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findHistoricActivityInstancesByProcessInstanceId', () => {
    it('应该返回指定流程实例的历史活动实例', async () => {
      activityRepository.find.mockResolvedValue([mockActivityInstance]);

      const result = await service.findHistoricActivityInstancesByProcessInstanceId('process-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockActivityInstance);
    });
  });

  describe('findHistoricTaskInstances', () => {
    it('应该返回分页的历史任务实例列表', async () => {
      const mockQueryBuilder = taskRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockTaskInstance], 1]);

      const result = await service.findHistoricTaskInstances({ page: 1, pageSize: 10 });

      expect(result.tasks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该支持processInstanceId过滤', async () => {
      const mockQueryBuilder = taskRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockTaskInstance], 1]);

      await service.findHistoricTaskInstances({ processInstanceId: 'process-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'task.processInstanceId = :processInstanceId',
        { processInstanceId: 'process-1' }
      );
    });

    it('应该支持status过滤', async () => {
      const mockQueryBuilder = taskRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockTaskInstance], 1]);

      await service.findHistoricTaskInstances({ status: HistoricTaskStatus.COMPLETED });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'task.status = :status',
        { status: HistoricTaskStatus.COMPLETED }
      );
    });

    it('应该支持completionTime范围过滤', async () => {
      const mockQueryBuilder = taskRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockTaskInstance], 1]);

      await service.findHistoricTaskInstances({
        completionTimeStart: '2026-01-01',
        completionTimeEnd: '2026-01-31',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'task.completionTime BETWEEN :completionTimeStart AND :completionTimeEnd',
        expect.objectContaining({
          completionTimeStart: expect.any(Date),
          completionTimeEnd: expect.any(Date),
        })
      );
    });
  });

  describe('findHistoricTaskInstanceById', () => {
    it('应该返回历史任务实例', async () => {
      taskRepository.findOne.mockResolvedValue(mockTaskInstance);

      const result = await service.findHistoricTaskInstanceById('task-1');

      expect(result).toEqual(mockTaskInstance);
    });

    it('任务实例不存在时应抛出NotFoundException', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.findHistoricTaskInstanceById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findHistoricTaskInstancesByProcessInstanceId', () => {
    it('应该返回指定流程实例的历史任务实例', async () => {
      taskRepository.find.mockResolvedValue([mockTaskInstance]);

      const result = await service.findHistoricTaskInstancesByProcessInstanceId('process-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockTaskInstance);
    });
  });

  describe('findHistoricTaskInstancesByAssignee', () => {
    it('应该返回指定负责人的历史任务实例', async () => {
      taskRepository.find.mockResolvedValue([mockTaskInstance]);

      const result = await service.findHistoricTaskInstancesByAssignee('user1');

      expect(result).toHaveLength(1);
      expect(result[0].assignee).toBe('user1');
    });
  });

  describe('findHistoricProcessInstances', () => {
    it('应该返回分页的历史流程实例列表', async () => {
      const mockQueryBuilder = processRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockProcessInstance], 1]);

      const result = await service.findHistoricProcessInstances({ page: 1, pageSize: 10 });

      expect(result.processes).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该支持processDefinitionKey过滤', async () => {
      const mockQueryBuilder = processRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockProcessInstance], 1]);

      await service.findHistoricProcessInstances({ processDefinitionKey: 'test-process' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'process.processDefinitionKey = :processDefinitionKey',
        { processDefinitionKey: 'test-process' }
      );
    });

    it('应该支持businessKey过滤', async () => {
      const mockQueryBuilder = processRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockProcessInstance], 1]);

      await service.findHistoricProcessInstances({ businessKey: 'biz-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'process.businessKey = :businessKey',
        { businessKey: 'biz-1' }
      );
    });

    it('应该支持startUserId过滤', async () => {
      const mockQueryBuilder = processRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockProcessInstance], 1]);

      await service.findHistoricProcessInstances({ startUserId: 'user1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'process.startUserId = :startUserId',
        { startUserId: 'user1' }
      );
    });

    it('应该支持status过滤', async () => {
      const mockQueryBuilder = processRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockProcessInstance], 1]);

      await service.findHistoricProcessInstances({ status: 'COMPLETED' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'process.status = :status',
        { status: 'COMPLETED' }
      );
    });

    it('应该支持endTime范围过滤', async () => {
      const mockQueryBuilder = processRepository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockProcessInstance], 1]);

      await service.findHistoricProcessInstances({
        endTimeStart: '2026-01-01',
        endTimeEnd: '2026-01-31',
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'process.endTime BETWEEN :endTimeStart AND :endTimeEnd',
        expect.objectContaining({
          endTimeStart: expect.any(Date),
          endTimeEnd: expect.any(Date),
        })
      );
    });
  });

  describe('findHistoricProcessInstanceById', () => {
    it('应该返回历史流程实例', async () => {
      processRepository.findOne.mockResolvedValue(mockProcessInstance);

      const result = await service.findHistoricProcessInstanceById('process-1');

      expect(result).toEqual(mockProcessInstance);
    });

    it('流程实例不存在时应抛出NotFoundException', async () => {
      processRepository.findOne.mockResolvedValue(null);

      await expect(service.findHistoricProcessInstanceById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findHistoricProcessInstanceByProcessInstanceId', () => {
    it('应该返回历史流程实例', async () => {
      processRepository.findOne.mockResolvedValue(mockProcessInstance);

      const result = await service.findHistoricProcessInstanceByProcessInstanceId('runtime-process-1');

      expect(result).toEqual(mockProcessInstance);
    });
  });

  describe('findHistoricProcessInstancesByBusinessKey', () => {
    it('应该返回指定业务Key的历史流程实例', async () => {
      processRepository.find.mockResolvedValue([mockProcessInstance]);

      const result = await service.findHistoricProcessInstancesByBusinessKey('biz-1');

      expect(result).toHaveLength(1);
      expect(result[0].businessKey).toBe('biz-1');
    });
  });

  describe('getProcessInstanceHistory', () => {
    it('应该返回流程实例的完整历史', async () => {
      processRepository.findOne.mockResolvedValue(mockProcessInstance);
      activityRepository.find.mockResolvedValue([mockActivityInstance]);
      taskRepository.find.mockResolvedValue([mockTaskInstance]);

      const result = await service.getProcessInstanceHistory('process-1');

      expect(result.processInstance).toEqual(mockProcessInstance);
      expect(result.activities).toHaveLength(1);
      expect(result.tasks).toHaveLength(1);
    });
  });

  describe('deleteHistoricProcessInstance', () => {
    it('应该删除历史流程实例', async () => {
      processRepository.findOne.mockResolvedValue(mockProcessInstance);
      processRepository.remove.mockResolvedValue(mockProcessInstance);

      await service.deleteHistoricProcessInstance('process-1');

      expect(processRepository.remove).toHaveBeenCalledWith(mockProcessInstance);
    });
  });

  describe('deleteHistoricTaskInstance', () => {
    it('应该删除历史任务实例', async () => {
      taskRepository.findOne.mockResolvedValue(mockTaskInstance);
      taskRepository.remove.mockResolvedValue(mockTaskInstance);

      await service.deleteHistoricTaskInstance('task-1');

      expect(taskRepository.remove).toHaveBeenCalledWith(mockTaskInstance);
    });
  });

  describe('deleteHistoricActivityInstance', () => {
    it('应该删除历史活动实例', async () => {
      activityRepository.findOne.mockResolvedValue(mockActivityInstance);
      activityRepository.remove.mockResolvedValue(mockActivityInstance);

      await service.deleteHistoricActivityInstance('activity-1');

      expect(activityRepository.remove).toHaveBeenCalledWith(mockActivityInstance);
    });
  });

  describe('createHistoricTask', () => {
    it('应该创建历史任务实例', async () => {
      const createParams = {
        taskId: 'new-task-1',
        taskDefinitionKey: 'userTask1',
        taskDefinitionId: 'task-def-1',
        taskDefinitionVersion: 1,
        processInstanceId: 'process-1',
        processDefinitionId: 'proc-def-1',
        processDefinitionKey: 'test-process',
        processDefinitionVersion: 1,
        name: 'New Task',
      };

      taskRepository.create.mockReturnValue({ ...createParams, status: HistoricTaskStatus.CREATED } as any);
      taskRepository.save.mockResolvedValue({ id: 'task-new', ...createParams } as any);

      const result = await service.createHistoricTask(createParams);

      expect(taskRepository.create).toHaveBeenCalled();
      expect(taskRepository.save).toHaveBeenCalled();
    });

    it('创建时应该设置默认状态为CREATED', async () => {
      const createParams = {
        taskId: 'new-task-1',
        taskDefinitionKey: 'userTask1',
        taskDefinitionId: 'task-def-1',
        taskDefinitionVersion: 1,
        processInstanceId: 'process-1',
        processDefinitionId: 'proc-def-1',
        processDefinitionKey: 'test-process',
        processDefinitionVersion: 1,
        name: 'New Task',
      };

      taskRepository.create.mockReturnValue({ ...createParams, status: HistoricTaskStatus.CREATED } as any);
      taskRepository.save.mockResolvedValue({ id: 'task-new', ...createParams, status: HistoricTaskStatus.CREATED } as any);

      const result = await service.createHistoricTask(createParams);

      expect(taskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: HistoricTaskStatus.CREATED,
        })
      );
    });
  });

  describe('updateHistoricTaskStatus', () => {
    it('应该更新历史任务状态', async () => {
      taskRepository.findOne.mockResolvedValue(mockTaskInstance);
      taskRepository.save.mockResolvedValue({ ...mockTaskInstance, status: HistoricTaskStatus.COMPLETED } as any);

      const result = await service.updateHistoricTaskStatus('runtime-task-1', HistoricTaskStatus.COMPLETED);

      expect(result.status).toBe(HistoricTaskStatus.COMPLETED);
    });

    it('更新状态时应该同时更新assignee', async () => {
      taskRepository.findOne.mockResolvedValue(mockTaskInstance);
      taskRepository.save.mockResolvedValue({ ...mockTaskInstance, assignee: 'newUser' } as any);

      await service.updateHistoricTaskStatus('runtime-task-1', HistoricTaskStatus.COMPLETED, {
        assignee: 'newUser',
      });

      expect(taskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          assignee: 'newUser',
        })
      );
    });

    it('完成时应该计算duration', async () => {
      const completionTime = new Date('2026-01-01T11:00:00Z');
      taskRepository.findOne.mockResolvedValue(mockTaskInstance);
      taskRepository.save.mockResolvedValue(mockTaskInstance);

      await service.updateHistoricTaskStatus('runtime-task-1', HistoricTaskStatus.COMPLETED, {
        completionTime,
      });

      expect(taskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          completionTime,
          duration: expect.any(Number),
        })
      );
    });

    it('任务不存在时应抛出NotFoundException', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateHistoricTaskStatus('non-existent', HistoricTaskStatus.COMPLETED)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findHistoricTaskByTaskId', () => {
    it('应该返回历史任务实例', async () => {
      taskRepository.findOne.mockResolvedValue(mockTaskInstance);

      const result = await service.findHistoricTaskByTaskId('runtime-task-1');

      expect(result).toEqual(mockTaskInstance);
    });

    it('任务不存在时应该返回null', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      const result = await service.findHistoricTaskByTaskId('non-existent');

      expect(result).toBeNull();
    });
  });
});
