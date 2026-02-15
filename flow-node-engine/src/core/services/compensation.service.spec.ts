import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CompensationService } from './compensation.service';
import {
  CompensationEventType,
  CompensationState,
  CompensationHandlerConfig,
  CompensationContext,
  CompensationHandlerResult,
  ICompensationHandler,
} from '../interfaces/compensation.interface';

describe('CompensationService', () => {
  let service: CompensationService;

  beforeEach(() => {
    // 直接实例化服务，避免NestJS依赖注入问题
    service = new CompensationService();
  });

  afterEach(() => {
    // Clean up
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerHandler', () => {
    it('should register a compensation handler', () => {
      const handler: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({
          id: 'handler-1',
          activityId: 'activity-1',
          activityType: 'userTask',
        }),
      };

      service.registerHandler('process-1', 'activity-1', handler);

      expect(service.hasHandler('process-1', 'activity-1')).toBe(true);
    });

    it('should register multiple handlers for same process', () => {
      const handler1: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };
      const handler2: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({ id: 'h2', activityId: 'a2', activityType: 'serviceTask' }),
      };

      service.registerHandler('process-1', 'a1', handler1);
      service.registerHandler('process-1', 'a2', handler2);

      expect(service.hasHandler('process-1', 'a1')).toBe(true);
      expect(service.hasHandler('process-1', 'a2')).toBe(true);
    });
  });

  describe('unregisterHandler', () => {
    it('should unregister a compensation handler', () => {
      const handler: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };

      service.registerHandler('process-1', 'a1', handler);
      expect(service.hasHandler('process-1', 'a1')).toBe(true);

      service.unregisterHandler('process-1', 'a1');
      expect(service.hasHandler('process-1', 'a1')).toBe(false);
    });

    it('should return false if handler not found', () => {
      const result = service.unregisterHandler('process-1', 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('recordExecution', () => {
    it('should record an execution', () => {
      const record = service.recordExecution(
        'process-1',
        'exec-1',
        'activity-1',
        'userTask',
        'Test Activity',
        { var1: 'value1' },
      );

      expect(record).toBeDefined();
      expect(record.processInstanceId).toBe('process-1');
      expect(record.activityId).toBe('activity-1');
      expect(record.activityType).toBe('userTask');
      expect(record.state).toBe(CompensationState.PENDING);
      expect(record.variableSnapshot).toEqual({ var1: 'value1' });
    });

    it('should record multiple executions', () => {
      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');
      service.recordExecution('process-1', 'exec-2', 'a2', 'serviceTask');
      service.recordExecution('process-1', 'exec-3', 'a3', 'sendTask');

      const records = service.getExecutionRecords('process-1');
      expect(records.length).toBe(3);
    });
  });

  describe('createScope', () => {
    it('should create a compensation scope', () => {
      const scope = service.createScope('process-1', 'scope-1', 'activity-1');

      expect(scope).toBeDefined();
      expect(scope.scopeId).toBe('scope-1');
      expect(scope.processInstanceId).toBe('process-1');
      expect(scope.activityId).toBe('activity-1');
      expect(scope.depth).toBe(0);
    });

    it('should create nested scopes', () => {
      const parentScope = service.createScope('process-1', 'scope-1', 'activity-1');
      const childScope = service.createScope('process-1', 'scope-2', 'activity-2', 'scope-1');

      expect(childScope.parentScopeId).toBe('scope-1');
      expect(childScope.depth).toBe(1);
      expect(parentScope.childScopes.length).toBe(1);
    });
  });

  describe('subscribe', () => {
    it('should create a compensation subscription', () => {
      const handlerConfig: CompensationHandlerConfig = {
        id: 'handler-1',
        activityId: 'activity-1',
        activityType: 'userTask',
      };

      const subscription = service.subscribe('process-1', 'exec-1', 'activity-1', handlerConfig);

      expect(subscription).toBeDefined();
      expect(subscription.processInstanceId).toBe('process-1');
      expect(subscription.activityId).toBe('activity-1');
      expect(subscription.handlerConfig).toEqual(handlerConfig);
    });

    it('should get subscriptions for a process', () => {
      const handlerConfig: CompensationHandlerConfig = {
        id: 'handler-1',
        activityId: 'activity-1',
        activityType: 'userTask',
      };

      service.subscribe('process-1', 'exec-1', 'activity-1', handlerConfig);
      const subscriptions = service.getSubscriptions('process-1');

      expect(subscriptions.length).toBe(1);
    });
  });

  describe('compensate', () => {
    it('should execute compensation in reverse order', async () => {
      const compensationOrder: string[] = [];
      
      const handler1: ICompensationHandler = {
        compensate: vi.fn().mockImplementation(() => {
          compensationOrder.push('a1');
          return { success: true };
        }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };
      
      const handler2: ICompensationHandler = {
        compensate: vi.fn().mockImplementation(() => {
          compensationOrder.push('a2');
          return { success: true };
        }),
        getConfig: vi.fn().mockReturnValue({ id: 'h2', activityId: 'a2', activityType: 'serviceTask' }),
      };

      service.registerHandler('process-1', 'a1', handler1);
      service.registerHandler('process-1', 'a2', handler2);

      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');
      service.recordExecution('process-1', 'exec-2', 'a2', 'serviceTask');

      const results = await service.compensate('process-1');

      expect(results.length).toBe(2);
      // Should be in reverse order
      expect(compensationOrder).toEqual(['a2', 'a1']);
    });

    it('should skip activities without handlers', async () => {
      const handler: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };

      service.registerHandler('process-1', 'a1', handler);

      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');
      service.recordExecution('process-1', 'exec-2', 'a2', 'serviceTask'); // No handler

      const results = await service.compensate('process-1');

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true); // a2 skipped
      expect(results[1].success).toBe(true); // a1 compensated
    });

    it('should handle compensation failures', async () => {
      const handler: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({
          success: false,
          error: 'Compensation failed',
        }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };

      service.registerHandler('process-1', 'a1', handler);
      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');

      const results = await service.compensate('process-1');

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Compensation failed');
    });

    it('should compensate within a scope', async () => {
      const handler1: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };
      const handler2: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({ id: 'h2', activityId: 'a2', activityType: 'userTask' }),
      };

      service.registerHandler('process-1', 'a1', handler1);
      service.registerHandler('process-1', 'a2', handler2);

      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask', undefined, undefined, 'scope-1');
      service.recordExecution('process-1', 'exec-2', 'a2', 'userTask', undefined, undefined, 'scope-2');

      const results = await service.compensate('process-1', undefined, 'scope-1');

      expect(results.length).toBe(1);
      expect(results[0].compensatedActivityId).toBe('a1');
    });
  });

  describe('createPlan', () => {
    it('should create a compensation plan', () => {
      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');
      service.recordExecution('process-1', 'exec-2', 'a2', 'serviceTask');

      const plan = service.createPlan('process-1', 'error-event');

      expect(plan).toBeDefined();
      expect(plan.processInstanceId).toBe('process-1');
      expect(plan.triggerSource).toBe('error-event');
      expect(plan.executionOrder.length).toBe(2);
      // Should be in reverse order
      expect(plan.executionOrder[0].activityId).toBe('a2');
      expect(plan.executionOrder[1].activityId).toBe('a1');
    });
  });

  describe('executePlan', () => {
    it('should execute a compensation plan', async () => {
      const handler: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };

      service.registerHandler('process-1', 'a1', handler);
      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');

      const plan = service.createPlan('process-1', 'error-event');
      const results = await service.executePlan(plan);

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clean up all data for a process instance', () => {
      const handler: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };

      service.registerHandler('process-1', 'a1', handler);
      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');
      service.createScope('process-1', 'scope-1');

      service.cleanup('process-1');

      expect(service.getExecutionRecords('process-1').length).toBe(0);
      expect(service.getSubscriptions('process-1').length).toBe(0);
      expect(service.getScope('process-1', 'scope-1')).toBeUndefined();
    });
  });

  describe('getStatistics', () => {
    it('should return compensation statistics', async () => {
      const handler: ICompensationHandler = {
        compensate: vi.fn().mockReturnValue({ success: true }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };

      service.registerHandler('process-1', 'a1', handler);
      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');

      await service.compensate('process-1');

      const stats = service.getStatistics();

      expect(stats.totalCompensations).toBe(1);
      expect(stats.successCount).toBe(1);
      expect(stats.byActivityType['userTask']).toBeDefined();
      expect(stats.byActivityType['userTask'].count).toBe(1);
    });
  });

  describe('async compensation', () => {
    it('should handle async compensation handlers', async () => {
      const handler: ICompensationHandler = {
        compensate: vi.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { success: true };
        }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };

      service.registerHandler('process-1', 'a1', handler);
      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');

      const results = await service.compensate('process-1');

      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
    });
  });

  describe('retry mechanism', () => {
    it('should retry failed compensations', async () => {
      let attempts = 0;
      
      const handler: ICompensationHandler = {
        compensate: vi.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 3) {
            return { success: false, retry: true, error: 'Temporary failure' };
          }
          return { success: true };
        }),
        getConfig: vi.fn().mockReturnValue({ id: 'h1', activityId: 'a1', activityType: 'userTask' }),
      };

      service.registerHandler('process-1', 'a1', handler);
      service.recordExecution('process-1', 'exec-1', 'a1', 'userTask');

      const results = await service.compensate('process-1');

      expect(attempts).toBe(3);
      expect(results[0].success).toBe(true);
    });
  });
});
