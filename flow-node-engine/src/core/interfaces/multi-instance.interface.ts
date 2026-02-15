/**
 * 多实例（Multi-Instance）接口定义
 * 支持BPMN 2.0规范中的顺序和并行多实例
 */

/**
 * 多实例类型
 */
export enum MultiInstanceType {
  /** 顺序执行 - 一个接一个 */
  SEQUENTIAL = 'sequential',
  /** 并行执行 - 同时执行 */
  PARALLEL = 'parallel',
}

/**
 * 多实例状态
 */
export enum MultiInstanceState {
  /** 待开始 */
  PENDING = 'pending',
  /** 进行中 */
  IN_PROGRESS = 'in_progress',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 已取消 */
  CANCELLED = 'cancelled',
  /** 失败 */
  FAILED = 'failed',
}

/**
 * 单个实例的执行状态
 */
export enum InstanceExecutionState {
  /** 待执行 */
  PENDING = 'pending',
  /** 执行中 */
  RUNNING = 'running',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 已跳过 */
  SKIPPED = 'skipped',
  /** 失败 */
  FAILED = 'failed',
}

/**
 * 多实例配置
 */
export interface MultiInstanceConfig {
  /** 唯一标识 */
  id: string;
  /** 多实例类型 */
  type: MultiInstanceType;
  /** 输入集合变量名 */
  collection: string;
  /** 元素变量名 - 每次迭代时的当前元素 */
  elementVariable: string;
  /** 输出集合变量名 */
  outputCollection?: string;
  /** 完成条件表达式 */
  completionCondition?: string;
  /** 基数（固定实例数量） */
  cardinality?: number;
  /** 是否在完成前收集所有输出 */
  collectAllOutputs?: boolean;
  /** 异常处理策略 */
  exceptionHandlingStrategy?: ExceptionHandlingStrategy;
}

/**
 * 异常处理策略
 */
export enum ExceptionHandlingStrategy {
  /** 默认 - 一个失败全部失败 */
  DEFAULT = 'default',
  /** 继续执行 - 忽略失败 */
  CONTINUE = 'continue',
  /** 补偿 - 失败时补偿已完成的 */
  COMPENSATE = 'compensate',
}

/**
 * 单个实例执行上下文
 */
export interface InstanceExecutionContext {
  /** 实例ID */
  instanceId: string;
  /** 多实例活动ID */
  activityId: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 执行ID */
  executionId: string;
  /** 当前索引（从0开始） */
  index: number;
  /** 总实例数 */
  totalInstances: number;
  /** 当前元素值 */
  currentElement: any;
  /** 元素变量名 */
  elementVariable: string;
  /** 局部变量 */
  localVariables: Record<string, any>;
  /** 创建时间 */
  createdAt: Date;
  /** 状态 */
  state: InstanceExecutionState;
  /** 输出结果 */
  output?: any;
  /** 错误信息 */
  error?: string;
}

/**
 * 多实例执行状态
 */
export interface MultiInstanceExecutionState {
  /** 多实例ID */
  id: string;
  /** 活动ID */
  activityId: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 配置 */
  config: MultiInstanceConfig;
  /** 整体状态 */
  state: MultiInstanceState;
  /** 实例总数 */
  totalInstances: number;
  /** 已完成实例数 */
  completedInstances: number;
  /** 活跃实例数 */
  activeInstances: number;
  /** 失败实例数 */
  failedInstances: number;
  /** 各实例执行上下文 */
  instances: InstanceExecutionContext[];
  /** 输入集合 */
  inputCollection: any[];
  /** 输出集合 */
  outputCollection: any[];
  /** 创建时间 */
  createdAt: Date;
  /** 开始时间 */
  startedAt?: Date;
  /** 完成时间 */
  completedAt?: Date;
  /** 完成原因 */
  completionReason?: string;
}

/**
 * 多实例执行结果
 */
export interface MultiInstanceResult {
  /** 是否成功 */
  success: boolean;
  /** 多实例ID */
  multiInstanceId: string;
  /** 活动ID */
  activityId: string;
  /** 完成的实例数 */
  completedCount: number;
  /** 总实例数 */
  totalCount: number;
  /** 输出集合 */
  outputs: any[];
  /** 失败的实例 */
  failedInstances?: InstanceExecutionContext[];
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  executionTime?: number;
}

