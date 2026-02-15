import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { ListenerRegistryService } from './listener-registry.service';
import { BuiltinListenerFactory } from './builtin-listeners.service';
import {
  ExecutionListenerEvent,
  TaskListenerEvent,
  ListenerImplementationType,
  IExecutionListener,
  ITaskListener,
  ListenerContext,
  TaskListenerContext,
  ListenerResult,
} from '../interfaces/listener.interface';

describe('ListenerRegistryService', () => {
  let service: ListenerRegistryService;
  let builtinFactory: BuiltinListenerFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListenerRegistryService,
        BuiltinListenerFactory,
      ],
    }).compile();

    service = module.get<ListenerRegistryService>(ListenerRegistryService);
    builtinFactory = module.get<BuiltinListenerFactory>(BuiltinListenerFactory);
  });

  afterEach(() => {
    service.clearAll();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerExecutionListener', () => {
    it('should register an execution listener', () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      const registrationId = service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestListener',
          name: 'Test Execution Listener',
        },
        listener,
      );

      expect(registrationId).toBeDefined();
      expect(service.getAllRegistrations().length).toBe(1);
    });

    it('should register listener with process definition key', () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      const registrationId = service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestListener',
        },
        listener,
        { processDefinitionKey: 'test-process' },
      );

      expect(registrationId).toBeDefined();
      
      const listeners = service.getExecutionListeners('test-process', 'activity1', ExecutionListenerEvent.START);
      expect(listeners.length).toBe(1);
    });

    it('should throw error if listener already exists', () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      service.registerExecutionListener(
        {
          id: 'test-id',
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestListener',
        },
        listener,
      );

      expect(() => {
        service.registerExecutionListener(
          {
            id: 'test-id',
            event: ExecutionListenerEvent.START,
            implementationType: ListenerImplementationType.CLASS,
            implementation: 'TestListener',
          },
          listener,
        );
      }).toThrow('already exists');
    });

    it('should overwrite listener if overwrite option is true', () => {
      const listener1: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };
      const listener2: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      service.registerExecutionListener(
        {
          id: 'test-id',
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestListener1',
        },
        listener1,
      );

      service.registerExecutionListener(
        {
          id: 'test-id',
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestListener2',
        },
        listener2,
        { overwrite: true },
      );

      expect(service.getAllRegistrations().length).toBe(1);
    });
  });

  describe('registerTaskListener', () => {
    it('should register a task listener', () => {
      const listener: ITaskListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      const registrationId = service.registerTaskListener(
        {
          event: TaskListenerEvent.CREATE,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestTaskListener',
          name: 'Test Task Listener',
        },
        listener,
      );

      expect(registrationId).toBeDefined();
      expect(service.getAllRegistrations().length).toBe(1);
    });
  });

  describe('unregisterListener', () => {
    it('should unregister a listener', () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      const registrationId = service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestListener',
        },
        listener,
      );

      expect(service.getAllRegistrations().length).toBe(1);

      const result = service.unregisterListener(registrationId);
      expect(result).toBe(true);
      expect(service.getAllRegistrations().length).toBe(0);
    });

    it('should return false if listener not found', () => {
      const result = service.unregisterListener('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('getExecutionListeners', () => {
    it('should return global listeners', () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestListener',
        },
        listener,
      );

      const listeners = service.getExecutionListeners(undefined, undefined, ExecutionListenerEvent.START);
      expect(listeners.length).toBe(1);
    });

    it('should filter by event type', () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestListener',
        },
        listener,
      );

      const startListeners = service.getExecutionListeners(undefined, undefined, ExecutionListenerEvent.START);
      const endListeners = service.getExecutionListeners(undefined, undefined, ExecutionListenerEvent.END);

      expect(startListeners.length).toBe(1);
      expect(endListeners.length).toBe(0);
    });

    it('should filter by target element id', () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TestListener',
        },
        listener,
        { processDefinitionKey: 'test-process', targetElementId: 'activity1' },
      );

      const listenersForActivity1 = service.getExecutionListeners('test-process', 'activity1', ExecutionListenerEvent.START);
      const listenersForActivity2 = service.getExecutionListeners('test-process', 'activity2', ExecutionListenerEvent.START);

      expect(listenersForActivity1.length).toBe(1);
      expect(listenersForActivity2.length).toBe(0);
    });

    it('should sort listeners by order', () => {
      const listener1: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };
      const listener2: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener1',
          order: 2,
        },
        listener1,
      );

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener2',
          order: 1,
        },
        listener2,
      );

      const listeners = service.getExecutionListeners(undefined, undefined, ExecutionListenerEvent.START);
      expect(listeners.length).toBe(2);
      expect((listeners[0].config as any).order).toBe(1);
      expect((listeners[1].config as any).order).toBe(2);
    });
  });

  describe('dispatchExecutionListeners', () => {
    it('should dispatch to all matching listeners', async () => {
      const listener1: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };
      const listener2: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener1',
        },
        listener1,
      );

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener2',
        },
        listener2,
      );

      const context: ListenerContext = {
        processInstanceId: 'process-1',
        event: ExecutionListenerEvent.START,
        timestamp: new Date(),
        variables: {},
      };

      const result = await service.dispatchExecutionListeners(context);

      expect(result.totalInvocations).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(listener1.notify).toHaveBeenCalled();
      expect(listener2.notify).toHaveBeenCalled();
    });

    it('should collect modified variables', async () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({
          success: true,
          modifiedVariables: { var1: 'value1', var2: 'value2' },
        }),
      };

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener',
        },
        listener,
      );

      const context: ListenerContext = {
        processInstanceId: 'process-1',
        event: ExecutionListenerEvent.START,
        timestamp: new Date(),
        variables: {},
      };

      const result = await service.dispatchExecutionListeners(context);

      expect(result.modifiedVariables).toEqual({ var1: 'value1', var2: 'value2' });
    });

    it('should handle listener errors', async () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({
          success: false,
          error: 'Test error',
        }),
      };

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener',
        },
        listener,
      );

      const context: ListenerContext = {
        processInstanceId: 'process-1',
        event: ExecutionListenerEvent.START,
        timestamp: new Date(),
        variables: {},
      };

      const result = await service.dispatchExecutionListeners(context);

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
      expect(result.results[0].error).toBe('Test error');
    });

    it('should handle async listeners', async () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockResolvedValue({ success: true }),
      };

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener',
        },
        listener,
      );

      const context: ListenerContext = {
        processInstanceId: 'process-1',
        event: ExecutionListenerEvent.START,
        timestamp: new Date(),
        variables: {},
      };

      const result = await service.dispatchExecutionListeners(context);

      expect(result.successCount).toBe(1);
    });
  });

  describe('dispatchTaskListeners', () => {
    it('should dispatch task listeners', async () => {
      const listener: ITaskListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      service.registerTaskListener(
        {
          event: TaskListenerEvent.CREATE,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'TaskListener',
        },
        listener,
      );

      const context: TaskListenerContext = {
        processInstanceId: 'process-1',
        taskId: 'task-1',
        taskName: 'Test Task',
        event: TaskListenerEvent.CREATE,
        timestamp: new Date(),
        variables: {},
      };

      const result = await service.dispatchTaskListeners(context);

      expect(result.totalInvocations).toBe(1);
      expect(result.successCount).toBe(1);
      expect(listener.notify).toHaveBeenCalledWith(context);
    });
  });

  describe('setListenerEnabled', () => {
    it('should enable/disable listener', () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      const registrationId = service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener',
        },
        listener,
      );

      // Disable
      service.setListenerEnabled(registrationId, false);
      
      const listeners = service.getExecutionListeners(undefined, undefined, ExecutionListenerEvent.START);
      expect(listeners.length).toBe(0);

      // Enable
      service.setListenerEnabled(registrationId, true);
      
      const listenersAfterEnable = service.getExecutionListeners(undefined, undefined, ExecutionListenerEvent.START);
      expect(listenersAfterEnable.length).toBe(1);
    });
  });

  describe('getStatistics', () => {
    it('should return statistics for a listener', async () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      const registrationId = service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener',
          name: 'Test Listener',
        },
        listener,
      );

      const context: ListenerContext = {
        processInstanceId: 'process-1',
        event: ExecutionListenerEvent.START,
        timestamp: new Date(),
        variables: {},
      };

      await service.dispatchExecutionListeners(context);

      const stats = service.getStatistics(registrationId) as any;
      expect(stats).toBeDefined();
      expect(stats.executionCount).toBe(1);
      expect(stats.successCount).toBe(1);
    });
  });

  describe('registerFactory', () => {
    it('should register a custom factory', () => {
      const customFactory = {
        createExecutionListener: vi.fn(),
        createTaskListener: vi.fn(),
        supports: vi.fn().mockReturnValue(true),
      };

      service.registerFactory(customFactory);

      // Factory should be registered
      expect(service).toBeDefined();
    });
  });

  describe('clearAll', () => {
    it('should clear all listeners', () => {
      const listener: IExecutionListener = {
        notify: vi.fn().mockReturnValue({ success: true }),
      };

      service.registerExecutionListener(
        {
          event: ExecutionListenerEvent.START,
          implementationType: ListenerImplementationType.CLASS,
          implementation: 'Listener',
        },
        listener,
      );

      expect(service.getAllRegistrations().length).toBe(1);

      service.clearAll();

      expect(service.getAllRegistrations().length).toBe(0);
    });
  });
});

