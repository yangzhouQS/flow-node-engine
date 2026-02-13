import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, IsObject } from 'class-validator';

/**
 * 退回策略枚举
 */
export enum RejectStrategy {
  /** 退回到上一节点 */
  TO_PREVIOUS = 'TO_PREVIOUS',
  /** 退回到发起人 */
  TO_STARTER = 'TO_STARTER',
  /** 退回到指定节点 */
  TO_SPECIFIC = 'TO_SPECIFIC',
  /** 退回到任意历史节点 */
  TO_ANY_HISTORY = 'TO_ANY_HISTORY',
  /** 不允许退回 */
  NOT_ALLOWED = 'NOT_ALLOWED',
}

/**
 * 多实例退回策略枚举
 * 定义多人任务场景下的退回执行策略
 */
export enum MultiInstanceRejectStrategy {
  /** 所有人任务都退回 */
  ALL_BACK = 'ALL_BACK',
  /** 仅退回当前操作人的任务 */
  ONLY_CURRENT = 'ONLY_CURRENT',
  /** 多数人退回则全部退回 */
  MAJORITY_BACK = 'MAJORITY_BACK',
  /** 保留已完成状态，仅重置未完成任务 */
  KEEP_COMPLETED = 'KEEP_COMPLETED',
  /** 重置所有任务，需要重新审批 */
  RESET_ALL = 'RESET_ALL',
  /** 等待其他人完成后再退回 */
  WAIT_COMPLETION = 'WAIT_COMPLETION',
  /** 立即退回，取消其他人的任务 */
  IMMEDIATE = 'IMMEDIATE',
}

/**
 * 多实例投票策略枚举
 * 定义多人任务场景下的投票决策策略
 */
export enum MultiInstanceVoteStrategy {
  /** 任一人驳回即退回 */
  ANY_REJECT = 'ANY_REJECT',
  /** 所有人驳回才退回 */
  ALL_REJECT = 'ALL_REJECT',
  /** 多数驳回才退回 */
  MAJORITY_REJECT = 'MAJORITY_REJECT',
  /** 按百分比驳回 */
  PERCENTAGE_REJECT = 'PERCENTAGE_REJECT',
  /** 任一人驳回需其他人同意 */
  ANY_REJECT_WAIT_OTHERS = 'ANY_REJECT_WAIT_OTHERS',
  /** 所有人完成后计算 */
  CALCULATE_AFTER_ALL = 'CALCULATE_AFTER_ALL',
  /** 最后一人决定 */
  LAST_DECIDES = 'LAST_DECIDES',
}

/**
 * 驳回类型枚举
 */
export enum RejectType {
  /** 退回（保持流程继续） */
  ROLLBACK = 'ROLLBACK',
  /** 驳回（流程终止） */
  REJECT = 'REJECT',
  /** 否决（流程终止并标记为否决） */
  DENY = 'DENY',
}

/**
 * 创建任务驳回DTO
 */
export class CreateTaskRejectDto {
  @IsString()
  taskId: string;

  @IsEnum(RejectType)
  @IsOptional()
  rejectType?: RejectType;

  @IsEnum(RejectStrategy)
  @IsOptional()
  strategy?: RejectStrategy;

  @IsString()
  @IsOptional()
  targetActivityId?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  skipListeners?: boolean;
}

/**
 * 批量驳回DTO
 */
export class BatchRejectDto {
  @IsArray()
  @IsString({ each: true })
  taskIds: string[];

  @IsEnum(RejectType)
  @IsOptional()
  rejectType?: RejectType;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  comment?: string;
}

/**
 * 查询驳回记录DTO
 */
export class QueryRejectRecordDto {
  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  processInstanceId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsEnum(RejectType)
  @IsOptional()
  rejectType?: RejectType;

  @IsString()
  @IsOptional()
  startTimeAfter?: string;

  @IsString()
  @IsOptional()
  startTimeBefore?: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  pageSize?: string;
}

/**
 * 多实例退回DTO
 */
export class MultiInstanceRejectDto {
  @IsString()
  taskId: string;

  @IsEnum(MultiInstanceRejectStrategy)
  @IsOptional()
  strategy?: MultiInstanceRejectStrategy;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsObject()
  @IsOptional()
  variables?: Record<string, any>;
}

/**
 * 获取可退回节点DTO
 */
export class GetRejectableNodesDto {
  @IsString()
  taskId: string;
}

/**
 * 驳回记录响应DTO
 */
export class RejectRecordResponseDto {
  id: string;
  taskId: string;
  processInstanceId: string;
  executionId: string;
  rejectType: RejectType;
  strategy: RejectStrategy;
  sourceActivityId: string;
  targetActivityId?: string;
  userId: string;
  reason?: string;
  comment?: string;
  createTime: Date;
}

/**
 * 可退回节点响应DTO
 */
export class RejectableNodeResponseDto {
  activityId: string;
  activityName: string;
  activityType: string;
  assignee?: string;
  candidateUsers?: string[];
  candidateGroups?: string[];
  createTime: Date;
  endTime?: Date;
}

/**
 * 退回策略配置响应DTO
 */
export class RejectConfigResponseDto {
  processDefinitionId: string;
  processDefinitionKey: string;
  activityId: string;
  strategy: RejectStrategy;
  allowedTargetActivities?: string[];
  multiInstanceStrategy?: MultiInstanceRejectStrategy;
  rejectPercentage?: number;
  allowUserChoice: boolean;
}
