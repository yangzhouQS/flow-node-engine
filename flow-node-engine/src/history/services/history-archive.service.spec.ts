import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';

import { HistoricActivityInstance } from '../entities/historic-activity-instance.entity';
import { HistoricProcessInstance } from '../entities/historic-process-instance.entity';
import { HistoricTaskInstance } from '../entities/historic-task-instance.entity';
import { HistoricVariableInstanceEntity } from '../entities/historic-variable-instance.entity';
import { HistoryArchiveService, ArchiveConfig, ArchiveResult } from './history-archive.service';

describe('HistoryArchiveService', () => {
  let service: HistoryArchiveService;
  let taskRepository: Mocked<Repository<HistoricTaskInstance>>;
  let activityRepository: Mocked<Repository<HistoricActivityInstance>>;
  let processRepository: Mocked<Repository<HistoricProcessInstance>>;
  let variableRepository: Mocked<Repository<HistoricVariableInstanceEntity>>;
  let dataSource: {
    createQueryRunner: vi.Mock;
    query: vi.Mock;
  };

  const mockTaskInstance: HistoricTaskInstance = {
    id: 'task-1',
    taskId: 'runtime-task-1',
    taskDefinitionKey: 'userTask1',
    taskDefinitionId: 'task-def-1',
    taskDefinitionVersion: 1,
    processInstanceId: 'process-1',
    processDefinitionId: 'proc-def-1',
    processDefinitionKey: 'test-process',
    processDefinitionVersion: 1,
    name: 'User Task 1',
    createTime: new Date('2025-01-01T10:00:00Z'),
    completionTime: new Date('2025-01-01T11:00:00Z'),
    status: 'COMPLETED' as any,
  } as HistoricTaskInstance;

  const mockProcessInstance: HistoricProcessInstance = {
    id: 'process-1',
    processInstanceId: 'runtime-process-1',
    processDefinitionId: 'proc-def-1',
    processDefinitionKey: 'test-process',
    processDefinitionVersion: 1,
    startTime: new Date('2025-01-01T09:00:00Z'),
    endTime: new Date('2025-01-01T12:00:00Z'),
    status: 'COMPLETED',
  } as HistoricProcessInstance;

  const mockQueryRunner = {
    connect: vi.fn(),
    startTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn(),
    release: vi.fn(),
    manager: {
      delete: vi.fn(),
    },
  };

  beforeEach(async () => {
    const mockTaskRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      count: vi.fn(),
    };

    const mockActivityRepo = {
      find: vi.fn(),
      count: vi.fn(),
    };

    const mockProcessRepo = {
      find: vi.fn(),
      findOne: vi.fn(),
      count: vi.fn(),
    };

    const mockVariableRepo = {
      find: vi.fn(),
      count: vi.fn(),
    };

    const mockDataSource = {
      createQueryRunner: vi.fn().mockReturnValue(mockQueryRunner),
      query: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryArchiveService,
        {
          provide: getRepositoryToken(HistoricTaskInstance),
          useValue: mockTaskRepo,
        },
        {
          provide: getRepositoryToken(HistoricActivityInstance),
          useValue: mockActivityRepo,
        },
        {
          provide: getRepositoryToken(HistoricProcessInstance),
          useValue: mockProcessRepo,
        },
        {
          provide: getRepositoryToken(HistoricVariableInstanceEntity),
          useValue: mockVariableRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<HistoryArchiveService>(HistoryArchiveService);
    taskRepository = module.get(getRepositoryToken(HistoricTaskInstance));
    activityRepository = module.get(getRepositoryToken(HistoricActivityInstance));
    processRepository = module.get(getRepositoryToken(HistoricProcessInstance));
    variableRepository = module.get(getRepositoryToken(HistoricVariableInstanceEntity));
    dataSource = module.get(DataSource);

    // 重置mock
    mockQueryRunner.connect.mockClear();
    mockQueryRunner.startTransaction.mockClear();
    mockQueryRunner.commitTransaction.mockClear();
    mockQueryRunner.rollbackTransaction.mockClear();
    mockQueryRunner.release.mockClear();
    mockQueryRunner.manager.delete.mockClear();
  });

  describe('updateConfig', () => {
    it('应该更新归档配置', () => {
      const newConfig: Partial<ArchiveConfig> = {
        retentionDays: 180,
        enableAutoArchive: false,
      };

      service.updateConfig(newConfig);
      const config = service.getConfig();

      expect(config.retentionDays).toBe(180);
      expect(config.enableAutoArchive).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('应该返回当前配置', () => {
      const config = service.getConfig();

      expect(config).toHaveProperty('retentionDays');
      expect(config).toHaveProperty('archiveBatchSize');
      expect(config).toHaveProperty('enableAutoArchive');
    });
  });

  describe('archiveProcessInstance', () => {
    it('应该归档指定流程实例的历史数据', async () => {
      mockQueryRunner.manager.delete
        .mockResolvedValueOnce({ affected: 2 }) // tasks
        .mockResolvedValueOnce({ affected: 3 }) // activities
        .mockResolvedValueOnce({ affected: 5 }) // variables
        .mockResolvedValueOnce({ affected: 1 }); // process

      const result = await service.archiveProcessInstance('process-1');

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();

      expect(result.archivedTasks).toBe(2);
      expect(result.archivedActivities).toBe(3);
      expect(result.archivedVariables).toBe(5);
      expect(result.archivedProcessInstances).toBe(1);
      expect(result.totalArchived).toBe(11);
    });

    it('归档失败时应该回滚事务', async () => {
      mockQueryRunner.manager.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.archiveProcessInstance('process-1')).rejects.toThrow('Database error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('getArchiveStatistics', () => {
    it('应该返回归档统计信息', async () => {
      taskRepository.count.mockResolvedValue(10);
      activityRepository.count.mockResolvedValue(20);
      processRepository.count.mockResolvedValue(5);
      variableRepository.count.mockResolvedValue(30);
      taskRepository.findOne.mockResolvedValue(mockTaskInstance);
      dataSource.query.mockResolvedValue([
        { month: '2025-01', count: 5 },
        { month: '2025-02', count: 3 },
      ]);

      const result = await service.getArchiveStatistics();

      expect(result.totalRecords).toBe(65); // 10 + 20 + 5 + 30
      expect(result.oldestRecord).toEqual(mockTaskInstance.createTime);
      expect(result.recordsByMonth).toHaveLength(2);
    });

    it('没有记录时应该返回null时间', async () => {
      taskRepository.count.mockResolvedValue(0);
      activityRepository.count.mockResolvedValue(0);
      processRepository.count.mockResolvedValue(0);
      variableRepository.count.mockResolvedValue(0);
      taskRepository.findOne.mockResolvedValue(null);
      dataSource.query.mockResolvedValue([]);

      const result = await service.getArchiveStatistics();

      expect(result.totalRecords).toBe(0);
      expect(result.oldestRecord).toBeNull();
      expect(result.newestRecord).toBeNull();
    });
  });

  describe('previewArchiveData', () => {
    it('应该预览将要归档的数据', async () => {
      taskRepository.find.mockResolvedValue([mockTaskInstance]);
      processRepository.find.mockResolvedValue([mockProcessInstance]);
      taskRepository.count.mockResolvedValue(10);
      activityRepository.count.mockResolvedValue(20);
      processRepository.count.mockResolvedValue(5);
      variableRepository.count.mockResolvedValue(30);

      const beforeDate = new Date('2025-06-01');
      const result = await service.previewArchiveData(beforeDate);

      expect(result.tasks).toHaveLength(1);
      expect(result.processInstances).toHaveLength(1);
      expect(result.counts.tasks).toBe(10);
      expect(result.counts.activities).toBe(20);
      expect(result.counts.processInstances).toBe(5);
      expect(result.counts.variables).toBe(30);
    });

    it('应该限制返回的预览记录数', async () => {
      taskRepository.find.mockResolvedValue([mockTaskInstance]);
      processRepository.find.mockResolvedValue([mockProcessInstance]);
      taskRepository.count.mockResolvedValue(100);
      activityRepository.count.mockResolvedValue(200);
      processRepository.count.mockResolvedValue(50);
      variableRepository.count.mockResolvedValue(300);

      const beforeDate = new Date('2025-06-01');
      const result = await service.previewArchiveData(beforeDate, 50);

      expect(taskRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });
  });

  describe('needsArchive', () => {
    it('有需要归档的数据时应该返回true', async () => {
      taskRepository.count.mockResolvedValue(10);

      const result = await service.needsArchive();

      expect(result).toBe(true);
    });

    it('没有需要归档的数据时应该返回false', async () => {
      taskRepository.count.mockResolvedValue(0);

      const result = await service.needsArchive();

      expect(result).toBe(false);
    });
  });

  describe('archiveOldData', () => {
    it('应该归档旧数据', async () => {
      // 模拟find返回空数组（没有需要归档的数据）
      taskRepository.find.mockResolvedValue([]);
      activityRepository.find.mockResolvedValue([]);
      processRepository.find.mockResolvedValue([]);
      variableRepository.find.mockResolvedValue([]);

      const result = await service.archiveOldData(new Date('2025-01-01'));

      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('归档失败时应该回滚', async () => {
      taskRepository.find.mockRejectedValue(new Error('Query error'));

      await expect(service.archiveOldData()).rejects.toThrow('Query error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('默认配置', () => {
    it('默认保留天数应该是365天', () => {
      const config = service.getConfig();
      expect(config.retentionDays).toBe(365);
    });

    it('默认批次大小应该是1000', () => {
      const config = service.getConfig();
      expect(config.archiveBatchSize).toBe(1000);
    });

    it('默认应该启用自动归档', () => {
      const config = service.getConfig();
      expect(config.enableAutoArchive).toBe(true);
    });
  });
});
