/**
 * 流程迁移接口定义
 * 对应Flowable ProcessMigrationService
 */

import { ProcessInstance } from '../../core/interfaces/process-instance.interface';

/**
 * 迁移计划
 */
export interface MigrationPlan {
  /** 源流程定义ID */
  sourceProcessDefinitionId: string;
  /** 目标流程定义ID */
  targetProcessDefinitionId: string;
  /** 活动映射（源活动ID -> 目标活动ID） */
  activityMappings: ActivityMapping[];
  /** 变量映射 */
  variableMappings?: VariableMapping[];
  /** 迁移选项 */
  options?: MigrationOptions;
}

/**
 * 活动映射
 */
export interface ActivityMapping {
  /** 源活动ID */
  sourceActivityId: string;
  /** 目标活动ID */
  targetActivityId: string;
  /** 是否为新活动 */
  isNewActivity?: boolean;
}

/**
 * 变量映射
 */
export interface VariableMapping {
  /** 源变量名 */
  sourceVariableName: string;
  /** 目标变量名 */
  targetVariableName: string;
  /** 变量类型 */
  variableType?: string;
}

/**
 * 迁移选项
 */
export interface MigrationOptions {
  /** 是否保留原始流程实例ID */
  keepProcessInstanceId?: boolean;
  /** 是否保留原始业务键 */
  keepBusinessKey?: boolean;
  /** 是否保留原始变量 */
  keepVariables?: boolean;
  /** 是否保留原始任务 */
  keepTasks?: boolean;
  /** 是否保留原始作业 */
  keepJobs?: boolean;
  /** 是否保留原始事件订阅 */
  keepEventSubscriptions?: boolean;
  /** 是否跳过自定义监听器 */
  skipCustomListeners?: boolean;
  /** 是否跳过IO映射 */
  skipIoMappings?: boolean;
  /** 是否验证迁移 */
  validate?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 迁移验证结果
 */
export interface MigrationValidationResult {
  /** 是否验证通过 */
  valid: boolean;
  /** 验证错误列表 */
  errors: MigrationValidationError[];
  /** 验证警告列表 */
  warnings: MigrationValidationWarning[];
}

/**
 * 迁移验证错误
 */
export interface MigrationValidationError {
  /** 错误类型 */
  type: MigrationErrorType;
  /** 错误消息 */
  message: string;
  /** 源活动ID */
  sourceActivityId?: string;
  /** 目标活动ID */
  targetActivityId?: string;
  /** 流程实例ID */
  processInstanceId?: string;
}

/**
 * 迁移验证警告
 */
export interface MigrationValidationWarning {
  /** 警告类型 */
  type: MigrationWarningType;
  /** 警告消息 */
  message: string;
  /** 源活动ID */
  sourceActivityId?: string;
  /** 目标活动ID */
  targetActivityId?: string;
}

/**
 * 迁移错误类型
 */
export enum MigrationErrorType {
  /** 源活动不存在 */
  SOURCE_ACTIVITY_NOT_FOUND = 'SOURCE_ACTIVITY_NOT_FOUND',
  /** 目标活动不存在 */
  TARGET_ACTIVITY_NOT_FOUND = 'TARGET_ACTIVITY_NOT_FOUND',
  /** 活动类型不匹配 */
  ACTIVITY_TYPE_MISMATCH = 'ACTIVITY_TYPE_MISMATCH',
  /** 多实例配置不兼容 */
  MULTI_INSTANCE_INCOMPATIBLE = 'MULTI_INSTANCE_INCOMPATIBLE',
  /** 并行网关不兼容 */
  PARALLEL_GATEWAY_INCOMPATIBLE = 'PARALLEL_GATEWAY_INCOMPATIBLE',
  /** 子流程不兼容 */
  SUB_PROCESS_INCOMPATIBLE = 'SUB_PROCESS_INCOMPATIBLE',
  /** 变量类型不匹配 */
  VARIABLE_TYPE_MISMATCH = 'VARIABLE_TYPE_MISMATCH',
  /** 流程定义不存在 */
  PROCESS_DEFINITION_NOT_FOUND = 'PROCESS_DEFINITION_NOT_FOUND',
  /** 流程实例状态无效 */
  INVALID_PROCESS_INSTANCE_STATE = 'INVALID_PROCESS_INSTANCE_STATE',
}

/**
 * 迁移警告类型
 */
export enum MigrationWarningType {
  /** 活动将被跳过 */
  ACTIVITY_WILL_BE_SKIPPED = 'ACTIVITY_WILL_BE_SKIPPED',
  /** 变量将被丢失 */
  VARIABLE_WILL_BE_LOST = 'VARIABLE_WILL_BE_LOST',
  /** 任务将被取消 */
  TASK_WILL_BE_CANCELLED = 'TASK_WILL_BE_CANCELLED',
  /** 作业将被取消 */
  JOB_WILL_BE_CANCELLED = 'JOB_WILL_BE_CANCELLED',
  /** 监听器将不会被触发 */
  LISTENER_NOT_TRIGGERED = 'LISTENER_NOT_TRIGGERED',
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  /** 是否成功 */
  success: boolean;
  /** 迁移的流程实例ID列表 */
  migratedProcessInstanceIds: string[];
  /** 失败的流程实例ID列表 */
  failedProcessInstanceIds: string[];
  /** 失败原因 */
  failures: MigrationFailure[];
  /** 迁移开始时间 */
  startTime: Date;
  /** 迁移结束时间 */
  endTime?: Date;
  /** 迁移耗时（毫秒） */
  duration?: number;
}

/**
 * 迁移失败信息
 */
export interface MigrationFailure {
  /** 流程实例ID */
  processInstanceId: string;
  /** 失败原因 */
  reason: string;
  /** 错误详情 */
  error?: Error;
}

/**
 * 迁移批量配置
 */
export interface MigrationBatchConfig {
  /** 批量大小 */
  batchSize?: number;
  /** 是否并行处理 */
  parallel?: boolean;
  /** 并行度 */
  parallelism?: number;
  /** 失败时是否继续 */
  continueOnFailure?: boolean;
  /** 进度回调 */
  onProgress?: (current: number, total: number) => void;
}

/**
 * 迁移状态
 */
export enum MigrationStatus {
  /** 待执行 */
  PENDING = 'PENDING',
  /** 验证中 */
  VALIDATING = 'VALIDATING',
  /** 验证失败 */
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  /** 执行中 */
  EXECUTING = 'EXECUTING',
  /** 已完成 */
  COMPLETED = 'COMPLETED',
  /** 部分完成 */
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  /** 失败 */
  FAILED = 'FAILED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
}

/**
 * 迁移执行上下文
 */
export interface MigrationContext {
  /** 迁移计划 */
  plan: MigrationPlan;
  /** 迁移选项 */
  options: MigrationOptions;
  /** 源流程定义 */
  sourceProcessDefinition: any;
  /** 目标流程定义 */
  targetProcessDefinition: any;
  /** 当前流程实例 */
  processInstance?: ProcessInstance;
  /** 活动实例映射 */
  activityInstanceMap?: Map<string, any>;
  /** 执行实例映射 */
  executionInstanceMap?: Map<string, any>;
}

/**
 * 迁移策略接口
 */
export interface IMigrationStrategy {
  /**
   * 验证迁移计划
   */
  validate(plan: MigrationPlan): Promise<MigrationValidationResult>;

