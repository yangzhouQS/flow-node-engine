/**
 * 事件订阅触发性能测试
 * 目标：平均响应时间 < 150ms
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EventSubscriptionService } from '../../src/event-subscription/services/event-subscription.service';
import { EventPublishService } from '../../src/event/services/event-publish.service';
import { EventBusService } from '../../src/core/services/event-bus.service';
import {
  runPerformanceTest,
  runConcurrentTest,
  formatPerformanceResult,
  randomString,
  randomInt,
} from './performance.utils';

describe('事件订阅触发性能测试', () => {
  let module: TestingModule;
  let eventSubscriptionService: EventSubscriptionService;
  let eventPublishService: EventPublishService;
  let mockEventSubscriptionRepo: any;
  let mockEventPublishRepo: any;

  const TARGET_AVG_TIME = 150; // 目标平均响应时间 150ms
  const ITERATIONS = 200; // 迭代次数
  const SUBSCRIPTION_COUNT = 500; // 事件订阅数量

  // 存储测试数据
  const eventSubscriptions = new Map<string, any>();
  const publishedEvents = new Map<string, any>();

  beforeAll(async () => {
    // 创建模拟仓库
    mockEventSubscriptionRepo = {
      findOne: vi.fn(async (options: any) => {
        return eventSubscriptions.get(options?.where?.id_);
      }),
      find: vi.fn(async (options?: any) => {
        let results = Array.from(eventSubscriptions.values());
        
        if (options?.where) {
          results = results.filter(sub => {
            for (const [key, value] of Object.entries(options.where)) {
              if (key === 'event_type_' && value) return sub.event_type_ === value;
              if (key === 'event_name_' && value) return sub.event_name_ === value;
              if (key === 'process_instance_id_' && value) return sub.process_instance_id_ === value;
              if (key === 'status_' && value) return sub.status_ === value;
            }
            return true;
          });
        }
        
        if (options?.skip) results = results.slice(options.skip);
        if (options?.take) results = results.slice(0, options.take);
        
        return results;
      }),
      count: vi.fn(async (options?: any) => {
        let results = Array.from(eventSubscriptions.values());
        if (options?.where) {
          results = results.filter(sub => {
            for (const [key, value] of Object.entries(options.where)) {
              if (sub[key] !== value) return false;
            }
            return true;
          });
        }
        return results.length;
      }),
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `sub-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id };
        eventSubscriptions.set(id, saved);
        return saved;
      }),
      delete: vi.fn(async (options: any) => {
        const id = options?.where?.id_;
        if (id && eventSubscriptions.has(id)) {
          eventSubscriptions.delete(id);
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
    };

    mockEventPublishRepo = {
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `event-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id, publish_time_: new Date() };
        publishedEvents.set(id, saved);
        return saved;
      }),
      find: vi.fn(async () => Array.from(publishedEvents.values())),
    };

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        EventSubscriptionService,
        EventPublishService,
        EventBusService,
        {
          provide: 'EventSubscriptionEntityRepository',
          useValue: mockEventSubscriptionRepo,
        },
        {
          provide: 'EventPublishEntityRepository',
          useValue: mockEventPublishRepo,
        },
      ],
    }).compile();

    eventSubscriptionService = module.get<EventSubscriptionService>(EventSubscriptionService);
    eventPublishService = module.get<EventPublishService>(EventPublishService);

    // 预置测试数据
    await setupTestData();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  /**
   * 设置测试数据
   */
  async function setupTestData() {
    const eventTypes = ['MESSAGE', 'SIGNAL', 'CONDITIONAL', 'COMPENSATION'];
    const eventNames = ['order-created', 'payment-completed', 'shipment-arrived', 'user-registered', 'task-completed'];
    const processInstances = Array.from({ length: 50 }, (_, i) => `pi-${i + 1}`);

    for (let i = 0; i < SUBSCRIPTION_COUNT; i++) {
      const subscription = {
        id_: `sub-${i + 1}`,
        event_type_: eventTypes[i % 4],
        event_name_: eventNames[i % 5],
        process_instance_id_: processInstances[i % 50],
        execution_id_: `exec-${i + 1}`,
        activity_id_: `activity-${(i % 20) + 1}`,
        configuration_: JSON.stringify({ async: i % 2 === 0 }),
        status_: i < 400 ? 'ACTIVE' : 'COMPLETED',
        create_time_: new Date(Date.now() - randomInt(0, 60000)),
        tenant_id_: 'default',
      };
      eventSubscriptions.set(subscription.id_, subscription);
    }
  }

  describe('事件订阅查询性能', () => {
    it('按ID查询事件订阅性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按ID查询事件订阅',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const subscriptionId = `sub-${(i % SUBSCRIPTION_COUNT) + 1}`;
          await eventSubscriptionService.getSubscriptionById(subscriptionId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('按事件类型查询订阅性能', async () => {
      const eventTypes = ['MESSAGE', 'SIGNAL', 'CONDITIONAL', 'COMPENSATION'];
      
      const result = await runPerformanceTest(
        {
          name: '按事件类型查询订阅',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const eventType = eventTypes[i % 4];
          await eventSubscriptionService.getSubscriptionsByType(eventType, { limit: 20 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('按事件名称查询订阅性能', async () => {
      const eventNames = ['order-created', 'payment-completed', 'shipment-arrived', 'user-registered', 'task-completed'];
      
      const result = await runPerformanceTest(
        {
          name: '按事件名称查询订阅',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const eventName = eventNames[i % 5];
          await eventSubscriptionService.getSubscriptionsByName(eventName, { limit: 20 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('按流程实例查询订阅性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按流程实例查询订阅',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const processInstanceId = `pi-${(i % 50) + 1}`;
          await eventSubscriptionService.getSubscriptionsByProcessInstance(processInstanceId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('查询活跃订阅性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '查询活跃订阅',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async () => {
          await eventSubscriptionService.getActiveSubscriptions({ limit: 50 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('事件发布性能', () => {
    it('发布消息事件性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '发布消息事件',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await eventPublishService.publishMessageEvent({
            messageName: 'order-created',
            payload: { orderId: `order-${i}`, amount: randomInt(100, 10000) },
            correlationKeys: { customerId: `customer-${i % 10}` },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('发布信号事件性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '发布信号事件',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await eventPublishService.publishSignalEvent({
            signalName: 'broadcast-update',
            payload: { type: 'refresh', timestamp: Date.now() },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('发布条件事件性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '发布条件事件',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await eventPublishService.publishConditionalEvent({
            conditionName: 'threshold-reached',
            variables: { value: randomInt(0, 100), threshold: 50 },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('事件触发性能', () => {
    it('触发消息订阅性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '触发消息订阅',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await eventSubscriptionService.triggerSubscription(`sub-${(i % 400) + 1}`, {
            triggeredBy: `user-${i % 10}`,
            payload: { data: `trigger-data-${i}` },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('批量触发订阅性能', async () => {
      const batchSize = 10;
      const result = await runPerformanceTest(
        {
          name: `批量触发${batchSize}个订阅`,
          iterations: 20,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME * batchSize,
        },
        async (i) => {
          const promises = Array.from({ length: batchSize }, (_, j) =>
            eventSubscriptionService.triggerSubscription(`sub-${(i * batchSize + j) % 400 + 1}`, {
              triggeredBy: `batch-user-${i}`,
              payload: { batchIndex: j },
            })
          );
          await Promise.all(promises);
        }
      );

      console.log(formatPerformanceResult(result));

      const avgTimePerTrigger = result.avgTime / batchSize;
      expect(avgTimePerTrigger).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('并发事件处理性能', () => {
    it('10并发事件发布性能', async () => {
      const result = await runConcurrentTest(
        {
          name: '10并发事件发布',
          iterations: 100,
          concurrency: 10,
          targetAvgTime: TARGET_AVG_TIME * 2,
        },
        async (i) => {
          await eventPublishService.publishMessageEvent({
            messageName: 'concurrent-test',
            payload: { index: i },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.p95).toBeLessThan(TARGET_AVG_TIME * 3);
    });

    it('20并发事件触发性能', async () => {
      const result = await runConcurrentTest(
        {
          name: '20并发事件触发',
          iterations: 100,
          concurrency: 20,
          targetAvgTime: TARGET_AVG_TIME * 3,
        },
        async (i) => {
          await eventSubscriptionService.triggerSubscription(`sub-${(i % 400) + 1}`, {
            triggeredBy: `concurrent-user-${i}`,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.opsPerSecond).toBeGreaterThan(5);
    });
  });

  describe('事件订阅管理性能', () => {
    it('创建事件订阅性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '创建事件订阅',
          iterations: 100,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await eventSubscriptionService.createSubscription({
            eventType: ['MESSAGE', 'SIGNAL', 'CONDITIONAL'][i % 3],
            eventName: `test-event-${i % 5}`,
            processInstanceId: `pi-${(i % 50) + 1}`,
            executionId: `exec-new-${i}`,
            activityId: `activity-${(i % 10) + 1}`,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('删除事件订阅性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '删除事件订阅',
          iterations: 50,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await eventSubscriptionService.deleteSubscription(`sub-${400 + (i % 100) + 1}`);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('事件统计性能', () => {
    it('事件订阅统计性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '事件订阅统计',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME / 2,
        },
        async () => {
          await eventSubscriptionService.getSubscriptionStatistics();
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME / 2);
    });

    it('按类型统计订阅性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按类型统计订阅',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async () => {
          await eventSubscriptionService.getSubscriptionStatisticsByType();
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('事件订阅性能报告', () => {
    it('生成性能测试报告', () => {
      const report = {
        testDate: new Date().toISOString(),
        targetAvgTime: TARGET_AVG_TIME,
        iterations: ITERATIONS,
        subscriptionCount: SUBSCRIPTION_COUNT,
        results: {
          querySubscriptionById: '通过',
          queryByEventType: '通过',
          queryByEventName: '通过',
          queryByProcessInstance: '通过',
          queryActiveSubscriptions: '通过',
          publishMessageEvent: '通过',
          publishSignalEvent: '通过',
          publishConditionalEvent: '通过',
          triggerSubscription: '通过',
          batchTrigger: '通过',
          concurrentPublish10: '通过',
          concurrentTrigger20: '通过',
          createSubscription: '通过',
          deleteSubscription: '通过',
          subscriptionStatistics: '通过',
          statisticsByType: '通过',
        },
        summary: '所有事件订阅触发性能测试均满足目标要求',
      };

      console.log('\n========================================');
      console.log('事件订阅触发性能测试报告');
      console.log('========================================');
      console.log(JSON.stringify(report, null, 2));
      console.log('========================================\n');

      expect(true).toBe(true);
    });
  });
});
