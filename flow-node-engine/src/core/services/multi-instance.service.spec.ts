import { MultiInstanceService } from './multi-instance.service';
import {
  MultiInstanceType,
  MultiInstanceState,
  InstanceExecutionState,
  MultiInstanceConfig,
  MULTI_INSTANCE_BUILTIN_VARIABLES,
} from '../interfaces/multi-instance.interface';

describe('MultiInstanceService', () => {
  let service: MultiInstanceService;

  beforeEach(() => {
    // 直接实例化服务，避免NestJS依赖注入问题
    service = new MultiInstanceService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialize', () => {
    it('should initialize with collection variable', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = {
        items: ['a', 'b', 'c'],
      };

      const state = await service.initialize('process-1', 'activity-1', config, variables);

      expect(state).toBeDefined();
      expect(state.totalInstances).toBe(3);
      expect(state.instances.length).toBe(3);
      expect(state.state).toBe(MultiInstanceState.PENDING);
    });

    it('should initialize with cardinality', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.PARALLEL,
        collection: 'items',
        elementVariable: 'item',
        cardinality: 5,
      };
      const variables = {};

      const state = await service.initialize('process-1', 'activity-1', config, variables);

      expect(state.totalInstances).toBe(5);
      expect(state.instances.length).toBe(5);
    });

    it('should handle empty collection', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [] };

      const state = await service.initialize('process-1', 'activity-1', config, variables);

      expect(state.totalInstances).toBe(0);
      expect(state.instances.length).toBe(0);
    });

    it('should set correct element values', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };

      const state = await service.initialize('process-1', 'activity-1', config, variables);

      expect(state.instances[0].currentElement).toBe(1);
      expect(state.instances[1].currentElement).toBe(2);
      expect(state.instances[2].currentElement).toBe(3);
    });

    it('should set correct indices', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: ['a', 'b', 'c'] };

      const state = await service.initialize('process-1', 'activity-1', config, variables);

      expect(state.instances[0].index).toBe(0);
      expect(state.instances[1].index).toBe(1);
      expect(state.instances[2].index).toBe(2);
    });
  });

  describe('getNextInstance', () => {
    it('should return next pending instance', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      const next = service.getNextInstance(state);

      expect(next).toBeDefined();
      expect(next!.index).toBe(0);
    });

    it('should return null when no pending instances', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      const next = service.getNextInstance(state);

      expect(next).toBeNull();
    });
  });

  describe('getPendingInstances', () => {
    it('should return all pending instances', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.PARALLEL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      const pending = service.getPendingInstances(state);

      expect(pending.length).toBe(3);
    });
  });

  describe('startInstance', () => {
    it('should mark instance as running', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);

      expect(state.instances[0].state).toBe(InstanceExecutionState.RUNNING);
      expect(state.activeInstances).toBe(1);
      expect(state.state).toBe(MultiInstanceState.IN_PROGRESS);
    });

    it('should throw error for non-existent instance', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await expect(service.startInstance(state, 'non-existent')).rejects.toThrow();
    });
  });

  describe('completeInstance', () => {
    it('should mark instance as completed', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      const result = await service.completeInstance(state, state.instances[0].instanceId, 'output1');

      expect(state.instances[0].state).toBe(InstanceExecutionState.COMPLETED);
      expect(state.instances[0].output).toBe('output1');
      expect(state.completedInstances).toBe(1);
      expect(state.activeInstances).toBe(0);
      expect(state.outputCollection).toContain('output1');
    });

    it('should return success when all instances complete', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      const result = await service.completeInstance(state, state.instances[0].instanceId);

      expect(result.success).toBe(true);
      expect(result.completedCount).toBe(1);
      expect(result.totalCount).toBe(1);
    });
  });

  describe('failInstance', () => {
    it('should mark instance as failed', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      const result = await service.failInstance(state, state.instances[0].instanceId, 'Test error');

      expect(state.instances[0].state).toBe(InstanceExecutionState.FAILED);
      expect(state.instances[0].error).toBe('Test error');
      expect(state.failedInstances).toBe(1);
    });
  });

  describe('evaluateCompletionCondition', () => {
    it('should evaluate completion condition', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.PARALLEL,
        collection: 'items',
        elementVariable: 'item',
        completionCondition: '${nrOfCompletedInstances >= 2}',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      // Complete 2 instances
      await service.startInstance(state, state.instances[0].instanceId);
      await service.completeInstance(state, state.instances[0].instanceId);
      await service.startInstance(state, state.instances[1].instanceId);
      await service.completeInstance(state, state.instances[1].instanceId);

      const result = await service.evaluateCompletionCondition(state, variables);

      expect(result.isComplete).toBe(true);
    });

    it('should return false when condition not met', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.PARALLEL,
        collection: 'items',
        elementVariable: 'item',
        completionCondition: '${nrOfCompletedInstances >= 5}',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      await service.completeInstance(state, state.instances[0].instanceId);

      const result = await service.evaluateCompletionCondition(state, variables);

      expect(result.isComplete).toBe(false);
    });

    it('should return false when no condition defined', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      const result = await service.evaluateCompletionCondition(state, variables);

      expect(result.isComplete).toBe(false);
    });
  });

  describe('isAllCompleted', () => {
    it('should return true when all completed', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      await service.completeInstance(state, state.instances[0].instanceId);

      expect(service.isAllCompleted(state)).toBe(true);
    });

    it('should return false when not all completed', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      await service.completeInstance(state, state.instances[0].instanceId);

      expect(service.isAllCompleted(state)).toBe(false);
    });
  });

  describe('getOutputCollection', () => {
    it('should return output collection', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      await service.completeInstance(state, state.instances[0].instanceId, 'out1');
      await service.startInstance(state, state.instances[1].instanceId);
      await service.completeInstance(state, state.instances[1].instanceId, 'out2');

      const outputs = service.getOutputCollection(state);

      expect(outputs).toEqual(['out1', 'out2']);
    });
  });

  describe('getInstanceVariables', () => {
    it('should return instance variables', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: ['a', 'b', 'c'] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      const instanceVars = service.getInstanceVariables(state, state.instances[1]);

      expect(instanceVars.item).toBe('b');
      expect(instanceVars[MULTI_INSTANCE_BUILTIN_VARIABLES.LOOP_COUNTER]).toBe(1);
      expect(instanceVars[MULTI_INSTANCE_BUILTIN_VARIABLES.NR_OF_INSTANCES]).toBe(3);
    });
  });

  describe('cancel', () => {
    it('should cancel all instances', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.PARALLEL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      await service.cancel(state);

      expect(state.state).toBe(MultiInstanceState.CANCELLED);
      expect(state.activeInstances).toBe(0);
      expect(state.instances[0].state).toBe(InstanceExecutionState.SKIPPED);
      expect(state.instances[1].state).toBe(InstanceExecutionState.SKIPPED);
    });
  });

  describe('getState', () => {
    it('should return state by id', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      const retrieved = service.getState(state.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(state.id);
    });

    it('should return undefined for non-existent id', () => {
      const retrieved = service.getState('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should clean up state', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      service.cleanup(state.id);

      expect(service.getState(state.id)).toBeUndefined();
    });
  });

  describe('getStatistics', () => {
    it('should return statistics', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.SEQUENTIAL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      await service.startInstance(state, state.instances[0].instanceId);
      await service.completeInstance(state, state.instances[0].instanceId);

      const stats = service.getStatistics();

      expect(stats.totalExecutions).toBe(1);
      expect(stats.successCount).toBe(1);
    });
  });

  describe('canStartMoreInstances', () => {
    it('should return true when no limit', async () => {
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.PARALLEL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3] };
      const state = await service.initialize('process-1', 'activity-1', config, variables);

      expect(service.canStartMoreInstances(state)).toBe(true);
    });

    it('should respect max parallel instances limit', async () => {
      const serviceWithLimit = new MultiInstanceService({ maxParallelInstances: 2 });
      const config: MultiInstanceConfig = {
        id: 'mi-1',
        type: MultiInstanceType.PARALLEL,
        collection: 'items',
        elementVariable: 'item',
      };
      const variables = { items: [1, 2, 3, 4, 5] };
      const state = await serviceWithLimit.initialize('process-1', 'activity-1', config, variables);

      await serviceWithLimit.startInstance(state, state.instances[0].instanceId);
      await serviceWithLimit.startInstance(state, state.instances[1].instanceId);

      expect(serviceWithLimit.canStartMoreInstances(state)).toBe(false);
    });
  });
});
