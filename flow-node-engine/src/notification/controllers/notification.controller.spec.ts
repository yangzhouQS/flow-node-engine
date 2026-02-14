import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { InAppNotificationService } from '../services/in-app-notification.service';
import { NotificationService } from '../services/notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let inAppNotificationService: InAppNotificationService;
  let notificationService: NotificationService;

  const mockInAppNotificationService = {
    getNotifications: vi.fn(),
    getNotificationSummary: vi.fn(),
    getUnreadCount: vi.fn(),
    getNotificationById: vi.fn(),
    markAsRead: vi.fn(),
    markAsReadBatch: vi.fn(),
    markAllAsRead: vi.fn(),
    archiveNotification: vi.fn(),
    deleteNotification: vi.fn(),
    clearReadNotifications: vi.fn(),
    getNotificationsByTaskId: vi.fn(),
    getNotificationsByProcessInstanceId: vi.fn(),
  };

  const mockNotificationService = {
    sendNotification: vi.fn(),
    sendEmail: vi.fn(),
    sendSms: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        { provide: InAppNotificationService, useValue: mockInAppNotificationService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    inAppNotificationService = module.get<InAppNotificationService>(InAppNotificationService);
    notificationService = module.get<NotificationService>(NotificationService);
  });

  describe('getNotifications', () => {
    it('应该返回当前用户的通知列表', async () => {
      const mockResult = {
        data: [{ id: 'notif-1', title: '测试通知' }],
        total: 1,
      };
      mockInAppNotificationService.getNotifications.mockResolvedValue(mockResult);

      const req = { user: { id: 'user-1' } };
      const result = await controller.getNotifications(
        req,
        'UNREAD',
        'TASK',
        'true',
        '1',
        '10',
      );

      expect(mockInAppNotificationService.getNotifications).toHaveBeenCalledWith({
        userId: 'user-1',
        status: 'UNREAD',
        type: 'TASK',
        unreadOnly: true,
        page: 1,
        pageSize: 10,
      });
      expect(result).toEqual(mockResult);
    });

    it('应该使用默认用户ID当用户未登录时', async () => {
      const mockResult = { data: [], total: 0 };
      mockInAppNotificationService.getNotifications.mockResolvedValue(mockResult);

      const req = {};
      await controller.getNotifications(req);

      expect(mockInAppNotificationService.getNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'test-user' }),
      );
    });

    it('应该使用默认分页参数', async () => {
      const mockResult = { data: [], total: 0 };
      mockInAppNotificationService.getNotifications.mockResolvedValue(mockResult);

      const req = { user: { id: 'user-1' } };
      await controller.getNotifications(req);

      expect(mockInAppNotificationService.getNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
    });
  });

  describe('getNotificationSummary', () => {
    it('应该返回通知摘要', async () => {
      const mockSummary = { unread: 5, total: 20 };
      mockInAppNotificationService.getNotificationSummary.mockResolvedValue(mockSummary);

      const req = { user: { id: 'user-1' } };
      const result = await controller.getNotificationSummary(req);

      expect(mockInAppNotificationService.getNotificationSummary).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockSummary);
    });
  });

  describe('getUnreadCount', () => {
    it('应该返回未读通知数量', async () => {
      mockInAppNotificationService.getUnreadCount.mockResolvedValue(8);

      const req = { user: { id: 'user-1' } };
      const result = await controller.getUnreadCount(req);

      expect(mockInAppNotificationService.getUnreadCount).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ count: 8 });
    });
  });

  describe('getNotificationById', () => {
    it('应该返回通知详情', async () => {
      const mockNotification = { id: 'notif-1', userId: 'user-1', title: '测试通知' };
      mockInAppNotificationService.getNotificationById.mockResolvedValue(mockNotification);

      const req = { user: { id: 'user-1' } };
      const result = await controller.getNotificationById('notif-1', req);

      expect(mockInAppNotificationService.getNotificationById).toHaveBeenCalledWith('notif-1');
      expect(result).toEqual(mockNotification);
    });

    it('应该拒绝访问其他用户的通知', async () => {
      const mockNotification = { id: 'notif-1', userId: 'user-2', title: '测试通知' };
      mockInAppNotificationService.getNotificationById.mockResolvedValue(mockNotification);

      const req = { user: { id: 'user-1' } };
      const result = await controller.getNotificationById('notif-1', req);

      expect(result).toEqual({ error: '无权访问此通知' });
    });
  });

  describe('markAsRead', () => {
    it('应该标记通知为已读', async () => {
      const mockNotification = { id: 'notif-1', status: 'READ' };
      mockInAppNotificationService.markAsRead.mockResolvedValue(mockNotification);

      const req = { user: { id: 'user-1' } };
      const result = await controller.markAsRead('notif-1', req);

      expect(mockInAppNotificationService.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(result).toEqual(mockNotification);
    });
  });

  describe('markAsReadBatch', () => {
    it('应该批量标记为已读', async () => {
      const mockResult = { success: true, count: 3 };
      mockInAppNotificationService.markAsReadBatch.mockResolvedValue(mockResult);

      const req = { user: { id: 'user-1' } };
      const result = await controller.markAsReadBatch({ ids: ['notif-1', 'notif-2', 'notif-3'] }, req);

      expect(mockInAppNotificationService.markAsReadBatch).toHaveBeenCalledWith(
        ['notif-1', 'notif-2', 'notif-3'],
        'user-1',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('markAllAsRead', () => {
    it('应该标记所有通知为已读', async () => {
      const mockResult = { success: true, count: 10 };
      mockInAppNotificationService.markAllAsRead.mockResolvedValue(mockResult);

      const req = { user: { id: 'user-1' } };
      const result = await controller.markAllAsRead(req);

      expect(mockInAppNotificationService.markAllAsRead).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResult);
    });
  });

  describe('archiveNotification', () => {
    it('应该归档通知', async () => {
      const mockNotification = { id: 'notif-1', archived: true };
      mockInAppNotificationService.archiveNotification.mockResolvedValue(mockNotification);

      const req = { user: { id: 'user-1' } };
      const result = await controller.archiveNotification('notif-1', req);

      expect(mockInAppNotificationService.archiveNotification).toHaveBeenCalledWith('notif-1', 'user-1');
      expect(result).toEqual(mockNotification);
    });
  });

  describe('deleteNotification', () => {
    it('应该删除通知', async () => {
      mockInAppNotificationService.deleteNotification.mockResolvedValue(undefined);

      const req = { user: { id: 'user-1' } };
      await controller.deleteNotification('notif-1', req);

      expect(mockInAppNotificationService.deleteNotification).toHaveBeenCalledWith('notif-1', 'user-1');
    });
  });

  describe('clearReadNotifications', () => {
    it('应该清理已读通知', async () => {
      mockInAppNotificationService.clearReadNotifications.mockResolvedValue(5);

      const req = { user: { id: 'user-1' } };
      const result = await controller.clearReadNotifications(req);

      expect(mockInAppNotificationService.clearReadNotifications).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ deleted: 5 });
    });
  });

  describe('getNotificationsByTaskId', () => {
    it('应该返回任务相关通知', async () => {
      const mockNotifications = [{ id: 'notif-1', taskId: 'task-1' }];
      mockInAppNotificationService.getNotificationsByTaskId.mockResolvedValue(mockNotifications);

      const req = { user: { id: 'user-1' } };
      const result = await controller.getNotificationsByTaskId('task-1', req);

      expect(mockInAppNotificationService.getNotificationsByTaskId).toHaveBeenCalledWith('task-1', 'user-1');
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('getNotificationsByProcessInstanceId', () => {
    it('应该返回流程实例相关通知', async () => {
      const mockNotifications = [{ id: 'notif-1', processInstanceId: 'proc-1' }];
      mockInAppNotificationService.getNotificationsByProcessInstanceId.mockResolvedValue(mockNotifications);

      const req = { user: { id: 'user-1' } };
      const result = await controller.getNotificationsByProcessInstanceId('proc-1', req);

      expect(mockInAppNotificationService.getNotificationsByProcessInstanceId).toHaveBeenCalledWith(
        'proc-1',
        'user-1',
      );
      expect(result).toEqual(mockNotifications);
    });
  });
});
