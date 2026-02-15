import { Injectable, Logger } from '@nestjs/common';

import { HitPolicy, AggregationType } from '../entities/dmn-decision.entity';
import {
  HitPolicyHandler,
  HitPolicyResult,
  RuleEvaluationResult,
  RuleExecutionContext,
  ContinueEvaluatingBehavior,
  EvaluateRuleValidityBehavior,
  ComposeRuleResultBehavior,
  ComposeDecisionResultBehavior,
} from '../interfaces/hit-policy.interface';

/**
 * 抽象命中策略基类（与Flowable AbstractHitPolicy对应）
 */
export abstract class AbstractHitPolicy implements 
  ContinueEvaluatingBehavior, 
  ComposeRuleResultBehavior, 
  ComposeDecisionResultBehavior {
  
  protected multipleResults: boolean = false;
  protected readonly logger = new Logger(this.constructor.name);

  constructor();
  constructor(multipleResults: boolean);
  constructor(multipleResults?: boolean) {
    if (multipleResults !== undefined) {
      this.multipleResults = multipleResults;
    }
  }

  /**
   * 获取命中策略名称
   */
  abstract get name(): string;

  /**
   * 获取命中策略类型
   */
  abstract get type(): string;

  /**
   * 处理规则评估结果（默认实现）
   */
  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult {
    // 默认实现，子类可以覆盖
    const matchedResults = results.filter((r) => r.matched);
    
    return {
      hasMatch: matchedResults.length > 0,
      matchedRuleIds: matchedResults.map((r) => r.ruleId),
      output: matchedResults.map((r) => r.outputs),
      needsAggregation: this.multipleResults,
    };
  }

  /**
   * 默认继续评估行为：继续评估所有规则
   */
  shouldContinueEvaluating(ruleResult: boolean): boolean {
    return true;
  }

  /**
   * 默认规则结果组装：添加到规则结果集合
   */
  composeRuleResult(ruleNumber: number, outputName: string, outputValue: any, context: RuleExecutionContext): void {
    context.addRuleResult(ruleNumber, outputName, outputValue);
  }

  /**
   * 默认决策结果组装：将所有规则结果转为决策结果
   */
  composeDecisionResults(context: RuleExecutionContext): void {
    const decisionResults = Array.from(context.getRuleResults().values());
    this.updateStackWithDecisionResults(decisionResults, context);
    
    const auditContainer = context.getAuditContainer();
    auditContainer.decisionResult = decisionResults;
    auditContainer.multipleResults = this.multipleResults;
  }

  /**
   * 更新执行堆栈变量
   */
  updateStackWithDecisionResults(decisionResults: Record<string, any>[], context: RuleExecutionContext): void {
    decisionResults.forEach(result => {
      Object.entries(result).forEach(([key, value]) => {
        context.getStackVariables().set(key, value);
      });
    });
  }
}

/**
 * UNIQUE Hit Policy处理器（与Flowable HitPolicyUnique对应）
 * 只允许匹配一个规则，多个匹配则根据strictMode抛出异常或记录警告
 */
@Injectable()
export class UniqueHitPolicyHandler extends AbstractHitPolicy implements EvaluateRuleValidityBehavior {
  readonly name = 'UNIQUE';
  readonly type = HitPolicy.UNIQUE;

  /**
   * 评估规则有效性
   * 检查是否有多条规则匹配
   */
  evaluateRuleValidity(ruleNumber: number, context: RuleExecutionContext): void {
    const ruleExecutions = context.getAuditContainer().ruleExecutions;
    
    for (const [entryRuleNumber, ruleExecution] of Object.entries(ruleExecutions)) {
      const entryRuleNum = parseInt(entryRuleNumber);
      if (entryRuleNum !== ruleNumber && ruleExecution.isValid) {
        const hitPolicyViolatedMessage = 
          `HitPolicy UNIQUE violated; at least rule ${ruleNumber} and rule ${entryRuleNum} are valid.`;
        
        if (context.isStrictMode()) {
          // 严格模式：抛出异常
          ruleExecutions[ruleNumber].exceptionMessage = hitPolicyViolatedMessage;
          ruleExecutions[entryRuleNum].exceptionMessage = hitPolicyViolatedMessage;
          throw new Error('HitPolicy UNIQUE violated.');
        } else {
          // 非严格模式：记录验证消息
          ruleExecutions[ruleNumber].validationMessage = hitPolicyViolatedMessage;
          ruleExecutions[entryRuleNum].validationMessage = hitPolicyViolatedMessage;
          break;
        }
      }
    }
  }

