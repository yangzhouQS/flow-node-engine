/**
 * 流程实例接口定义
 */

/**
 * 流程实例状态
 */
export enum ProcessInstanceState {
  /** 活动中 */
  ACTIVE = 'ACTIVE',
  /** 已挂起 */
  SUSPENDED = 'SUSPENDED',
  /** 已完成 */
  COMPLETED = 'COMPLETED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
}

/**
 * 流程实例接口
 */
export interface ProcessInstance {
  /** 实例ID */
  id: string;
  /** 流程定义ID */
  processDefinitionId: string;
  /** 流程定义Key */
  processDefinitionKey?: string;
  /** 流程定义名称 */
  processDefinitionName?: string;
  /** 流程定义版本 */
  processDefinitionVersion?: number;
  /** 业务Key */
  businessKey?: string;
  /** 租户ID */
  tenantId?: string;
  /** 父实例ID */
  parentId?: string;
  /** 根实例ID */
  rootProcessInstanceId?: string;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime?: Date;
  /** 状态 */
  state?: ProcessInstanceState | string;
  /** 状态（兼容性别名） */
  status?: ProcessInstanceState | string;
  /** 启动人 */
  startUserId?: string;
  /** 名称 */
  name?: string;
  /** 描述 */
  description?: string;
  /** 变量 */
  variables?: Record<string, any>;
  /** 本地变量 */
  localVariables?: Record<string, any>;
  /** 是否 suspended */
  isSuspended?: boolean;
  /** 是否 ended */
  isEnded?: boolean;
  /** 活动实例ID */
  activityId?: string;
  /** 回调ID */
  callbackId?: string;
  /** 任务数量 */
  taskCount?: number;
  /** 作业数量 */
  jobCount?: number;
  /** 变量数量 */
  variableCount?: number;
}

/**
 * 流程实例查询参数接口
 */
export interface ProcessInstanceQueryParams {
  /** 流程定义Key */
  processDefinitionKey?: string;
  /** 流程定义ID */
  processDefinitionId?: string;
  /** 业务Key */
  businessKey?: string;
  /** 租户ID */
  tenantId?: string;
  /** 启动人 */
  startedBy?: string;
  /** 开始时间（起） */
  startedAfter?: Date;
  /** 开始时间（止） */
  startedBefore?: Date;
  /** 结束时间（起） */
  finishedAfter?: Date;
  /** 结束时间（止） */
  finishedBefore?: Date;
  /** 状态 */
  state?: ProcessInstanceState | string;
  /** 是否包含变量 */
  includeVariables?: boolean;
  /** 是否包含本地变量 */
  includeLocalVariables?: boolean;
  /** 分页 -页码 */
  page?: number;
  /** 分页 - 每页数量 */
  size?: number;
  /** 排序字段 */
  sort?: string;
  /** 排序方向 */
  order?: 'ASC' | 'DESC';
}

/**
 * 启动流程实例参数接口
 */
export interface StartProcessInstanceParams {
  /** 流程定义Key */
  processDefinitionKey?: string;
  /** 流程定义ID */
  processDefinitionId?: string;
  /** 业务Key */
  businessKey?: string;
  /** 租户ID */
  tenantId?: string;
  /** 流程变量 */
  variables?: Record<string, any>;
  /** 启动人 */
  startUserId?: string;
  /** 流程实例名称 */
  name?: string;
  /** 回调ID */
  callbackId?: string;
}

/**
 * 流程实例创建结果接口
 */
export interface ProcessInstanceResult {
  /** 是否成功 */
  success: boolean;
  /** 流程实例 */
  processInstance?: ProcessInstance;
  /** 错误信息 */
  errorMessage?: string;
  /** 错误代码 */
  errorCode?: string;
}
