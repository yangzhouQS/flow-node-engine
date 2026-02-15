import { describe, it, expect, beforeEach } from 'vitest';
import { HitPolicy, AggregationType } from '../entities/dmn-decision.entity';
import { RuleEvaluationResult, RuleExecutionContext, DecisionExecutionAuditContainer } from '../interfaces/hit-policy.interface';
import { 
  HitPolicyHandlerFactory,
  UniqueHitPolicyHandler,
  FirstHitPolicyHandler,
  PriorityHitPolicyHandler,
  AnyHitPolicyHandler,
  CollectHitPolicyHandler,
  RuleOrderHitPolicyHandler,
  OutputOrderHitPolicyHandler,
  UnorderedHitPolicyHandler,
} from './hit-policy-handlers.service';

describe('HitPolicyHandlers', () => {
  let factory: HitPolicyHandlerFactory;
  let uniqueHandler: UniqueHitPolicyHandler;
  let firstHandler: FirstHitPolicyHandler;
  let priorityHandler: PriorityHitPolicyHandler;
  let anyHandler: AnyHitPolicyHandler;
  let collectHandler: CollectHitPolicyHandler;
  let ruleOrderHandler: RuleOrderHitPolicyHandler;
  let outputOrderHandler: OutputOrderHitPolicyHandler;
  let unorderedHandler: UnorderedHitPolicyHandler;

  // 创建模拟规则结果
  const createMockResults = (count: number, matched: boolean[] = []): RuleEvaluationResult[] => {
    const results: RuleEvaluationResult[] = [];
    for (let i = 0; i < count; i++) {
      results.push({
        ruleId: `rule-${i}`,
        ruleIndex: i,
        matched: matched[i] ?? false,
        outputs: matched[i] ? { output1: `value-${i}` } : {},
        priority: i,
      });
    }
    return results;
  };

  // 创建模拟执行上下文
  const createMockContext = (overrides: Partial<RuleExecutionContext> = {}): RuleExecutionContext => {
    const auditContainer: DecisionExecutionAuditContainer = {
      decisionId: 'test-decision',
      decisionKey: 'test',
      strictMode: true,
      forceDMN11: false,
      ruleExecutions: [],
    };
    return {
      auditContainer,
      strictMode: true,
      forceDMN11: false,
      ruleResults: new Map(),
      stackVariables: new Map(),
      ...overrides,
    };
  };

  beforeEach(() => {
    uniqueHandler = new UniqueHitPolicyHandler();
    firstHandler = new FirstHitPolicyHandler();
    priorityHandler = new PriorityHitPolicyHandler();
    anyHandler = new AnyHitPolicyHandler();
    collectHandler = new CollectHitPolicyHandler();
    ruleOrderHandler = new RuleOrderHitPolicyHandler();
    outputOrderHandler = new OutputOrderHitPolicyHandler();
    unorderedHandler = new UnorderedHitPolicyHandler();

    factory = new HitPolicyHandlerFactory(
      uniqueHandler,
      firstHandler,
      priorityHandler,
      anyHandler,
      collectHandler,
      ruleOrderHandler,
      outputOrderHandler,
      unorderedHandler,
    );
  });

  describe('HitPolicyHandlerFactory', () => {
    it('应该为UNIQUE策略返回正确的处理器', () => {
      const handler = factory.getHandler(HitPolicy.UNIQUE);
      expect(handler).toBe(uniqueHandler);
    });

    it('应该为FIRST策略返回正确的处理器', () => {
      const handler = factory.getHandler(HitPolicy.FIRST);
      expect(handler).toBe(firstHandler);
    });

    it('应该为PRIORITY策略返回正确的处理器', () => {
      const handler = factory.getHandler(HitPolicy.PRIORITY);
      expect(handler).toBe(priorityHandler);
    });

    it('应该为ANY策略返回正确的处理器', () => {
      const handler = factory.getHandler(HitPolicy.ANY);
      expect(handler).toBe(anyHandler);
    });

    it('应该为COLLECT策略返回正确的处理器', () => {
      const handler = factory.getHandler(HitPolicy.COLLECT);
      expect(handler).toBe(collectHandler);
    });

    it('应该为RULE_ORDER策略返回正确的处理器', () => {
      const handler = factory.getHandler(HitPolicy.RULE_ORDER);
      expect(handler).toBe(ruleOrderHandler);
    });

    it('应该为OUTPUT_ORDER策略返回正确的处理器', () => {
      const handler = factory.getHandler(HitPolicy.OUTPUT_ORDER);
      expect(handler).toBe(outputOrderHandler);
    });

    it('应该为UNORDERED策略返回正确的处理器', () => {
      const handler = factory.getHandler(HitPolicy.UNORDERED);
      expect(handler).toBe(unorderedHandler);
    });

    it('应该检查ContinueEvaluating行为支持', () => {
      expect(factory.isContinueEvaluatingBehavior(firstHandler)).toBe(true);
      expect(factory.isContinueEvaluatingBehavior(uniqueHandler)).toBe(true);
    });

    it('应该检查EvaluateRuleValidity行为支持', () => {
      expect(factory.isEvaluateRuleValidityBehavior(uniqueHandler)).toBe(true);
      expect(factory.isEvaluateRuleValidityBehavior(firstHandler)).toBe(false);
    });

    it('应该检查ComposeDecisionResult行为支持', () => {
      expect(factory.isComposeDecisionResultBehavior(priorityHandler)).toBe(true);
      expect(factory.isComposeDecisionResultBehavior(firstHandler)).toBe(true);
    });
  });

  describe('UniqueHitPolicyHandler', () => {
    it('当没有匹配规则时应该返回无匹配', () => {
      const results = createMockResults(3, [false, false, false]);
      const result = uniqueHandler.handle(results);

      expect(result.hasMatch).toBe(false);
      expect(result.matchedRuleIds).toHaveLength(0);
    });

    it('当只有一条规则匹配时应该返回结果', () => {
      const results = createMockResults(3, [false, true, false]);
      const result = uniqueHandler.handle(results);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedRuleIds).toHaveLength(1);
      expect(result.matchedRuleIds[0]).toBe('rule-1');
    });

    it('当多条规则匹配时应该抛出异常', () => {
      const results = createMockResults(3, [true, true, false]);
      
      expect(() => uniqueHandler.handle(results)).toThrow('UNIQUE');
    });

    it('evaluateRuleValidity应该在strictMode下对多条匹配返回无效', () => {
      const results = createMockResults(3, [true, true, false]);
      const matchedResults = results.filter(r => r.matched);
      const validity = uniqueHandler.evaluateRuleValidity(matchedResults, true);

      expect(validity.valid).toBe(false);
      expect(validity.errorMessage).toContain('UNIQUE');
    });

    it('evaluateRuleValidity应该在单条匹配时返回有效', () => {
      const results = createMockResults(3, [false, true, false]);
      const matchedResults = results.filter(r => r.matched);
      const validity = uniqueHandler.evaluateRuleValidity(matchedResults, true);

      expect(validity.valid).toBe(true);
    });
  });

  describe('FirstHitPolicyHandler', () => {
    it('应该返回第一条匹配的规则', () => {
      const results = createMockResults(5, [false, false, true, true, false]);
      const result = firstHandler.handle(results);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedRuleIds).toHaveLength(1);
      expect(result.matchedRuleIds[0]).toBe('rule-2');
    });

    it('当没有匹配规则时应该返回无匹配', () => {
      const results = createMockResults(3, [false, false, false]);
      const result = firstHandler.handle(results);

      expect(result.hasMatch).toBe(false);
    });

    it('shouldContinueEvaluating应该在匹配后返回false', () => {
      const continueResult = firstHandler.shouldContinueEvaluating(true);

      expect(continueResult.shouldContinue).toBe(false);
      expect(continueResult.reason).toContain('First');
    });

    it('shouldContinueEvaluating应该在无匹配时返回true', () => {
      const continueResult = firstHandler.shouldContinueEvaluating(false);

      expect(continueResult.shouldContinue).toBe(true);
    });
  });

  describe('PriorityHitPolicyHandler', () => {
    it('应该返回优先级最高的匹配规则', () => {
      const results: RuleEvaluationResult[] = [
        { ruleId: 'rule-0', ruleIndex: 0, matched: true, outputs: { output1: 'low' }, priority: 10 },
        { ruleId: 'rule-1', ruleIndex: 1, matched: true, outputs: { output1: 'high' }, priority: 1 },
        { ruleId: 'rule-2', ruleIndex: 2, matched: true, outputs: { output1: 'mid' }, priority: 5 },
      ];
      
      const result = priorityHandler.handle(results);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedRuleIds).toHaveLength(1);
      expect(result.matchedRuleIds[0]).toBe('rule-1'); // 优先级1最高
    });

    it('当没有匹配规则时应该返回无匹配', () => {
      const results = createMockResults(3, [false, false, false]);
      const result = priorityHandler.handle(results);

      expect(result.hasMatch).toBe(false);
    });

    it('composeDecisionResults应该按优先级排序', () => {
      const context = createMockContext({
        ruleResults: new Map([
          [0, { output1: 'low' }],
          [1, { output1: 'high' }],
        ]),
        outputClauseOutputValues: ['high', 'mid', 'low'],
      });

      const composed = priorityHandler.composeDecisionResults(context);

      expect(composed).toEqual([{ output1: 'high' }]);
    });
  });

  describe('AnyHitPolicyHandler', () => {
    it('应该返回任意一条匹配的规则', () => {
      const results = createMockResults(5, [false, false, true, true, false]);
      const result = anyHandler.handle(results);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedRuleIds).toHaveLength(2);
    });

    it('当没有匹配规则时应该返回无匹配', () => {
      const results = createMockResults(3, [false, false, false]);
      const result = anyHandler.handle(results);

      expect(result.hasMatch).toBe(false);
    });

    it('当所有输出相同时应该正常处理', () => {
      const results: RuleEvaluationResult[] = [
        { ruleId: 'rule-0', ruleIndex: 0, matched: true, outputs: { output1: 'same-value' }, priority: 0 },
        { ruleId: 'rule-1', ruleIndex: 1, matched: true, outputs: { output1: 'same-value' }, priority: 0 },
      ];

      const result = anyHandler.handle(results);

      expect(result.hasMatch).toBe(true);
      expect(result.output).toEqual({ output1: 'same-value' });
    });
  });

  describe('CollectHitPolicyHandler', () => {
    it('应该收集所有匹配规则的结果', () => {
      const results = createMockResults(5, [false, true, false, true, false]);
      const result = collectHandler.handle(results);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedRuleIds).toHaveLength(2);
      expect(result.needsAggregation).toBe(true);
    });

    it('当没有匹配规则时应该返回无匹配', () => {
      const results = createMockResults(3, [false, false, false]);
      const result = collectHandler.handle(results);

      expect(result.hasMatch).toBe(false);
    });

    it('应该支持SUM聚合', () => {
      const outputs = [
        { amount: 100 },
        { amount: 200 },
        { amount: 300 },
      ];

      const aggregated = collectHandler.applyAggregation(outputs, 'amount', AggregationType.SUM);

      expect(aggregated).toBe(600);
    });

    it('应该支持COUNT聚合', () => {
      const outputs = [
        { status: 'active' },
        { status: 'active' },
      ];

      const aggregated = collectHandler.applyAggregation(outputs, 'status', AggregationType.COUNT);

      expect(aggregated).toBe(2);
    });

    it('应该支持MIN聚合', () => {
      const outputs = [
        { score: 80 },
        { score: 60 },
        { score: 90 },
      ];

      const aggregated = collectHandler.applyAggregation(outputs, 'score', AggregationType.MIN);

      expect(aggregated).toBe(60);
    });

    it('应该支持MAX聚合', () => {
      const outputs = [
        { score: 80 },
        { score: 60 },
        { score: 90 },
      ];

      const aggregated = collectHandler.applyAggregation(outputs, 'score', AggregationType.MAX);

      expect(aggregated).toBe(90);
    });
  });

  describe('RuleOrderHitPolicyHandler', () => {
    it('应该按规则顺序返回所有匹配结果', () => {
      const results = createMockResults(5, [true, false, true, true, false]);
      const result = ruleOrderHandler.handle(results);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedRuleIds).toHaveLength(3);
      expect(result.matchedRuleIds).toEqual(['rule-0', 'rule-2', 'rule-3']);
    });

    it('当没有匹配规则时应该返回无匹配', () => {
      const results = createMockResults(3, [false, false, false]);
      const result = ruleOrderHandler.handle(results);

      expect(result.hasMatch).toBe(false);
    });

    it('应该标记返回多个结果', () => {
      const results = createMockResults(3, [true, true, true]);
      const result = ruleOrderHandler.handle(results);

      expect(result.multipleResults).toBe(true);
    });
  });

  describe('OutputOrderHitPolicyHandler', () => {
    it('应该按输出值优先级返回结果', () => {
      const results: RuleEvaluationResult[] = [
        { ruleId: 'rule-0', ruleIndex: 0, matched: true, outputs: { status: 'high' }, priority: 0 },
        { ruleId: 'rule-1', ruleIndex: 1, matched: true, outputs: { status: 'low' }, priority: 0 },
        { ruleId: 'rule-2', ruleIndex: 2, matched: true, outputs: { status: 'medium' }, priority: 0 },
      ];

      const result = outputOrderHandler.handle(results);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedRuleIds).toHaveLength(3);
    });

    it('当没有匹配规则时应该返回无匹配', () => {
      const results = createMockResults(3, [false, false, false]);
      const result = outputOrderHandler.handle(results);

      expect(result.hasMatch).toBe(false);
    });
  });

  describe('UnorderedHitPolicyHandler', () => {
    it('应该返回所有匹配规则但不保证顺序', () => {
      const results = createMockResults(5, [true, false, true, true, false]);
      const result = unorderedHandler.handle(results);

      expect(result.hasMatch).toBe(true);
      expect(result.matchedRuleIds).toHaveLength(3);
    });

    it('当没有匹配规则时应该返回无匹配', () => {
      const results = createMockResults(3, [false, false, false]);
      const result = unorderedHandler.handle(results);

      expect(result.hasMatch).toBe(false);
    });

    it('应该标记返回多个结果', () => {
      const results = createMockResults(3, [true, true, true]);
      const result = unorderedHandler.handle(results);

      expect(result.multipleResults).toBe(true);
    });
  });

  describe('AbstractHitPolicy行为接口', () => {
    it('所有处理器应该实现isMultipleResults方法', () => {
      expect(uniqueHandler.isMultipleResults()).toBe(false);
      expect(firstHandler.isMultipleResults()).toBe(false);
      expect(priorityHandler.isMultipleResults()).toBe(false);
      expect(anyHandler.isMultipleResults()).toBe(false);
      expect(collectHandler.isMultipleResults()).toBe(true);
      expect(ruleOrderHandler.isMultipleResults()).toBe(true);
      expect(outputOrderHandler.isMultipleResults()).toBe(true);
      expect(unorderedHandler.isMultipleResults()).toBe(true);
    });
  });
});
