/**
 * 事务子流程接口定义（与Flowable TransactionSubProcess保持一致）
 * 
 * 事务子流程是一种特殊的子流程，具有以下特性：
 * 1. 自动补偿：当事务被取消时，自动触发已完成活动的补偿处理器
 * 2. 取消事件支持：支持取消结束事件和取消边界事件
 * 3. 事件订阅：跟踪事务内所有活动的补偿事件订阅
 * 4. 事务作用域：管理事务的生命周期和状态
 */

import { ICompensationHandler } from './compensation.interface';

/**
 * 事务子流程状态
 */
export enum TransactionState {
  /** 活动中 */
  ACTIVE = 'ACTIVE',
  /** 已成功完成 */
  COMPLETED = 'COMPLETED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
  /** 补偿中 */
  COMPENSATING = 'COMPENSATING'
}

/**
 * 事务子流程配置
 */
export interface ITransactionSubProcessConfig {
  /** 事务子流程ID */
  id: string;
  /** 事务子流程名称 */
  name?: string;
  /** 是否异步执行 */
  async?: boolean;
  /** 是否独占执行 */
  exclusive?: boolean;
}

/**
 * 补偿事件订阅
 */
export interface ICompensationEventSubscription {
  /** 订阅ID */
  id: string;
  /** 事件类型（固定为compensate） */
  eventType: 'compensate';
  /** 活动ID */
  activityId: string;
  /** 执行ID */
  executionId: string;
  /** 配置（事件作用域执行ID） */
  configuration?: string;
  /** 补偿处理器 */
  handler?: ICompensationHandler;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 事务作用域
 */
export interface ITransactionScope {
  /** 事务ID */
  transactionId: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 父执行ID */
  parentExecutionId?: string;
  /** 事务状态 */
  state: TransactionState;
  /** 补偿事件订阅列表 */
  compensationSubscriptions: ICompensationEventSubscription[];
  /** 事务变量 */
  variables: Record<string, any>;
  /** 创建时间 */
  createdAt: Date;
  /** 完成时间 */
  completedAt?: Date;
}

/**
 * 取消事件类型
 */
export enum CancelEventType {
  /** 取消结束事件 */
  END_EVENT = 'END_EVENT',
  /** 取消边界事件 */
  BOUNDARY_EVENT = 'BOUNDARY_EVENT'
}

/**
 * 取消事件上下文
 */
export interface ICancelEventContext {
  /** 事件类型 */
  eventType: CancelEventType;
  /** 事务子流程ID */
  transactionId: string;
  /** 触发取消的活动ID */
  triggerActivityId?: string;
  /** 取消原因 */
  reason?: string;
  /** 是否触发补偿 */
  triggerCompensation: boolean;
}

/**
 * 事务子流程执行结果
 */
export interface ITransactionResult {
  /** 是否成功 */
  success: boolean;
  /** 事务状态 */
  state: TransactionState;
  /** 补偿事件订阅（成功时保留） */
  compensationSubscriptions: ICompensationEventSubscription[];
  /** 已执行的补偿处理器（取消时） */
  executedCompensations: string[];
  /** 结果变量 */
  variables: Record<string, any>;
  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 事务子流程执行器接口
 */
export interface ITransactionSubProcessExecutor {
  /**
   * 启动事务子流程
   * @param config 事务配置
   * @param processInstanceId 流程实例ID
   * @param parentExecutionId 父执行ID
   * @param variables 初始变量
   */
  startTransaction(
    config: ITransactionSubProcessConfig,
    processInstanceId: string,
    parentExecutionId?: string,
    variables?: Record<string, any>
  ): Promise<ITransactionScope>;

  /**
   * 注册补偿事件订阅
   * @param transactionId 事务ID
   * @param subscription 补偿事件订阅
   */
  registerCompensationSubscription(
    transactionId: string,
    subscription: ICompensationEventSubscription
  ): Promise<void>;

  /**
   * 取消补偿事件订阅
   * @param transactionId 事务ID
   * @param activityId 活动ID
   */
  cancelCompensationSubscription(
    transactionId: string,
    activityId: string
  ): Promise<void>;

  /**
   * 完成事务子流程（成功）
   * @param transactionId 事务ID
   * @param variables 结果变量
   */
  completeTransaction(
    transactionId: string,
    variables?: Record<string, any>
  ): Promise<ITransactionResult>;

  /**
   * 取消事务子流程
   * @param context 取消事件上下文
   */
  cancelTransaction(context: ICancelEventContext): Promise<ITransactionResult>;

  /**
   * 获取事务作用域
   * @param transactionId 事务ID
   */
  getTransactionScope(transactionId: string): Promise<ITransactionScope | null>;

  /**
   * 获取活动的补偿事件订阅
   * @param transactionId 事务ID
   * @param activityId 活动ID（可选，不提供则返回所有）
   */
  getCompensationSubscriptions(
    transactionId: string,
    activityId?: string
  ): Promise<ICompensationEventSubscription[]>;

  /**
   * 触发补偿
   * @param transactionId 事务ID
   * @param activityIds 要补偿的活动ID列表（可选，不提供则补偿所有）
   */
  triggerCompensation(
    transactionId: string,
    activityIds?: string[]
  ): Promise<string[]>;
}

/**
 * 事务子流程服务接口
 */
export interface ITransactionSubProcessService {
  /**
   * 创建事务作用域
   */
  createTransactionScope(
    config: ITransactionSubProcessConfig,
    processInstanceId: string,
    parentExecutionId?: string,
    variables?: Record<string, any>
  ): Promise<ITransactionScope>;

  /**
   * 获取事务作用域
   */
  getTransactionScope(transactionId: string): Promise<ITransactionScope | null>;

  /**
   * 更新事务状态
   */
  updateTransactionState(
    transactionId: string,
    state: TransactionState
  ): Promise<void>;

  /**
   * 添加补偿订阅
   */
  addCompensationSubscription(
    transactionId: string,
    subscription: ICompensationEventSubscription
  ): Promise<void>;

  /**
   * 移除补偿订阅
   */
  removeCompensationSubscription(
    transactionId: string,
    activityId: string
  ): Promise<void>;

  /**
   * 获取所有补偿订阅
   */
  getCompensationSubscriptions(
    transactionId: string,
    activityId?: string
  ): Promise<ICompensationEventSubscription[]>;

  /**
   * 清除所有补偿订阅
   */
  clearCompensationSubscriptions(transactionId: string): Promise<void>;

  /**
   * 删除事务作用域
   */
  deleteTransactionScope(transactionId: string): Promise<void>;
}

/**
 * 取消边界事件配置
 */
export interface ICancelBoundaryEventConfig {
  /** 事件ID */
  id: string;
  /** 附加到的事务子流程ID */
  attachedToRef: string;
  /** 是否取消活动 */
  cancelActivity: boolean;
}

/**
 * 取消结束事件配置
 */
export interface ICancelEndEventConfig {
  /** 事件ID */
  id: string;
  /** 所在的事务子流程ID */
  transactionSubProcessId: string;
}