  /**
   * 执行迁移
   */
  migrate(
    plan: MigrationPlan,
    processInstanceIds: string[],
    options?: MigrationOptions
  ): Promise<MigrationResult>;
}

/**
 * 活动迁移器接口
 */
export interface IActivityMigrator {
  /**
   * 检查是否支持该活动类型
   */
  supports(activityType: string): boolean;

  /**
   * 验证活动迁移
   */
  validate(
    sourceActivity: any,
    targetActivity: any,
    context: MigrationContext
  ): Promise<MigrationValidationError | null>;

  /**
   * 执行活动迁移
   */
  migrate(
    sourceActivity: any,
    targetActivity: any,
    context: MigrationContext
  ): Promise<void>;
}

/**
 * 迁移事件类型
 */
export enum MigrationEventType {
  /** 迁移开始 */
  MIGRATION_STARTED = 'MIGRATION_STARTED',
  /** 迁移完成 */
  MIGRATION_COMPLETED = 'MIGRATION_COMPLETED',
  /** 迁移失败 */
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  /** 流程实例迁移开始 */
  PROCESS_INSTANCE_MIGRATION_STARTED = 'PROCESS_INSTANCE_MIGRATION_STARTED',
  /** 流程实例迁移完成 */
  PROCESS_INSTANCE_MIGRATION_COMPLETED = 'PROCESS_INSTANCE_MIGRATION_COMPLETED',
  /** 流程实例迁移失败 */
  PROCESS_INSTANCE_MIGRATION_FAILED = 'PROCESS_INSTANCE_MIGRATION_FAILED',
  /** 活动迁移 */
  ACTIVITY_MIGRATED = 'ACTIVITY_MIGRATED',
}

/**
 * 迁移事件
 */
export interface MigrationEvent {
  /** 事件类型 */
  type: MigrationEventType;
  /** 迁移计划ID */
  migrationPlanId?: string;
  /** 流程实例ID */
  processInstanceId?: string;
  /** 源活动ID */
  sourceActivityId?: string;
  /** 目标活动ID */
  targetActivityId?: string;
  /** 时间戳 */
  timestamp: Date;
  /** 附加数据 */
  data?: any;
}

/**
 * 迁移事件监听器
 */
export type MigrationEventListener = (event: MigrationEvent) => void | Promise<void>;