/**
 * 完成条件评估结果
 */
export interface CompletionConditionResult {
  /** 是否满足完成条件 */
  isComplete: boolean;
  /** 评估的表达式 */
  expression?: string;
  /** 评估结果详情 */
  evaluationDetails?: Record<string, any>;
}

/**
 * 多实例变量处理配置
 */
export interface MultiInstanceVariableConfig {
  /** 输入集合变量名 */
  inputCollection: string;
  /** 输出集合变量名 */
  outputCollection?: string;
  /** 元素变量名 */
  elementVariable: string;
  /** 索引变量名（可选） */
  indexVariable?: string;
  /** 实例数量变量名（可选） */
  nrOfInstancesVariable?: string;
  /** 已完成实例数变量名（可选） */
  nrOfCompletedInstancesVariable?: string;
  /** 活跃实例数变量名（可选） */
  nrOfActiveInstancesVariable?: string;
}

/**
 * 多实例内置变量名
 */
export const MULTI_INSTANCE_BUILTIN_VARIABLES = {
  /** 实例总数 */
  NR_OF_INSTANCES: 'nrOfInstances',
  /** 已完成实例数 */
  NR_OF_COMPLETED_INSTANCES: 'nrOfCompletedInstances',
  /** 活跃实例数 */
  NR_OF_ACTIVE_INSTANCES: 'nrOfActiveInstances',
  /** 循环计数器（索引） */
  LOOP_COUNTER: 'loopCounter',
} as const;

/**
 * 多实例执行器接口
 */
export interface IMultiInstanceExecutor {
  /**
   * 初始化多实例执行
   */
  initialize(
    processInstanceId: string,
    activityId: string,
    config: MultiInstanceConfig,
    variables: Record<string, any>,
  ): Promise<MultiInstanceExecutionState>;

  /**
   * 获取下一个待执行的实例
   */
  getNextInstance(state: MultiInstanceExecutionState): InstanceExecutionContext | null;

  /**
   * 标记实例开始执行
   */
  startInstance(
    state: MultiInstanceExecutionState,
    instanceId: string,
  ): Promise<void>;

  /**
   * 标记实例完成
   */
  completeInstance(
    state: MultiInstanceExecutionState,
    instanceId: string,
    output?: any,
  ): Promise<MultiInstanceResult>;

  /**
   * 标记实例失败
   */
  failInstance(
    state: MultiInstanceExecutionState,
    instanceId: string,
    error: string,
  ): Promise<MultiInstanceResult>;

  /**
   * 评估完成条件
   */
  evaluateCompletionCondition(
    state: MultiInstanceExecutionState,
    variables: Record<string, any>,
  ): Promise<CompletionConditionResult>;

  /**
   * 检查是否所有实例都已完成
   */
  isAllCompleted(state: MultiInstanceExecutionState): boolean;

  /**
   * 获取输出集合
   */
  getOutputCollection(state: MultiInstanceExecutionState): any[];
}

/**
 * 多实例服务配置
 */
export interface MultiInstanceServiceConfig {
  /** 最大并行实例数（0表示无限制） */
  maxParallelInstances?: number;
  /** 实例执行超时时间（毫秒） */
  instanceTimeout?: number;
  /** 是否启用重试 */
  enableRetry?: boolean;
  /** 重试次数 */
  retryCount?: number;
  /** 重试间隔（毫秒） */
  retryInterval?: number;
}

/**
 * 多实例统计信息
 */
export interface MultiInstanceStatistics {
  /** 总执行次数 */
  totalExecutions: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均实例数 */
  averageInstanceCount: number;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 按类型统计 */
  byType: {
    sequential: TypeStatistics;
    parallel: TypeStatistics;
  };
}

/**
 * 类型统计
 */
export interface TypeStatistics {
  /** 执行次数 */
  count: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均实例数 */
  averageInstanceCount: number;
  /** 平均执行时间 */
  averageTime: number;
}
