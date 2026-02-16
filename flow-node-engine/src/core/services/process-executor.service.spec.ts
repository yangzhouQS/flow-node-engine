import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BpmnProcessDefinition, BpmnElement } from './bpmn-parser.service';
import { EventBusService } from './event-bus.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { GatewayExecutorService } from './gateway-executor.service';
import {
  ProcessExecutorService,
  ExecutionContext,
  ExecutionHistory,
} from './process-executor.service';

describe('ProcessExecutorService', () => {
  let service: ProcessExecutorService;
  let eventBusService: EventBusService;
  let gatewayExecutor: GatewayExecutorService;

  const mockEventBusService = {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };

  const mockExpressionEvaluator = {
    evaluateCondition: vi.fn(),
    evaluate: vi.fn(),
  };

  const mockGatewayExecutor = {
    execute: vi.fn(),
    validateGateway: vi.fn(),
  };

  // 创建模拟流程定义
  const createProcessDefinition = (): BpmnProcessDefinition => ({
    id: 'testProcess',
    name: '测试流程',
    isExecutable: true,
    startEvents: [
      { id: 'start', name: '开始', type: 'bpmn:StartEvent' } as BpmnElement,
    ],
    userTasks: [
      { id: 'task1', name: '用户任务1', type: 'bpmn:UserTask' } as BpmnElement,
    ],
    serviceTasks: [
      {
        id: 'service1',
        name: '服务任务1',
        type: 'bpmn:ServiceTask',
      } as BpmnElement,
    ],
    gateways: [],
    endEvents: [
      { id: 'end', name: '结束', type: 'bpmn:EndEvent' } as BpmnElement,
    ],
    sequenceFlows: [
      { id: 'flow1', sourceRef: 'start', targetRef: 'task1' },
      { id: 'flow2', sourceRef: 'task1', targetRef: 'service1' },
      { id: 'flow3', sourceRef: 'service1', targetRef: 'end' },
    ],
    subProcesses: [],
    // elements: [],
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessExecutorService,
        {
          provide: EventBusService,
          useValue: mockEventBusService,
        },
        {
          provide: ExpressionEvaluatorService,
          useValue: mockExpressionEvaluator,
        },
        {
          provide: GatewayExecutorService,
          useValue: mockGatewayExecutor,
        },
      ],
    }).compile();

    service = module.get<ProcessExecutorService>(ProcessExecutorService);
    eventBusService = module.get<EventBusService>(EventBusService);
    gatewayExecutor = module.get<GatewayExecutorService>(GatewayExecutorService);
  });

  describe('start', () => {
    it('应该成功启动流程实例', async () => {
      const processDefinition = createProcessDefinition();
      const businessKey = 'test-business-key';
      const variables = { initiator: 'user1' };

      const context = await service.start(processDefinition, businessKey, variables);

      expect(context).toBeDefined();
      expect(context.processInstanceId).toMatch(/^pi-/);
      expect(context.variables.businessKey).toBe(businessKey);
      expect(context.variables.initiator).toBe('user1');
      expect(context.history.length).toBeGreaterThan(0);
    });

    it('应该发出流程启动事件', async () => {
      const processDefinition = createProcessDefinition();
      const businessKey = 'test-key';

      await service.start(processDefinition, businessKey);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'process.start',
        expect.objectContaining({
          businessKey,
          processDefinition,
        }),
      );
    });

    it('应该发出流程已启动事件', async () => {
      const processDefinition = createProcessDefinition();
      const businessKey = 'test-key';

      await service.start(processDefinition, businessKey);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'process.started',
        expect.objectContaining({
          context: expect.any(Object),
        }),
      );
    });

    it('应该抛出错误当没有开始事件时', async () => {
      const processDefinition = createProcessDefinition();
      processDefinition.startEvents = [];

      await expect(
        service.start(processDefinition, 'test-key'),
      ).rejects.toThrow('No start event found in process definition');
    });

    it('应该正确合并初始变量和业务键', async () => {
      const processDefinition = createProcessDefinition();
      const businessKey = 'order-123';
      const variables = { amount: 100, customer: 'ABC' };

      const context = await service.start(processDefinition, businessKey, variables);

      expect(context.variables.businessKey).toBe(businessKey);
      expect(context.variables.amount).toBe(100);
      expect(context.variables.customer).toBe('ABC');
    });

    it('应该执行开始事件并添加到历史记录', async () => {
      const processDefinition = createProcessDefinition();

      const context = await service.start(processDefinition, 'test-key');

      const startEventHistory = context.history.find(
        (h) => h.elementId === 'start',
      );
      expect(startEventHistory).toBeDefined();
      expect(startEventHistory?.elementType).toBe('bpmn:StartEvent');
      expect(startEventHistory?.status).toBe('COMPLETED');
    });
  });

  describe('continue', () => {
    it('应该继续执行流程实例', async () => {
      const processDefinition = createProcessDefinition();
      const businessKey = 'test-key';

      // 先启动流程
      const startContext = await service.start(processDefinition, businessKey);
      const processInstanceId = startContext.processInstanceId;

      // 继续执行
      const context = await service.continue(processInstanceId, 'task1', {
        approved: true,
      });

      expect(context).toBeDefined();
      expect(context.variables.approved).toBe(true);
    });

    it('应该发出继续执行事件', async () => {
      const processDefinition = createProcessDefinition();
      const startContext = await service.start(processDefinition, 'test-key');

      await service.continue(startContext.processInstanceId, 'task1');

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'process.continue',
        expect.objectContaining({
          taskId: 'task1',
        }),
      );
    });

    it('应该抛出错误当流程实例不存在时', async () => {
      await expect(
        service.continue('non-existent-id', 'task1'),
      ).rejects.toThrow('Process instance not found');
    });

    it('应该更新变量', async () => {
      const processDefinition = createProcessDefinition();
      const startContext = await service.start(processDefinition, 'test-key');
      const newVariables = { status: 'updated', count: 5 };

      const context = await service.continue(
        startContext.processInstanceId,
        undefined,
        newVariables,
      );

      expect(context.variables.status).toBe('updated');
      expect(context.variables.count).toBe(5);
    });
  });

  describe('suspend', () => {
    it('应该成功挂起流程实例并发出事件', async () => {
      const processDefinition = createProcessDefinition();
      // 使用用户任务让流程暂停在任务节点
      processDefinition.sequenceFlows = [
        { id: 'flow1', sourceRef: 'start', targetRef: 'task1' },
      ];
      const startContext = await service.start(processDefinition, 'test-key');

      await service.suspend(startContext.processInstanceId);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'process.suspend',
        expect.objectContaining({
          processInstanceId: startContext.processInstanceId,
        }),
      );
    });

    it('应该发出挂起事件', async () => {
      const processDefinition = createProcessDefinition();
      const startContext = await service.start(processDefinition, 'test-key');

      await service.suspend(startContext.processInstanceId);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'process.suspend',
        expect.objectContaining({
          processInstanceId: startContext.processInstanceId,
        }),
      );
    });

    it('应该发出已挂起事件', async () => {
      const processDefinition = createProcessDefinition();
      const startContext = await service.start(processDefinition, 'test-key');

      await service.suspend(startContext.processInstanceId);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'process.suspended',
        expect.objectContaining({
          processInstanceId: startContext.processInstanceId,
        }),
      );
    });

    it('应该抛出错误当流程实例不存在时', async () => {
      await expect(service.suspend('non-existent-id')).rejects.toThrow(
        'Process instance not found',
      );
    });
  });

  describe('resume', () => {
    it('应该抛出错误当没有挂起的元素时', async () => {
      const processDefinition = createProcessDefinition();
      const startContext = await service.start(processDefinition, 'test-key');

      // 不挂起直接恢复
      await expect(service.resume(startContext.processInstanceId)).rejects.toThrow(
        'No suspended element found',
      );
    });

    it('应该抛出错误当流程实例不存在时', async () => {
      await expect(service.resume('non-existent-id')).rejects.toThrow(
        'Process instance not found',
      );
    });
  });

  describe('terminate', () => {
    it('应该成功终止流程实例', async () => {
      const processDefinition = createProcessDefinition();
      const startContext = await service.start(processDefinition, 'test-key');

      await service.terminate(startContext.processInstanceId, '测试终止');

      const context = service.getExecutionContext(startContext.processInstanceId);
      expect(context).toBeUndefined();
    });

    it('应该发出终止事件', async () => {
      const processDefinition = createProcessDefinition();
      const startContext = await service.start(processDefinition, 'test-key');

      await service.terminate(startContext.processInstanceId, '测试终止');

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'process.terminate',
        expect.objectContaining({
          reason: '测试终止',
        }),
      );
    });

    it('应该发出已终止事件', async () => {
      const processDefinition = createProcessDefinition();
      const startContext = await service.start(processDefinition, 'test-key');

      await service.terminate(startContext.processInstanceId);

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'process.terminated',
        expect.objectContaining({
          processInstanceId: startContext.processInstanceId,
        }),
      );
    });

    it('应该抛出错误当流程实例不存在时', async () => {
      await expect(
        service.terminate('non-existent-id', 'reason'),
      ).rejects.toThrow('Process instance not found');
    });
  });

  describe('getExecutionContext', () => {
    it('应该返回存在的执行上下文', async () => {
      const processDefinition = createProcessDefinition();
      const startContext = await service.start(processDefinition, 'test-key');

      const context = service.getExecutionContext(startContext.processInstanceId);

      expect(context).toBeDefined();
      expect(context?.processInstanceId).toBe(startContext.processInstanceId);
    });

    it('应该返回undefined当流程实例不存在时', () => {
      const context = service.getExecutionContext('non-existent-id');
      expect(context).toBeUndefined();
    });
  });

  describe('网关执行', () => {
    it('应该使用网关执行器处理网关元素', async () => {
      const processDefinition = createProcessDefinition();
      processDefinition.gateways = [
        {
          id: 'gateway1',
          name: '排他网关',
          type: 'bpmn:ExclusiveGateway',
        } as BpmnElement,
      ];
      processDefinition.sequenceFlows = [
        { id: 'flow1', sourceRef: 'start', targetRef: 'gateway1' },
        { id: 'flow2', sourceRef: 'gateway1', targetRef: 'task1' },
      ];

      mockGatewayExecutor.execute.mockResolvedValue({
        nextElementIds: ['task1'],
        needsWait: false,
        isFork: false,
      });

      await service.start(processDefinition, 'test-key');

      expect(mockGatewayExecutor.execute).toHaveBeenCalled();
    });
  });

  describe('用户任务执行', () => {
    it('应该发出任务创建事件', async () => {
      const processDefinition = createProcessDefinition();
      processDefinition.sequenceFlows = [
        { id: 'flow1', sourceRef: 'start', targetRef: 'task1' },
      ];

      await service.start(processDefinition, 'test-key');

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'task.created',
        expect.objectContaining({
          taskId: 'task1',
          taskName: '用户任务1',
        }),
      );
    });
  });

  describe('服务任务执行', () => {
    it('应该执行服务任务并继续流程', async () => {
      const processDefinition = createProcessDefinition();
      processDefinition.sequenceFlows = [
        { id: 'flow1', sourceRef: 'start', targetRef: 'service1' },
        { id: 'flow2', sourceRef: 'service1', targetRef: 'end' },
      ];

      const context = await service.start(processDefinition, 'test-key');

      const serviceTaskHistory = context.history.find(
        (h) => h.elementId === 'service1',
      );
      expect(serviceTaskHistory).toBeDefined();
      expect(serviceTaskHistory?.status).toBe('COMPLETED');
    });
  });

  describe('结束事件执行', () => {
    it('应该发出流程结束事件', async () => {
      const processDefinition = createProcessDefinition();
      processDefinition.sequenceFlows = [
        { id: 'flow1', sourceRef: 'start', targetRef: 'end' },
      ];

      await service.start(processDefinition, 'test-key');

      expect(mockEventBusService.emit).toHaveBeenCalledWith(
        'process.end',
        expect.objectContaining({
          processInstanceId: expect.any(String),
        }),
      );
    });
  });

  describe('执行历史记录', () => {
    it('应该正确记录执行历史', async () => {
      const processDefinition = createProcessDefinition();
      processDefinition.sequenceFlows = [
        { id: 'flow1', sourceRef: 'start', targetRef: 'service1' },
        { id: 'flow2', sourceRef: 'service1', targetRef: 'end' },
      ];

      const context = await service.start(processDefinition, 'test-key');

      // 验证历史记录
      expect(context.history.length).toBeGreaterThan(0);

      // 验证开始事件历史
      const startHistory = context.history.find((h) => h.elementId === 'start');
      expect(startHistory?.elementType).toBe('bpmn:StartEvent');
      expect(startHistory?.status).toBe('COMPLETED');
      expect(startHistory?.startTime).toBeDefined();
      expect(startHistory?.endTime).toBeDefined();
    });
  });

  describe('流程实例ID生成', () => {
    it('应该生成唯一的流程实例ID', async () => {
      const processDefinition = createProcessDefinition();

      const context1 = await service.start(processDefinition, 'key1');
      const context2 = await service.start(processDefinition, 'key2');

      expect(context1.processInstanceId).not.toBe(context2.processInstanceId);
    });

    it('应该生成正确格式的流程实例ID', async () => {
      const processDefinition = createProcessDefinition();

      const context = await service.start(processDefinition, 'test-key');

      expect(context.processInstanceId).toMatch(/^pi-\d+-[a-z0-9]+$/);
    });
  });
});
