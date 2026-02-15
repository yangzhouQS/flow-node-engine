/**
 * 动态流程修改接口（与Flowable DynamicBpmnService行为保持一致）
 * 
 * 核心功能：
 * 1. 动态修改流程定义 - 在运行时修改已部署的流程定义
 * 2. 活动添加/删除 - 动态添加或删除流程活动
 * 3. 连线修改 - 动态修改流程连线
 * 4. 属性修改 - 动态修改活动属性
 * 
 * 参考实现：Flowable DynamicBpmnService
 */

import { IBpmnActivity, IBpmnSequenceFlow, IBpmnProcess } from './bpmn-process.interface';

/**
 * 修改操作类型
 */
export enum ModificationType {
  /** 添加活动 */
  ADD_ACTIVITY = 'ADD_ACTIVITY',
  /** 删除活动 */
  REMOVE_ACTIVITY = 'REMOVE_ACTIVITY',
  /** 更新活动 */
  UPDATE_ACTIVITY = 'UPDATE_ACTIVITY',
  /** 添加连线 */
  ADD_SEQUENCE_FLOW = 'ADD_SEQUENCE_FLOW',
  /** 删除连线 */
  REMOVE_SEQUENCE_FLOW = 'REMOVE_SEQUENCE_FLOW',
  /** 更新连线 */
  UPDATE_SEQUENCE_FLOW = 'UPDATE_SEQUENCE_FLOW',
  /** 添加网关 */
  ADD_GATEWAY = 'ADD_GATEWAY',
  /** 添加事件 */
  ADD_EVENT = 'ADD_EVENT',
  /** 修改属性 */
  MODIFY_PROPERTY = 'MODIFY_PROPERTY',
}

/**
 * 动态修改操作
 */
export interface IDynamicModification {
  /** 操作ID */
  id: string;
  /** 操作类型 */
  type: ModificationType;
  /** 目标活动ID */
  targetActivityId?: string;
  /** 目标连线ID */
  targetSequenceFlowId?: string;
  /** 修改数据 */
  data: Record<string, any>;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 添加活动操作数据
 */
export interface IAddActivityData {
  /** 活动类型 */
  activityType: string;
  /** 活动ID */
  activityId: string;
  /** 活动名称 */
  name?: string;
  /** 前置活动ID */
  previousActivityId?: string;
  /** 后置活动ID */
  nextActivityId?: string;
  /** 活动配置 */
  config?: Record<string, any>;
}

/**
 * 删除活动操作数据
 */
export interface IRemoveActivityData {
  /** 活动ID */
  activityId: string;
  /** 是否删除相关连线 */
  removeSequenceFlows?: boolean;
  /** 替代连线配置 */
  replacementFlow?: {
    sourceId: string;
    targetId: string;
  };
}

/**
 * 添加连线操作数据
 */
export interface IAddSequenceFlowData {
  /** 连线ID */
  sequenceFlowId: string;
  /** 源活动ID */
  sourceRef: string;
  /** 目标活动ID */
  targetRef: string;
  /** 连线名称 */
  name?: string;
  /** 条件表达式 */
  conditionExpression?: string;
}

/**
 * 修改属性操作数据
 */
export interface IModifyPropertyData {
  /** 属性路径 */
  propertyPath: string;
  /** 旧值 */
  oldValue?: any;
  /** 新值 */
  newValue: any;
}

/**
 * 动态修改上下文
 */
export interface IDynamicModificationContext {
  /** 流程定义ID */
  processDefinitionId: string;
  /** 租户ID */
  tenantId?: string;
  /** 修改原因 */
  reason?: string;
  /** 操作人 */
  operator?: string;
  /** 是否验证修改 */
  validate?: boolean;
  /** 是否立即生效 */
  immediate?: boolean;
}

/**
 * 修改结果
 */
export interface IModificationResult {
  /** 是否成功 */
  success: boolean;
  /** 新流程定义ID */
  newProcessDefinitionId?: string;
  /** 执行的修改操作列表 */
  executedModifications: IDynamicModification[];
  /** 验证错误 */
  validationErrors?: string[];
  /** 错误信息 */
  errorMessage?: string;
  /** 影响的流程实例数量 */
  affectedProcessInstances?: number;
}

/**
 * 批量修改请求
 */
export interface IBatchModificationRequest {
  /** 修改上下文 */
  context: IDynamicModificationContext;
  /** 修改操作列表 */
  modifications: IDynamicModification[];
  /** 是否原子操作（全部成功或全部回滚） */
  atomic?: boolean;
}

/**
 * 流程定义差异
 */
export interface IProcessDefinitionDiff {
  /** 添加的活动 */
  addedActivities: IBpmnActivity[];
  /** 删除的活动 */
  removedActivities: string[];
  /** 修改的活动 */
  modifiedActivities: Array<{
    activityId: string;
    changes: Array<{
      property: string;
      oldValue: any;
      newValue: any;
    }>;
  }>;
  /** 添加的连线 */
  addedSequenceFlows: IBpmnSequenceFlow[];
  /** 删除的连线 */
  removedSequenceFlows: string[];
  /** 修改的连线 */
  modifiedSequenceFlows: Array<{
    sequenceFlowId: string;
    changes: Array<{
      property: string;
      oldValue: any;
      newValue: any;
    }>;
  }>;
}

/**
 * 动态流程修改服务接口
 */
export interface IDynamicProcessService {
  /**
   * 执行动态修改
   * @param request 批量修改请求
   */
  executeModification(request: IBatchModificationRequest): Promise<IModificationResult>;

