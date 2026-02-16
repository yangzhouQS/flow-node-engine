/**
 * EventSubscriptionService 单元测试
 * 测试事件订阅服务的核心功能
 */
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, Repository } from 'typeorm';
import { vi, describe, it, expect, beforeEach, afterEach, Mocked } from 'vitest';

import {
  EventSubscription,
  EventSubscriptionType,
  EventSubscriptionConfigType,
} from '../entities/event-subscription.entity';
import {
  EventSubscriptionService,
  CreateEventSubscriptionOptions,
} from './event-subscription.service';

// Mock 数据
const mockSubscription: EventSubscription = {
  id_: 'subscription-123',
  event_type_: EventSubscriptionType.MESSAGE,
  event_name_: 'test-message',
  process_def_id_: 'process-def-123',
  process_def_key_: 'test-process',
  process_inst_id_: 'process-123',
  execution_id_: 'execution-123',
  activity_id_: 'activity-123',
  activity_name_: 'Test Activity',
  configuration_type_: EventSubscriptionConfigType.BOUNDARY,
  configuration_: JSON.stringify({ key: 'value' }),
  tenant_id_: 'tenant-123',
  callback_id_: 'callback-123',
  priority_: 0,
  is_processed_: false,
  processed_time_: null,
  extra_data_: null,
  create_time_: new Date(),
};

const mockSignalSubscription: EventSubscription = {
  id_: 'subscription-456',
  event_type_: EventSubscriptionType.SIGNAL,
  event_name_: 'test-signal',
  process_def_id_: 'process-def-123',
  process_def_key_: 'test-process',
  process_inst_id_: 'process-456',
  execution_id_: 'execution-456',
  activity_id_: 'activity-456',
  activity_name_: 'Signal Activity',
  configuration_type_: EventSubscriptionConfigType.INTERMEDIATE_CATCH,
  configuration_: null,
  tenant_id_: 'tenant-123',
  callback_id_: null,
  priority_: 1,
  is_processed_: false,
  processed_time_: null,
  extra_data_: null,
  create_time_: new Date(),
};

