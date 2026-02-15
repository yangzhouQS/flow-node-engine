/**
 * 补偿事件接口定义
 * 基于BPMN 2.0规范和Flowable补偿机制设计
 * 支持补偿边界事件和补偿中间抛出事件
 */

/**
 * 补偿事件类型
 */
export enum CompensationEventType {
  /** 补偿边界事件 */
  BOUNDARY = 'boundary',
  /** 补偿中间抛出事件 */
  INTERMEDIATE_THROW = 'intermediate_throw',
  /** 补偿开始事件（事件子流程） */
  START = 'start',
  /** 补偿结束事件 */
  END = 'end',
}

/**
 * 补偿状态
 */
export enum CompensationState {
  /** 待补偿 */
  PENDING = 'pending',
  /** 补偿中 */
  COMPENSATING = 'compensating',
  /** 已补偿 */
  COMPENSATED = 'compensated',
  /** 补偿失败 */
  FAILED = 'failed',
  /** 跳过补偿 */
  SKIPPED = 'skipped',
}

/**
 * 补偿处理器配置
 */
export interface CompensationHandlerConfig {
  /** 处理器ID */
  id: string;
  /** 处理器名称 */
  name?: string;
  /** 关联的活动ID */
  activityId: string;
  /** 活动名称 */
  activityName?: string;
  /** 活动类型 */
  activityType: string;
  /** 是否异步执行 */
  async?: boolean;
  /** 重试次数 */
  retryCount?: number;
  /** 重试间隔（毫秒） */
  retryInterval?: number;
  /** 扩展属性 */
  extensionElements?: Record<string, any>;
}

/**
 * 补偿事件配置
 */
export interface CompensationEventConfig {
  /** 事件ID */
  id: string;
  /** 事件名称 */
  name?: string;
  /** 事件类型 */
  eventType: CompensationEventType;
  /** 关联的活动ID（边界事件） */
  attachedToActivityId?: string;
  /** 补偿处理器的活动引用 */
  activityRef?: string;
  /** 是否中断 */
  cancelActivity?: boolean;
  /** 扩展属性 */
  extensionElements?: Record<string, any>;
}

/**
 * 补偿上下文
 */
export interface CompensationContext {
  /** 补偿执行ID */
  compensationExecutionId: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 执行ID */
  executionId?: string;
  /** 流程定义Key */
  processDefinitionKey?: string;
  /** 活动ID */
  activityId?: string;
  /** 触发补偿的活动ID */
  triggerActivityId?: string;
  /** 补偿作用域ID */
  scopeId?: string;
  /** 补偿事件配置 */
  eventConfig: CompensationEventConfig;
  /** 流程变量 */
  variables: Record<string, any>;
  /** 本地变量 */
  localVariables?: Record<string, any>;
  /** 补偿索引（用于多次补偿） */
  compensationIndex?: number;
  /** 补偿时间 */
  timestamp: Date;
}

/**
 * 补偿执行记录
 * 记录已完成的活动，用于补偿时回滚
 */
export interface CompensationExecutionRecord {
  /** 记录ID */
  id: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 执行ID */
  executionId: string;
  /** 活动ID */
  activityId: string;
  /** 活动名称 */
  activityName?: string;
  /** 活动类型 */
  activityType: string;
  /** 补偿处理器配置 */
  handlerConfig?: CompensationHandlerConfig;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime: Date;
  /** 状态 */
  state: CompensationState;
  /** 执行时的变量快照 */
  variableSnapshot?: Record<string, any>;
  /** 补偿作用域ID */
  scopeId?: string;
  /** 父作用域ID */
  parentScopeId?: string;
  /** 嵌套深度 */
  depth?: number;
}

/**
 * 补偿结果
 */
export interface CompensationResult {
  /** 是否成功 */
  success: boolean;
  /** 补偿执行ID */
  compensationExecutionId: string;
  /** 补偿的活动ID */
  compensatedActivityId: string;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  executionTime?: number;
  /** 修改的变量 */
  modifiedVariables?: Record<string, any>;
}