  /**
   * 添加活动
   * @param context 修改上下文
   * @param data 添加活动数据
   */
  addActivity(
    context: IDynamicModificationContext,
    data: IAddActivityData
  ): Promise<IModificationResult>;

  /**
   * 删除活动
   * @param context 修改上下文
   * @param data 删除活动数据
   */
  removeActivity(
    context: IDynamicModificationContext,
    data: IRemoveActivityData
  ): Promise<IModificationResult>;

  /**
   * 添加连线
   * @param context 修改上下文
   * @param data 添加连线数据
   */
  addSequenceFlow(
    context: IDynamicModificationContext,
    data: IAddSequenceFlowData
  ): Promise<IModificationResult>;

  /**
   * 修改属性
   * @param context 修改上下文
   * @param activityId 活动ID
   * @param data 修改属性数据
   */
  modifyProperty(
    context: IDynamicModificationContext,
    activityId: string,
    data: IModifyPropertyData
  ): Promise<IModificationResult>;

  /**
   * 计算流程定义差异
   * @param oldProcessDefinitionId 旧流程定义ID
   * @param newProcessDefinitionId 新流程定义ID
   */
  calculateDiff(
    oldProcessDefinitionId: string,
    newProcessDefinitionId: string
  ): Promise<IProcessDefinitionDiff>;

  /**
   * 验证修改
   * @param modifications 修改操作列表
   * @param context 修改上下文
   */
  validateModifications(
    modifications: IDynamicModification[],
    context: IDynamicModificationContext
  ): Promise<{ valid: boolean; errors: string[] }>;

  /**
   * 回滚修改
   * @param modificationId 修改ID
   */
  rollbackModification(modificationId: string): Promise<boolean>;
}

/**
 * 动态流程修改构建器接口
 */
export interface IDynamicModificationBuilder {
  /**
   * 添加用户任务
   */
  addUserTask(activityId: string, name: string): this;

  /**
   * 添加服务任务
   */
  addServiceTask(activityId: string, name: string, implementation?: string): this;

  /**
   * 添加网关
   */
  addGateway(activityId: string, gatewayType: string): this;

  /**
   * 添加连线
   */
  addSequenceFlow(
    sequenceFlowId: string,
    sourceRef: string,
    targetRef: string,
    conditionExpression?: string
  ): this;

  /**
   * 删除活动
   */
  removeActivity(activityId: string): this;

  /**
   * 修改活动属性
   */
  changeActivityProperty(activityId: string, property: string, value: any): this;

  /**
   * 设置连线条件
   */
  setSequenceFlowCondition(sequenceFlowId: string, condition: string): this;

  /**
   * 构建修改请求
   */
  build(): IBatchModificationRequest;
}