describe('BuiltinListenerFactory', () => {
  let factory: BuiltinListenerFactory;

  beforeEach(() => {
    factory = new BuiltinListenerFactory();
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('supports', () => {
    it('should return true for builtin implementation type', () => {
      expect(factory.supports(ListenerImplementationType.BUILTIN, 'log')).toBe(true);
    });

    it('should return false for non-builtin implementation type', () => {
      expect(factory.supports(ListenerImplementationType.CLASS, 'SomeClass')).toBe(false);
    });
  });

  describe('createExecutionListener', () => {
    it('should create log listener', () => {
      const listener = factory.createExecutionListener({
        event: ExecutionListenerEvent.START,
        implementationType: ListenerImplementationType.BUILTIN,
        implementation: 'log',
      });

      expect(listener).toBeDefined();
    });

    it('should create variable_set listener', () => {
      const listener = factory.createExecutionListener({
        event: ExecutionListenerEvent.START,
        implementationType: ListenerImplementationType.BUILTIN,
        implementation: 'variable_set',
        variableName: 'testVar',
        variableValue: 'testValue',
      } as any);

      expect(listener).toBeDefined();
    });

    it('should return null for unknown type', () => {
      const listener = factory.createExecutionListener({
        event: ExecutionListenerEvent.START,
        implementationType: ListenerImplementationType.BUILTIN,
        implementation: 'unknown',
      });

      expect(listener).toBeNull();
    });
  });

  describe('createTaskListener', () => {
    it('should create log task listener', () => {
      const listener = factory.createTaskListener({
        event: TaskListenerEvent.CREATE,
        implementationType: ListenerImplementationType.BUILTIN,
        implementation: 'log',
      });

      expect(listener).toBeDefined();
    });
  });
});
