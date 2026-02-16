import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';

import { CcConfigEntity } from '../entities/cc-config.entity';
import { CcRecordEntity, CcType, CcStatus } from '../entities/cc-record.entity';
import { CcService } from './cc.service';

describe('CcService', () => {
  let service: CcService;
  let ccRecordRepository: Mocked<Repository<CcRecordEntity>>;
  let ccConfigRepository: Mocked<Repository<CcConfigEntity>>;

  const mockCcRecord: Partial<CcRecordEntity> = {
    id_: 'cc-123',
    proc_inst_id_: 'pi-123',
    proc_def_id_: 'pd-123',
    task_id_: 'task-123',
    task_def_key_: 'task-key-1',
    cc_type_: CcType.MANUAL,
    cc_from_user_id_: 'user-1',
    cc_from_user_name_: 'User One',
    cc_to_user_id_: 'user-2',
    cc_to_user_name_: 'User Two',
    cc_reason_: 'Test reason',
    status_: CcStatus.UNREAD,
    create_time_: new Date(),
  };

  const mockCcConfig: Partial<CcConfigEntity> = {
    id_: 'config-123',
    proc_def_id_: 'pd-123',
    task_def_key_: 'task-key-1',
    task_name_: 'Test Task',
    cc_type_: CcType.AUTO,
    enabled_: true,
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
      count: vi.fn(),
      createQueryBuilder: vi.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CcService,
        { provide: getRepositoryToken(CcRecordEntity), useFactory: mockRepo },
        { provide: getRepositoryToken(CcConfigEntity), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<CcService>(CcService);
    ccRecordRepository = module.get(getRepositoryToken(CcRecordEntity));
    ccConfigRepository = module.get(getRepositoryToken(CcConfigEntity));
  });

  describe('createCcRecord', () => {
    it('应该成功创建抄送记录', async () => {
      ccRecordRepository.save.mockResolvedValue(mockCcRecord as CcRecordEntity);

      const result = await service.createCcRecord({
        processInstanceId: 'pi-123',
        ccType: CcType.MANUAL,
        ccFromUserId: 'user-1',
        ccToUserId: 'user-2',
      });

      expect(result).toEqual(mockCcRecord);
      expect(ccRecordRepository.save).toHaveBeenCalled();
    });

    it('创建记录时应该正确序列化extraData', async () => {
      ccRecordRepository.save.mockResolvedValue(mockCcRecord as CcRecordEntity);

      await service.createCcRecord({
        processInstanceId: 'pi-123',
        ccType: CcType.MANUAL,
        ccFromUserId: 'user-1',
        ccToUserId: 'user-2',
        extraData: { key: 'value' },
      });

      const savedEntity = ccRecordRepository.save.mock.calls[0][0];
      expect(savedEntity.extra_data_).toBe(JSON.stringify({ key: 'value' }));
    });
  });

  describe('batchCreateCcRecords', () => {
    it('应该批量创建抄送记录', async () => {
      const records = [
        { ...mockCcRecord, id_: 'cc-1', cc_to_user_id_: 'user-2' },
        { ...mockCcRecord, id_: 'cc-2', cc_to_user_id_: 'user-3' },
      ];
      ccRecordRepository.save.mockResolvedValue(records as CcRecordEntity[]);

      const result = await service.batchCreateCcRecords({
        processInstanceId: 'pi-123',
        ccFromUserId: 'user-1',
        ccToUserIds: ['user-2', 'user-3'],
      });

      expect(result).toHaveLength(2);
    });

    it('应该为每个接收人创建独立记录', async () => {
      ccRecordRepository.save.mockResolvedValue([]as CcRecordEntity[]);

      await service.batchCreateCcRecords({
        processInstanceId: 'pi-123',
        ccFromUserId: 'user-1',
        ccToUserIds: ['user-2', 'user-3', 'user-4'],
      });

      const savedEntities = ccRecordRepository.save.mock.calls[0][0];
      expect(savedEntities).toHaveLength(3);
    });

    it('应该正确映射用户名称', async () => {
      ccRecordRepository.save.mockResolvedValue([]as CcRecordEntity[]);

      await service.batchCreateCcRecords({
        processInstanceId: 'pi-123',
        ccFromUserId: 'user-1',
        ccToUserIds: ['user-2'],
        ccToUserNames: { 'user-2': 'User Two Name' },
      });

      const savedEntities = ccRecordRepository.save.mock.calls[0][0];
      expect(savedEntities[0].cc_to_user_name_).toBe('User Two Name');
    });
  });

  describe('getCcRecordById', () => {
    it('应该返回抄送记录', async () => {
      ccRecordRepository.findOne.mockResolvedValue(mockCcRecord as CcRecordEntity);

      const result = await service.getCcRecordById('cc-123');

      expect(result).toEqual(mockCcRecord);
    });

    it('记录不存在时应该返回null', async () => {
      ccRecordRepository.findOne.mockResolvedValue(null);

      const result = await service.getCcRecordById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('queryCcRecords', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn(),
      };
      return qb as unknown as Mocked<SelectQueryBuilder<CcRecordEntity>>;
    };

    it('应该返回查询结果', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockCcRecord as CcRecordEntity]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.queryCcRecords({});

      expect(result).toHaveLength(1);
    });

    it('应该支持processInstanceId过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryCcRecords({ processInstanceId: 'pi-123' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('cc.proc_inst_id_ = :procInstId', { procInstId: 'pi-123' });
    });

    it('应该支持taskId过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryCcRecords({ taskId: 'task-123' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('cc.task_id_ = :taskId', { taskId: 'task-123' });
    });

    it('应该支持ccFromUserId过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryCcRecords({ ccFromUserId: 'user-1' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('cc.cc_from_user_id_ = :ccFromUserId', { ccFromUserId: 'user-1' });
    });

    it('应该支持ccToUserId过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryCcRecords({ ccToUserId: 'user-2' });

      expect(mockQb.andWhere).toHaveBeenCalledWith('cc.cc_to_user_id_ = :ccToUserId', { ccToUserId: 'user-2' });
    });

    it('应该支持status过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.queryCcRecords({ status: CcStatus.UNREAD });

      expect(mockQb.andWhere).toHaveBeenCalledWith('cc.status_ = :status', { status: CcStatus.UNREAD });
    });
  });

  describe('getCcInboxForUser', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn(),
        getMany: vi.fn(),
      };
      return qb as unknown as Mocked<SelectQueryBuilder<CcRecordEntity>>;
    };

    it('应该返回用户收件箱', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(1);
      mockQb.getMany.mockResolvedValue([mockCcRecord as CcRecordEntity]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getCcInboxForUser('user-2');

      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该正确计算分页偏移量', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(0);
      mockQb.getMany.mockResolvedValue([]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.getCcInboxForUser('user-2', 3, 20);

      expect(mockQb.skip).toHaveBeenCalledWith(40);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });
  });

  describe('getCcOutboxForUser', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn(),
        getMany: vi.fn(),
      };
      return qb as unknown as Mocked<SelectQueryBuilder<CcRecordEntity>>;
    };

    it('应该返回用户发件箱', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(1);
      mockQb.getMany.mockResolvedValue([mockCcRecord as CcRecordEntity]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getCcOutboxForUser('user-1');

      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getCcRecordsByProcessInstance', () => {
    it('应该返回流程实例的抄送记录', async () => {
      ccRecordRepository.find.mockResolvedValue([mockCcRecord as CcRecordEntity]);

      const result = await service.getCcRecordsByProcessInstance('pi-123');

      expect(result).toHaveLength(1);
      expect(ccRecordRepository.find).toHaveBeenCalledWith({
        where: { proc_inst_id_: 'pi-123' },
        order: { create_time_: 'DESC' },
      });
    });
  });

  describe('markAsRead', () => {
    it('应该标记抄送为已读', async () => {
      ccRecordRepository.findOne.mockResolvedValue(mockCcRecord as CcRecordEntity);
      ccRecordRepository.save.mockResolvedValue({
        ...mockCcRecord,
        status_: CcStatus.READ,
        read_time_: new Date(),
      } as CcRecordEntity);

      const result = await service.markAsRead('cc-123');

      expect(result.status_).toBe(CcStatus.READ);
      expect(result.read_time_).toBeDefined();
    });

    it('记录不存在时应抛出NotFoundException', async () => {
      ccRecordRepository.findOne.mockResolvedValue(null);

      await expect(service.markAsRead('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('batchMarkAsRead', () => {
    it('应该批量标记已读', async () => {
      ccRecordRepository.update.mockResolvedValue({ affected: 2, generatedMaps: [], raw: [] });

      await service.batchMarkAsRead(['cc-1', 'cc-2']);

      expect(ccRecordRepository.update).toHaveBeenCalled();
    });
  });

  describe('markAllAsReadForUser', () => {
    it('应该标记用户所有抄送为已读', async () => {
      ccRecordRepository.update.mockResolvedValue({ affected: 5, generatedMaps: [], raw: [] });

      await service.markAllAsReadForUser('user-2');

      expect(ccRecordRepository.update).toHaveBeenCalledWith(
        { cc_to_user_id_: 'user-2', status_: CcStatus.UNREAD },
        expect.objectContaining({ status_: CcStatus.READ })
      );
    });
  });

  describe('getUnreadCountForUser', () => {
    it('应该返回用户未读数量', async () => {
      ccRecordRepository.count.mockResolvedValue(5);

      const result = await service.getUnreadCountForUser('user-2');

      expect(result).toBe(5);
    });
  });

  describe('deleteCcRecord', () => {
    it('应该删除抄送记录', async () => {
      ccRecordRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.deleteCcRecord('cc-123');

      expect(ccRecordRepository.delete).toHaveBeenCalledWith({ id_: 'cc-123' });
    });
  });

  describe('deleteCcRecordsByProcessInstance', () => {
    it('应该删除流程实例的所有抄送记录', async () => {
      ccRecordRepository.delete.mockResolvedValue({ affected: 3, raw: [] });

      await service.deleteCcRecordsByProcessInstance('pi-123');

      expect(ccRecordRepository.delete).toHaveBeenCalledWith({ proc_inst_id_: 'pi-123' });
    });
  });

  // ==================== 抄送配置测试 ====================

  describe('createCcConfig', () => {
    it('应该成功创建抄送配置', async () => {
      ccConfigRepository.save.mockResolvedValue(mockCcConfig as CcConfigEntity);

      const result = await service.createCcConfig({
        processDefinitionId: 'pd-123',
      });

      expect(result).toEqual(mockCcConfig);
    });

    it('创建配置时应该正确序列化ccToUsers', async () => {
      ccConfigRepository.save.mockResolvedValue(mockCcConfig as CcConfigEntity);

      await service.createCcConfig({
        processDefinitionId: 'pd-123',
        ccToUsers: ['user-1', 'user-2'],
      });

      const savedEntity = ccConfigRepository.save.mock.calls[0][0];
      expect(savedEntity.cc_to_users_).toBe(JSON.stringify(['user-1', 'user-2']));
    });
  });

  describe('getCcConfig', () => {
    it('应该返回指定流程和任务的配置', async () => {
      ccConfigRepository.findOne.mockResolvedValue(mockCcConfig as CcConfigEntity);

      const result = await service.getCcConfig('pd-123', 'task-key-1');

      expect(result).toEqual(mockCcConfig);
    });

    it('没有taskDefKey时应该返回流程级别配置', async () => {
      const flowLevelConfig = { ...mockCcConfig, task_def_key_: null };
      ccConfigRepository.findOne.mockResolvedValue(flowLevelConfig as CcConfigEntity);

      const result = await service.getCcConfig('pd-123');

      expect(ccConfigRepository.findOne).toHaveBeenCalledWith({
        where: {
          proc_def_id_: 'pd-123',
          task_def_key_: null as any,
        },
      });
    });
  });

  describe('getCcConfigsByProcessDefinition', () => {
    it('应该返回流程定义的所有配置', async () => {
      ccConfigRepository.find.mockResolvedValue([mockCcConfig as CcConfigEntity]);

      const result = await service.getCcConfigsByProcessDefinition('pd-123');

      expect(result).toHaveLength(1);
    });
  });

  describe('updateCcConfig', () => {
    it('应该更新抄送配置', async () => {
      ccConfigRepository.findOne.mockResolvedValue(mockCcConfig as CcConfigEntity);
      ccConfigRepository.save.mockResolvedValue({
        ...mockCcConfig,
        task_name_: 'Updated Task',
      } as CcConfigEntity);

      const result = await service.updateCcConfig('config-123', { taskName: 'Updated Task' });

      expect(result.task_name_).toBe('Updated Task');
    });

    it('配置不存在时应抛出NotFoundException', async () => {
      ccConfigRepository.findOne.mockResolvedValue(null);

      await expect(service.updateCcConfig('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCcConfig', () => {
    it('应该删除抄送配置', async () => {
      ccConfigRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.deleteCcConfig('config-123');

      expect(ccConfigRepository.delete).toHaveBeenCalledWith({ id_: 'config-123' });
    });
  });

  describe('getEnabledCcConfigs', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn(),
      };
      return qb as unknown as Mocked<SelectQueryBuilder<CcConfigEntity>>;
    };

    it('应该返回启用的配置', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([mockCcConfig as CcConfigEntity]);
      ccConfigRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getEnabledCcConfigs('pd-123');

      expect(result).toHaveLength(1);
    });

    it('应该过滤启用的配置', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getMany.mockResolvedValue([]);
      ccConfigRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.getEnabledCcConfigs('pd-123');

      expect(mockQb.where).toHaveBeenCalledWith('config.proc_def_id_ = :procDefId', { procDefId: 'pd-123' });
      expect(mockQb.andWhere).toHaveBeenCalledWith('config.enabled_ = :enabled', { enabled: true });
    });
  });

  // ==================== Controller 接口方法测试 ====================

  describe('create (Controller接口)', () => {
    it('应该创建抄送', async () => {
      ccRecordRepository.save.mockResolvedValue([mockCcRecord as CcRecordEntity]);

      const result = await service.create({
        processInstanceId: 'pi-123',
        userIds: ['user-2'],
        fromUserId: 'user-1',
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('getMyCCList', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getCount: vi.fn(),
        getMany: vi.fn(),
      };
      return qb as unknown as Mocked<SelectQueryBuilder<CcRecordEntity>>;
    };

    it('应该返回用户抄送列表', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(1);
      mockQb.getMany.mockResolvedValue([mockCcRecord as CcRecordEntity]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);
      ccRecordRepository.count.mockResolvedValue(1);

      const result = await service.getMyCCList({
        userId: 'user-2',
        page: 1,
        pageSize: 20,
      });

      expect(result.total).toBe(1);
      expect(result.unreadCount).toBe(1);
      expect(result.list).toHaveLength(1);
    });

    it('应该支持status过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(0);
      mockQb.getMany.mockResolvedValue([]);
      ccRecordRepository.createQueryBuilder.mockReturnValue(mockQb);
      ccRecordRepository.count.mockResolvedValue(0);

      await service.getMyCCList({
        userId: 'user-2',
        status: CcStatus.UNREAD,
        page: 1,
        pageSize: 20,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith('cc.status_ = :status', { status: CcStatus.UNREAD });
    });
  });

  describe('getStatistics', () => {
    it('应该返回统计信息', async () => {
      ccRecordRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20)// unread
        .mockResolvedValueOnce(70) // read
        .mockResolvedValueOnce(10); // archived

      const result = await service.getStatistics('user-2');

      expect(result.total).toBe(100);
      expect(result.unread).toBe(20);
      expect(result.read).toBe(70);
      expect(result.archived).toBe(10);
    });
  });

  describe('getDetail', () => {
    it('应该返回抄送详情', async () => {
      ccRecordRepository.findOne.mockResolvedValue(mockCcRecord as CcRecordEntity);

      const result = await service.getDetail('cc-123', 'user-2');

      expect(result.id_).toBe('cc-123');
    });

    it('记录不存在时应抛出NotFoundException', async () => {
      ccRecordRepository.findOne.mockResolvedValue(null);

      await expect(service.getDetail('non-existent', 'user-2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsReadWithUser', () => {
    it('应该标记已读', async () => {
      ccRecordRepository.findOne.mockResolvedValue(mockCcRecord as CcRecordEntity);
      ccRecordRepository.save.mockResolvedValue({
        ...mockCcRecord,
        status_: CcStatus.READ,
      } as CcRecordEntity);

      const result = await service.markAsReadWithUser('cc-123', 'user-2');

      expect(result.status_).toBe(CcStatus.READ);
    });

    it('用户不匹配时应抛出NotFoundException', async () => {
      ccRecordRepository.findOne.mockResolvedValue(mockCcRecord as CcRecordEntity);

      await expect(service.markAsReadWithUser('cc-123', 'wrong-user')).rejects.toThrow('无权操作此抄送记录');
    });
  });

  describe('archive', () => {
    it('应该归档抄送', async () => {
      ccRecordRepository.findOne.mockResolvedValue(mockCcRecord as CcRecordEntity);
      ccRecordRepository.save.mockResolvedValue({
        ...mockCcRecord,
        status_: CcStatus.ARCHIVED,
      } as CcRecordEntity);

      const result = await service.archive('cc-123', 'user-2');

      expect(result.status_).toBe(CcStatus.ARCHIVED);
    });

    it('用户不匹配时应抛出NotFoundException', async () => {
      ccRecordRepository.findOne.mockResolvedValue(mockCcRecord as CcRecordEntity);

      await expect(service.archive('cc-123', 'wrong-user')).rejects.toThrow('无权操作此抄送记录');
    });
  });

  describe('deleteWithUser', () => {
    it('应该删除抄送', async () => {
      ccRecordRepository.findOne.mockResolvedValue(mockCcRecord as CcRecordEntity);
      ccRecordRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.deleteWithUser('cc-123', 'user-2');

      expect(ccRecordRepository.delete).toHaveBeenCalledWith({ id_: 'cc-123' });
    });

    it('用户不匹配时应抛出NotFoundException', async () => {
      ccRecordRepository.findOne.mockResolvedValue(mockCcRecord as CcRecordEntity);

      await expect(service.deleteWithUser('cc-123', 'wrong-user')).rejects.toThrow('无权操作此抄送记录');
    });
  });

  describe('toCcRecordInfo', () => {
    it('应该正确转换实体为信息对象', () => {
      const entity = {
        ...mockCcRecord,
        extra_data_: JSON.stringify({ key: 'value' }),
      } as CcRecordEntity;

      const result = service.toCcRecordInfo(entity);

      expect(result.id).toBe('cc-123');
      expect(result.processInstanceId).toBe('pi-123');
      expect(result.extraData).toEqual({ key: 'value' });
    });
  });

  describe('toCcConfigInfo', () => {
    it('应该正确转换配置实体为信息对象', () => {
      const entity = {
        ...mockCcConfig,
        cc_to_users_: JSON.stringify(['user-1', 'user-2']),
      } as CcConfigEntity;

      const result = service.toCcConfigInfo(entity);

      expect(result.id).toBe('config-123');
      expect(result.processDefinitionId).toBe('pd-123');
      expect(result.ccToUsers).toEqual(['user-1', 'user-2']);
    });
  });
});
