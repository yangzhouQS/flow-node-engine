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
 * 规则执行审计信息
 */
export interface RuleExecutionAudit {
  /** 规则编号 */
  ruleNumber: number;
  /** 规则ID */
  ruleId: string;
  /** 规则索引 */
  ruleIndex: number;
  /** 是否匹配 */
  matched: boolean;
  /** 是否有效 */
  isValid?: boolean;
  /** 输入条目审计 */
  inputEntries: InputEntryAudit[];
  /** 输出条目审计 */
  outputEntries: OutputEntryAudit[];
  /** 异常消息 */
  exceptionMessage?: string;
  /** 验证消息 */
  validationMessage?: string;
}

/**
 * 输入条目审计
 */
export interface InputEntryAudit {
  /** 条目ID */
  id: string;
  /** 输入ID */
  inputId?: string;
  /** 输入名称 */
  inputName?: string;
  /** 输入值 */
  inputValue?: any;
  /** 操作符 */
  operator?: string;
  /** 条件值 */
  conditionValue?: any;
  /** 表达式 */
  expression?: string;
  /** 条件文本 */
  conditionText?: string;
  /** 评估结果 */
  result?: boolean | string;
  /** 是否匹配 */
  matched?: boolean;
}

/**
 * 输出条目审计
 */
export interface OutputEntryAudit {
  /** 条目ID */
  id: string;
  /** 输出ID */
  outputId?: string;
  /** 输出名称 */
  outputName?: string;
  /** 输出值 */
  outputValue?: any;
  /** 表达式 */
  expression?: string;
  /** 输出结果 */
  result?: any;
}

/**
 * 决策执行审计容器（与Flowable DecisionExecutionAuditContainer对应）
 */
export interface DecisionExecutionAuditContainer {
  /** 决策ID */
  decisionId: string;
  /** 决策名称 */
  decisionName?: string;
  /** 决策Key */
  decisionKey: string;
  /** 决策版本 */
  decisionVersion?: number;
  /** Hit Policy */
  hitPolicy?: string;
  /** 聚合类型 */
  aggregation?: string;
  /** 严格模式 */
  strictMode: boolean;
  /** 是否强制DMN1.1 */
  forceDMN11: boolean;
  /** 开始时间 */
  startTime?: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 是否失败 */
  failed?: boolean;
  /** 异常消息 */
  exceptionMessage?: string;
  /** 验证消息 */
  validationMessage?: string;
  /** 输入变量 */
  inputVariables?: Record<string, any>;
  /** 输入变量类型 */
  inputVariableTypes?: Record<string, string>;
  /** 决策结果 */
  decisionResult?: Record<string, any>[];
  /** 决策结果类型 */
  decisionResultTypes?: Record<string, string>;
  /** 规则执行审计 */
  ruleExecutions: RuleExecutionAudit[];
  /** 是否多结果 */
  multipleResults?: boolean;
  /** 输入子句 */
  inputClauses?: InputClauseAudit[];
  /** 输出子句 */
  outputClauses?: OutputClauseAudit[];
}

/**
 * 输入子句审计
 */
export interface InputClauseAudit {
  /** ID */
  id: string;
  /** 标签 */
  label?: string;
  /** 表达式 */
  expression: string;
  /** 类型引用 */
  typeRef?: string;
}

/**
 * 输出子句审计
 */
export interface OutputClauseAudit {
  /** ID */
  id: string;
  /** 标签 */
  label?: string;
  /** 名称 */
  name: string;
  /** 类型引用 */
  typeRef?: string;
  /** 输出值列表（用于PRIORITY/OUTPUT ORDER） */
  outputValues?: any[];
}

/**
 * 规则执行上下文（与Flowable ELExecutionContext对应）
 */