  /**
   * 组装决策结果
   * 非严格模式下，多条匹配时取最后一个有效结果
   */
  composeDecisionResults(context: RuleExecutionContext): void {
    const ruleResults = Array.from(context.getRuleResults().values());
    let decisionResults: Record<string, any>[];

    if (ruleResults.length > 1 && !context.isStrictMode()) {
      // 非严格模式：合并所有结果，取最后一个有效值
      const lastResult: Record<string, any> = {};
      
      for (const ruleResult of ruleResults) {
        for (const [key, value] of Object.entries(ruleResult)) {
          if (value !== null && value !== undefined) {
            lastResult[key] = value;
          }
        }
      }
      
      context.getAuditContainer().validationMessage = 
        'HitPolicy UNIQUE violated; multiple valid rules. Setting last valid rule result as final result.';
      decisionResults = [lastResult];
    } else {
      decisionResults = ruleResults;
    }

    this.updateStackWithDecisionResults(decisionResults, context);
    context.getAuditContainer().decisionResult = decisionResults;
  }

  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult {
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
 * FIRST Hit Policy处理器（与Flowable HitPolicyFirst对应）
 * 返回第一条匹配的规则，找到后停止评估
 */
@Injectable()
export class FirstHitPolicyHandler extends AbstractHitPolicy {
  readonly name = 'FIRST';
  readonly type = HitPolicy.FIRST;

  /**
   * 找到匹配规则后停止评估
   */
  shouldContinueEvaluating(ruleResult: boolean): boolean {
    return !ruleResult; // 如果规则匹配，停止评估
  }

  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult {
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
 * PRIORITY Hit Policy处理器（与Flowable HitPolicyPriority对应）
 * 按输出优先级返回最高优先级结果
 */
@Injectable()
export class PriorityHitPolicyHandler extends AbstractHitPolicy {
  readonly name = 'PRIORITY';
  readonly type = HitPolicy.PRIORITY;

  composeDecisionResults(context: RuleExecutionContext): void {
    const ruleResults = Array.from(context.getRuleResults().values());
    
    if (ruleResults.length === 0) {
      this.updateStackWithDecisionResults([], context);
      context.getAuditContainer().decisionResult = [];
      return;
    }
    
    // 获取输出值优先级列表
    const outputValues = context.getOutputClauseOutputValues();
    const outputValuesPresent = outputValues && outputValues.length > 0;
    
    if (!outputValuesPresent) {
      const hitPolicyViolatedMessage = 'HitPolicy PRIORITY violated; no output values present';
      
      if (context.isStrictMode()) {
        throw new Error(hitPolicyViolatedMessage);
      } else {
        context.getAuditContainer().validationMessage = 
          `${hitPolicyViolatedMessage}. Setting first valid result as final result.`;
        this.updateStackWithDecisionResults([ruleResults[0]], context);
        context.getAuditContainer().decisionResult = [ruleResults[0]];
        return;
      }
    }
    
    // 按优先级排序，取最高优先级结果
    const sortedResults = this.sortByOutputValues(ruleResults, outputValues!);
    const decisionResults = [sortedResults[0]];
    
    this.updateStackWithDecisionResults(decisionResults, context);
    context.getAuditContainer().decisionResult = decisionResults;
  }

  private sortByOutputValues(
    results: Record<string, any>[], 
    outputValues: any[]
  ): Record<string, any>[] {
    return results.sort((a, b) => {
      const aValue = Object.values(a)[0];
      const bValue = Object.values(b)[0];
      
      const aIndex = outputValues.indexOf(aValue);
      const bIndex = outputValues.indexOf(bValue);
      
      return aIndex - bIndex;
    });
  }

  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult {
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
 * ANY Hit Policy处理器（与Flowable HitPolicyAny对应）
 * 允许多条匹配，但所有输出必须相同
 */
@Injectable()
export class AnyHitPolicyHandler extends AbstractHitPolicy {
  readonly name = 'ANY';
  readonly type = HitPolicy.ANY;

  composeDecisionResults(context: RuleExecutionContext): void {
    const ruleResults = context.getRuleResults();
    let validationFailed = false;
    
    // 检查所有匹配规则的输出是否相同
    const ruleResultsArray = Array.from(ruleResults.entries());
    
    for (let i = 0; i < ruleResultsArray.length; i++) {
      for (let j = i + 1; j < ruleResultsArray.length; j++) {
        const [ruleNumber1, outputValues1] = ruleResultsArray[i];
        const [ruleNumber2, outputValues2] = ruleResultsArray[j];
        
        // 比较输出值
        for (const [outputName, value1] of Object.entries(outputValues1)) {
          const value2 = outputValues2[outputName];
          
          if (value1 !== value2) {
            const hitPolicyViolatedMessage = 
              `HitPolicy ANY violated; both rule ${ruleNumber1} and ${ruleNumber2} are valid but output ${outputName} has different values.`;
            
            if (context.isStrictMode()) {
              context.getAuditContainer().ruleExecutions[ruleNumber1].exceptionMessage = hitPolicyViolatedMessage;
              context.getAuditContainer().ruleExecutions[ruleNumber2].exceptionMessage = hitPolicyViolatedMessage;
              throw new Error('HitPolicy ANY violated.');
            } else {
              context.getAuditContainer().ruleExecutions[ruleNumber1].validationMessage = hitPolicyViolatedMessage;
              context.getAuditContainer().ruleExecutions[ruleNumber2].validationMessage = hitPolicyViolatedMessage;
              validationFailed = true;
            }
          }
        }
      }
    }
    
    // 非严格模式下，取最后一个有效结果
    if (!context.isStrictMode() && validationFailed) {
      context.getAuditContainer().validationMessage = 
        'HitPolicy ANY violated; multiple valid rules with different outcomes. Setting last valid rule result as final result.';
    }
    
    const decisionResults = [ruleResultsArray[ruleResultsArray.length - 1]?.[1] || {}];
    this.updateStackWithDecisionResults(decisionResults, context);
    context.getAuditContainer().decisionResult = decisionResults;
  }

  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult {
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
 * COLLECT Hit Policy处理器（与Flowable HitPolicyCollect对应）
 * 收集所有匹配规则的输出，支持聚合器
 */
@Injectable()
export class CollectHitPolicyHandler extends AbstractHitPolicy {
  readonly name = 'COLLECT';
  readonly type = HitPolicy.COLLECT;

  constructor(private readonly aggregationType?: AggregationType) {
    super(true); // 多结果模式
  }

  composeDecisionResults(context: RuleExecutionContext): void {
    const decisionResults: Record<string, any>[] = [];
    const ruleResults = context.getRuleResults();
    
    if (ruleResults && ruleResults.size > 0) {
      const aggregator = context.getAggregator();
      
      if (aggregator === null || aggregator === undefined) {
        // 无聚合器：返回所有匹配结果
        decisionResults.push(...Array.from(ruleResults.values()));
      } else {
        // 有聚合器：执行聚合计算
        const outputValuesEntry = this.composeOutputValues(context);
        
        if (outputValuesEntry) {
          const [outputName, values] = outputValuesEntry;
          let aggregatedValue: number;
          
          switch (aggregator) {
            case 'SUM':
              aggregatedValue = this.aggregateSum(values);
              break;
            case 'MIN':
              aggregatedValue = this.aggregateMin(values);
              break;
            case 'MAX':
              aggregatedValue = this.aggregateMax(values);
              break;
            case 'COUNT':
              aggregatedValue = this.aggregateCount(values);
              break;
            default:
              throw new Error(`Unknown aggregator: ${aggregator}`);
          }
          
          decisionResults.push({ [outputName]: aggregatedValue });
        }
      }
    }

    this.updateStackWithDecisionResults(decisionResults, context);
    
    context.getAuditContainer().decisionResult = decisionResults;
    // 无聚合器时返回多个结果
    context.getAuditContainer().multipleResults = 
      (context.getAggregator() === null || context.getAggregator() === undefined);
  }

  /**
   * 组装输出值列表
   */
  private composeOutputValues(context: RuleExecutionContext): [string, number[]] | null {
    let ruleResults = Array.from(context.getRuleResults().values());
    
    if (context.isForceDMN11()) {
      // DMN 1.1模式：去重
      const uniqueResults = new Set(ruleResults.map(r => JSON.stringify(r)));
      ruleResults = Array.from(uniqueResults).map(s => JSON.parse(s));
    }
    
    return this.createOutputDoubleValues(ruleResults);
  }

  /**
   * 创建输出数值列表
   */
  private createOutputDoubleValues(ruleResults: Record<string, any>[]): [string, number[]] | null {
    const distinctOutputValues: Map<string, number[]> = new Map();
    
    for (const ruleResult of ruleResults) {
      for (const [key, value] of Object.entries(ruleResult)) {
        if (!distinctOutputValues.has(key)) {
          distinctOutputValues.set(key, []);
        }
        distinctOutputValues.get(key)!.push(value as number);
      }
    }
    
    // 返回第一个输出子句的值
    if (distinctOutputValues.size > 0) {
      const firstEntry = distinctOutputValues.entries().next().value;
      return [firstEntry[0], firstEntry[1]];
    }
    
    return null;
  }

  private aggregateSum(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0);
  }

  private aggregateMin(values: number[]): number {
    return Math.min(...values);
  }

  private aggregateMax(values: number[]): number {
    return Math.max(...values);
  }

  private aggregateCount(values: number[]): number {
    return values.length;
  }

  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult {
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
 * RULE ORDER Hit Policy处理器（与Flowable HitPolicyRuleOrder对应）
 * 按规则顺序返回所有匹配结果
 */
@Injectable()
export class RuleOrderHitPolicyHandler extends AbstractHitPolicy {
  readonly name = 'RULE ORDER';
  readonly type = HitPolicy.RULE_ORDER;

  constructor() {
    super(true); // 多结果模式
  }

  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult {
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
 * OUTPUT ORDER Hit Policy处理器（与Flowable HitPolicyOutputOrder对应）
 * 按输出值优先级排序返回所有匹配结果
 */
@Injectable()
export class OutputOrderHitPolicyHandler extends AbstractHitPolicy {
  readonly name = 'OUTPUT ORDER';
  readonly type = HitPolicy.OUTPUT_ORDER;

  constructor() {
    super(true); // 多结果模式
  }

  composeDecisionResults(context: RuleExecutionContext): void {
    const decisionResults: Record<string, any>[] = [];
    const ruleResults = Array.from(context.getRuleResults().values());
    
    if (ruleResults.length > 0) {
      // 获取输出值优先级列表
      const outputValues = context.getOutputClauseOutputValues();
      const outputValuesPresent = outputValues && outputValues.length > 0;
      
      if (!outputValuesPresent) {
        const hitPolicyViolatedMessage = 'HitPolicy OUTPUT ORDER violated; no output values present';
        
        if (context.isStrictMode()) {
          throw new Error(hitPolicyViolatedMessage);
        } else {
          context.getAuditContainer().validationMessage = 
            `${hitPolicyViolatedMessage}. Setting first valid result as final result.`;
          decisionResults.push(...ruleResults);
        }
      } else {
        // 按输出值优先级排序
        const sortedResults = this.sortByOutputValues(ruleResults, outputValues!);
        decisionResults.push(...sortedResults);
      }
    }

    this.updateStackWithDecisionResults(decisionResults, context);
    context.getAuditContainer().decisionResult = decisionResults;
  }

  /**
   * 按输出值优先级排序
   */
  private sortByOutputValues(
    results: Record<string, any>[], 
    outputValues: any[]
  ): Record<string, any>[] {
    return results.sort((a, b) => {
      const aValue = Object.values(a)[0];
      const bValue = Object.values(b)[0];
      
      const aIndex = outputValues.indexOf(aValue);
      const bIndex = outputValues.indexOf(bValue);
      
      // 优先级高的（索引小的）排在前面
      return aIndex - bIndex;
    });
  }

  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult {
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
 * UNORDERED Hit Policy处理器（与Flowable HitPolicyUnordered对应）
 * 返回所有匹配结果，无特定顺序
 */
@Injectable()
export class UnorderedHitPolicyHandler extends AbstractHitPolicy {
  readonly name = 'UNORDERED';
  readonly type = HitPolicy.UNORDERED;

  constructor() {
    super(true); // 多结果模式
  }

  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult {
    const matchedResults = results.filter((r) => r.matched);

    if (matchedResults.length === 0) {
      return {
        hasMatch: false,
        matchedRuleIds: [],
        output: [],
        needsAggregation: true,
      };
    }

    // 不排序，直接返回
    return {
      hasMatch: true,
      matchedRuleIds: matchedResults.map((r) => r.ruleId),
      output: matchedResults.map((r) => r.outputs),
      needsAggregation: true,
    };
  }
}

/**
 * Hit Policy处理器工厂（与Flowable对应）
 */
@Injectable()
export class HitPolicyHandlerFactory {
  private readonly handlers: Map<HitPolicy, HitPolicyHandler>;
  private readonly logger = new Logger(HitPolicyHandlerFactory.name);

  constructor(
    private readonly uniqueHandler: UniqueHitPolicyHandler,
    private readonly firstHandler: FirstHitPolicyHandler,
    private readonly priorityHandler: PriorityHitPolicyHandler,
    private readonly anyHandler: AnyHitPolicyHandler,
    private readonly collectHandler: CollectHitPolicyHandler,
    private readonly ruleOrderHandler: RuleOrderHitPolicyHandler,
    private readonly outputOrderHandler: OutputOrderHitPolicyHandler,
    private readonly unorderedHandler: UnorderedHitPolicyHandler,
  ) {
    this.handlers = new Map<HitPolicy, HitPolicyHandler>([
      [HitPolicy.UNIQUE, this.uniqueHandler],
      [HitPolicy.FIRST, this.firstHandler],
      [HitPolicy.PRIORITY, this.priorityHandler],
      [HitPolicy.ANY, this.anyHandler],
      [HitPolicy.COLLECT, this.collectHandler],
      [HitPolicy.RULE_ORDER, this.ruleOrderHandler],
      [HitPolicy.OUTPUT_ORDER, this.outputOrderHandler],
      [HitPolicy.UNORDERED, this.unorderedHandler],
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

  /**
   * 检查是否为继续评估行为
   */
  isContinueEvaluatingBehavior(handler: HitPolicyHandler): handler is ContinueEvaluatingBehavior {
    return 'shouldContinueEvaluating' in handler;
  }

  /**
   * 检查是否为评估规则有效性行为
   */
  isEvaluateRuleValidityBehavior(handler: HitPolicyHandler): handler is EvaluateRuleValidityBehavior {
    return 'evaluateRuleValidity' in handler;
  }

  /**
   * 检查是否为组装规则结果行为
   */
  isComposeRuleResultBehavior(handler: HitPolicyHandler): handler is ComposeRuleResultBehavior {
    return 'composeRuleResult' in handler;
  }

  /**
   * 检查是否为组装决策结果行为
   */
  isComposeDecisionResultBehavior(handler: HitPolicyHandler): handler is ComposeDecisionResultBehavior {
    return 'composeDecisionResults' in handler;
  }
}
