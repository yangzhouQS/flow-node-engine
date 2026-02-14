import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { 
  EventSubProcessExecutorService, 
  EventSubProcessExecutionContext,
  EventTriggerInfo,
  EventType,
  EventSubscriptionInfo,
} from './event-sub-process-executor.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { VariableScopeService, VariableScope } from './variable-scope.service';
import { EventSubscriptionService, EventSubscriptionType, EventSubscriptionConfigType } from '../../event-subscription';
import { BpmnElement } from './bpmn-parser.service';

describe('EventSubProcessExecutorService', () => {
  let service: EventSubProcessExecutorService;
  let expressionEvaluator: ExpressionEvaluatorService;
  let variableScopeService: VariableScopeService;
  let eventSubscriptionService: EventSubscriptionService;

  const mockExpressionEvaluator = {
    evaluate: vi.fn(),
    evaluateCondition: vi.fn(),
  };

  const mockVariableScopeService = {
    createScope: vi.fn(),
    getVariables: vi.fn(),
    setVariables: vi.fn(),
    setVariable: vi.fn(),
    destroyScope: vi.fn(),
  };

  const mockEventSubscriptionService = {
    createSubscription: vi.fn(),
    deleteSubscriptionsByProcessInstance: vi.fn(),
    findSubscriptionsByProcessInstance: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSubProcessExecutorService,
        { provide: ExpressionEvaluatorService, useValue: mockExpressionEvaluator },
        { provide: VariableScopeService, useValue: mockVariableScopeService },
        { provide: EventSubscriptionService, useValue: mockEventSubscriptionService },
      ],
    }).compile();

    service = module.get<EventSubProcessExecutorService>(EventSubProcessExecutorService);
    expressionEvaluator = module.get<ExpressionEvaluatorService>(ExpressionEvaluatorService);
    variableScopeService = module.get<VariableScopeService>(VariableScopeService);
    eventSubscriptionService = module.get<EventSubscriptionService>(EventSubscriptionService);
  });

  describe('registerEventSubProcess', () => {
    const createEventSubProcessElement = (options: {
      id: string;
      children?: BpmnElement[];
      triggeredByEvent?: boolean;
    }): BpmnElement => ({
      id: options.id,
      name: options.id,
      type: 'bpmn:SubProcess',
      triggeredByEvent: options.triggeredByEvent ?? true,
      children: options.children || [],
    });

    const createSignalStartEvent = (id: string, signalRef: string, isInterrupting?: boolean): BpmnElement => ({
      id,
      type: 'bpmn:StartEvent',
      signalRef,
      isInterrupting,
    });

    const createContext = (element: BpmnElement): EventSubProcessExecutionContext => ({
      processInstanceId: 'process-1',
      executionId: 'exec-1',
      eventSubProcessElement: element,
      variables: { var1: 'value1' },
      tenantId: 'tenant-1',
    });

    it('应该成功注册事件子流程', async () => {
      const startEvent = createSignalStartEvent('start-1', 'signal-1');
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const context = createContext(element);

      mockEventSubscriptionService.createSubscription.mockResolvedValueOnce({ id: 'sub-1' });

      const result = await service.registerEventSubProcess(context);

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe(EventType.SIGNAL);
      expect(result[0].eventName).toBe('signal-1');
      expect(mockEventSubscriptionService.createSubscription).toHaveBeenCalled();
    });

    it('应该跳过没有事件定义的开始事件', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const context = createContext(element);

      const result = await service.registerEventSubProcess(context);

      expect(result).toHaveLength(0);
    });

    it('应该跳过条件不满足的事件', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        conditionalEventDefinition: { condition: '${var1 == "other"}' },
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const context = createContext(element);

      mockExpressionEvaluator.evaluate.mockResolvedValueOnce(false);

      const result = await service.registerEventSubProcess(context);

      expect(result).toHaveLength(0);
      expect(mockExpressionEvaluator.evaluate).toHaveBeenCalledWith(
        '${var1 == "other"}',
        context.variables,
      );
    });

    it('应该注册消息事件', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        messageRef: 'message-1',
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const context = createContext(element);

      mockEventSubscriptionService.createSubscription.mockResolvedValueOnce({ id: 'sub-1' });

      const result = await service.registerEventSubProcess(context);

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe(EventType.MESSAGE);
      expect(result[0].eventName).toBe('message-1');
    });

    it('应该注册定时器事件', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        timerEventDefinition: { timeDuration: 'PT1H' },
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const context = createContext(element);

      mockEventSubscriptionService.createSubscription.mockResolvedValueOnce({ id: 'sub-1' });

      const result = await service.registerEventSubProcess(context);

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe(EventType.TIMER);
    });

    it('应该注册错误事件', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        errorRef: 'error-1',
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const context = createContext(element);

      mockEventSubscriptionService.createSubscription.mockResolvedValueOnce({ id: 'sub-1' });

      const result = await service.registerEventSubProcess(context);

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe(EventType.ERROR);
    });

    it('应该注册条件事件', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        conditionalEventDefinition: { condition: '${var1 == "value1"}' },
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const context = createContext(element);

      mockExpressionEvaluator.evaluate.mockResolvedValueOnce(true);
      mockEventSubscriptionService.createSubscription.mockResolvedValueOnce({ id: 'sub-1' });

      const result = await service.registerEventSubProcess(context);

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe(EventType.CONDITIONAL);
    });
  });

  describe('triggerEventSubProcess', () => {
    const createEventSubProcessElement = (options: {
      id: string;
      children?: BpmnElement[];
    }): BpmnElement => ({
      id: options.id,
      name: options.id,
      type: 'bpmn:SubProcess',
      triggeredByEvent: true,
      children: options.children || [],
    });

    const createContext = (element: BpmnElement, triggerEvent?: EventTriggerInfo): EventSubProcessExecutionContext => ({
      processInstanceId: 'process-1',
      executionId: 'exec-1',
      eventSubProcessElement: element,
      variables: { var1: 'value1' },
      triggerEvent,
    });

    it('应该成功触发事件子流程', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        signalRef: 'signal-1',
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const triggerEvent: EventTriggerInfo = {
        eventType: EventType.SIGNAL,
        eventName: 'signal-1',
        timestamp: new Date(),
      };
      const context = createContext(element, triggerEvent);

      mockVariableScopeService.createScope.mockResolvedValueOnce('scope-1');
      mockVariableScopeService.setVariables.mockResolvedValueOnce(undefined);

      const result = await service.triggerEventSubProcess(context);

      expect(result.isTriggered).toBe(true);
      expect(result.nextElementIds).toContain('start-1');
      expect(result.executionId).toBeDefined();
      expect(mockVariableScopeService.createScope).toHaveBeenCalled();
    });

    it('应该抛出错误当没有触发事件时', async () => {
      const element = createEventSubProcessElement({ id: 'event-sub-1' });
      const context = createContext(element);

      await expect(service.triggerEventSubProcess(context)).rejects.toThrow(
        'Trigger event is required',
      );
    });

    it('应该添加事件数据到变量', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        signalRef: 'signal-1',
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const triggerEvent: EventTriggerInfo = {
        eventType: EventType.SIGNAL,
        eventName: 'signal-1',
        eventData: { key: 'value' },
        timestamp: new Date(),
      };
      const context = createContext(element, triggerEvent);

      mockVariableScopeService.createScope.mockResolvedValueOnce('scope-1');

      await service.triggerEventSubProcess(context);

      expect(mockVariableScopeService.setVariable).toHaveBeenCalledWith(
        'scope-1',
        'eventData',
        { key: 'value' },
      );
    });

    it('应该抛出错误当没有匹配的开始事件时', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        signalRef: 'signal-1',
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const triggerEvent: EventTriggerInfo = {
        eventType: EventType.MESSAGE, // 不匹配的事件类型
        eventName: 'message-1',
        timestamp: new Date(),
      };
      const context = createContext(element, triggerEvent);

      mockVariableScopeService.createScope.mockResolvedValueOnce('scope-1');

      await expect(service.triggerEventSubProcess(context)).rejects.toThrow(
        'No matching start event found',
      );
    });

    it('应该返回中断标记', async () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        signalRef: 'signal-1',
        isInterrupting: true,
      };
      const element = createEventSubProcessElement({
        id: 'event-sub-1',
        children: [startEvent],
      });
      const triggerEvent: EventTriggerInfo = {
        eventType: EventType.SIGNAL,
        eventName: 'signal-1',
        timestamp: new Date(),
      };
      const context = createContext(element, triggerEvent);

      mockVariableScopeService.createScope.mockResolvedValueOnce('scope-1');

      const result = await service.triggerEventSubProcess(context);

      expect(result.isInterrupting).toBe(true);
    });
  });

  describe('completeEventSubProcess', () => {
    it('应该成功完成事件子流程', async () => {
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
        children: [{ id: 'start-1', type: 'bpmn:StartEvent', isInterrupting: false }],
      };

      mockVariableScopeService.getVariables.mockResolvedValueOnce({ result: 'success' });
      mockVariableScopeService.destroyScope.mockResolvedValueOnce(undefined);

      const result = await service.completeEventSubProcess('process-1', element, 'scope-1');

      expect(result.outputVariables).toEqual({ result: 'success' });
      expect(mockVariableScopeService.getVariables).toHaveBeenCalledWith('scope-1');
      expect(mockVariableScopeService.destroyScope).toHaveBeenCalledWith('scope-1');
    });

    it('应该返回中断标记为true当有中断开始事件时', async () => {
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
        children: [{ id: 'start-1', type: 'bpmn:StartEvent', isInterrupting: true }],
      };

      mockVariableScopeService.getVariables.mockResolvedValueOnce({});
      mockVariableScopeService.destroyScope.mockResolvedValueOnce(undefined);

      const result = await service.completeEventSubProcess('process-1', element, 'scope-1');

      expect(result.isInterrupting).toBe(true);
    });
  });

  describe('cancelEventSubProcess', () => {
    it('应该成功取消事件子流程', async () => {
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
      };

      mockEventSubscriptionService.deleteSubscriptionsByProcessInstance.mockResolvedValueOnce(undefined);

      await service.cancelEventSubProcess('process-1', element);

      expect(mockEventSubscriptionService.deleteSubscriptionsByProcessInstance).toHaveBeenCalledWith(
        'process-1',
      );
    });
  });

  describe('isEventSubProcess', () => {
    it('应该识别事件子流程', () => {
      const element: BpmnElement = {
        id: 'sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
      };

      expect(service.isEventSubProcess(element)).toBe(true);
    });

    it('应该拒绝非事件子流程', () => {
      const element: BpmnElement = {
        id: 'sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: false,
      };

      expect(service.isEventSubProcess(element)).toBe(false);
    });

    it('应该拒绝非子流程元素', () => {
      const element: BpmnElement = {
        id: 'task-1',
        type: 'bpmn:UserTask',
      };

      expect(service.isEventSubProcess(element)).toBe(false);
    });
  });

  describe('getEventSubProcessEventType', () => {
    it('应该返回事件子流程的事件类型', () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        signalRef: 'signal-1',
      };
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
        children: [startEvent],
      };

      const result = service.getEventSubProcessEventType(element);

      expect(result).toBe(EventType.SIGNAL);
    });

    it('应该返回null当没有开始事件时', () => {
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
        children: [],
      };

      const result = service.getEventSubProcessEventType(element);

      expect(result).toBeNull();
    });

    it('应该返回null当开始事件没有事件定义时', () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
      };
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
        children: [startEvent],
      };

      const result = service.getEventSubProcessEventType(element);

      expect(result).toBeNull();
    });
  });

  describe('validateEventSubProcess', () => {
    it('应该验证有效的事件子流程', () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        signalRef: 'signal-1',
      };
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
        children: [startEvent],
      };

      const result = service.validateEventSubProcess(element);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测未标记为事件子流程的元素', () => {
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: false,
        children: [],
      };

      const result = service.validateEventSubProcess(element);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('not marked as triggeredByEvent'))).toBe(true);
    });

    it('应该检测没有开始事件的事件子流程', () => {
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
        children: [],
      };

      const result = service.validateEventSubProcess(element);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('has no start event'))).toBe(true);
    });

    it('应该检测没有事件定义的开始事件', () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
      };
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
        children: [startEvent],
      };

      const result = service.validateEventSubProcess(element);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('has no event definition'))).toBe(true);
    });

    it('应该检测有入口流的事件子流程', () => {
      const startEvent: BpmnElement = {
        id: 'start-1',
        type: 'bpmn:StartEvent',
        signalRef: 'signal-1',
      };
      const element: BpmnElement = {
        id: 'event-sub-1',
        type: 'bpmn:SubProcess',
        triggeredByEvent: true,
        children: [startEvent],
        incoming: ['flow-1'],
      };

      const result = service.validateEventSubProcess(element);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('should not have incoming flows'))).toBe(true);
    });
  });
});