describe('EventSubscriptionService', () => {
  let service: EventSubscriptionService;
  let subscriptionRepository: Mocked<Repository<EventSubscription>>;
  let eventEmitter: Mocked<EventEmitter2>;

  beforeEach(async () => {
    // 创建 mock repository
    subscriptionRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      remove: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as any;

    // 创建 mock eventEmitter
    eventEmitter = {
      emit: vi.fn().mockResolvedValue(undefined),
    } as any;

    // 创建 mock dataSource
    const mockDataSource = {} as DataSource;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSubscriptionService,
        { provide: 'EventSubscriptionRepository', useValue: subscriptionRepository },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: DataSource, useValue: mockDataSource },
      ],
    })
      .overrideProvider('EventSubscriptionRepository')
      .useValue(subscriptionRepository)
      .overrideProvider(EventEmitter2)
      .useValue(eventEmitter)
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .compile();

    service = module.get<EventSubscriptionService>(EventSubscriptionService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== 创建订阅测试 ====================

  describe('createSubscription', () => {
    it('应该成功创建事件订阅', async () => {
      const options: CreateEventSubscriptionOptions = {
        eventType: EventSubscriptionType.MESSAGE,
        eventName: 'test-message',
        processDefinitionId: 'process-def-123',
        processInstanceId: 'process-123',
      };

      subscriptionRepository.save.mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(options);

      expect(subscriptionRepository.save).toHaveBeenCalled();
      expect(result.event_type_).toBe(EventSubscriptionType.MESSAGE);
      expect(result.event_name_).toBe('test-message');
    });

    it('创建订阅时应该发送创建事件', async () => {
      const options: CreateEventSubscriptionOptions = {
        eventType: EventSubscriptionType.SIGNAL,
        eventName: 'test-signal',
      };

      subscriptionRepository.save.mockResolvedValue(mockSignalSubscription);

      await service.createSubscription(options);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'eventSubscription.created',
        expect.objectContaining({
          type: 'created',
          subscription: expect.any(Object),
        })
      );
    });

    it('应该正确处理配置数据', async () => {
      const config = { timeout: 5000, retries: 3 };
      const options: CreateEventSubscriptionOptions = {
        eventType: EventSubscriptionType.TIMER,
        eventName: 'timer-event',
        configuration: config,
      };

      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        event_type_: EventSubscriptionType.TIMER,
        configuration_: JSON.stringify(config),
      });

      await service.createSubscription(options);

      const savedArg = subscriptionRepository.save.mock.calls[0][0];
      expect(savedArg.configuration_).toBe(JSON.stringify(config));
    });

    it('应该正确处理扩展数据', async () => {
      const extraData = { customField: 'value' };
      const options: CreateEventSubscriptionOptions = {
        eventType: EventSubscriptionType.MESSAGE,
        eventName: 'test-message',
        extraData,
      };

      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        extra_data_: JSON.stringify(extraData),
      });

      await service.createSubscription(options);

      const savedArg = subscriptionRepository.save.mock.calls[0][0];
      expect(savedArg.extra_data_).toBe(JSON.stringify(extraData));
    });

    it('应该设置默认优先级为0', async () => {
      const options: CreateEventSubscriptionOptions = {
        eventType: EventSubscriptionType.MESSAGE,
        eventName: 'test-message',
      };

      subscriptionRepository.save.mockResolvedValue(mockSubscription);

      await service.createSubscription(options);

      const savedArg = subscriptionRepository.save.mock.calls[0][0];
      expect(savedArg.priority_).toBe(0);
    });

    it('应该设置自定义优先级', async () => {
      const options: CreateEventSubscriptionOptions = {
        eventType: EventSubscriptionType.MESSAGE,
        eventName: 'test-message',
        priority: 10,
      };

      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        priority_: 10,
      });

      await service.createSubscription(options);

      const savedArg = subscriptionRepository.save.mock.calls[0][0];
      expect(savedArg.priority_).toBe(10);
    });
  });

  // ==================== 删除订阅测试 ====================

  describe('deleteSubscription', () => {
    it('应该成功删除订阅', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      subscriptionRepository.remove.mockResolvedValue(mockSubscription);

      const result = await service.deleteSubscription('subscription-123');

      expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
        where: { id_: 'subscription-123' },
      });
      expect(subscriptionRepository.remove).toHaveBeenCalledWith(mockSubscription);
      expect(result).toBe(true);
    });

    it('删除订阅时应该发送删除事件', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      subscriptionRepository.remove.mockResolvedValue(mockSubscription);

      await service.deleteSubscription('subscription-123');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'eventSubscription.deleted',
        expect.objectContaining({
          type: 'deleted',
          subscription: mockSubscription,
        })
      );
    });

    it('订阅不存在时应该返回false', async () => {
      subscriptionRepository.findOne.mockResolvedValue(null);

      const result = await service.deleteSubscription('nonexistent');

      expect(result).toBe(false);
      expect(subscriptionRepository.remove).not.toHaveBeenCalled();
    });
  });

  describe('deleteSubscriptionsByProcessInstance', () => {
    it('应该删除流程实例的所有订阅', async () => {
      subscriptionRepository.delete.mockResolvedValue({ affected: 3 } as any);

      const result = await service.deleteSubscriptionsByProcessInstance('process-123');

      expect(subscriptionRepository.delete).toHaveBeenCalledWith({
        process_inst_id_: 'process-123',
      });
      expect(result).toBe(3);
    });

    it('没有订阅时应该返回0', async () => {
      subscriptionRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const result = await service.deleteSubscriptionsByProcessInstance('process-123');

      expect(result).toBe(0);
    });
  });

  describe('deleteSubscriptionsByExecution', () => {
    it('应该删除执行的所有订阅', async () => {
      subscriptionRepository.delete.mockResolvedValue({ affected: 2 } as any);

      const result = await service.deleteSubscriptionsByExecution('execution-123');

      expect(subscriptionRepository.delete).toHaveBeenCalledWith({
        execution_id_: 'execution-123',
      });
      expect(result).toBe(2);
    });
  });

  // ==================== 查询订阅测试 ====================

  describe('getSubscription', () => {
    it('应该返回指定ID的订阅', async () => {
      subscriptionRepository.findOne.mockResolvedValue(mockSubscription);

      const result = await service.getSubscription('subscription-123');

      expect(subscriptionRepository.findOne).toHaveBeenCalledWith({
        where: { id_: 'subscription-123' },
      });
      expect(result).toEqual(mockSubscription);
    });

    it('订阅不存在时应该返回null', async () => {
      subscriptionRepository.findOne.mockResolvedValue(null);

      const result = await service.getSubscription('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getSubscriptionsByProcessInstance', () => {
    it('应该返回流程实例的所有订阅', async () => {
      subscriptionRepository.find.mockResolvedValue([mockSubscription, mockSignalSubscription]);

      const result = await service.getSubscriptionsByProcessInstance('process-123');

      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: { process_inst_id_: 'process-123' },
        order: { create_time_: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('没有订阅时应该返回空数组', async () => {
      subscriptionRepository.find.mockResolvedValue([]);

      const result = await service.getSubscriptionsByProcessInstance('process-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getSubscriptionsByEvent', () => {
    it('应该返回指定类型和名称的未处理订阅', async () => {
      subscriptionRepository.find.mockResolvedValue([mockSubscription]);

      const result = await service.getSubscriptionsByEvent(
        EventSubscriptionType.MESSAGE,
        'test-message'
      );

      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: {
          event_type_: EventSubscriptionType.MESSAGE,
          event_name_: 'test-message',
          is_processed_: false,
        },
        order: { priority_: 'DESC', create_time_: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getMessageEventSubscriptions', () => {
    it('应该返回消息事件订阅', async () => {
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockSubscription]),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getMessageEventSubscriptions('test-message');

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'sub.event_type_ = :eventType',
        { eventType: EventSubscriptionType.MESSAGE }
      );
      expect(result).toHaveLength(1);
    });

    it('应该按流程实例过滤消息订阅', async () => {
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockSubscription]),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.getMessageEventSubscriptions('test-message', 'process-123');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'sub.process_inst_id_ = :processInstanceId',
        { processInstanceId: 'process-123' }
      );
    });
  });

  describe('getSignalEventSubscriptions', () => {
    it('应该返回信号事件订阅', async () => {
      subscriptionRepository.find.mockResolvedValue([mockSignalSubscription]);

      const result = await service.getSignalEventSubscriptions('test-signal');

      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: {
          event_type_: EventSubscriptionType.SIGNAL,
          event_name_: 'test-signal',
          is_processed_: false,
        },
        order: { priority_: 'DESC', create_time_: 'ASC' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ==================== 触发事件测试 ====================

  describe('triggerMessageEvent', () => {
    it('应该触发消息事件', async () => {
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockSubscription]),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        is_processed_: true,
        processed_time_: new Date(),
      });

      const result = await service.triggerMessageEvent('test-message', { data: 'test' });

      expect(result.triggeredCount).toBe(1);
      expect(result.subscriptions).toHaveLength(1);
    });

    it('没有匹配订阅时应该返回0', async () => {
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.triggerMessageEvent('nonexistent');

      expect(result.triggeredCount).toBe(0);
      expect(result.subscriptions).toHaveLength(0);
    });

    it('触发失败时应该继续处理其他订阅', async () => {
      const subscription1 = { ...mockSubscription, id_: 'sub-1' };
      const subscription2 = { ...mockSubscription, id_: 'sub-2' };
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([subscription1, subscription2]),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      
      // 第一个保存失败，第二个成功
      subscriptionRepository.save
        .mockRejectedValueOnce(new Error('Save failed'))
        .mockResolvedValueOnce({
          ...subscription2,
          is_processed_: true,
          processed_time_: new Date(),
        });

      const result = await service.triggerMessageEvent('test-message');

      expect(result.triggeredCount).toBe(1);
    });
  });

  describe('triggerSignalEvent', () => {
    it('应该触发信号事件', async () => {
      subscriptionRepository.find.mockResolvedValue([mockSignalSubscription]);
      subscriptionRepository.save.mockResolvedValue({
        ...mockSignalSubscription,
        is_processed_: true,
        processed_time_: new Date(),
      });

      const result = await service.triggerSignalEvent('test-signal', { data: 'test' });

      expect(result.triggeredCount).toBe(1);
    });

    it('应该按租户过滤信号订阅', async () => {
      const subscriptionWithTenant = { ...mockSignalSubscription, tenant_id_: 'tenant-123' };
      const subscriptionWithoutTenant = { ...mockSignalSubscription, id_: 'sub-789', tenant_id_: null };
      
      subscriptionRepository.find.mockResolvedValue([subscriptionWithTenant, subscriptionWithoutTenant]);
      subscriptionRepository.save.mockResolvedValue({
        ...mockSignalSubscription,
        is_processed_: true,
      });

      const result = await service.triggerSignalEvent('test-signal', {}, 'tenant-123');

      // 应该只触发匹配租户的订阅（包括无租户的）
      expect(result.triggeredCount).toBe(2);
    });

    it('不匹配租户的订阅不应该被触发', async () => {
      const subscriptionOtherTenant = {
        ...mockSignalSubscription,
        tenant_id_: 'other-tenant',
      };
      
      subscriptionRepository.find.mockResolvedValue([subscriptionOtherTenant]);
      subscriptionRepository.save.mockResolvedValue({});

      const result = await service.triggerSignalEvent('test-signal', {}, 'tenant-123');

      expect(result.triggeredCount).toBe(0);
    });
  });

  describe('triggerSubscription', () => {
    it('应该标记订阅为已处理', async () => {
      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        is_processed_: true,
        processed_time_: new Date(),
      });

      await service.triggerSubscription(mockSubscription, { test: 'data' });

      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          is_processed_: true,
          processed_time_: expect.any(Date),
        })
      );
    });

    it('应该发送触发事件', async () => {
      subscriptionRepository.save.mockResolvedValue({
        ...mockSubscription,
        is_processed_: true,
      });

      await service.triggerSubscription(mockSubscription, { test: 'data' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'eventSubscription.triggered',
        expect.objectContaining({
          subscription: expect.any(Object),
          payload: { test: 'data' },
        })
      );
    });
  });

  // ==================== 检查订阅存在测试 ====================

  describe('hasMessageEventSubscription', () => {
    it('存在订阅时应该返回true', async () => {
      subscriptionRepository.count.mockResolvedValue(1);

      const result = await service.hasMessageEventSubscription('test-message', 'process-123');

      expect(subscriptionRepository.count).toHaveBeenCalledWith({
        where: {
          event_type_: EventSubscriptionType.MESSAGE,
          event_name_: 'test-message',
          process_inst_id_: 'process-123',
          is_processed_: false,
        },
      });
      expect(result).toBe(true);
    });

    it('不存在订阅时应该返回false', async () => {
      subscriptionRepository.count.mockResolvedValue(0);

      const result = await service.hasMessageEventSubscription('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('hasSignalEventSubscription', () => {
    it('存在订阅时应该返回true', async () => {
      subscriptionRepository.count.mockResolvedValue(2);

      const result = await service.hasSignalEventSubscription('test-signal');

      expect(subscriptionRepository.count).toHaveBeenCalledWith({
        where: {
          event_type_: EventSubscriptionType.SIGNAL,
          event_name_: 'test-signal',
          is_processed_: false,
        },
      });
      expect(result).toBe(true);
    });

    it('不存在订阅时应该返回false', async () => {
      subscriptionRepository.count.mockResolvedValue(0);

      const result = await service.hasSignalEventSubscription('nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== 统计和清理测试 ====================

  describe('getPendingSubscriptions', () => {
    it('应该返回未处理的订阅', async () => {
      subscriptionRepository.find.mockResolvedValue([mockSubscription, mockSignalSubscription]);

      const result = await service.getPendingSubscriptions(100);

      expect(subscriptionRepository.find).toHaveBeenCalledWith({
        where: { is_processed_: false },
        take: 100,
        order: { create_time_: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });

    it('应该使用自定义限制', async () => {
      subscriptionRepository.find.mockResolvedValue([mockSubscription]);

      await service.getPendingSubscriptions(50);

      expect(subscriptionRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });
  });

  describe('getStatistics', () => {
    it('应该返回统计信息', async () => {
      subscriptionRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(30)  // pending
        .mockResolvedValueOnce(70); // processed

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { type: 'message', count: '50' },
          { type: 'signal', count: '30' },
          { type: 'timer', count: '20' },
        ]),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getStatistics();

      expect(result.total).toBe(100);
      expect(result.pending).toBe(30);
      expect(result.processed).toBe(70);
      expect(result.byType[EventSubscriptionType.MESSAGE]).toBe(50);
      expect(result.byType[EventSubscriptionType.SIGNAL]).toBe(30);
      expect(result.byType[EventSubscriptionType.TIMER]).toBe(20);
    });
  });

  describe('cleanupProcessedSubscriptions', () => {
    it('应该清理旧的已处理订阅', async () => {
      const mockQueryBuilder = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 5 }),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.cleanupProcessedSubscriptions(7);

      expect(result).toBe(5);
    });

    it('没有需要清理的订阅时应该返回0', async () => {
      const mockQueryBuilder = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 0 }),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.cleanupProcessedSubscriptions(7);

      expect(result).toBe(0);
    });

    it('应该使用自定义天数', async () => {
      const mockQueryBuilder = {
        delete: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 3 }),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.cleanupProcessedSubscriptions(30);

      // 验证调用
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'processed_time_ < :cutoff',
        expect.objectContaining({ cutoff: expect.any(Date) })
      );
    });
  });

  // ==================== 边界情况测试 ====================

  describe('边界情况', () => {
    it('创建订阅时所有可选字段应该为null', async () => {
      const options: CreateEventSubscriptionOptions = {
        eventType: EventSubscriptionType.MESSAGE,
        eventName: 'minimal-message',
      };

      subscriptionRepository.save.mockResolvedValue({
        id_: 'new-id',
        event_type_: EventSubscriptionType.MESSAGE,
        event_name_: 'minimal-message',
        process_def_id_: null,
        process_def_key_: null,
        process_inst_id_: null,
        execution_id_: null,
        activity_id_: null,
        activity_name_: null,
        configuration_type_: null,
        configuration_: null,
        tenant_id_: null,
        callback_id_: null,
        priority_: 0,
        is_processed_: false,
        processed_time_: null,
        extra_data_: null,
        create_time_: new Date(),
      });

      const result = await service.createSubscription(options);

      expect(result.process_def_id_).toBeNull();
      expect(result.process_inst_id_).toBeNull();
      expect(result.tenant_id_).toBeNull();
    });

    it('触发大量订阅时应该全部处理', async () => {
      const subscriptions = Array.from({ length: 100 }, (_, i) => ({
        ...mockSubscription,
        id_: `sub-${i}`,
      }));

      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(subscriptions),
      };
      subscriptionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      subscriptionRepository.save.mockResolvedValue({});

      const result = await service.triggerMessageEvent('test-message');

      expect(result.triggeredCount).toBe(100);
    });
  });
});