export interface RuleExecutionContext {
  /** 决策定义 */
  decision?: any;
  /** 决策表定义 */
  decisionTable?: DecisionTableDefinition;
  /** 输入变量 */
  variables?: Map<string, any>;
  /** 输入数据 */
  inputData?: Record<string, any>;
  /** 堆栈变量 */
  stackVariables?: Map<string, any>;
  /** 审计容器 */
  auditContainer: DecisionExecutionAuditContainer;
  /** 规则结果 */
  ruleResults?: Map<number, Record<string, any>>;
  /** 聚合器 */
  aggregator?: string | null;
  /** 严格模式 */
  strictMode: boolean;
  /** 强制DMN1.1 */
  forceDMN11: boolean;
  /** 输出子句输出值 */
  outputClauseOutputValues?: any[] | null;
  /** Hit Policy处理器 */
  handler?: HitPolicyHandler;
  
  /** 添加规则结果 */
  addRuleResult?(ruleNumber: number, outputName: string, outputValue: any): void;
  /** 获取规则结果 */
  getRuleResults?(): Map<number, Record<string, any>>;
  /** 获取堆栈变量 */
  getStackVariables?(): Map<string, any>;
  /** 获取审计容器 */
  getAuditContainer?(): DecisionExecutionAuditContainer;
  /** 获取聚合器 */
  getAggregator?(): string | null;
  /** 是否严格模式 */
  isStrictMode?(): boolean;
  /** 是否强制DMN1.1 */
  isForceDMN11?(): boolean;
  /** 获取输出子句输出值 */
  getOutputClauseOutputValues?(): any[] | null;
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
   * @param context 执行上下文
   * @returns 最终输出结果
   */
  handle(results: RuleEvaluationResult[], context?: RuleExecutionContext): HitPolicyResult;
}

/**
 * 继续评估结果
 */
export interface ContinueEvaluatingResult {
  shouldContinue: boolean;
  reason?: string;
}

/**
 * 规则有效性结果
 */
export interface RuleValidityResult {
  valid: boolean;
  errorMessage?: string;
}

/**
 * 继续评估行为接口（与Flowable ContinueEvaluatingBehavior对应）
 * 控制找到匹配规则后是否继续评估后续规则
 */
export interface ContinueEvaluatingBehavior extends HitPolicyHandler {
  /**
   * 判断是否继续评估
   * @param ruleResult 当前规则是否匹配
   * @returns 继续评估结果
   */
  shouldContinueEvaluating(ruleResult: boolean): ContinueEvaluatingResult;
}

/**
 * 评估规则有效性行为接口（与Flowable EvaluateRuleValidityBehavior对应）
 * 用于UNIQUE等需要验证规则唯一性的策略
 */
export interface EvaluateRuleValidityBehavior extends HitPolicyHandler {
  /**
   * 评估规则有效性
   * @param matchedResults 匹配的规则结果列表
   * @param strictMode 是否严格模式
   * @returns 有效性结果
   */
  evaluateRuleValidity(matchedResults: RuleEvaluationResult[], strictMode: boolean): RuleValidityResult;
}

/**
 * 组装规则结果行为接口（与Flowable ComposeRuleResultBehavior对应）
 * 处理单个规则的输出结果
 */
export interface ComposeRuleResultBehavior extends HitPolicyHandler {
  /**
   * 组装规则结果
   * @param ruleNumber 规则编号
   * @param outputName 输出名称
   * @param outputValue 输出值
   * @param context 执行上下文
   */
  composeRuleResult(ruleNumber: number, outputName: string, outputValue: any, context: RuleExecutionContext): void;
}

/**
 * 组装决策结果行为接口（与Flowable ComposeDecisionResultBehavior对应）
 * 处理最终决策结果的组装
 */
export interface ComposeDecisionResultBehavior extends HitPolicyHandler {
  /**
   * 组装决策结果
   * @param context 执行上下文
   * @returns 决策结果
   */
  composeDecisionResults(context: RuleExecutionContext): Record<string, any> | Record<string, any>[];
  
  /**
   * 更新堆栈变量
   * @param decisionResults 决策结果
   * @param context 执行上下文
   */
  updateStackWithDecisionResults(decisionResults: Record<string, any>[], context: RuleExecutionContext): void;
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
  
  /** 是否多结果 */
  multipleResults?: boolean;
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
  /** 输出值列表（用于PRIORITY/OUTPUT ORDER） */
  outputValues?: any[];
}
