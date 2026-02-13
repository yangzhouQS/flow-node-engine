import { DecisionRuleDto } from '../dto/dmn.dto';

/**
 * 规则评估结果
 */
export interface RuleEvaluationResult {
  /** 规则ID */
  ruleId: string;
  /** 规则索引 */
  ruleIndex: number;
  /** 是否匹配 */
  matched: boolean;
  /** 规则输出 */
  outputs: Record<string, any>;
  /** 规则优先级 */
  priority?: number;
}

/**
 * Hit Policy处理器接口
 */
export interface HitPolicyHandler {
  /** Hit Policy名称 */
  readonly name: string;

  /** Hit Policy类型 */
  readonly type: string;

  /**
   * 处理规则评估结果
   * @param results 所有规则的评估结果
   * @returns 最终输出结果
   */
  handle(results: RuleEvaluationResult[]): HitPolicyResult;
}

/**
 * Hit Policy处理结果
 */
export interface HitPolicyResult {
  /** 是否有匹配的规则 */
  hasMatch: boolean;

  /** 匹配的规则ID列表 */
  matchedRuleIds: string[];

  /** 输出结果（单个或数组） */
  output: Record<string, any> | Record<string, any>[];

  /** 是否需要聚合 */
  needsAggregation: boolean;
}

/**
 * 条件评估器接口
 */
export interface ConditionEvaluator {
  /**
   * 评估条件
   * @param inputValue 输入值
   * @param operator 操作符
   * @param conditionValue 条件值
   * @returns 是否满足条件
   */
  evaluate(inputValue: any, operator: string, conditionValue: any): boolean;
}

/**
 * 规则定义接口
 */
export interface RuleDefinition {
  /** 规则ID */
  id: string;
  /** 规则条件 */
  conditions: RuleCondition[];
  /** 规则输出 */
  outputs: RuleOutput[];
  /** 规则优先级 */
  priority?: number;
  /** 规则描述 */
  description?: string;
}

/**
 * 规则条件
 */
export interface RuleCondition {
  /** 输入ID */
  inputId: string;
  /** 操作符 */
  operator: string;
  /** 条件值 */
  value: any;
}

/**
 * 规则输出
 */
export interface RuleOutput {
  /** 输出ID */
  outputId: string;
  /** 输出值 */
  value: any;
}

/**
 * 决策表定义接口
 */
export interface DecisionTableDefinition {
  /** 决策ID */
  id: string;
  /** 决策Key */
  key: string;
  /** 决策名称 */
  name?: string;
  /** Hit Policy */
  hitPolicy: string;
  /** 聚合类型 */
  aggregation?: string;
  /** 输入定义 */
  inputs: DecisionInputDefinition[];
  /** 输出定义 */
  outputs: DecisionOutputDefinition[];
  /** 规则列表 */
  rules: RuleDefinition[];
}

/**
 * 决策输入定义
 */
export interface DecisionInputDefinition {
  /** 输入ID */
  id: string;
  /** 输入标签 */
  label: string;
  /** 输入表达式 */
  expression: string;
  /** 输入类型 */
  type?: string;
  /** 是否必填 */
  required?: boolean;
}

/**
 * 决策输出定义
 */
export interface DecisionOutputDefinition {
  /** 输出ID */
  id: string;
  /** 输出标签 */
  label: string;
  /** 输出名称 */
  name: string;
  /** 输出类型 */
  type?: string;
  /** 默认值 */
  defaultValue?: any;
}
