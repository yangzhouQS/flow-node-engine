import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventController } from './event.controller';
import { EventPublishService } from '../services/event-publish.service';
import { EventSubscriptionService } from '../services/event-subscription.service';
import { EventType, EventStatus } from '../entities/event.entity';

describe('EventController', () => {
  let controller: EventController;
  let eventSubscriptionService: EventSubscriptionService;
  let eventPublishService: EventPublishService;

  const mockEventSubscriptionService = {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByProcessInstanceId: vi.fn(),
    findByTaskId: vi.fn(),
    findByEventType: vi.fn(),
    findByEventStatus: vi.fn(),
    updateEventStatus: vi.fn(),
    retryFailedEvent: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    countByStatus: vi.fn(),
  };

  const mockEventPublishService = {
    markEventAsProcessed: vi.fn(),
    markEventsAsProcessed: vi.fn(),
    getEventStatistics: vi.fn(),
    getPendingEventCount: vi.fn(),
    getFailedEventCount: vi.fn(),
    getProcessedEventCount: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventController],
      providers: [
        { provide: EventSubscriptionService, useValue: mockEventSubscriptionService },
        { provide: EventPublishService, useValue: mockEventPublishService },
      ],
    }).compile();

    controller = module.get<EventController>(EventController);
    eventSubscriptionService = module.get<EventSubscriptionService>(EventSubscriptionService);
    eventPublishService = module.get<EventPublishService>(EventPublishService);
  });

  describe('findAll', () => {
    it('应该返回分页事件列表', async () => {
      const mockEvents = [{ id: 'event-1', name: 'Test Event' }];
      mockEventSubscriptionService.findAll.mockResolvedValue({
        events: mockEvents,
        total: 1,
      });

      const result = await controller.findAll(1, 10);

      expect(mockEventSubscriptionService.findAll).toHaveBeenCalledWith(1, 10);
      expect(result.data).toEqual(mockEvents);
      expect(result.total).toBe(1);
    });

    it('应该使用默认分页参数', async () => {
      mockEventSubscriptionService.findAll.mockResolvedValue({
        events: [],
        total: 0,
      });

      await controller.findAll();

      expect(mockEventSubscriptionService.findAll).toHaveBeenCalledWith(1, 10);
    });

    it('应该正确处理自定义分页参数', async () => {
      mockEventSubscriptionService.findAll.mockResolvedValue({
        events: [],
        total: 0,
      });

      await controller.findAll(2, 20);

      expect(mockEventSubscriptionService.findAll).toHaveBeenCalledWith(2, 20);
    });
  });

  describe('findById', () => {
    it('应该根据ID返回事件', async () => {
      const mockEvent = { id: 'event-1', name: 'Test Event' };
      mockEventSubscriptionService.findById.mockResolvedValue(mockEvent);

      const result = await controller.findById('event-1');

      expect(mockEventSubscriptionService.findById).toHaveBeenCalledWith('event-1');
      expect(result.data).toEqual(mockEvent);
    });

    it('应该处理事件不存在的情况', async () => {
      mockEventSubscriptionService.findById.mockResolvedValue(null);

      const result = await controller.findById('nonexistent');

      expect(result.data).toBeNull();
    });
  });

  describe('findByProcessInstanceId', () => {
    it('应该根据流程实例ID返回事件列表', async () => {
      const mockEvents = [{ id: 'event-1', processInstanceId: 'pi-1' }];
      mockEventSubscriptionService.findByProcessInstanceId.mockResolvedValue(mockEvents);

      const result = await controller.findByProcessInstanceId('pi-1');

      expect(mockEventSubscriptionService.findByProcessInstanceId).toHaveBeenCalledWith('pi-1');
      expect(result.data).toEqual(mockEvents);
    });
  });

  describe('findByTaskId', () => {
    it('应该根据任务ID返回事件列表', async () => {
      const mockEvents = [{ id: 'event-1', taskId: 'task-1' }];
      mockEventSubscriptionService.findByTaskId.mockResolvedValue(mockEvents);

      const result = await controller.findByTaskId('task-1');

      expect(mockEventSubscriptionService.findByTaskId).toHaveBeenCalledWith('task-1');
      expect(result.data).toEqual(mockEvents);
    });
  });

  describe('findByEventType', () => {
    it('应该根据事件类型返回事件列表', async () => {
      const mockEvents = [{ id: 'event-1', eventType: EventType.TIMER }];
      mockEventSubscriptionService.findByEventType.mockResolvedValue(mockEvents);

      const result = await controller.findByEventType(EventType.TIMER);

      expect(mockEventSubscriptionService.findByEventType).toHaveBeenCalledWith(EventType.TIMER);
      expect(result.data).toEqual(mockEvents);
    });
  });

  describe('findByEventStatus', () => {
    it('应该根据事件状态返回事件列表', async () => {
      const mockEvents = [{ id: 'event-1', status: EventStatus.PENDING }];
      mockEventSubscriptionService.findByEventStatus.mockResolvedValue(mockEvents);

      const result = await controller.findByEventStatus(EventStatus.PENDING);

      expect(mockEventSubscriptionService.findByEventStatus).toHaveBeenCalledWith(EventStatus.PENDING);
      expect(result.data).toEqual(mockEvents);
    });
  });

  describe('updateEventStatus', () => {
    it('应该更新事件状态', async () => {
      const mockEvent = { id: 'event-1', status: EventStatus.PROCESSED };
      mockEventSubscriptionService.updateEventStatus.mockResolvedValue(mockEvent);

      const result = await controller.updateEventStatus('event-1', {
        status: EventStatus.PROCESSED,
      });

      expect(mockEventSubscriptionService.updateEventStatus).toHaveBeenCalledWith(
        'event-1',
        EventStatus.PROCESSED,
        undefined,
      );
      expect(result.data).toEqual(mockEvent);
    });

    it('应该更新事件状态并包含错误信息', async () => {
      const mockEvent = { id: 'event-1', status: EventStatus.FAILED, errorMessage: 'Error' };
      mockEventSubscriptionService.updateEventStatus.mockResolvedValue(mockEvent);

      const result = await controller.updateEventStatus('event-1', {
        status: EventStatus.FAILED,
        errorMessage: 'Error',
      });

      expect(mockEventSubscriptionService.updateEventStatus).toHaveBeenCalledWith(
        'event-1',
        EventStatus.FAILED,
        'Error',
      );
      expect(result.data).toEqual(mockEvent);
    });
  });

  describe('retryFailedEvent', () => {
    it('应该重试失败的事件', async () => {
      const mockEvent = { id: 'event-1', status: EventStatus.PENDING };
      mockEventSubscriptionService.retryFailedEvent.mockResolvedValue(mockEvent);

      const result = await controller.retryFailedEvent('event-1');

      expect(mockEventSubscriptionService.retryFailedEvent).toHaveBeenCalledWith('event-1');
      expect(result.data).toEqual(mockEvent);
    });
  });

  describe('markEventAsProcessed', () => {
    it('应该标记事件为已处理', async () => {
      const mockEvent = { id: 'event-1', status: EventStatus.PROCESSED };
      mockEventPublishService.markEventAsProcessed.mockResolvedValue(mockEvent);

      const result = await controller.markEventAsProcessed('event-1');

      expect(mockEventPublishService.markEventAsProcessed).toHaveBeenCalledWith('event-1');
      expect(result.data).toEqual(mockEvent);
    });
  });

  describe('markEventsAsProcessed', () => {
    it('应该批量标记事件为已处理', async () => {
      mockEventPublishService.markEventsAsProcessed.mockResolvedValue(undefined);

      const result = await controller.markEventsAsProcessed({
        eventIds: ['event-1', 'event-2'],
      });

      expect(mockEventPublishService.markEventsAsProcessed).toHaveBeenCalledWith(['event-1', 'event-2']);
      expect(result.data).toBeNull();
    });
  });

  describe('delete', () => {
    it('应该删除事件', async () => {
      mockEventSubscriptionService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('event-1');

      expect(mockEventSubscriptionService.delete).toHaveBeenCalledWith('event-1');
      expect(result.data).toBeNull();
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除事件', async () => {
      mockEventSubscriptionService.deleteMany.mockResolvedValue(undefined);

      const result = await controller.deleteMany({ ids: ['event-1', 'event-2'] });

      expect(mockEventSubscriptionService.deleteMany).toHaveBeenCalledWith(['event-1', 'event-2']);
      expect(result.data).toBeNull();
    });
  });

  describe('count', () => {
    it('应该返回事件总数', async () => {
      mockEventSubscriptionService.count.mockResolvedValue(100);

      const result = await controller.count();

      expect(mockEventSubscriptionService.count).toHaveBeenCalled();
      expect(result.data.count).toBe(100);
    });
  });

  describe('countByStatus', () => {
    it('应该根据状态统计事件数量', async () => {
      mockEventSubscriptionService.countByStatus.mockResolvedValue(50);

      const result = await controller.countByStatus(EventStatus.PENDING);

      expect(mockEventSubscriptionService.countByStatus).toHaveBeenCalledWith(EventStatus.PENDING);
      expect(result.data.count).toBe(50);
    });
  });

  describe('getStatistics', () => {
    it('应该返回事件统计信息', async () => {
      const mockStats = {
        total: 100,
        pending: 50,
        processed: 40,
        failed: 10,
      };
      mockEventPublishService.getEventStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics();

      expect(mockEventPublishService.getEventStatistics).toHaveBeenCalled();
      expect(result.data).toEqual(mockStats);
    });
  });

  describe('getPendingEventCount', () => {
    it('应该返回待发布事件数量', async () => {
      mockEventPublishService.getPendingEventCount.mockResolvedValue(25);

      const result = await controller.getPendingEventCount();

      expect(mockEventPublishService.getPendingEventCount).toHaveBeenCalled();
      expect(result.data.count).toBe(25);
    });
  });

  describe('getFailedEventCount', () => {
    it('应该返回失败事件数量', async () => {
      mockEventPublishService.getFailedEventCount.mockResolvedValue(5);

      const result = await controller.getFailedEventCount();

      expect(mockEventPublishService.getFailedEventCount).toHaveBeenCalled();
      expect(result.data.count).toBe(5);
    });
  });

  describe('getProcessedEventCount', () => {
    it('应该返回已处理事件数量', async () => {
      mockEventPublishService.getProcessedEventCount.mockResolvedValue(70);

      const result = await controller.getProcessedEventCount();

      expect(mockEventPublishService.getProcessedEventCount).toHaveBeenCalled();
      expect(result.data.count).toBe(70);
    });
  });
});