/**
 * 补偿处理结果
 */
export interface CompensationHandlerResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 修改的变量 */
  modifiedVariables?: Record<string, any>;
  /** 是否需要重试 */
  retry?: boolean;
}

/**
 * 补偿处理器接口
 */
export interface ICompensationHandler {
  /**
   * 执行补偿
   * @param context 补偿上下文
   * @returns 补偿结果
   */
  compensate(context: CompensationContext): Promise<CompensationHandlerResult> | CompensationHandlerResult;

  /**
   * 获取处理器配置
   */
  getConfig(): CompensationHandlerConfig;
}

/**
 * 补偿事件处理器接口
 */
export interface ICompensationEventHandler {
  /**
   * 处理补偿事件
   * @param context 补偿上下文
   * @returns 补偿结果
   */
  handle(context: CompensationContext): Promise<CompensationResult>;

  /**
   * 判断是否支持该事件类型
   * @param eventType 事件类型
   */
  supports(eventType: CompensationEventType): boolean;
}

/**
 * 补偿作用域
 * 用于管理嵌套的补偿
 */
export interface CompensationScope {
  /** 作用域ID */
  scopeId: string;
  /** 父作用域ID */
  parentScopeId?: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 关联的活动ID */
  activityId?: string;
  /** 作用域内的补偿记录 */
  compensationRecords: CompensationExecutionRecord[];
  /** 子作用域 */
  childScopes: CompensationScope[];
  /** 嵌套深度 */
  depth: number;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 补偿执行计划
 */
export interface CompensationPlan {
  /** 计划ID */
  planId: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 触发源 */
  triggerSource: string;
  /** 补偿执行顺序 */
  executionOrder: CompensationExecutionRecord[];
  /** 并行补偿组 */
  parallelGroups?: CompensationExecutionRecord[][];
  /** 是否并行执行 */
  parallel?: boolean;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 补偿事件载荷
 */
export interface CompensationEventPayload {
  /** 事件类型 */
  type: CompensationEventType;
  /** 流程实例ID */
  processInstanceId: string;
  /** 执行ID */
  executionId?: string;
  /** 补偿目标活动ID */
  targetActivityId?: string;
  /** 补偿作用域 */
  scope?: CompensationScope;
  /** 变量 */
  variables?: Record<string, any>;
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 补偿事件订阅
 */
export interface CompensationEventSubscription {
  /** 订阅ID */
  subscriptionId: string;
  /** 事件类型 */
  eventType: CompensationEventType;
  /** 活动ID */
  activityId: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 执行ID */
  executionId: string;
  /** 处理器配置 */
  handlerConfig: CompensationHandlerConfig;
  /** 创建时间 */
  createdAt: Date;
  /** 是否已处理 */
  processed?: boolean;
}

/**
 * 补偿注册表
 * 管理流程实例的补偿处理器
 */
export interface CompensationRegistry {
  /** 流程实例ID */
  processInstanceId: string;
  /** 补偿处理器映射 */
  handlers: Map<string, ICompensationHandler>;
  /** 执行记录 */
  executionRecords: CompensationExecutionRecord[];
  /** 作用域 */
  scopes: Map<string, CompensationScope>;
  /** 事件订阅 */
  subscriptions: CompensationEventSubscription[];
}

/**
 * 补偿服务配置
 */
export interface CompensationServiceConfig {
  /** 是否启用异步补偿 */
  enableAsync?: boolean;
  /** 默认重试次数 */
  defaultRetryCount?: number;
  /** 默认重试间隔（毫秒） */
  defaultRetryInterval?: number;
  /** 最大补偿深度 */
  maxCompensationDepth?: number;
  /** 补偿超时时间（毫秒） */
  compensationTimeout?: number;
}

/**
 * 补偿统计信息
 */
export interface CompensationStatistics {
  /** 总补偿次数 */
  totalCompensations: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 按活动类型统计 */
  byActivityType: Record<string, {
    count: number;
    successCount: number;
    failureCount: number;
    averageTime: number;
  }>;
}
