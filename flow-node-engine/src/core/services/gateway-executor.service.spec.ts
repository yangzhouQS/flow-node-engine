import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  GatewayExecutorService,
  GatewayType,
  GatewayExecutionResult,
} from './gateway-executor.service';
import { BpmnElement, BpmnSequenceFlow } from './bpmn-parser.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { InclusiveGatewayStateService } from './inclusive-gateway-state.service';

describe('GatewayExecutorService', () => {
  let service: GatewayExecutorService;
  let expressionEvaluator: ExpressionEvaluatorService;
  let inclusiveGatewayStateService: InclusiveGatewayStateService;

  const mockExpressionEvaluator = {
    evaluateCondition: vi.fn(),
    evaluate: vi.fn(),
  };

  const mockInclusiveGatewayStateService = {
    createForkState: vi.fn(),
    getJoinState: vi.fn(),
    getActiveStates: vi.fn(),
    getBranchTargets: vi.fn(),
    createJoinState: vi.fn(),
    incrementCompletedBranches: vi.fn(),
    completeState: vi.fn(),
  };

  // 创建模拟网关元素
  const createGateway = (
    id: string,
    type: string,
    name?: string,
  ): BpmnElement => ({
    id,
    name: name || id,
    type,
  });

  // 创建模拟序列流
  const createFlow = (
    id: string,
    sourceRef: string,
    targetRef: string,
    conditionExpression?: string,
  ): BpmnSequenceFlow => ({
    id,
    sourceRef,
    targetRef,
    conditionExpression,
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayExecutorService,
        {
          provide: ExpressionEvaluatorService,
          useValue: mockExpressionEvaluator,
        },
        {
          provide: InclusiveGatewayStateService,
          useValue: mockInclusiveGatewayStateService,
        },
      ],
    }).compile();

    service = module.get<GatewayExecutorService>(GatewayExecutorService);
    expressionEvaluator = module.get<ExpressionEvaluatorService>(
      ExpressionEvaluatorService,
    );
    inclusiveGatewayStateService = module.get<InclusiveGatewayStateService>(
      InclusiveGatewayStateService,
    );
  });

  describe('execute', () => {
    it('应该执行排他网关', async () => {
      const gateway = createGateway('gateway1', GatewayType.EXCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${amount > 100}'),
        createFlow('flow2', 'gateway1', 'task2'),
      ];
      const variables = { amount: 150 };

      mockExpressionEvaluator.evaluateCondition.mockReturnValue(true);

      const result = await service.execute(gateway, flows, variables);

      expect(result.nextElementIds).toContain('task1');
      expect(result.needsWait).toBe(false);
      expect(result.isFork).toBe(false);
    });

    it('应该执行并行网关', async () => {
      const gateway = createGateway('gateway1', GatewayType.PARALLEL);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1'),
        createFlow('flow2', 'gateway1', 'task2'),
      ];
      const variables = {};

      const result = await service.execute(gateway, flows, variables);

      expect(result.nextElementIds).toHaveLength(2);
      expect(result.nextElementIds).toContain('task1');
      expect(result.nextElementIds).toContain('task2');
      expect(result.isFork).toBe(true);
      expect(result.activeBranches).toBe(2);
    });

    it('应该执行包容网关分叉', async () => {
      const gateway = createGateway('gateway1', GatewayType.INCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${amount > 100}'),
        createFlow('flow2', 'gateway1', 'task2', '${amount > 200}'),
        createFlow('flow3', 'gateway1', 'task3'),
      ];
      const variables = { amount: 150 };

      mockExpressionEvaluator.evaluateCondition
        .mockReturnValueOnce(true) // flow1: amount > 100 = true
        .mockReturnValueOnce(false); // flow2: amount > 200 = false

      mockInclusiveGatewayStateService.createForkState.mockResolvedValue({});

      const result = await service.execute(
        gateway,
        flows,
        variables,
        'process-1',
        'exec-1',
      );

      expect(result.nextElementIds).toContain('task1');
      expect(result.nextElementIds).not.toContain('task2');
      expect(result.isFork).toBe(true);
    });

    it('应该执行基于事件的网关', async () => {
      const gateway = createGateway('gateway1', GatewayType.EVENT_BASED);
      const flows = [
        createFlow('flow1', 'gateway1', 'event1'),
        createFlow('flow2', 'gateway1', 'event2'),
      ];
      const variables = {};

      const result = await service.execute(gateway, flows, variables);

      expect(result.needsWait).toBe(true);
      expect(result.nextElementIds).toHaveLength(2);
    });

    it('应该抛出不支持的网关类型错误', async () => {
      const gateway = createGateway('gateway1', 'bpmn:UnknownGateway');
      const flows = [createFlow('flow1', 'gateway1', 'task1')];
      const variables = {};

      await expect(service.execute(gateway, flows, variables)).rejects.toThrow(
        'Unsupported gateway type',
      );
    });
  });

  describe('executeExclusiveGateway', () => {
    it('应该选择第一个满足条件的分支', async () => {
      const gateway = createGateway('gateway1', GatewayType.EXCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${status == "approved"}'),
        createFlow('flow2', 'gateway1', 'task2', '${status == "rejected"}'),
        createFlow('flow3', 'gateway1', 'task3'),
      ];
      const variables = { status: 'approved' };

      mockExpressionEvaluator.evaluateCondition.mockReturnValue(true);

      const result = await service.execute(gateway, flows, variables);

      expect(result.nextElementIds).toEqual(['task1']);
    });

    it('应该使用默认分支当没有条件满足时', async () => {
      const gateway = createGateway('gateway1', GatewayType.EXCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${status == "approved"}'),
        createFlow('flow2', 'gateway1', 'task2'),
      ];
      const variables = { status: 'pending' };

      mockExpressionEvaluator.evaluateCondition.mockReturnValue(false);

      const result = await service.execute(gateway, flows, variables);

      expect(result.nextElementIds).toEqual(['task2']);
    });

    it('应该抛出错误当没有条件满足且没有默认分支时', async () => {
      const gateway = createGateway('gateway1', GatewayType.EXCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${status == "approved"}'),
        createFlow('flow2', 'gateway1', 'task2', '${status == "rejected"}'),
      ];
      const variables = { status: 'pending' };

      mockExpressionEvaluator.evaluateCondition.mockReturnValue(false);

      await expect(service.execute(gateway, flows, variables)).rejects.toThrow(
        'No outgoing flow satisfied the condition',
      );
    });

    it('应该处理条件评估错误', async () => {
      const gateway = createGateway('gateway1', GatewayType.EXCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${invalid.expression}'),
        createFlow('flow2', 'gateway1', 'task2'),
      ];
      const variables = {};

      mockExpressionEvaluator.evaluateCondition.mockImplementation(() => {
        throw new Error('Evaluation error');
      });

      // 应该使用默认分支
      const result = await service.execute(gateway, flows, variables);
      expect(result.nextElementIds).toEqual(['task2']);
    });
  });

  describe('executeParallelGateway', () => {
    it('应该执行所有输出分支', async () => {
      const gateway = createGateway('gateway1', GatewayType.PARALLEL);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1'),
        createFlow('flow2', 'gateway1', 'task2'),
        createFlow('flow3', 'gateway1', 'task3'),
      ];
      const variables = {};

      const result = await service.execute(gateway, flows, variables);

      expect(result.nextElementIds).toHaveLength(3);
      expect(result.isFork).toBe(true);
      expect(result.activeBranches).toBe(3);
    });

    it('应该抛出错误当没有输出流时', async () => {
      const gateway = createGateway('gateway1', GatewayType.PARALLEL);
      const flows: BpmnSequenceFlow[] = [];
      const variables = {};

      await expect(service.execute(gateway, flows, variables)).rejects.toThrow(
        'No outgoing flows for parallel gateway',
      );
    });

    it('应该正确处理单个输出流', async () => {
      const gateway = createGateway('gateway1', GatewayType.PARALLEL);
      const flows = [createFlow('flow1', 'gateway1', 'task1')];
      const variables = {};

      const result = await service.execute(gateway, flows, variables);

      expect(result.nextElementIds).toHaveLength(1);
      expect(result.isFork).toBe(false);
    });
  });

  describe('executeInclusiveGateway', () => {
    it('应该选择所有满足条件的分支', async () => {
      const gateway = createGateway('gateway1', GatewayType.INCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${score >= 60}'),
        createFlow('flow2', 'gateway1', 'task2', '${score >= 80}'),
        createFlow('flow3', 'gateway1', 'task3', '${score >= 90}'),
      ];
      const variables = { score: 85 };

      mockExpressionEvaluator.evaluateCondition
        .mockReturnValueOnce(true) // score >= 60
        .mockReturnValueOnce(true) // score >= 80
        .mockReturnValueOnce(false); // score >= 90

      mockInclusiveGatewayStateService.createForkState.mockResolvedValue({});

      const result = await service.execute(
        gateway,
        flows,
        variables,
        'process-1',
        'exec-1',
      );

      expect(result.nextElementIds).toHaveLength(2);
      expect(result.nextElementIds).toContain('task1');
      expect(result.nextElementIds).toContain('task2');
      expect(result.isFork).toBe(true);
    });

    it('应该使用默认分支当没有条件满足时', async () => {
      const gateway = createGateway('gateway1', GatewayType.INCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${score >= 60}'),
        createFlow('flow2', 'gateway1', 'task2'),
      ];
      const variables = { score: 50 };

      mockExpressionEvaluator.evaluateCondition.mockReturnValue(false);
      mockInclusiveGatewayStateService.createForkState.mockResolvedValue({});

      const result = await service.execute(
        gateway,
        flows,
        variables,
        'process-1',
        'exec-1',
      );

      expect(result.nextElementIds).toEqual(['task2']);
    });

    it('应该抛出错误当缺少流程实例ID时', async () => {
      const gateway = createGateway('gateway1', GatewayType.INCLUSIVE);
      const flows = [createFlow('flow1', 'gateway1', 'task1')];
      const variables = {};

      await expect(
        service.execute(gateway, flows, variables),
      ).rejects.toThrow('Process instance ID is required');
    });
  });

  describe('executeEventBasedGateway', () => {
    it('应该返回所有可能的分支并标记需要等待', async () => {
      const gateway = createGateway('gateway1', GatewayType.EVENT_BASED);
      const flows = [
        createFlow('flow1', 'gateway1', 'timerEvent'),
        createFlow('flow2', 'gateway1', 'messageEvent'),
      ];
      const variables = {};

      const result = await service.execute(gateway, flows, variables);

      expect(result.needsWait).toBe(true);
      expect(result.nextElementIds).toHaveLength(2);
      expect(result.isFork).toBe(false);
    });
  });

  describe('validateGateway', () => {
    it('应该验证有效的网关配置', () => {
      const gateway = createGateway('gateway1', GatewayType.EXCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${x > 0}'),
        createFlow('flow2', 'gateway1', 'task2'),
      ];

      const result = service.validateGateway(gateway, flows);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该检测没有输出流的网关', () => {
      const gateway = createGateway('gateway1', GatewayType.EXCLUSIVE);
      const flows: BpmnSequenceFlow[] = [];

      const result = service.validateGateway(gateway, flows);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Gateway gateway1 has no outgoing flows',
      );
    });

    it('应该警告排他网关没有默认流', () => {
      const gateway = createGateway('gateway1', GatewayType.EXCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${x > 0}'),
        createFlow('flow2', 'gateway1', 'task2', '${x <= 0}'),
      ];

      const result = service.validateGateway(gateway, flows);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('no default flow'))).toBe(
        true,
      );
    });

    it('应该检测并行网关有条件流', () => {
      const gateway = createGateway('gateway1', GatewayType.PARALLEL);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${x > 0}'),
        createFlow('flow2', 'gateway1', 'task2'),
      ];

      const result = service.validateGateway(gateway, flows);

      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('should not have conditional flows')),
      ).toBe(true);
    });
  });

  describe('getSatisfiedBranches', () => {
    it('应该返回所有满足条件的分支', async () => {
      const gateway = createGateway('gateway1', GatewayType.INCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${x > 0}'),
        createFlow('flow2', 'gateway1', 'task2', '${x > 10}'),
        createFlow('flow3', 'gateway1', 'task3'),
      ];
      const variables = { x: 5 };

      mockExpressionEvaluator.evaluateCondition
        .mockReturnValueOnce(true) // x > 0
        .mockReturnValueOnce(false); // x > 10

      const result = await service.getSatisfiedBranches(
        gateway,
        flows,
        variables,
      );

      expect(result).toHaveLength(2);
      expect(result.map((f) => f.id)).toContain('flow1');
      expect(result.map((f) => f.id)).toContain('flow3');
    });

    it('应该将无条件流作为默认流', async () => {
      const gateway = createGateway('gateway1', GatewayType.INCLUSIVE);
      const flows = [
        createFlow('flow1', 'gateway1', 'task1', '${x > 100}'),
        createFlow('flow2', 'gateway1', 'task2'),
      ];
      const variables = { x: 50 };

      mockExpressionEvaluator.evaluateCondition.mockReturnValue(false);

      const result = await service.getSatisfiedBranches(
        gateway,
        flows,
        variables,
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('flow2');
    });
  });
});
