/**
 * 事务子流程服务单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  TransactionSubProcessService,
  TransactionSubProcessExecutor,
} from './transaction-subprocess.service';
import { CompensationService } from './compensation.service';
import {
  TransactionState,
  ITransactionSubProcessConfig,
  ICompensationEventSubscription,
  CancelEventType,
} from '../interfaces/transaction-subprocess.interface';

describe('TransactionSubProcessService', () => {
  let service: TransactionSubProcessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionSubProcessService],
    }).compile();

    service = module.get<TransactionSubProcessService>(TransactionSubProcessService);
  });

  describe('createTransactionScope', () => {
    it('should create a transaction scope', async () => {
      const config: ITransactionSubProcessConfig = {
        id: 'tx-1',
        name: 'Test Transaction',
      };

      const scope = await service.createTransactionScope(
        config,
        'process-1',
        'parent-1',
        { initialVar: 'value' }
      );

      expect(scope).toBeDefined();
      expect(scope.transactionId).toBeDefined();
      expect(scope.processInstanceId).toBe('process-1');
      expect(scope.parentExecutionId).toBe('parent-1');
      expect(scope.state).toBe(TransactionState.ACTIVE);
      expect(scope.compensationSubscriptions).toEqual([]);
      expect(scope.variables).toEqual({ initialVar: 'value' });
      expect(scope.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getTransactionScope', () => {
    it('should return null for non-existent transaction', async () => {
      const scope = await service.getTransactionScope('non-existent');
      expect(scope).toBeNull();
    });

    it('should return existing transaction scope', async () => {
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const created = await service.createTransactionScope(config, 'process-1');
      
      const scope = await service.getTransactionScope(created.transactionId);
      expect(scope).toBeDefined();
      expect(scope?.transactionId).toBe(created.transactionId);
    });
  });

  describe('updateTransactionState', () => {
    it('should update transaction state', async () => {
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const created = await service.createTransactionScope(config, 'process-1');
      
      await service.updateTransactionState(
        created.transactionId,
        TransactionState.COMPLETED
      );
      
      const scope = await service.getTransactionScope(created.transactionId);
      expect(scope?.state).toBe(TransactionState.COMPLETED);
      expect(scope?.completedAt).toBeDefined();
    });

    it('should throw error for non-existent transaction', async () => {
      await expect(
        service.updateTransactionState('non-existent', TransactionState.COMPLETED)
      ).rejects.toThrow('Transaction scope not found');
    });
  });

  describe('addCompensationSubscription', () => {
    it('should add compensation subscription', async () => {
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const created = await service.createTransactionScope(config, 'process-1');
      
      const subscription: ICompensationEventSubscription = {
        id: 'sub-1',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-1',
        createdAt: new Date(),
      };
      
      await service.addCompensationSubscription(created.transactionId, subscription);
      
      const subscriptions = await service.getCompensationSubscriptions(created.transactionId);
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].activityId).toBe('activity-1');
    });

    it('should update existing subscription for same activity', async () => {
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const created = await service.createTransactionScope(config, 'process-1');
      
      const subscription1: ICompensationEventSubscription = {
        id: 'sub-1',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-1',
        createdAt: new Date(),
      };
      
      const subscription2: ICompensationEventSubscription = {
        id: 'sub-2',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-2',
        createdAt: new Date(),
      };
      
      await service.addCompensationSubscription(created.transactionId, subscription1);
      await service.addCompensationSubscription(created.transactionId, subscription2);
      
      const subscriptions = await service.getCompensationSubscriptions(created.transactionId);
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0].id).toBe('sub-2');
    });
  });

  describe('removeCompensationSubscription', () => {
    it('should remove compensation subscription', async () => {
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const created = await service.createTransactionScope(config, 'process-1');
      
      const subscription: ICompensationEventSubscription = {
        id: 'sub-1',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-1',
        createdAt: new Date(),
      };
      
      await service.addCompensationSubscription(created.transactionId, subscription);
      await service.removeCompensationSubscription(created.transactionId, 'activity-1');
      
      const subscriptions = await service.getCompensationSubscriptions(created.transactionId);
      expect(subscriptions).toHaveLength(0);
    });
  });

  describe('clearCompensationSubscriptions', () => {
    it('should clear all compensation subscriptions', async () => {
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const created = await service.createTransactionScope(config, 'process-1');
      
      await service.addCompensationSubscription(created.transactionId, {
        id: 'sub-1',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-1',
        createdAt: new Date(),
      });
      
      await service.addCompensationSubscription(created.transactionId, {
        id: 'sub-2',
        eventType: 'compensate',
        activityId: 'activity-2',
        executionId: 'exec-2',
        createdAt: new Date(),
      });
      
      await service.clearCompensationSubscriptions(created.transactionId);
      
      const subscriptions = await service.getCompensationSubscriptions(created.transactionId);
      expect(subscriptions).toHaveLength(0);
    });
  });

  describe('convertToEventScope', () => {
    it('should convert transaction to event scope', async () => {
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const created = await service.createTransactionScope(config, 'process-1');
      
      await service.addCompensationSubscription(created.transactionId, {
        id: 'sub-1',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-1',
        createdAt: new Date(),
      });
      
      const eventScopeId = await service.convertToEventScope(created.transactionId);
      
      // Original should not exist
      const original = await service.getTransactionScope(created.transactionId);
      expect(original).toBeNull();
      
      // Event scope should exist with subscriptions preserved
      const eventScope = await service.getTransactionScope(eventScopeId);
      expect(eventScope).toBeDefined();
      expect(eventScope?.compensationSubscriptions).toHaveLength(1);
    });
  });

  describe('getActiveTransactionScopes', () => {
    it('should return only active transaction scopes', async () => {
      const config1: ITransactionSubProcessConfig = { id: 'tx-1' };
      const config2: ITransactionSubProcessConfig = { id: 'tx-2' };
      
      const scope1 = await service.createTransactionScope(config1, 'process-1');
      const scope2 = await service.createTransactionScope(config2, 'process-2');
      
      await service.updateTransactionState(scope1.transactionId, TransactionState.COMPLETED);
      
      const activeScopes = await service.getActiveTransactionScopes();
      expect(activeScopes).toHaveLength(1);
      expect(activeScopes[0].transactionId).toBe(scope2.transactionId);
    });
  });
});

describe('TransactionSubProcessExecutor', () => {
  let executor: TransactionSubProcessExecutor;
  let transactionService: TransactionSubProcessService;
  let compensationService: CompensationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionSubProcessService,
        TransactionSubProcessExecutor,
        {
          provide: CompensationService,
          useValue: {
            compensate: vi.fn(),
          },
        },
      ],
    }).compile();

    transactionService = module.get<TransactionSubProcessService>(TransactionSubProcessService);
    compensationService = module.get<CompensationService>(CompensationService);
    executor = module.get<TransactionSubProcessExecutor>(TransactionSubProcessExecutor);
  });

  describe('startTransaction', () => {
    it('should start a transaction', async () => {
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      
      const scope = await executor.startTransaction(config, 'process-1');
      
      expect(scope).toBeDefined();
      expect(scope.processInstanceId).toBe('process-1');
      expect(scope.state).toBe(TransactionState.ACTIVE);
    });
  });

  describe('completeTransaction', () => {
    it('should complete transaction successfully', async () => {
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const scope = await executor.startTransaction(config, 'process-1');
      
      const result = await executor.completeTransaction(scope.transactionId, { result: 'success' });
      
      expect(result.success).toBe(true);
      expect(result.state).toBe(TransactionState.COMPLETED);
      expect(result.variables.result).toBe('success');
    });
  });

  describe('cancelTransaction', () => {
    it('should cancel transaction and trigger compensation', async () => {
      const mockCompensate = vi.fn();
      
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const scope = await executor.startTransaction(config, 'process-1');
      
      // Add compensation subscription with mock handler
      await executor.registerCompensationSubscription(scope.transactionId, {
        id: 'sub-1',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-1',
        createdAt: new Date(),
        handler: {
          compensate: mockCompensate,
        },
      });
      
      const result = await executor.cancelTransaction({
        eventType: CancelEventType.END_EVENT,
        transactionId: scope.transactionId,
        triggerCompensation: true,
      });
      
      expect(result.success).toBe(false);
      expect(result.state).toBe(TransactionState.CANCELLED);
      expect(result.executedCompensations).toContain('activity-1');
      expect(mockCompensate).toHaveBeenCalled();
    });

    it('should cancel transaction without compensation when disabled', async () => {
      const mockCompensate = vi.fn();
      
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const scope = await executor.startTransaction(config, 'process-1');
      
      await executor.registerCompensationSubscription(scope.transactionId, {
        id: 'sub-1',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-1',
        createdAt: new Date(),
        handler: {
          compensate: mockCompensate,
        },
      });
      
      const result = await executor.cancelTransaction({
        eventType: CancelEventType.BOUNDARY_EVENT,
        transactionId: scope.transactionId,
        triggerCompensation: false,
      });
      
      expect(result.success).toBe(false);
      expect(result.executedCompensations).toHaveLength(0);
      expect(mockCompensate).not.toHaveBeenCalled();
    });
  });

  describe('triggerCompensation', () => {
    it('should trigger compensation for specific activities', async () => {
      const mockCompensate1 = vi.fn();
      const mockCompensate2 = vi.fn();
      
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const scope = await executor.startTransaction(config, 'process-1');
      
      await executor.registerCompensationSubscription(scope.transactionId, {
        id: 'sub-1',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-1',
        createdAt: new Date(),
        handler: { compensate: mockCompensate1 },
      });
      
      await executor.registerCompensationSubscription(scope.transactionId, {
        id: 'sub-2',
        eventType: 'compensate',
        activityId: 'activity-2',
        executionId: 'exec-2',
        createdAt: new Date(),
        handler: { compensate: mockCompensate2 },
      });
      
      const executed = await executor.triggerCompensation(scope.transactionId, ['activity-1']);
      
      expect(executed).toContain('activity-1');
      expect(executed).not.toContain('activity-2');
      expect(mockCompensate1).toHaveBeenCalled();
      expect(mockCompensate2).not.toHaveBeenCalled();
    });

    it('should trigger compensation in reverse order', async () => {
      const order: string[] = [];
      
      const config: ITransactionSubProcessConfig = { id: 'tx-1' };
      const scope = await executor.startTransaction(config, 'process-1');
      
      await executor.registerCompensationSubscription(scope.transactionId, {
        id: 'sub-1',
        eventType: 'compensate',
        activityId: 'activity-1',
        executionId: 'exec-1',
        createdAt: new Date(),
        handler: { compensate: async () => { order.push('activity-1'); } },
      });
      
      await executor.registerCompensationSubscription(scope.transactionId, {
        id: 'sub-2',
        eventType: 'compensate',
        activityId: 'activity-2',
        executionId: 'exec-2',
        createdAt: new Date(),
        handler: { compensate: async () => { order.push('activity-2'); } },
      });
      
      await executor.triggerCompensation(scope.transactionId);
      
      // Should be in reverse order
      expect(order).toEqual(['activity-2', 'activity-1']);
    });
  });
});
