/**
 * EventPublishService 单元测试
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBusService } from '../../core/services/event-bus.service';
import { Event } from '../entities/event.entity';
// 直接从枚举文件导入，避免 Swagger 循环依赖问题
import { EventStatus, EventType } from '../enums/event.enum';
import { EventPublishService } from './event-publish.service';

describe('EventPublishService', () => {
  let service: EventPublishService;
  let eventRepository: Repository<Event>;
  let eventBusService: EventBusService;

  const mockEvent: Event = {
    id: 'event-123',
    eventType: EventType.TASK_CREATED,
    eventStatus: EventStatus.PENDING,
    processInstanceId: 'pi-123',
    processDefinitionId: 'pd-123',
    processDefinitionKey: 'test_process',
    executionId: 'exec-123',
    activityId: 'activity-1',
    activityName: 'Test Activity',
    taskId: 'task-123',
    taskName: 'Test Task',
    assignee: 'user1',
    eventName: 'TaskCreatedEvent',
    eventCode: 'TASK_CREATED',
    eventData: { taskId: 'task-123', assignee: 'user1' },
    payload: '{"key": "value"}',
    tenantId: 'tenant1',
    retryCount: 0,
    maxRetries: 3,
    errorMessage: null,
    processedTime: null,
    createTime: new Date('2026-01-01T00:00:00.000Z'),
    updateTime: new Date('2026-01-01T00:00:00.000Z'),
  };

  const mockFailedEvent: Event = {
    ...mockEvent,
    id: 'event-failed',
    eventStatus: EventStatus.FAILED,
    retryCount: 1,
    errorMessage: 'Previous error',
  };

  const mockProcessedEvent: Event = {
    ...mockEvent,
    id: 'event-processed',
    eventStatus: EventStatus.PROCESSED,
    processedTime: new Date('2026-01-01T01:00:00.000Z'),
  };

  beforeEach(async () => {
    const mockEventRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
      count: vi.fn(),
    };

    const mockEventBusService = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventPublishService,
        {
          provide: 'EventRepository',
          useValue: mockEventRepository,
        },
        {
          provide: EventBusService,
          useValue: mockEventBusService,
        },
      ],
    }).compile();

    service = module.get<EventPublishService>(EventPublishService);
    eventRepository = module.get('EventRepository');
    eventBusService = module.get<EventBusService>(EventBusService);
  });

  // ==================== processPendingEvents 测试 ====================

  describe('processPendingEvents', () => {
    it('应该处理待发布的事件', async () => {
      vi.mocked(eventRepository.find).mockResolvedValue([mockEvent]);
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockResolvedValue({
        ...mockEvent,
        eventStatus: EventStatus.PUBLISHED,
      });

      await service.processPendingEvents();

      expect(eventRepository.find).toHaveBeenCalledWith({
        where: { eventStatus: EventStatus.PENDING },
        order: { createTime: 'ASC' },
        take: 100,
      });
      expect(eventBusService.publish).toHaveBeenCalled();
    });

    it('没有待发布事件时应该直接返回', async () => {
      vi.mocked(eventRepository.find).mockResolvedValue([]);

      await service.processPendingEvents();

      expect(eventBusService.publish).not.toHaveBeenCalled();
    });

    it('应该按顺序处理多个待发布事件', async () => {
      const event1 = { ...mockEvent, id: 'event-1' };
      const event2 = { ...mockEvent, id: 'event-2' };
      vi.mocked(eventRepository.find).mockResolvedValue([event1, event2]);
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      await service.processPendingEvents();

      expect(eventBusService.publish).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== retryFailedEvents 测试 ====================

  describe('retryFailedEvents', () => {
    it('应该重试失败的事件', async () => {
      vi.mocked(eventRepository.find).mockResolvedValue([mockFailedEvent]);
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      await service.retryFailedEvents();

      expect(eventRepository.find).toHaveBeenCalledWith({
        where: { eventStatus: EventStatus.FAILED },
        order: { updateTime: 'ASC' },
        take: 50,
      });
    });

    it('没有失败事件时应该直接返回', async () => {
      vi.mocked(eventRepository.find).mockResolvedValue([]);

      await service.retryFailedEvents();

      expect(eventRepository.save).not.toHaveBeenCalled();
    });

    it('超过最大重试次数的事件不应该重试', async () => {
      const maxRetriedEvent = {
        ...mockFailedEvent,
        retryCount: 3,
        maxRetries: 3,
      };
      vi.mocked(eventRepository.find).mockResolvedValue([maxRetriedEvent]);

      await service.retryFailedEvents();

      expect(eventRepository.save).not.toHaveBeenCalled();
    });
  });

  // ==================== cleanupOldEvents 测试 ====================

  describe('cleanupOldEvents', () => {
    it('应该清理30天前的已处理事件', async () => {
      const oldEvent = {
        ...mockProcessedEvent,
        processedTime: new Date('2020-01-01'),
      };
      vi.mocked(eventRepository.find).mockResolvedValue([oldEvent]);
      vi.mocked(eventRepository.remove).mockResolvedValue(oldEvent);

      await service.cleanupOldEvents();

      expect(eventRepository.find).toHaveBeenCalled();
      expect(eventRepository.remove).toHaveBeenCalled();
    });

    it('没有旧事件时应该直接返回', async () => {
      vi.mocked(eventRepository.find).mockResolvedValue([]);

      await service.cleanupOldEvents();

      expect(eventRepository.remove).not.toHaveBeenCalled();
    });
  });

  // ==================== publishEvent 测试 ====================

  describe('publishEvent', () => {
    it('应该成功发布事件', async () => {
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      await service.publishEvent(mockEvent);

      expect(eventBusService.publish).toHaveBeenCalled();
      expect(mockEvent.eventStatus).toBe(EventStatus.PUBLISHED);
    });

    it('发布失败时应该更新状态为FAILED', async () => {
      vi.mocked(eventBusService.publish).mockRejectedValue(new Error('Publish failed'));
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      await service.publishEvent(mockEvent);

      expect(mockEvent.eventStatus).toBe(EventStatus.FAILED);
      expect(mockEvent.retryCount).toBe(1);
      expect(mockEvent.errorMessage).toBe('Publish failed');
    });
  });

  // ==================== retryEvent 测试 ====================

  describe('retryEvent', () => {
    it('应该将事件状态重置为PENDING', async () => {
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      // 创建一个新的事件对象，避免状态污染
      const failedEvent = {
        ...mockEvent,
        id: 'event-failed-retry',
        eventStatus: EventStatus.FAILED,
        retryCount: 1,
        errorMessage: 'Previous error',
      };

      await service.retryEvent(failedEvent);

      expect(failedEvent.eventStatus).toBe(EventStatus.PENDING);
      expect(failedEvent.retryCount).toBe(2);
      expect(failedEvent.errorMessage).toBeNull();
    });
  });

  // ==================== markEventAsProcessed 测试 ====================

  describe('markEventAsProcessed', () => {
    it('应该将事件标记为已处理', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(mockEvent);
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      const result = await service.markEventAsProcessed('event-123');

      expect(result.eventStatus).toBe(EventStatus.PROCESSED);
      expect(result.processedTime).toBeDefined();
    });

    it('事件不存在时应该抛出错误', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(null);

      await expect(service.markEventAsProcessed('nonexistent')).rejects.toThrow(
        'Event with ID nonexistent not found',
      );
    });
  });

  // ==================== markEventsAsProcessed 测试 ====================

  describe('markEventsAsProcessed', () => {
    it('应该批量标记事件为已处理', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(mockEvent);
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      await service.markEventsAsProcessed(['event-1', 'event-2']);

      expect(eventRepository.findOne).toHaveBeenCalledTimes(2);
      expect(eventRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== getEventTopic 测试 ====================

  describe('getEventTopic', () => {
    it('应该返回正确的事件主题 - TASK_CREATED', async () => {
      const event = { ...mockEvent, eventType: EventType.TASK_CREATED };
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockImplementation((e) => Promise.resolve(e as Event));

      await service.publishEvent(event);

      expect(eventBusService.publish).toHaveBeenCalledWith('task.created', event.eventData);
    });

    it('应该返回正确的事件主题 - PROCESS_INSTANCE_START', async () => {
      const event = { ...mockEvent, eventType: EventType.PROCESS_INSTANCE_START };
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockImplementation((e) => Promise.resolve(e as Event));

      await service.publishEvent(event);

      expect(eventBusService.publish).toHaveBeenCalledWith('process.instance.start', event.eventData);
    });

    it('应该返回正确的事件主题 - PROCESS_INSTANCE_END', async () => {
      const event = { ...mockEvent, eventType: EventType.PROCESS_INSTANCE_END };
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockImplementation((e) => Promise.resolve(e as Event));

      await service.publishEvent(event);

      expect(eventBusService.publish).toHaveBeenCalledWith('process.instance.end', event.eventData);
    });

    it('应该返回正确的事件主题 - TASK_COMPLETED', async () => {
      const event = { ...mockEvent, eventType: EventType.TASK_COMPLETED };
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockImplementation((e) => Promise.resolve(e as Event));

      await service.publishEvent(event);

      expect(eventBusService.publish).toHaveBeenCalledWith('task.completed', event.eventData);
    });

    it('应该返回正确的事件主题 - VARIABLE_UPDATED', async () => {
      const event = { ...mockEvent, eventType: EventType.VARIABLE_UPDATED };
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockImplementation((e) => Promise.resolve(e as Event));

      await service.publishEvent(event);

      expect(eventBusService.publish).toHaveBeenCalledWith('variable.updated', event.eventData);
    });

    it('应该返回正确的事件主题 - CUSTOM', async () => {
      const event = { ...mockEvent, eventType: EventType.CUSTOM, eventCode: 'myCustomEvent' };
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockImplementation((e) => Promise.resolve(e as Event));

      await service.publishEvent(event);

      expect(eventBusService.publish).toHaveBeenCalledWith('custom.myCustomEvent', event.eventData);
    });

    it('未知事件类型应该返回event.unknown', async () => {
      const event = { ...mockEvent, eventType: 'UNKNOWN_TYPE' as EventType };
      vi.mocked(eventBusService.publish).mockResolvedValue(undefined);
      vi.mocked(eventRepository.save).mockImplementation((e) => Promise.resolve(e as Event));

      await service.publishEvent(event);

      expect(eventBusService.publish).toHaveBeenCalledWith('event.unknown', event.eventData);
    });
  });

  // ==================== 统计方法测试 ====================

  describe('getPendingEventCount', () => {
    it('应该返回待发布事件数量', async () => {
      vi.mocked(eventRepository.count).mockResolvedValue(10);

      const result = await service.getPendingEventCount();

      expect(result).toBe(10);
      expect(eventRepository.count).toHaveBeenCalledWith({
        where: { eventStatus: EventStatus.PENDING },
      });
    });
  });

  describe('getFailedEventCount', () => {
    it('应该返回失败事件数量', async () => {
      vi.mocked(eventRepository.count).mockResolvedValue(5);

      const result = await service.getFailedEventCount();

      expect(result).toBe(5);
      expect(eventRepository.count).toHaveBeenCalledWith({
        where: { eventStatus: EventStatus.FAILED },
      });
    });
  });

  describe('getProcessedEventCount', () => {
    it('应该返回已处理事件数量', async () => {
      vi.mocked(eventRepository.count).mockResolvedValue(100);

      const result = await service.getProcessedEventCount();

      expect(result).toBe(100);
      expect(eventRepository.count).toHaveBeenCalledWith({
        where: { eventStatus: EventStatus.PROCESSED },
      });
    });
  });

  describe('getEventStatistics', () => {
    it('应该返回所有状态的事件统计', async () => {
      vi.mocked(eventRepository.count)
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(20) // published
        .mockResolvedValueOnce(100) // processed
        .mockResolvedValueOnce(5); // failed

      const result = await service.getEventStatistics();

      expect(result).toEqual({
        pending: 10,
        published: 20,
        processed: 100,
        failed: 5,
        total: 135,
      });
    });

    it('所有计数为0时应该返回正确的统计', async () => {
      vi.mocked(eventRepository.count)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getEventStatistics();

      expect(result).toEqual({
        pending: 0,
        published: 0,
        processed: 0,
        failed: 0,
        total: 0,
      });
    });
  });
});
