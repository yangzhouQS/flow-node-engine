/**
 * EventSubscriptionService 单元测试
 */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBusService } from '../../core/services/event-bus.service';
import { Event } from '../entities/event.entity';
// 直接从枚举文件导入，避免 Swagger 循环依赖问题
import { EventStatus, EventType } from '../enums/event.enum';
import { EventSubscriptionService } from './event-subscription.service';

describe('EventSubscriptionService', () => {
  let service: EventSubscriptionService;
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

  beforeEach(async () => {
    const mockEventRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      findAndCount: vi.fn(),
      create: vi.fn(),
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
        EventSubscriptionService,
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

    service = module.get<EventSubscriptionService>(EventSubscriptionService);
    eventRepository = module.get('EventRepository');
    eventBusService = module.get<EventBusService>(EventBusService);
  });

  // ==================== 初始化测试 ====================

  describe('initialization', () => {
    it('应该在初始化时订阅所有事件类型', () => {
      // 服务订阅了22个事件类型：流程实例4个、任务4个、活动2个、变量3个、信号2个、消息2个、错误2个、定时器1个、补偿1个、自定义1个
      expect(eventBusService.subscribe).toHaveBeenCalledTimes(22);
    });

    it('应该订阅流程实例相关事件', () => {
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'process.instance.start',
        expect.any(Function),
      );
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'process.instance.end',
        expect.any(Function),
      );
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'process.instance.suspend',
        expect.any(Function),
      );
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'process.instance.activate',
        expect.any(Function),
      );
    });

    it('应该订阅任务相关事件', () => {
      expect(eventBusService.subscribe).toHaveBeenCalledWith('task.created', expect.any(Function));
      expect(eventBusService.subscribe).toHaveBeenCalledWith('task.assigned', expect.any(Function));
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'task.completed',
        expect.any(Function),
      );
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'task.cancelled',
        expect.any(Function),
      );
    });

    it('应该订阅活动相关事件', () => {
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'activity.started',
        expect.any(Function),
      );
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'activity.completed',
        expect.any(Function),
      );
    });

    it('应该订阅变量相关事件', () => {
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'variable.created',
        expect.any(Function),
      );
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'variable.updated',
        expect.any(Function),
      );
      expect(eventBusService.subscribe).toHaveBeenCalledWith(
        'variable.deleted',
        expect.any(Function),
      );
    });
  });

  // ==================== findById 测试 ====================

  describe('findById', () => {
    it('应该返回指定ID的事件', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(mockEvent);

      const result = await service.findById('event-123');

      expect(eventRepository.findOne).toHaveBeenCalledWith({ where: { id: 'event-123' } });
      expect(result).toEqual(mockEvent);
    });

    it('事件不存在时应该抛出NotFoundException', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== findByProcessInstanceId 测试 ====================

  describe('findByProcessInstanceId', () => {
    it('应该返回指定流程实例ID的事件列表', async () => {
      vi.mocked(eventRepository.find).mockResolvedValue([mockEvent]);

      const result = await service.findByProcessInstanceId('pi-123');

      expect(eventRepository.find).toHaveBeenCalledWith({
        where: { processInstanceId: 'pi-123' },
        order: { createTime: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ==================== findByTaskId 测试 ====================

  describe('findByTaskId', () => {
    it('应该返回指定任务ID的事件列表', async () => {
      vi.mocked(eventRepository.find).mockResolvedValue([mockEvent]);

      const result = await service.findByTaskId('task-123');

      expect(eventRepository.find).toHaveBeenCalledWith({
        where: { taskId: 'task-123' },
        order: { createTime: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ==================== findByEventType 测试 ====================

  describe('findByEventType', () => {
    it('应该返回指定类型的事件列表', async () => {
      vi.mocked(eventRepository.find).mockResolvedValue([mockEvent]);

      const result = await service.findByEventType(EventType.TASK_CREATED);

      expect(eventRepository.find).toHaveBeenCalledWith({
        where: { eventType: EventType.TASK_CREATED },
        order: { createTime: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ==================== findByEventStatus 测试 ====================

  describe('findByEventStatus', () => {
    it('应该返回指定状态的事件列表', async () => {
      vi.mocked(eventRepository.find).mockResolvedValue([mockEvent]);

      const result = await service.findByEventStatus(EventStatus.PENDING);

      expect(eventRepository.find).toHaveBeenCalledWith({
        where: { eventStatus: EventStatus.PENDING },
        order: { createTime: 'DESC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ==================== findAll 测试 ====================

  describe('findAll', () => {
    it('应该返回分页事件列表', async () => {
      vi.mocked(eventRepository.findAndCount).mockResolvedValue([[mockEvent], 1]);

      const result = await service.findAll(1, 10);

      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该正确计算分页偏移量', async () => {
      vi.mocked(eventRepository.findAndCount).mockResolvedValue([[], 0]);

      await service.findAll(3, 25);

      expect(eventRepository.findAndCount).toHaveBeenCalledWith({
        order: { createTime: 'DESC' },
        skip: 50, // (3-1) * 25
        take: 25,
      });
    });
  });

  // ==================== updateEventStatus 测试 ====================

  describe('updateEventStatus', () => {
    it('应该更新事件状态', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(mockEvent);
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      const result = await service.updateEventStatus('event-123', EventStatus.PROCESSED);

      expect(result.eventStatus).toBe(EventStatus.PROCESSED);
    });

    it('更新为PROCESSED状态时应该设置processedTime', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(mockEvent);
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      const result = await service.updateEventStatus('event-123', EventStatus.PROCESSED);

      expect(result.processedTime).toBeDefined();
    });

    it('应该支持设置错误消息', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(mockEvent);
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      const result = await service.updateEventStatus(
        'event-123',
        EventStatus.FAILED,
        'Something went wrong',
      );

      expect(result.errorMessage).toBe('Something went wrong');
    });
  });

  // ==================== retryFailedEvent 测试 ====================

  describe('retryFailedEvent', () => {
    it('应该重试失败的事件', async () => {
      const failedEvent = {
        ...mockEvent,
        eventStatus: EventStatus.FAILED,
        retryCount: 1,
        errorMessage: 'Previous error',
      };
      vi.mocked(eventRepository.findOne).mockResolvedValue(failedEvent);
      vi.mocked(eventRepository.save).mockImplementation((event) => Promise.resolve(event as Event));

      const result = await service.retryFailedEvent('event-123');

      expect(result.eventStatus).toBe(EventStatus.PENDING);
      expect(result.retryCount).toBe(2);
      expect(result.errorMessage).toBeNull();
    });

    it('非FAILED状态的事件不应该重试', async () => {
      // 创建一个新的非FAILED状态的事件对象
      const nonFailedEvent = {
        ...mockEvent,
        eventStatus: EventStatus.PENDING,
      };
      vi.mocked(eventRepository.findOne).mockResolvedValue(nonFailedEvent);

      await expect(service.retryFailedEvent('event-123')).rejects.toThrow(
        'Event with ID event-123 is not in FAILED status',
      );
    });

    it('超过最大重试次数的事件不应该重试', async () => {
      const maxRetriedEvent = {
        ...mockEvent,
        eventStatus: EventStatus.FAILED,
        retryCount: 3,
        maxRetries: 3,
      };
      vi.mocked(eventRepository.findOne).mockResolvedValue(maxRetriedEvent);

      await expect(service.retryFailedEvent('event-123')).rejects.toThrow(
        'Event with ID event-123 has reached maximum retry count',
      );
    });
  });

  // ==================== delete 测试 ====================

  describe('delete', () => {
    it('应该删除事件', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(mockEvent);
      vi.mocked(eventRepository.remove).mockResolvedValue(mockEvent);

      await service.delete('event-123');

      expect(eventRepository.remove).toHaveBeenCalledWith(mockEvent);
    });

    it('事件不存在时应该抛出NotFoundException', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(null);

      await expect(service.delete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== deleteMany 测试 ====================

  describe('deleteMany', () => {
    it('应该批量删除事件', async () => {
      vi.mocked(eventRepository.findOne).mockResolvedValue(mockEvent);
      vi.mocked(eventRepository.remove).mockResolvedValue(mockEvent);

      await service.deleteMany(['event-1', 'event-2']);

      expect(eventRepository.remove).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== count 测试 ====================

  describe('count', () => {
    it('应该返回事件总数', async () => {
      vi.mocked(eventRepository.count).mockResolvedValue(100);

      const result = await service.count();

      expect(result).toBe(100);
    });
  });

  // ==================== countByStatus 测试 ====================

  describe('countByStatus', () => {
    it('应该返回指定状态的事件数量', async () => {
      vi.mocked(eventRepository.count).mockResolvedValue(25);

      const result = await service.countByStatus(EventStatus.PENDING);

      expect(eventRepository.count).toHaveBeenCalledWith({
        where: { eventStatus: EventStatus.PENDING },
      });
      expect(result).toBe(25);
    });
  });

  // ==================== 事件处理器测试 ====================

  describe('event handlers', () => {
    it('handleProcessInstanceStart应该创建事件', async () => {
      const data = {
        processInstanceId: 'pi-123',
        processDefinitionId: 'pd-123',
        processDefinitionKey: 'test_process',
      };
      vi.mocked(eventRepository.create).mockReturnValue(mockEvent);
      vi.mocked(eventRepository.save).mockResolvedValue(mockEvent);

      // 获取订阅回调函数
      const subscribeCalls = vi.mocked(eventBusService.subscribe).mock.calls;
      const startHandler = subscribeCalls.find(
        (call) => call[0] === 'process.instance.start',
      )?.[1];

      if (startHandler) {
        await startHandler(data);
        expect(eventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: EventType.PROCESS_INSTANCE_START,
            eventStatus: EventStatus.PENDING,
          }),
        );
      }
    });

    it('handleTaskCreated应该创建事件', async () => {
      const data = {
        processInstanceId: 'pi-123',
        taskId: 'task-123',
        taskName: 'Test Task',
        assignee: 'user1',
      };
      vi.mocked(eventRepository.create).mockReturnValue(mockEvent);
      vi.mocked(eventRepository.save).mockResolvedValue(mockEvent);

      const subscribeCalls = vi.mocked(eventBusService.subscribe).mock.calls;
      const taskCreatedHandler = subscribeCalls.find(
        (call) => call[0] === 'task.created',
      )?.[1];

      if (taskCreatedHandler) {
        await taskCreatedHandler(data);
        expect(eventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: EventType.TASK_CREATED,
            eventStatus: EventStatus.PENDING,
            taskId: 'task-123',
          }),
        );
      }
    });

    it('handleActivityStarted应该创建事件', async () => {
      const data = {
        processInstanceId: 'pi-123',
        executionId: 'exec-123',
        activityId: 'activity-1',
        activityName: 'Test Activity',
      };
      vi.mocked(eventRepository.create).mockReturnValue(mockEvent);
      vi.mocked(eventRepository.save).mockResolvedValue(mockEvent);

      const subscribeCalls = vi.mocked(eventBusService.subscribe).mock.calls;
      const activityStartedHandler = subscribeCalls.find(
        (call) => call[0] === 'activity.started',
      )?.[1];

      if (activityStartedHandler) {
        await activityStartedHandler(data);
        expect(eventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: EventType.ACTIVITY_STARTED,
            activityId: 'activity-1',
          }),
        );
      }
    });

    it('handleVariableUpdated应该创建事件', async () => {
      const data = {
        processInstanceId: 'pi-123',
        executionId: 'exec-123',
        variableName: 'testVar',
        value: 'newValue',
      };
      vi.mocked(eventRepository.create).mockReturnValue(mockEvent);
      vi.mocked(eventRepository.save).mockResolvedValue(mockEvent);

      const subscribeCalls = vi.mocked(eventBusService.subscribe).mock.calls;
      const variableUpdatedHandler = subscribeCalls.find(
        (call) => call[0] === 'variable.updated',
      )?.[1];

      if (variableUpdatedHandler) {
        await variableUpdatedHandler(data);
        expect(eventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: EventType.VARIABLE_UPDATED,
          }),
        );
      }
    });

    it('handleSignalThrown应该创建事件', async () => {
      const data = {
        processInstanceId: 'pi-123',
        signalName: 'testSignal',
      };
      vi.mocked(eventRepository.create).mockReturnValue(mockEvent);
      vi.mocked(eventRepository.save).mockResolvedValue(mockEvent);

      const subscribeCalls = vi.mocked(eventBusService.subscribe).mock.calls;
      const signalThrownHandler = subscribeCalls.find(
        (call) => call[0] === 'signal.thrown',
      )?.[1];

      if (signalThrownHandler) {
        await signalThrownHandler(data);
        expect(eventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: EventType.SIGNAL_THROWN,
            eventName: 'testSignal',
          }),
        );
      }
    });

    it('handleMessageSent应该创建事件', async () => {
      const data = {
        processInstanceId: 'pi-123',
        messageName: 'testMessage',
      };
      vi.mocked(eventRepository.create).mockReturnValue(mockEvent);
      vi.mocked(eventRepository.save).mockResolvedValue(mockEvent);

      const subscribeCalls = vi.mocked(eventBusService.subscribe).mock.calls;
      const messageSentHandler = subscribeCalls.find(
        (call) => call[0] === 'message.sent',
      )?.[1];

      if (messageSentHandler) {
        await messageSentHandler(data);
        expect(eventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: EventType.MESSAGE_SENT,
            eventName: 'testMessage',
          }),
        );
      }
    });

    it('handleTimerFired应该创建事件', async () => {
      const data = {
        processInstanceId: 'pi-123',
        executionId: 'exec-123',
        timerId: 'timer-1',
      };
      vi.mocked(eventRepository.create).mockReturnValue(mockEvent);
      vi.mocked(eventRepository.save).mockResolvedValue(mockEvent);

      const subscribeCalls = vi.mocked(eventBusService.subscribe).mock.calls;
      const timerFiredHandler = subscribeCalls.find(
        (call) => call[0] === 'timer.fired',
      )?.[1];

      if (timerFiredHandler) {
        await timerFiredHandler(data);
        expect(eventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: EventType.TIMER_FIRED,
          }),
        );
      }
    });

    it('handleCustomEvent应该创建事件', async () => {
      const data = {
        processInstanceId: 'pi-123',
        eventName: 'CustomEvent',
        eventCode: 'CUSTOM_001',
      };
      vi.mocked(eventRepository.create).mockReturnValue(mockEvent);
      vi.mocked(eventRepository.save).mockResolvedValue(mockEvent);

      const subscribeCalls = vi.mocked(eventBusService.subscribe).mock.calls;
      const customEventHandler = subscribeCalls.find(
        (call) => call[0] === 'custom.event',
      )?.[1];

      if (customEventHandler) {
        await customEventHandler(data);
        expect(eventRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: EventType.CUSTOM,
            eventName: 'CustomEvent',
            eventCode: 'CUSTOM_001',
          }),
        );
      }
    });

    it('事件处理器错误应该被捕获并记录', async () => {
      const data = {
        processInstanceId: 'pi-123',
      };
      vi.mocked(eventRepository.create).mockReturnValue(mockEvent);
      vi.mocked(eventRepository.save).mockRejectedValue(new Error('Database error'));

      const subscribeCalls = vi.mocked(eventBusService.subscribe).mock.calls;
      const startHandler = subscribeCalls.find(
        (call) => call[0] === 'process.instance.start',
      )?.[1];

      if (startHandler) {
        // 不应该抛出错误
        await expect(startHandler(data)).resolves.toBeUndefined();
      }
    });
  });
});
