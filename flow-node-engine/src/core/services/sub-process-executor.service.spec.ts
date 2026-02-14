import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  SubProcessExecutorService,
  SubProcessExecutionContext,
  SubProcessExecutionResult,
  SubProcessType,
} from './sub-process-executor.service';
import { BpmnParserService, BpmnElement } from './bpmn-parser.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { VariableScopeService } from './variable-scope.service';

describe('SubProcessExecutorService', () => {
  let service: SubProcessExecutorService;
  let variableScopeService: VariableScopeService;

  const mockBpmnParser = {
    parse: vi.fn(),
    validate: vi.fn(),
  };

  const mockExpressionEvaluator = {
    evaluateCondition: vi.fn(),
    evaluate: vi.fn(),
  };

  const mockVariableScopeService = {
    createScope: vi.fn(),
    setVariables: vi.fn(),
    setVariable: vi.fn(),
    getVariables: vi.fn(),
    getVariable: vi.fn(),
    getParentScope: vi.fn(),
    destroyScope: vi.fn(),
  };

  // 创建模拟子流程元素
  const createSubProcessElement = (
    id: string,
    type: string,
    options: {
      name?: string;
      children?: BpmnElement[];
      outgoing?: string[];
      triggeredByEvent?: boolean;
      dataOutputAssociations?: any[];
    } = {},
  ): BpmnElement => ({
    id,
    name: options.name || id,
    type,
    children: options.children || [
      { id: 'subStart', name: '子流程开始', type: 'bpmn:StartEvent' } as BpmnElement,
      { id: 'subTask', name: '子流程任务', type: 'bpmn:UserTask' } as BpmnElement,
      { id: 'subEnd', name: '子流程结束', type: 'bpmn:EndEvent' } as BpmnElement,
    ],
    outgoing: options.outgoing || ['nextElement'],
    triggeredByEvent: options.triggeredByEvent,
    dataOutputAssociations: options.dataOutputAssociations || [],
  });

  // 创建模拟执行上下文
  const createExecutionContext = (
    overrides: Partial<SubProcessExecutionContext> = {},
  ): SubProcessExecutionContext => ({
    processInstanceId: 'process-1',
    parentExecutionId: 'exec-1',
    subProcessElement: createSubProcessElement('subProcess1', 'bpmn:SubProcess'),
    variables: { var1: 'value1', var2: 100 },
    ...overrides,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubProcessExecutorService,
        {
          provide: BpmnParserService,
          useValue: mockBpmnParser,
        },
        {
          provide: ExpressionEvaluatorService,
          useValue: mockExpressionEvaluator,
        },
        {
          provide: VariableScopeService,
          useValue: mockVariableScopeService,
        },
      ],
    }).compile();

    service = module.get<SubProcessExecutorService>(SubProcessExecutorService);
    variableScopeService = module.get<VariableScopeService>(VariableScopeService);
  });

  describe('executeEmbeddedSubProcess', () => {
    it('应该成功执行内嵌子流程', async () => {
      const context = createExecutionContext();
      mockVariableScopeService.createScope.mockResolvedValue('scope-1');
      mockVariableScopeService.setVariables.mockResolvedValue(undefined);

      const result = await service.executeEmbeddedSubProcess(context);

      expect(result.executionId).toBeDefined();
      expect(result.isCompleted).toBe(false);
      expect(result.nextElementIds).toContain('subStart');
      expect(result.outputVariables).toEqual(context.variables);
    });

    it('应该创建子流程作用域', async () => {
      const context = createExecutionContext();
      mockVariableScopeService.createScope.mockResolvedValue('scope-1');

      await service.executeEmbeddedSubProcess(context);

      expect(mockVariableScopeService.createScope).toHaveBeenCalledWith(
        expect.objectContaining({
          processInstanceId: context.processInstanceId,
          parentScopeId: context.parentExecutionId,
          elementId: context.subProcessElement.id,
        }),
      );
    });

    it('应该复制变量到子流程作用域', async () => {
      const context = createExecutionContext();
      mockVariableScopeService.createScope.mockResolvedValue('scope-1');

      await service.executeEmbeddedSubProcess(context);

      expect(mockVariableScopeService.setVariables).toHaveBeenCalledWith(
        'scope-1',
        context.variables,
      );
    });

    it('应该抛出错误当子流程没有开始事件时', async () => {
      const subProcessWithoutStart = createSubProcessElement('subProcess1', 'bpmn:SubProcess', {
        children: [
          { id: 'subTask', name: '子流程任务', type: 'bpmn:UserTask' } as BpmnElement,
        ],
      });
      const context = createExecutionContext({
        subProcessElement: subProcessWithoutStart,
      });
      mockVariableScopeService.createScope.mockResolvedValue('scope-1');

      await expect(service.executeEmbeddedSubProcess(context)).rejects.toThrow(
        'No start event found in sub-process',
      );
    });
  });

  describe('completeEmbeddedSubProcess', () => {
    it('应该成功完成内嵌子流程', async () => {
      const subProcess = createSubProcessElement('subProcess1', 'bpmn:SubProcess');
      const outputVariables = { result: 'success', count: 5 };

      mockVariableScopeService.getVariables.mockResolvedValue(outputVariables);
      mockVariableScopeService.getParentScope.mockResolvedValue({
        id_: 'parent-scope-1',
      });
      mockVariableScopeService.setVariables.mockResolvedValue(undefined);
      mockVariableScopeService.destroyScope.mockResolvedValue(undefined);

      const result = await service.completeEmbeddedSubProcess(
        'process-1',
        subProcess,
        'scope-1',
      );

      expect(result.nextElementIds).toEqual(['nextElement']);
      expect(result.outputVariables).toEqual(outputVariables);
    });

    it('应该获取子流程作用域的变量', async () => {
      const subProcess = createSubProcessElement('subProcess1', 'bpmn:SubProcess');
      const outputVariables = { result: 'success' };

      mockVariableScopeService.getVariables.mockResolvedValue(outputVariables);
      mockVariableScopeService.getParentScope.mockResolvedValue(null);
      mockVariableScopeService.destroyScope.mockResolvedValue(undefined);

      await service.completeEmbeddedSubProcess('process-1', subProcess, 'scope-1');

      expect(mockVariableScopeService.getVariables).toHaveBeenCalledWith('scope-1');
    });

    it('应该销毁子流程作用域', async () => {
      const subProcess = createSubProcessElement('subProcess1', 'bpmn:SubProcess');

      mockVariableScopeService.getVariables.mockResolvedValue({});
      mockVariableScopeService.getParentScope.mockResolvedValue(null);
      mockVariableScopeService.destroyScope.mockResolvedValue(undefined);

      await service.completeEmbeddedSubProcess('process-1', subProcess, 'scope-1');

      expect(mockVariableScopeService.destroyScope).toHaveBeenCalledWith('scope-1');
    });

    it('应该将变量传播到父作用域', async () => {
      const subProcess = createSubProcessElement('subProcess1', 'bpmn:SubProcess');
      const outputVariables = { result: 'success' };

      mockVariableScopeService.getVariables.mockResolvedValue(outputVariables);
      mockVariableScopeService.getParentScope.mockResolvedValue({
        id_: 'parent-scope-1',
      });
      mockVariableScopeService.setVariables.mockResolvedValue(undefined);
      mockVariableScopeService.destroyScope.mockResolvedValue(undefined);

      await service.completeEmbeddedSubProcess('process-1', subProcess, 'scope-1');

      expect(mockVariableScopeService.setVariables).toHaveBeenCalledWith(
        'parent-scope-1',
        outputVariables,
      );
    });
  });

  describe('isSubProcess', () => {
    it('应该识别内嵌子流程', () => {
      const element = createSubProcessElement('sub1', 'bpmn:SubProcess');
      expect(service.isSubProcess(element)).toBe(true);
    });

    it('应该识别事件子流程', () => {
      const element = createSubProcessElement('eventSub1', 'bpmn:EventSubProcess');
      expect(service.isSubProcess(element)).toBe(true);
    });

    it('应该识别调用活动', () => {
      const element = createSubProcessElement('call1', 'bpmn:CallActivity');
      expect(service.isSubProcess(element)).toBe(true);
    });

    it('应该识别事务子流程', () => {
      const element = createSubProcessElement('tx1', 'bpmn:Transaction');
      expect(service.isSubProcess(element)).toBe(true);
    });

    it('应该识别特指子流程', () => {
      const element = createSubProcessElement('adhoc1', 'bpmn:AdHocSubProcess');
      expect(service.isSubProcess(element)).toBe(true);
    });

    it('应该返回false对于非子流程元素', () => {
      const element = { id: 'task1', type: 'bpmn:UserTask' } as BpmnElement;
      expect(service.isSubProcess(element)).toBe(false);
    });
  });

  describe('getSubProcessType', () => {
    it('应该返回内嵌子流程类型', () => {
      const element = createSubProcessElement('sub1', 'bpmn:SubProcess');
      expect(service.getSubProcessType(element)).toBe(SubProcessType.EMBEDDED);
    });

    it('应该返回事件子流程类型当triggeredByEvent为true时', () => {
      const element = createSubProcessElement('sub1', 'bpmn:SubProcess', {
        triggeredByEvent: true,
      });
      expect(service.getSubProcessType(element)).toBe(SubProcessType.EVENT);
    });

    it('应该返回调用活动类型', () => {
      const element = createSubProcessElement('call1', 'bpmn:CallActivity');
      expect(service.getSubProcessType(element)).toBe(SubProcessType.CALL_ACTIVITY);
    });

    it('应该返回事务子流程类型', () => {
      const element = createSubProcessElement('tx1', 'bpmn:Transaction');
      expect(service.getSubProcessType(element)).toBe(SubProcessType.TRANSACTION);
    });

    it('应该返回特指子流程类型', () => {
      const element = createSubProcessElement('adhoc1', 'bpmn:AdHocSubProcess');
      expect(service.getSubProcessType(element)).toBe(SubProcessType.AD_HOC);
    });

    it('应该返回null对于非子流程元素', () => {
      const element = { id: 'task1', type: 'bpmn:UserTask' } as BpmnElement;
      expect(service.getSubProcessType(element)).toBeNull();
    });
  });

  describe('getSubProcessChildren', () => {
    it('应该返回子流程的子元素', () => {
      const children = [
        { id: 'subStart', type: 'bpmn:StartEvent' } as BpmnElement,
        { id: 'subTask', type: 'bpmn:UserTask' } as BpmnElement,
      ];
      const subProcess = createSubProcessElement('sub1', 'bpmn:SubProcess', { children });

      const result = service.getSubProcessChildren(subProcess);

      expect(result).toEqual(children);
    });

    it('应该返回flowElements当children不存在时', () => {
      const flowElements = [
        { id: 'subStart', type: 'bpmn:StartEvent' } as BpmnElement,
      ];
      const subProcess = {
        id: 'sub1',
        type: 'bpmn:SubProcess',
        flowElements,
      } as BpmnElement;

      const result = service.getSubProcessChildren(subProcess);

      expect(result).toEqual(flowElements);
    });

    it('应该返回空数组当没有子元素时', () => {
      const subProcess = { id: 'sub1', type: 'bpmn:SubProcess' } as BpmnElement;

      const result = service.getSubProcessChildren(subProcess);

      expect(result).toEqual([]);
    });
  });

  describe('validateSubProcess', () => {
    it('应该验证有效的子流程', () => {
      const subProcess = createSubProcessElement('sub1', 'bpmn:SubProcess');

      const result = service.validateSubProcess(subProcess);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测没有子元素的子流程', () => {
      const subProcess = createSubProcessElement('sub1', 'bpmn:SubProcess', {
        children: [],
      });

      const result = service.validateSubProcess(subProcess);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sub-process sub1 has no child elements');
    });

    it('应该检测没有开始事件的子流程', () => {
      const subProcess = createSubProcessElement('sub1', 'bpmn:SubProcess', {
        children: [
          { id: 'subTask', type: 'bpmn:UserTask' } as BpmnElement,
          { id: 'subEnd', type: 'bpmn:EndEvent' } as BpmnElement,
        ],
      });

      const result = service.validateSubProcess(subProcess);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Sub-process sub1 has no start event');
    });

    it('应该警告没有结束事件的子流程', () => {
      const subProcess = createSubProcessElement('sub1', 'bpmn:SubProcess', {
        children: [
          { id: 'subStart', type: 'bpmn:StartEvent' } as BpmnElement,
          { id: 'subTask', type: 'bpmn:UserTask' } as BpmnElement,
        ],
      });

      const result = service.validateSubProcess(subProcess);

      // 没有结束事件是警告，不影响验证结果
      expect(result.isValid).toBe(true);
    });
  });
});
