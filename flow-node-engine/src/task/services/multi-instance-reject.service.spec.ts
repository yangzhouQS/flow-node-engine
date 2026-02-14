import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';

import { MultiInstanceRejectService, HandleMultiInstanceRejectParams, MultiInstanceRejectResult } from './multi-instance-reject.service';
import { MultiInstanceConfigEntity } from '../entities/multi-instance-config.entity';
import { Task, TaskStatus } from '../entities/task.entity';
import { HistoricActivityInstance } from '../../history/entities/historic-activity-instance.entity';
import { MultiInstanceRejectStrategy } from '../dto/task-reject.dto';

describe('MultiInstanceRejectService', () => {
  let service: MultiInstanceRejectService;
  let configRepository: vi.Mocked<Repository<MultiInstanceConfigEntity>>;
  let taskRepository: vi.Mocked<Repository<Task>>;
  let historicActivityRepository: vi.Mocked<Repository<HistoricActivityInstance>>;
  let dataSource: {
    createQueryRunner: vi.Mock;
  };

  const mockTask: Task = {
    id: 'task-1',
    name: '审批任务',
    description: null,
    priority: 50,
    assignee: 'user1',
    owner: null,
    parentTaskId: null,
    taskDefinitionId: 'proc-def-1',
    taskDefinitionKey: 'approveTask',
    processInstanceId: 'pi-1',
    executionId: 'exec-1',
    processDefinitionId: 'pd-1',
    createTime: new Date(),
    dueDate: null,
    completionTime: null,
    status: TaskStatus.ACTIVE,
    category: null,
    formKey: null,
    tenantId: null,
  };

  const mockConfig: MultiInstanceConfigEntity = {
    id_: 'config-1',
    proc_def_id_: 'proc-def-1',
    task_def_key_: 'approveTask',
    task_name_: '审批任务',
    is_multi_instance_: true,
    sequential_: false,
    reject_strategy_: MultiInstanceRejectStrategy.ALL_BACK,
    reject_percentage_: null,
  };

  const mockSiblingTasks: Task[] = [
    mockTask,
    {
      ...mockTask,
      id: 'task-2',
      assignee: 'user2',
    },
    {
      ...mockTask,
      id: 'task-3',
      assignee: 'user3',
      completionTime: new Date(),
      status: TaskStatus.COMPLETED,
    },
  ];

  const createMockQueryRunner = (): QueryRunner => ({
    connect: vi.fn().mockResolvedValue(undefined),
    startTransaction: vi.fn().mockResolvedValue(undefined),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    release: vi.fn().mockResolvedValue(undefined),
    manager: {
      update: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as QueryRunner);

  beforeEach(async () => {
    configRepository = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as vi.Mocked<Repository<MultiInstanceConfigEntity>>;

    taskRepository = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as vi.Mocked<Repository<Task>>;

    historicActivityRepository = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
    } as unknown as vi.Mocked<Repository<HistoricActivityInstance>>;

    dataSource = {
      createQueryRunner: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MultiInstanceRejectService,
        {
          provide: getRepositoryToken(MultiInstanceConfigEntity),
          useValue: configRepository,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: taskRepository,
        },
        {
          provide: getRepositoryToken(HistoricActivityInstance),
          useValue: historicActivityRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<MultiInstanceRejectService>(MultiInstanceRejectService);
  });

  describe('handleMultiInstanceReject', () => {
    it('应该成功处理多实例任务退回', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      
      const mockQueryRunner = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        reason: '测试退回',
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
      expect(result.shouldReject).toBe(true);
    });

    it('任务不存在时应该抛出NotFoundException', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'nonexistent',
        userId: 'user1',
      };

      await expect(service.handleMultiInstanceReject(params)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('非多实例任务应该返回失败结果', async () => {
      const nonMITask = { ...mockTask, parentTaskId: null, processInstanceId: null };
      taskRepository.findOne.mockResolvedValue(nonMITask);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(false);
      expect(result.message).toContain('不是多实例任务');
    });

    it('应该使用传入的策略而不是配置的策略', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      taskRepository.update.mockResolvedValue(undefined);
      
      const mockQueryRunner = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.ONLY_CURRENT,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
      expect(result.cancelledTasks).toContain('task-1');
    });
  });

  describe('executeAllBack策略', () => {
    it('应该取消所有待处理的兄弟任务', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      
      const mockQueryRunner = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.ALL_BACK,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
      expect(result.shouldReject).toBe(true);
      expect(result.cancelledTasks).toHaveLength(2); // task-1 和 task-2 未完成
    });
  });

  describe('executeOnlyCurrent策略', () => {
    it('应该仅取消当前任务', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      taskRepository.update.mockResolvedValue(undefined);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.ONLY_CURRENT,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
      expect(result.cancelledTasks).toContain('task-1');
      expect(result.cancelledTasks).toHaveLength(1);
      expect(taskRepository.update).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          status: TaskStatus.CANCELLED,
        }),
      );
    });

    it('当没有剩余任务时应该触发退回', async () => {
      const singleTask = [mockTask];
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(singleTask),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      taskRepository.update.mockResolvedValue(undefined);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.ONLY_CURRENT,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.shouldReject).toBe(true);
    });
  });

  describe('executeMajorityBack策略', () => {
    it('达到多数时应该执行全部退回', async () => {
      const manyTasks = [
        mockTask,
        { ...mockTask, id: 'task-2', completionTime: new Date(), status: TaskStatus.CANCELLED },
        { ...mockTask, id: 'task-3' },
      ];
      
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(manyTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      
      const mockQueryRunner = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.MAJORITY_BACK,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
    });

    it('未达多数时应该仅取消当前任务', async () => {
      const fewTasks = [
        mockTask,
        { ...mockTask, id: 'task-2' },
        { ...mockTask, id: 'task-3' },
        { ...mockTask, id: 'task-4' },
        { ...mockTask, id: 'task-5' },
      ];
      
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(fewTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      taskRepository.update.mockResolvedValue(undefined);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.MAJORITY_BACK,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
      expect(result.shouldReject).toBe(false);
      expect(result.message).toContain('未达多数');
    });
  });

  describe('executeKeepCompleted策略', () => {
    it('应该保留已完成任务，取消未完成任务', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      
      const mockQueryRunner = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.KEEP_COMPLETED,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
      expect(result.shouldReject).toBe(true);
      expect(result.message).toContain('保留');
    });
  });

  describe('executeResetAll策略', () => {
    it('应该重置所有任务包括已完成的', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      
      const mockQueryRunner = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.RESET_ALL,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
      expect(result.shouldReject).toBe(true);
      expect(result.cancelledTasks).toHaveLength(3); // 所有任务
    });
  });

  describe('executeWaitCompletion策略', () => {
    it('应该记录退回并等待其他人完成', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      taskRepository.update.mockResolvedValue(undefined);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.WAIT_COMPLETION,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
      expect(result.shouldReject).toBe(false);
      expect(result.message).toContain('等待');
    });

    it('所有人完成后应该执行退回', async () => {
      const singlePendingTask = [mockTask];
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(singlePendingTask),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      taskRepository.update.mockResolvedValue(undefined);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.WAIT_COMPLETION,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.shouldReject).toBe(true);
      expect(result.message).toContain('所有人已完成');
    });
  });

  describe('executeImmediate策略', () => {
    it('应该立即取消所有待处理任务', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      
      const mockQueryRunner = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.IMMEDIATE,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(true);
      expect(result.shouldReject).toBe(true);
      expect(result.message).toContain('立即退回');
    });
  });

  describe('getSubTasks', () => {
    it('应该返回指定父任务的所有子任务', async () => {
      const subTasks = [
        { ...mockTask, id: 'sub-1', parentTaskId: 'parent-1' },
        { ...mockTask, id: 'sub-2', parentTaskId: 'parent-1' },
      ];
      taskRepository.find.mockResolvedValue(subTasks);

      const result = await service.getSubTasks('parent-1');

      expect(result).toHaveLength(2);
      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent-1' },
      });
    });
  });

  describe('getProgress', () => {
    it('应该返回多实例任务的完成进度', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);

      const result = await service.getProgress('task-1');

      expect(result.total).toBe(3);
      expect(result.pending).toBe(2);
      expect(result.completed).toBe(1);
      expect(result.percentage).toBe(33);
    });

    it('任务不存在时应该抛出NotFoundException', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.getProgress('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('总任务数为0时百分比应该为0', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);

      const result = await service.getProgress('task-1');

      expect(result.percentage).toBe(0);
    });
  });

  describe('setConfig', () => {
    it('应该创建并保存多实例配置', async () => {
      const newConfig = { ...mockConfig };
      configRepository.create.mockReturnValue(newConfig);
      configRepository.save.mockResolvedValue(newConfig);

      const result = await service.setConfig({
        processDefinitionId: 'proc-def-1',
        processDefinitionKey: 'process-1',
        activityId: 'approveTask',
        strategy: MultiInstanceRejectStrategy.ALL_BACK,
      });

      expect(configRepository.create).toHaveBeenCalled();
      expect(configRepository.save).toHaveBeenCalled();
      expect(result).toEqual(newConfig);
    });

    it('应该支持设置驳回百分比', async () => {
      const newConfig = { ...mockConfig, reject_percentage_: 60 };
      configRepository.create.mockReturnValue(newConfig);
      configRepository.save.mockResolvedValue(newConfig);

      const result = await service.setConfig({
        processDefinitionId: 'proc-def-1',
        processDefinitionKey: 'process-1',
        activityId: 'approveTask',
        strategy: MultiInstanceRejectStrategy.MAJORITY_BACK,
        rejectPercentage: 60,
      });

      expect(result.reject_percentage_).toBe(60);
    });
  });

  describe('事务处理', () => {
    it('事务失败时应该回滚', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(mockConfig);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      
      const mockQueryRunner = {
        connect: vi.fn().mockResolvedValue(undefined),
        startTransaction: vi.fn().mockResolvedValue(undefined),
        commitTransaction: vi.fn().mockRejectedValue(new Error('Commit failed')),
        rollbackTransaction: vi.fn().mockResolvedValue(undefined),
        release: vi.fn().mockResolvedValue(undefined),
        manager: {
          update: vi.fn().mockResolvedValue(undefined),
        },
      };
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: MultiInstanceRejectStrategy.ALL_BACK,
      };

      await expect(service.handleMultiInstanceReject(params)).rejects.toThrow('Commit failed');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('边界情况', () => {
    it('未知策略应该返回失败', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue({ ...mockConfig, reject_strategy_: 'UNKNOWN' as any });
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
        strategy: 'UNKNOWN' as any,
      };

      const result = await service.handleMultiInstanceReject(params);

      expect(result.success).toBe(false);
      expect(result.message).toContain('未知的退回策略');
    });

    it('没有配置时应该使用默认策略', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      configRepository.findOne.mockResolvedValue(null);
      
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockSiblingTasks),
      };
      taskRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      historicActivityRepository.find.mockResolvedValue([]);
      
      const mockQueryRunner = createMockQueryRunner();
      dataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

      const params: HandleMultiInstanceRejectParams = {
        taskId: 'task-1',
        userId: 'user1',
      };

      const result = await service.handleMultiInstanceReject(params);

      // 默认策略是 ALL_BACK
      expect(result.success).toBe(true);
      expect(result.shouldReject).toBe(true);
    });
  });
});
