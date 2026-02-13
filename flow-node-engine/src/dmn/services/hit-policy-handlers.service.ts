import { Injectable, Logger } from '@nestjs/common';
import {
  HitPolicyHandler,
  HitPolicyResult,
  RuleEvaluationResult,
} from '../interfaces/hit-policy.interface';
import { HitPolicy, AggregationType } from '../entities/dmn-decision.entity';

/**
 * UNIQUE Hit Policy处理器
 * 只允许匹配一个规则，多个匹配则报错
 */
@Injectable()
export class UniqueHitPolicyHandler implements HitPolicyHandler {
  readonly name = 'UNIQUE';
  readonly type = HitPolicy.UNIQUE;

  handle(results: RuleEvaluationResult[]): HitPolicyResult {
    const matchedResults = results.filter((r) => r.matched);

    if (matchedResults.length === 0) {
      return {
        hasMatch: false,
        matchedRuleIds: [],
        output: {},
        needsAggregation: false,
      };
    }

    if (matchedResults.length > 1) {
      throw new Error(
        `UNIQUE hit policy violation: ${matchedResults.length} rules matched, but only one is allowed`,
      );
    }

    const matched = matchedResults[0];
    return {
      hasMatch: true,
      matchedRuleIds: [matched.ruleId],
      output: matched.outputs,
      needsAggregation: false,
    };
  }
}

/**
 * FIRST Hit Policy处理器
 * 返回第一个匹配的规则
 */
@Injectable()
export class FirstHitPolicyHandler implements HitPolicyHandler {
  readonly name = 'FIRST';
  readonly type = HitPolicy.FIRST;

  handle(results: RuleEvaluationResult[]): HitPolicyResult {
    const matchedResult = results.find((r) => r.matched);

    if (!matchedResult) {
      return {
        hasMatch: false,
        matchedRuleIds: [],
        output: {},
        needsAggregation: false,
      };
    }

    return {
      hasMatch: true,
      matchedRuleIds: [matchedResult.ruleId],
      output: matchedResult.outputs,
      needsAggregation: false,
    };
  }
}

/**
 * PRIORITY Hit Policy处理器
 * 返回优先级最高的匹配规则
 */
@Injectable()
export class PriorityHitPolicyHandler implements HitPolicyHandler {
  readonly name = 'PRIORITY';
  readonly type = HitPolicy.PRIORITY;

  handle(results: RuleEvaluationResult[]): HitPolicyResult {
    const matchedResults = results
      .filter((r) => r.matched)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    if (matchedResults.length === 0) {
      return {
        hasMatch: false,
        matchedRuleIds: [],
        output: {},
        needsAggregation: false,
      };
    }

    const highestPriority = matchedResults[0];
    return {
      hasMatch: true,
      matchedRuleIds: [highestPriority.ruleId],
      output: highestPriority.outputs,
      needsAggregation: false,
    };
  }
}

/**
 * ANY Hit Policy处理器
 * 任意一个匹配即可，多个匹配必须有相同的输出
 */
@Injectable()
export class AnyHitPolicyHandler implements HitPolicyHandler {
  readonly name = 'ANY';
  readonly type = HitPolicy.ANY;
  private readonly logger = new Logger(AnyHitPolicyHandler.name);

  handle(results: RuleEvaluationResult[]): HitPolicyResult {
    const matchedResults = results.filter((r) => r.matched);

    if (matchedResults.length === 0) {
      return {
        hasMatch: false,
        matchedRuleIds: [],
        output: {},
        needsAggregation: false,
      };
    }

    // 检查所有匹配的规则是否有相同的输出
    const firstOutput = JSON.stringify(matchedResults[0].outputs);
    const allSame = matchedResults.every(
      (r) => JSON.stringify(r.outputs) === firstOutput,
    );

    if (!allSame) {
      this.logger.warn(
        'ANY hit policy: multiple rules matched with different outputs, using first match',
      );
    }

    return {
      hasMatch: true,
      matchedRuleIds: matchedResults.map((r) => r.ruleId),
      output: matchedResults[0].outputs,
      needsAggregation: false,
    };
  }
}

/**
 * COLLECT Hit Policy处理器
 * 收集所有匹配的规则输出
 */
@Injectable()
export class CollectHitPolicyHandler implements HitPolicyHandler {
  readonly name = 'COLLECT';
  readonly type = HitPolicy.COLLECT;

  constructor(private readonly aggregationType?: AggregationType) {}

