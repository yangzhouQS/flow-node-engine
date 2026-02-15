/**
 * BPMN 流程基础接口定义
 * 
 * 用于描述 BPMN 流程中的活动、连线和流程本身
 */

/**
 * BPMN 活动类型
 */
export type BpmnActivityType =
  | 'userTask'
  | 'serviceTask'
  | 'scriptTask'
  | 'businessRuleTask'
  | 'sendTask'
  | 'receiveTask'
  | 'manualTask'
  | 'subProcess'
  | 'callActivity'
  | 'transaction'
  | 'multiInstance';

/**
 * BPMN 网关类型
 */
export type BpmnGatewayType =
  | 'exclusiveGateway'
  | 'parallelGateway'
  | 'inclusiveGateway'
  | 'eventBasedGateway'
  | 'complexGateway';

/**
 * BPMN 事件类型
 */
export type BpmnEventType =
  | 'startEvent'
  | 'endEvent'
  | 'intermediateCatchEvent'
  | 'intermediateThrowEvent'
  | 'boundaryEvent'
  | 'timerEventDefinition'
  | 'messageEventDefinition'
  | 'signalEventDefinition'
  | 'errorEventDefinition'
  | 'escalationEventDefinition'
  | 'cancelEventDefinition'
  | 'compensateEventDefinition'
  | 'conditionalEventDefinition';

/**
 * BPMN 活动接口
 */
export interface IBpmnActivity {
  /** 活动ID */
  id: string;
  /** 活动名称 */
  name?: string;
  /** 活动类型 */
  type: BpmnActivityType | BpmnGatewayType | BpmnEventType | string;
  /** 活动扩展类型（用于区分具体是活动、网关还是事件） */
  category?: 'activity' | 'gateway' | 'event';
  /** 文档描述 */
  documentation?: string;
  /** 扩展属性 */
  extensionElements?: Record<string, any>;
  /** 异步执行 */
  async?: boolean;
  /** 排他性（用于网关） */
  exclusive?: boolean;
  /** 多实例配置 */
  multiInstance?: {
    isSequential: boolean;
    collection?: string;
    elementVariable?: string;
    completionCondition?: string;
  };
  /** 执行监听器 */
  executionListeners?: Array<{
    event: string;
    class?: string;
    expression?: string;
    delegateExpression?: string;
  }>;
}

/**
 * BPMN 连线接口
 */
export interface IBpmnSequenceFlow {
  /** 连线ID */
  id: string;
  /** 连线名称 */
  name?: string;
  /** 源活动ID */
  sourceRef: string;
  /** 目标活动ID */
  targetRef: string;
  /** 条件表达式 */
  conditionExpression?: string;
  /** 条件表达式类型 */
  conditionType?: 'expression' | 'script';
  /** 文档描述 */
  documentation?: string;
  /** 扩展属性 */
  extensionElements?: Record<string, any>;
  /** 是否默认连线 */
  isDefault?: boolean;
}

/**
 * BPMN 流程接口
 */
export interface IBpmnProcess {
  /** 流程ID */
  id: string;
  /** 流程名称 */
  name?: string;
  /** 流程版本 */
  version?: number;
  /** 流程定义Key */
  key?: string;
  /** 流程定义ID */
  processDefinitionId?: string;
  /** 租户ID */
  tenantId?: string;
  /** 文档描述 */
  documentation?: string;
  /** 扩展属性 */
  extensionElements?: Record<string, any>;
  /** 活动列表 */
  activities?: IBpmnActivity[];
  /** 连线列表 */
  sequenceFlows?: IBpmnSequenceFlow[];
  /** 开始事件 */
  startEvents?: IBpmnActivity[];
  /** 结束事件 */
  endEvents?: IBpmnActivity[];
  /** 网关列表 */
  gateways?: IBpmnActivity[];
  /** 是否可执行 */
  isExecutable?: boolean;
  /** 流程变量 */
  properties?: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

/**
 * BPMN 流程定义接口
 */
export interface IBpmnProcessDefinition extends IBpmnProcess {
  /** 部署ID */
  deploymentId?: string;
  /** 资源名称 */
  resourceName?: string;
  /** BPMN XML 内容 */
  bpmnXml?: string;
  /** 挂起状态 */
  suspensionState?: 'ACTIVE' | 'SUSPENDED';
  /** 创建时间 */
  creationTime?: Date;
}

/**
 * BPMN 流程实例接口
 */
export interface IBpmnProcessInstance {
  /** 实例ID */
  id: string;
  /** 流程定义ID */
  processDefinitionId: string;
  /** 流程定义Key */
  processDefinitionKey?: string;
  /** 流程定义名称 */
  processDefinitionName?: string;
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
  state?: 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'CANCELLED';
  /** 启动人 */
  startUserId?: string;
  /** 名称 */
  name?: string;
  /** 变量 */
  variables?: Record<string, any>;
}
