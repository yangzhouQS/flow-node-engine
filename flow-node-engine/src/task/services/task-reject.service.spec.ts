import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm';

import { TaskRejectService } from './task-reject.service';
import { TaskRejectEntity, RejectType, RejectStatus } from '../entities/task-reject.entity';
import { RejectConfigEntity } from '../entities/reject-config.entity';
import { MultiInstanceConfigEntity, MultiInstanceRejectStrategy } from '../entities/multi-instance-config.entity';

describe('TaskRejectService', () => {
  let service: TaskRejectService;
  let taskRejectRepository: vi.Mocked<Repository<TaskRejectEntity>>;
  let rejectConfigRepository: vi.Mocked<Repository<RejectConfigEntity>>;
  let multiInstanceConfigRepository: vi.Mocked<Repository<MultiInstanceConfigEntity>>;
  let dataSource: vi.Mocked<DataSource>;

  const mockTaskReject: Partial<TaskRejectEntity> = {
    id_: 'reject-123',
    task_id_: 'task-123',
    task_def_key_: 'task-key-1',
    proc_inst_id_: 'pi-123',
    proc_def_id_: 'pd-123',
    reject_type_: RejectType.TO_PREVIOUS,
    reject_reason_: 'Test reason',
    reject_user_id_: 'user-1',
    status_: RejectStatus.PENDING,
    is_multi_instance_: false,
    create_time_: new Date(),
  };

  const mockRejectConfig: Partial<RejectConfigEntity> = {
    id_: 'config-123',
    proc_def_id_: 'pd-123',
    task_def_key_: 'task-key-1',
    task_name_: 'Test Task',
    allow_reject_: true,
    require_reason_: true,
    default_reject_type_: RejectType.TO_PREVIOUS,
    create_time_: new Date(),
    update_time_: new Date(),
  };

  const mockMultiInstanceConfig: Partial<MultiInstanceConfigEntity> = {
    id_: 'mi-config-123',
    proc_def_id_: 'pd-123',
    task_def_key_: 'task-key-1',
    is_multi_instance_: true,
    reject_strategy_: MultiInstanceRejectStrategy.ONLY_CURRENT,
    create_time_: new Date(),
    update_time_: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskRejectService,
        { provide: getRepositoryToken(TaskRejectEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(RejectConfigEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(MultiInstanceConfigEntity), useFactory: mockRepo },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<TaskRejectService>(TaskRejectService);
    taskRejectRepository = module.get(getRepositoryToken(TaskRejectEntity));
    rejectConfigRepository = module.get(getRepositoryToken(RejectConfigEntity));
    multiInstanceConfigRepository = module.get(getRepositoryToken(MultiInstanceConfigEntity));
    dataSource = module.get(DataSource);
  });

  // ==================== 驳回记录操作测试 ====================

  describe('createRejectRecord', () => {
    it('应该成功创建驳回记录', async () => {
      taskRejectRepository.save.mockResolvedValue(mockTaskReject as TaskRejectEntity);

      const result = await service.createRejectRecord({
        taskId: 'task-123',
        processInstanceId: 'pi-123',
        rejectType: RejectType.TO_PREVIOUS,
      });

      expect(result).toEqual(mockTaskReject);
      expect(taskRejectRepository.save).toHaveBeenCalled();
    });

    it('创建记录时应该正确序列化extraData', async () => {
      taskRejectRepository.save.mockResolvedValue(mockTaskReject as TaskRejectEntity);

      await service.createRejectRecord({
        taskId: 'task-123',
        processInstanceId: 'pi-123',
        rejectType: RejectType.TO_PREVIOUS,
        extraData: { key: 'value' },
      });

      const savedEntity = taskRejectRepository.save.mock.calls[0][0];
      expect(savedEntity.extra_data_).toBe(JSON.stringify({ key: 'value' }));
    });

    it('初始状态应该是PENDING', async () => {
      taskRejectRepository.save.mockResolvedValue(mockTaskReject as TaskRejectEntity);

      await service.createRejectRecord({
        taskId: 'task-123',
        processInstanceId: 'pi-123',
        rejectType: RejectType.TO_PREVIOUS,
      });

      const savedEntity = taskRejectRepository.save.mock.calls[0][0];
      expect(savedEntity.status_).toBe(RejectStatus.PENDING);
    });
  });

  describe('getRejectRecordById', () => {
    it('应该返回驳回记录', async () => {
      taskRejectRepository.findOne.mockResolvedValue(mockTaskReject as TaskRejectEntity);

      const result = await service.getRejectRecordById('reject-123');

      expect(result).toEqual(mockTaskReject);
    });

    it('记录不存在时应该返回null', async () => {
      taskRejectRepository.findOne.mockResolvedValue(null);

      const result = await service.getRejectRecordById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('queryRejectRecords', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn(),
      };
      return qb as unknown as vi.Mocked<SelectQueryBuilder<TaskRejectEntity>>;
    };

    it('应该返回查询结果', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockTaskReject as TaskRejectEntity]);
      taskRejectRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.queryRejectRecords({});

      expect(result).toHaveLength(1);
    });

    it('应该支持taskId过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      taskRejectRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryRejectRecords({ taskId: 'task-123' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('reject.task_id_ = :taskId', { taskId: 'task-123' });
    });

    it('应该支持processInstanceId过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      taskRejectRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryRejectRecords({ processInstanceId: 'pi-123' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('reject.proc_inst_id_ = :procInstId', { procInstId: 'pi-123' });
    });

    it('应该支持rejectType过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      taskRejectRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryRejectRecords({ rejectType: RejectType.TO_PREVIOUS });

      expect(mockQb.andWhere).toHaveBeenCalledWith('reject.reject_type_ = :rejectType', { rejectType: RejectType.TO_PREVIOUS });
    });

    it('应该支持status过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      taskRejectRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryRejectRecords({ status: RejectStatus.EXECUTED });

      expect(mockQb.andWhere).toHaveBeenCalledWith('reject.status_ = :status', { status: RejectStatus.EXECUTED });
    });

    it('应该支持isMultiInstance过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      taskRejectRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryRejectRecords({ isMultiInstance: true });

      expect(mockQb.andWhere).toHaveBeenCalledWith('reject.is_multi_instance_ = :isMultiInstance', { isMultiInstance: true });
    });
  });

  describe('updateRejectStatus', () => {
    it('应该更新驳回状态', async () => {
      taskRejectRepository.findOne.mockResolvedValue(mockTaskReject as TaskRejectEntity);
      taskRejectRepository.save.mockResolvedValue({
        ...mockTaskReject,
        status_: RejectStatus.EXECUTED,
        process_time_: new Date(),
      } as TaskRejectEntity);

      const result = await service.updateRejectStatus('reject-123', RejectStatus.EXECUTED);

      expect(result.status_).toBe(RejectStatus.EXECUTED);
      expect(result.process_time_).toBeDefined();
    });

    it('记录不存在时应抛出NotFoundException', async () => {
      taskRejectRepository.findOne.mockResolvedValue(null);

      await expect(service.updateRejectStatus('non-existent', RejectStatus.EXECUTED)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRejectHistoryByProcessInstance', () => {
    it('应该返回流程实例的驳回历史', async () => {
      taskRejectRepository.find.mockResolvedValue([mockTaskReject as TaskRejectEntity]);

      const result = await service.getRejectHistoryByProcessInstance('pi-123');

      expect(result).toHaveLength(1);
      expect(taskRejectRepository.find).toHaveBeenCalledWith({
        where: { proc_inst_id_: 'pi-123' },
        order: { create_time_: 'DESC' },
      });
    });
  });

  describe('deleteRejectRecord', () => {
    it('应该删除驳回记录', async () => {
      taskRejectRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.deleteRejectRecord('reject-123');

      expect(taskRejectRepository.delete).toHaveBeenCalledWith({ id_: 'reject-123' });
    });
  });

  describe('deleteRejectRecordsByProcessInstance', () => {
    it('应该删除流程实例的所有驳回记录', async () => {
      taskRejectRepository.delete.mockResolvedValue({ affected: 3, raw: [] });

      await service.deleteRejectRecordsByProcessInstance('pi-123');

      expect(taskRejectRepository.delete).toHaveBeenCalledWith({ proc_inst_id_: 'pi-123' });
    });
  });

  // ==================== 驳回配置操作测试 ====================

  describe('createRejectConfig', () => {
    it('应该成功创建驳回配置', async () => {
      rejectConfigRepository.save.mockResolvedValue(mockRejectConfig as RejectConfigEntity);

      const result = await service.createRejectConfig({
        processDefinitionId: 'pd-123',
        taskDefKey: 'task-key-1',
      });

      expect(result).toEqual(mockRejectConfig);
    });

    it('创建配置时应该正确序列化allowedRejectTypes', async () => {
      rejectConfigRepository.save.mockResolvedValue(mockRejectConfig as RejectConfigEntity);

      await service.createRejectConfig({
        processDefinitionId: 'pd-123',
        taskDefKey: 'task-key-1',
        allowedRejectTypes: [RejectType.TO_PREVIOUS, RejectType.TO_STARTER],
      });

      const savedEntity = rejectConfigRepository.save.mock.calls[0][0];
      expect(savedEntity.allowed_reject_types_).toBe(JSON.stringify([RejectType.TO_PREVIOUS, RejectType.TO_STARTER]));
    });
  });

  describe('getRejectConfig', () => {
    it('应该返回驳回配置', async () => {
      rejectConfigRepository.findOne.mockResolvedValue(mockRejectConfig as RejectConfigEntity);

      const result = await service.getRejectConfig('pd-123', 'task-key-1');

      expect(result).toEqual(mockRejectConfig);
    });

    it('配置不存在时应该返回null', async () => {
      rejectConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.getRejectConfig('pd-123', 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getRejectConfigsByProcessDefinition', () => {
    it('应该返回流程定义的所有配置', async () => {
      rejectConfigRepository.find.mockResolvedValue([mockRejectConfig as RejectConfigEntity]);

      const result = await service.getRejectConfigsByProcessDefinition('pd-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('updateRejectConfig', () => {
    it('应该更新驳回配置', async () => {
      rejectConfigRepository.findOne.mockResolvedValue(mockRejectConfig as RejectConfigEntity);
      rejectConfigRepository.save.mockResolvedValue({
        ...mockRejectConfig,
        task_name_: 'Updated Task',
      } as RejectConfigEntity);

      const result = await service.updateRejectConfig('config-123', { taskName: 'Updated Task' });

      expect(result.task_name_).toBe('Updated Task');
    });

    it('配置不存在时应抛出NotFoundException', async () => {
      rejectConfigRepository.findOne.mockResolvedValue(null);

      await expect(service.updateRejectConfig('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRejectConfig', () => {
    it('应该删除驳回配置', async () => {
      rejectConfigRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.deleteRejectConfig('config-123');

      expect(rejectConfigRepository.delete).toHaveBeenCalledWith({ id_: 'config-123' });
    });
  });

  describe('isRejectAllowed', () => {
    it('配置存在且允许驳回时应该返回true', async () => {
      const allowConfig = { ...mockRejectConfig, allow_reject_: true };
      rejectConfigRepository.findOne.mockResolvedValue(allowConfig as RejectConfigEntity);

      const result = await service.isRejectAllowed('pd-123', 'task-key-1');

      expect(result).toBe(true);
    });

    it('配置存在但不允许驳回时应该返回false', async () => {
      const disallowConfig = { ...mockRejectConfig, allow_reject_: false };
      rejectConfigRepository.findOne.mockResolvedValue(disallowConfig as RejectConfigEntity);

      const result = await service.isRejectAllowed('pd-123', 'task-key-1');

      expect(result).toBe(false);
    });

    it('配置不存在时默认允许驳回', async () => {
      rejectConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.isRejectAllowed('pd-123', 'task-key-1');

      expect(result).toBe(true);
    });
  });

  describe('getAllowedRejectTypes', () => {
    it('应该返回允许的驳回类型', async () => {
      const configWithTypes = {
        ...mockRejectConfig,
        allowed_reject_types_: JSON.stringify([RejectType.TO_PREVIOUS, RejectType.TO_STARTER]),
      };
      rejectConfigRepository.findOne.mockResolvedValue(configWithTypes as RejectConfigEntity);

      const result = await service.getAllowedRejectTypes('pd-123', 'task-key-1');

      expect(result).toEqual([RejectType.TO_PREVIOUS, RejectType.TO_STARTER]);
    });

    it('配置不存在时应该返回所有类型', async () => {
      rejectConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.getAllowedRejectTypes('pd-123', 'task-key-1');

      expect(result).toEqual(Object.values(RejectType));
    });
  });

  // ==================== 多实例配置操作测试 ====================

  describe('createMultiInstanceConfig', () => {
    it('应该成功创建多实例配置', async () => {
      multiInstanceConfigRepository.save.mockResolvedValue(mockMultiInstanceConfig as MultiInstanceConfigEntity);

      const result = await service.createMultiInstanceConfig({
        processDefinitionId: 'pd-123',
        taskDefKey: 'task-key-1',
      });

      expect(result).toEqual(mockMultiInstanceConfig);
    });
  });

  describe('getMultiInstanceConfig', () => {
    it('应该返回多实例配置', async () => {
      multiInstanceConfigRepository.findOne.mockResolvedValue(mockMultiInstanceConfig as MultiInstanceConfigEntity);

      const result = await service.getMultiInstanceConfig('pd-123', 'task-key-1');

      expect(result).toEqual(mockMultiInstanceConfig);
    });
  });

  describe('updateMultiInstanceConfig', () => {
    it('应该更新多实例配置', async () => {
      multiInstanceConfigRepository.findOne.mockResolvedValue(mockMultiInstanceConfig as MultiInstanceConfigEntity);
      multiInstanceConfigRepository.save.mockResolvedValue({
        ...mockMultiInstanceConfig,
        reject_strategy_: MultiInstanceRejectStrategy.ALL_BACK,
      } as MultiInstanceConfigEntity);

      const result = await service.updateMultiInstanceConfig('mi-config-123', {
        rejectStrategy: MultiInstanceRejectStrategy.ALL_BACK,
      });

      expect(result.reject_strategy_).toBe(MultiInstanceRejectStrategy.ALL_BACK);
    });

    it('配置不存在时应抛出NotFoundException', async () => {
      multiInstanceConfigRepository.findOne.mockResolvedValue(null);

      await expect(service.updateMultiInstanceConfig('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteMultiInstanceConfig', () => {
    it('应该删除多实例配置', async () => {
      multiInstanceConfigRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.deleteMultiInstanceConfig('mi-config-123');

      expect(multiInstanceConfigRepository.delete).toHaveBeenCalledWith({ id_: 'mi-config-123' });
    });
  });

  describe('getMultiInstanceRejectStrategy', () => {
    it('应该返回配置的驳回策略', async () => {
      multiInstanceConfigRepository.findOne.mockResolvedValue(mockMultiInstanceConfig as MultiInstanceConfigEntity);

      const result = await service.getMultiInstanceRejectStrategy('pd-123', 'task-key-1');

      expect(result).toBe(MultiInstanceRejectStrategy.ALL_BACK);
    });

    it('配置不存在时应该返回默认策略', async () => {
      multiInstanceConfigRepository.findOne.mockResolvedValue(null);

      const result = await service.getMultiInstanceRejectStrategy('pd-123', 'task-key-1');

      expect(result).toBe(MultiInstanceRejectStrategy.ONLY_CURRENT);
    });

    it('非多实例配置应该返回默认策略', async () => {
      const nonMiConfig = { ...mockMultiInstanceConfig, is_multi_instance_: false };
      multiInstanceConfigRepository.findOne.mockResolvedValue(nonMiConfig as MultiInstanceConfigEntity);

      const result = await service.getMultiInstanceRejectStrategy('pd-123', 'task-key-1');

      expect(result).toBe(MultiInstanceRejectStrategy.ONLY_CURRENT);
    });
  });

  // ==================== Controller兼容方法测试 ====================

  describe('reject', () => {
    it('应该执行驳回操作', async () => {
      taskRejectRepository.save.mockResolvedValue({
        ...mockTaskReject,
        status_: RejectStatus.EXECUTED,
        process_time_: new Date(),
      } as TaskRejectEntity);

      const result = await service.reject({
        taskId: 'task-123',
        userId: 'user-1',
        reason: 'Test reason',
      });

      expect(result.status_).toBe(RejectStatus.EXECUTED);
      expect(result.reject_user_id_).toBe('user-1');
    });
  });

  describe('batchReject', () => {
    it('应该批量执行驳回操作', async () => {
      taskRejectRepository.save.mockResolvedValue(mockTaskReject as TaskRejectEntity);

      const result = await service.batchReject({
        taskIds: ['task-1', 'task-2'],
        userId: 'user-1',
        reason: 'Batch reject',
      });

      expect(result).toHaveLength(2);
    });
  });

  describe('getRejectableNodes', () => {
    it('应该返回可退回节点列表', async () => {
      const result = await service.getRejectableNodes('task-123');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('queryRejectRecordsWithPaging', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn(),
      };
      return qb as unknown as vi.Mocked<SelectQueryBuilder<TaskRejectEntity>>;
    };

    it('应该返回分页结果', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockTaskReject as TaskRejectEntity], 1]);
      taskRejectRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.queryRejectRecordsWithPaging({ page: 1, pageSize: 10 });

      expect(result.total).toBe(1);
      expect(result.list).toHaveLength(1);
    });

    it('应该正确计算分页偏移量', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      taskRejectRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryRejectRecordsWithPaging({ page: 3, pageSize: 20 });

      expect(mockQb.skip).toHaveBeenCalledWith(40);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });
  });

  describe('handleMultiInstanceReject', () => {
    it('应该成功处理多实例驳回', async () => {
      taskRejectRepository.save.mockResolvedValue(mockTaskReject as TaskRejectEntity);
      taskRejectRepository.findOne.mockResolvedValue(mockTaskReject as TaskRejectEntity);

      const result = await service.handleMultiInstanceReject({
        taskId: 'task-123',
        userId: 'user-1',
        reason: 'Multi-instance reject',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('checkCanReject', () => {
    it('应该返回可驳回状态', async () => {
      const result = await service.checkCanReject('task-123', 'user-1');

      expect(result.canReject).toBeDefined();
    });
  });

  // ==================== 转换方法测试 ====================

  describe('toTaskRejectInfo', () => {
    it('应该正确转换实体为信息对象', () => {
      const entity = {
        ...mockTaskReject,
        extra_data_: JSON.stringify({ key: 'value' }),
      } as TaskRejectEntity;

      const result = service.toTaskRejectInfo(entity);

      expect(result.id).toBe('reject-123');
      expect(result.taskId).toBe('task-123');
      expect(result.extraData).toEqual({ key: 'value' });
    });
  });

  describe('toRejectConfigInfo', () => {
    it('应该正确转换配置实体为信息对象', () => {
      const entity = {
        ...mockRejectConfig,
        allowed_reject_types_: JSON.stringify([RejectType.TO_PREVIOUS]),
      } as RejectConfigEntity;

      const result = service.toRejectConfigInfo(entity);

      expect(result.id).toBe('config-123');
      expect(result.allowedRejectTypes).toEqual([RejectType.TO_PREVIOUS]);
    });
  });

  describe('toMultiInstanceConfigInfo', () => {
    it('应该正确转换多实例配置实体为信息对象', () => {
      const entity = {
        ...mockMultiInstanceConfig,
        extra_config_: JSON.stringify({ custom: 'config' }),
      } as MultiInstanceConfigEntity;

      const result = service.toMultiInstanceConfigInfo(entity);

      expect(result.id).toBe('mi-config-123');
      expect(result.extraConfig).toEqual({ custom: 'config' });
    });
  });
});