  handle(results: RuleEvaluationResult[]): HitPolicyResult {
    const matchedResults = results.filter((r) => r.matched);

    if (matchedResults.length === 0) {
      return {
        hasMatch: false,
        matchedRuleIds: [],
        output: [],
        needsAggregation: true,
      };
    }

    const outputs = matchedResults.map((r) => r.outputs);

    return {
      hasMatch: true,
      matchedRuleIds: matchedResults.map((r) => r.ruleId),
      output: outputs,
      needsAggregation: true,
    };
  }

  /**
   * 应用聚合函数
   */
  applyAggregation(
    outputs: Record<string, any>[],
    outputId: string,
    aggregationType: AggregationType,
  ): any {
    const values = outputs.map((o) => o[outputId]).filter((v) => v !== undefined);

    switch (aggregationType) {
      case AggregationType.SUM:
        return values.reduce((sum, v) => sum + (Number(v) || 0), 0);

      case AggregationType.COUNT:
        return values.length;

      case AggregationType.MIN:
        return Math.min(...values.map((v) => Number(v)).filter((v) => !isNaN(v)));

      case AggregationType.MAX:
        return Math.max(...values.map((v) => Number(v)).filter((v) => !isNaN(v)));

      case AggregationType.NONE:
      default:
        return values;
    }
  }
}

/**
 * RULE ORDER Hit Policy处理器
 * 按规则顺序返回所有匹配的规则
 */
@Injectable()
export class RuleOrderHitPolicyHandler implements HitPolicyHandler {
  readonly name = 'RULE ORDER';
  readonly type = HitPolicy.RULE_ORDER;

  handle(results: RuleEvaluationResult[]): HitPolicyResult {
    const matchedResults = results.filter((r) => r.matched);

    if (matchedResults.length === 0) {
      return {
        hasMatch: false,
        matchedRuleIds: [],
        output: [],
        needsAggregation: true,
      };
    }

    // 按规则索引排序
    const sortedResults = [...matchedResults].sort(
      (a, b) => a.ruleIndex - b.ruleIndex,
    );

    return {
      hasMatch: true,
      matchedRuleIds: sortedResults.map((r) => r.ruleId),
      output: sortedResults.map((r) => r.outputs),
      needsAggregation: true,
    };
  }
}

/**
 * OUTPUT ORDER Hit Policy处理器
 * 按输出优先级排序返回所有匹配的规则
 */
@Injectable()
export class OutputOrderHitPolicyHandler implements HitPolicyHandler {
  readonly name = 'OUTPUT ORDER';
  readonly type = HitPolicy.OUTPUT_ORDER;

  handle(results: RuleEvaluationResult[]): HitPolicyResult {
    const matchedResults = results.filter((r) => r.matched);

    if (matchedResults.length === 0) {
      return {
        hasMatch: false,
        matchedRuleIds: [],
        output: [],
        needsAggregation: true,
      };
    }

    // 按优先级排序（高优先级在前）
    const sortedResults = [...matchedResults].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );

    return {
      hasMatch: true,
      matchedRuleIds: sortedResults.map((r) => r.ruleId),
      output: sortedResults.map((r) => r.outputs),
      needsAggregation: true,
    };
  }
}

/**
 * Hit Policy处理器工厂
 */
@Injectable()
export class HitPolicyHandlerFactory {
  private readonly handlers: Map<HitPolicy, HitPolicyHandler>;

  constructor(
    private readonly uniqueHandler: UniqueHitPolicyHandler,
    private readonly firstHandler: FirstHitPolicyHandler,
    private readonly priorityHandler: PriorityHitPolicyHandler,
    private readonly anyHandler: AnyHitPolicyHandler,
    private readonly collectHandler: CollectHitPolicyHandler,
    private readonly ruleOrderHandler: RuleOrderHitPolicyHandler,
    private readonly outputOrderHandler: OutputOrderHitPolicyHandler,
  ) {
    this.handlers = new Map<HitPolicy, HitPolicyHandler>([
      [HitPolicy.UNIQUE, this.uniqueHandler],
      [HitPolicy.FIRST, this.firstHandler],
      [HitPolicy.PRIORITY, this.priorityHandler],
      [HitPolicy.ANY, this.anyHandler],
      [HitPolicy.COLLECT, this.collectHandler],
      [HitPolicy.RULE_ORDER, this.ruleOrderHandler],
      [HitPolicy.OUTPUT_ORDER, this.outputOrderHandler],
    ]);
  }

  /**
   * 获取Hit Policy处理器
   */
  getHandler(hitPolicy: HitPolicy): HitPolicyHandler {
    const handler = this.handlers.get(hitPolicy);
    if (!handler) {
      throw new Error(`Unknown hit policy: ${hitPolicy}`);
    }
    return handler;
  }

  /**
   * 获取聚合处理器
   */
  getCollectHandler(aggregationType?: AggregationType): CollectHitPolicyHandler {
    return this.collectHandler;
  }
}
