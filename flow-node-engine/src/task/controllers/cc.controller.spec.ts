import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CCController } from './cc.controller';
import { CcService } from '../services/cc.service';
import { CCStatus, CCType } from '../dto/cc.dto';

describe('CCController', () => {
  let controller: CCController;
  let ccService: CcService;

  const mockCcService = {
    create: vi.fn(),
    batchCreate: vi.fn(),
    getMyCCList: vi.fn(),
    getStatistics: vi.fn(),
    getDetail: vi.fn(),
    markAsReadWithUser: vi.fn(),
    batchMarkAsReadWithUser: vi.fn(),
    updateStatus: vi.fn(),
    archive: vi.fn(),
    deleteWithUser: vi.fn(),
    query: vi.fn(),
    createConfig: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    deleteConfig: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CCController],
      providers: [{ provide: CcService, useValue: mockCcService }],
    }).compile();

    controller = module.get<CCController>(CCController);
    ccService = module.get<CcService>(CcService);
  });

  describe('create', () => {
    it('应该创建抄送', async () => {
      const dto = {
        taskId: 'task-1',
        userIds: ['user-1', 'user-2'],
        reason: '请查阅',
      };
      const mockRecords = [
        { id_: 'cc-1', task_id_: 'task-1', user_id_: 'user-1' },
        { id_: 'cc-2', task_id_: 'task-1', user_id_: 'user-2' },
      ];
      mockCcService.create.mockResolvedValue(mockRecords);

      const result = await controller.create(dto, 'from-user-1');

      expect(mockCcService.create).toHaveBeenCalledWith({
        taskId: 'task-1',
        processInstanceId: undefined,
        userIds: ['user-1', 'user-2'],
        groupIds: undefined,
        reason: '请查阅',
        type: CCType.MANUAL,
        fromUserId: 'from-user-1',
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('batchCreate', () => {
    it('应该批量创建抄送', async () => {
      const dto = {
        taskId: 'task-1',
        userIds: ['user-1', 'user-2', 'user-3'],
        reason: '批量抄送',
      };
      const mockRecords = [
        { id_: 'cc-1', task_id_: 'task-1' },
        { id_: 'cc-2', task_id_: 'task-1' },
        { id_: 'cc-3', task_id_: 'task-1' },
      ];
      mockCcService.batchCreate.mockResolvedValue(mockRecords);

      const result = await controller.batchCreate(dto, 'from-user-1');

      expect(mockCcService.batchCreate).toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });
  });

  describe('getMyCCList', () => {
    it('应该返回我的抄送列表', async () => {
      const query = { status: CCStatus.UNREAD, page: '1', pageSize: '10' };
      const mockResult = {
        total: 5,
        unreadCount: 2,
        list: [
          { id_: 'cc-1', status_: CCStatus.UNREAD },
          { id_: 'cc-2', status_: CCStatus.READ },
        ],
      };
      mockCcService.getMyCCList.mockResolvedValue(mockResult);

      const result = await controller.getMyCCList(query, 'user-1');

      expect(mockCcService.getMyCCList).toHaveBeenCalledWith({
        userId: 'user-1',
        status: CCStatus.UNREAD,
        type: undefined,
        startTimeAfter: undefined,
        startTimeBefore: undefined,
        page: 1,
        pageSize: 10,
      });
      expect(result.total).toBe(5);
      expect(result.unreadCount).toBe(2);
    });
  });

  describe('getStatistics', () => {
    it('应该返回抄送统计信息', async () => {
      const mockStats = {
        total: 100,
        unread: 20,
        read: 70,
        archived: 10,
      };
      mockCcService.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics('user-1');

      expect(mockCcService.getStatistics).toHaveBeenCalledWith('user-1');
      expect(result.totalCount).toBe(100);
      expect(result.unreadCount).toBe(20);
      expect(result.readCount).toBe(70);
      expect(result.archivedCount).toBe(10);
    });
  });

  describe('getDetail', () => {
    it('应该返回抄送详情', async () => {
      const mockDetail = {
        id_: 'cc-1',
        task_id_: 'task-1',
        task_name_: '审批任务',
        task_description_: '请审批',
        proc_inst_id_: 'proc-1',
        proc_def_key_: 'test-process',
        proc_def_name_: '测试流程',
        proc_start_time_: new Date(),
        starter_id_: 'starter-1',
        starter_name_: '发起人',
        user_id_: 'user-1',
        user_name_: '用户1',
        user_email_: 'user1@test.com',
        from_user_id_: 'from-1',
        from_user_name_: '抄送人',
        status_: CCStatus.UNREAD,
        type_: CCType.MANUAL,
        reason_: '请查阅',
        comment_: null,
        read_time_: null,
        handle_time_: null,
        create_time_: new Date(),
        task_variables_: {},
        process_variables_: {},
      };
      mockCcService.getDetail.mockResolvedValue(mockDetail);

      const result = await controller.getDetail('cc-1', 'user-1');

      expect(mockCcService.getDetail).toHaveBeenCalledWith('cc-1', 'user-1');
      expect(result.id).toBe('cc-1');
      expect(result.taskId).toBe('task-1');
    });
  });

  describe('markAsRead', () => {
    it('应该标记抄送为已读', async () => {
      const mockRecord = { id_: 'cc-1', status_: CCStatus.READ };
      mockCcService.markAsReadWithUser.mockResolvedValue(mockRecord);

      const result = await controller.markAsRead('cc-1', 'user-1');

      expect(mockCcService.markAsReadWithUser).toHaveBeenCalledWith('cc-1', 'user-1');
      expect(result.status).toBe(CCStatus.READ);
    });
  });

  describe('batchMarkAsRead', () => {
    it('应该批量标记为已读', async () => {
      mockCcService.batchMarkAsReadWithUser.mockResolvedValue(3);

      const result = await controller.batchMarkAsRead(['cc-1', 'cc-2', 'cc-3'], 'user-1');

      expect(mockCcService.batchMarkAsReadWithUser).toHaveBeenCalledWith(['cc-1', 'cc-2', 'cc-3'], 'user-1');
      expect(result).toEqual({ success: true, count: 3 });
    });
  });

  describe('updateStatus', () => {
    it('应该更新抄送状态', async () => {
      const dto = { status: CCStatus.HANDLED, comment: '已处理' };
      const mockRecord = { id_: 'cc-1', status_: CCStatus.HANDLED, comment_: '已处理' };
      mockCcService.updateStatus.mockResolvedValue(mockRecord);

      const result = await controller.updateStatus('cc-1', dto, 'user-1');

      expect(mockCcService.updateStatus).toHaveBeenCalledWith({
        id: 'cc-1',
        status: CCStatus.HANDLED,
        comment: '已处理',
        userId: 'user-1',
      });
      expect(result.status).toBe(CCStatus.HANDLED);
    });
  });

  describe('archive', () => {
    it('应该归档抄送', async () => {
      const mockRecord = { id_: 'cc-1', status_: CCStatus.ARCHIVED };
      mockCcService.archive.mockResolvedValue(mockRecord);

      const result = await controller.archive('cc-1', 'user-1');

      expect(mockCcService.archive).toHaveBeenCalledWith('cc-1', 'user-1');
      expect(result.status).toBe(CCStatus.ARCHIVED);
    });
  });

  describe('delete', () => {
    it('应该删除抄送', async () => {
      mockCcService.deleteWithUser.mockResolvedValue(undefined);

      await controller.delete('cc-1', 'user-1');

      expect(mockCcService.deleteWithUser).toHaveBeenCalledWith('cc-1', 'user-1');
    });
  });

  describe('getByTaskId', () => {
    it('应该返回任务的抄送记录', async () => {
      const query = { page: '1', pageSize: '10' };
      const mockResult = {
        total: 2,
        list: [
          { id_: 'cc-1', task_id_: 'task-1' },
          { id_: 'cc-2', task_id_: 'task-1' },
        ],
      };
      mockCcService.query.mockResolvedValue(mockResult);

      const result = await controller.getByTaskId('task-1', query);

      expect(mockCcService.query).toHaveBeenCalledWith({
        taskId: 'task-1',
        status: undefined,
        type: undefined,
        page: 1,
        pageSize: 10,
      });
      expect(result.total).toBe(2);
    });
  });

  describe('getByProcessInstanceId', () => {
    it('应该返回流程实例的抄送记录', async () => {
      const query = { page: '1', pageSize: '10' };
      const mockResult = {
        total: 3,
        list: [
          { id_: 'cc-1', proc_inst_id_: 'proc-1' },
          { id_: 'cc-2', proc_inst_id_: 'proc-1' },
        ],
      };
      mockCcService.query.mockResolvedValue(mockResult);

      const result = await controller.getByProcessInstanceId('proc-1', query);

      expect(mockCcService.query).toHaveBeenCalledWith({
        processInstanceId: 'proc-1',
        status: undefined,
        type: undefined,
        page: 1,
        pageSize: 10,
      });
      expect(result.total).toBe(3);
    });
  });

  describe('createConfig', () => {
    it('应该创建抄送配置', async () => {
      const dto = {
        processDefinitionKey: 'test-process',
        activityId: 'activity-1',
        userIds: ['user-1'],
        enabled: true,
      };
      const mockConfig = { id_: 'config-1' };
      mockCcService.createConfig.mockResolvedValue(mockConfig);

      const result = await controller.createConfig(dto);

      expect(mockCcService.createConfig).toHaveBeenCalled();
      expect(result).toEqual({ id: 'config-1' });
    });
  });

  describe('getConfig', () => {
    it('应该返回抄送配置', async () => {
      const mockConfigs = [{ id_: 'config-1', processDefinitionKey: 'test-process' }];
      mockCcService.getConfig.mockResolvedValue(mockConfigs);

      const result = await controller.getConfig('test-process');

      expect(mockCcService.getConfig).toHaveBeenCalledWith('test-process', undefined);
      expect(result).toEqual(mockConfigs);
    });

    it('应该支持按活动ID筛选', async () => {
      const mockConfigs = [{ id_: 'config-1', activityId: 'activity-1' }];
      mockCcService.getConfig.mockResolvedValue(mockConfigs);

      const result = await controller.getConfig('test-process', 'activity-1');

      expect(mockCcService.getConfig).toHaveBeenCalledWith('test-process', 'activity-1');
      expect(result).toEqual(mockConfigs);
    });
  });

  describe('updateConfig', () => {
    it('应该更新抄送配置', async () => {
      const dto = { enabled: false };
      mockCcService.updateConfig.mockResolvedValue(undefined);

      const result = await controller.updateConfig('config-1', dto);

      expect(mockCcService.updateConfig).toHaveBeenCalledWith('config-1', dto);
      expect(result).toEqual({ success: true });
    });
  });

  describe('deleteConfig', () => {
    it('应该删除抄送配置', async () => {
      mockCcService.deleteConfig.mockResolvedValue(undefined);

      await controller.deleteConfig('config-1');

      expect(mockCcService.deleteConfig).toHaveBeenCalledWith('config-1');
    });
  });
});
