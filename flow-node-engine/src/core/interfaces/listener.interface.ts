/**
 * 监听器接口定义
 * 基于Flowable监听器机制设计
 * 支持Execution Listener和Task Listener
 */

/**
 * 执行监听器事件类型
 */
export enum ExecutionListenerEvent {
  /** 流程元素开始执行 */
  START = 'start',
  /** 流程元素执行结束 */
  END = 'end',
  /** 顺序流被采取 */
  TAKE = 'take',
}

/**
 * 任务监听器事件类型
 */
export enum TaskListenerEvent {
  /** 任务创建 */
  CREATE = 'create',
  /** 任务分配 */
  ASSIGNMENT = 'assignment',
  /** 任务完成 */
  COMPLETE = 'complete',
  /** 任务删除 */
  DELETE = 'delete',
  /** 任务更新 */
  UPDATE = 'update',
  /** 任务超时 */
  TIMEOUT = 'timeout',
}

/**
 * 监听器类型
 */
export enum ListenerType {
  /** 执行监听器 */
  EXECUTION_LISTENER = 'execution_listener',
  /** 任务监听器 */
  TASK_LISTENER = 'task_listener',
}

/**
 * 监听器实现类型
 */
export enum ListenerImplementationType {
  /** 类名实现 */
  CLASS = 'class',
  /** 表达式实现 */
  EXPRESSION = 'expression',
  /** 委托表达式实现 */
  DELEGATE_EXPRESSION = 'delegate_expression',
  /** 内置实现 */
  BUILTIN = 'builtin',
}

/**
 * 执行监听器配置
 */
export interface ExecutionListenerConfig {
  /** 监听器ID */
  id?: string;
  /** 监听器名称 */
  name?: string;
  /** 事件类型 */
  event: ExecutionListenerEvent;
  /** 实现类型 */
  implementationType: ListenerImplementationType;
  /** 实现值（类名、表达式或委托表达式） */
  implementation: string;
  /** 字段扩展属性 */
  fields?: Record<string, any>;
  /** 是否启用 */
  enabled?: boolean;
  /** 执行顺序 */
  order?: number;
}

/**
 * 任务监听器配置
 */
export interface TaskListenerConfig {
  /** 监听器ID */
  id?: string;
  /** 监听器名称 */
  name?: string;
  /** 事件类型 */
  event: TaskListenerEvent;
  /** 实现类型 */
  implementationType: ListenerImplementationType;
  /** 实现值（类名、表达式或委托表达式） */
  implementation: string;
  /** 字段扩展属性 */
  fields?: Record<string, any>;
  /** 是否启用 */
  enabled?: boolean;
  /** 执行顺序 */
  order?: number;
}

/**
 * 监听器执行上下文
 */
export interface ListenerContext {
  /** 流程实例ID */
  processInstanceId: string;
  /** 执行ID */
  executionId?: string;
  /** 任务ID（仅任务监听器） */
  taskId?: string;
  /** 流程定义ID */
  processDefinitionId?: string;
  /** 流程定义Key */
  processDefinitionKey?: string;
  /** 活动ID */
  activityId?: string;
  /** 活动名称 */
  activityName?: string;
  /** 事件类型 */
  event: ExecutionListenerEvent | TaskListenerEvent;
  /** 事件时间 */
  timestamp: Date;
  /** 流程变量 */
  variables: Record<string, any>;
  /** 本地变量 */
  localVariables?: Record<string, any>;
  /** 扩展属性 */
  extra?: Record<string, any>;
}

/**
 * 任务监听器上下文（扩展自ListenerContext）
 */
export interface TaskListenerContext extends ListenerContext {
  /** 任务ID */
  taskId: string;
  /** 任务名称 */
  taskName?: string;
  /** 任务描述 */
  taskDescription?: string;
  /** 任务分配人 */
  assignee?: string;
  /** 任务候选人 */
  candidates?: string[];
  /** 任务候选组 */
  candidateGroups?: string[];
  /** 任务优先级 */
  priority?: number;
  /** 任务到期时间 */
  dueDate?: Date;
  /** 任务分类 */
  category?: string;
  /** 表单Key */
  formKey?: string;
  /** 父任务ID */
  parentTaskId?: string;
}

/**
 * 监听器执行结果
 */
export interface ListenerResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 修改的变量 */
  modifiedVariables?: Record<string, any>;
  /** 是否需要终止流程 */
  terminateProcess?: boolean;
  /** 是否需要抛出BPMN错误 */
  bpmnError?: {
    errorCode: string;
    errorMessage?: string;
  };
}

/**
 * 执行监听器接口
 */
export interface IExecutionListener {
  /**
   * 通知监听器事件发生
   * @param context 执行上下文
   * @returns 执行结果
   */
  notify(context: ListenerContext): Promise<ListenerResult> | ListenerResult;
}

/**
 * 任务监听器接口
 */
export interface ITaskListener {
  /**
   * 通知监听器事件发生
   * @param context 任务上下文
   * @returns 执行结果
   */
  notify(context: TaskListenerContext): Promise<ListenerResult> | ListenerResult;
}

/**
 * 监听器注册信息
 */
export interface ListenerRegistration {
  /** 注册ID */
  registrationId: string;
  /** 监听器类型 */
  listenerType: ListenerType;
  /** 监听器配置 */
  config: ExecutionListenerConfig | TaskListenerConfig;
  /** 监听器实例 */
  listener: IExecutionListener | ITaskListener;
  /** 目标元素ID（可选，不指定则为全局监听器） */
  targetElementId?: string;
  /** 流程定义Key（可选，不指定则为全局监听器） */
  processDefinitionKey?: string;
  /** 注册时间 */
  registeredAt: Date;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 监听器统计信息
 */
export interface ListenerStatistics {
  /** 监听器ID */
  listenerId: string;
  /** 监听器名称 */
  listenerName?: string;
  /** 总执行次数 */
  executionCount: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 最后执行时间 */
  lastExecutionTime?: Date;
  /** 最后错误信息 */
  lastError?: string;
}

/**
 * 内置监听器类型
 */
export enum BuiltinListenerType {
  /** 日志监听器 */
  LOG = 'log',
  /** 邮件监听器 */
  EMAIL = 'email',
  /** 变量设置监听器 */
  VARIABLE_SET = 'variable_set',
  /** 变量删除监听器 */
  VARIABLE_DELETE = 'variable_delete',
  /** 脚本执行监听器 */
  SCRIPT = 'script',
  /** Webhook监听器 */
  WEBHOOK = 'webhook',
  /** 审计日志监听器 */
  AUDIT_LOG = 'audit_log',
  /** 性能统计监听器 */
  PERFORMANCE = 'performance',
}

/**
 * 日志监听器配置
 */
export interface LogListenerConfig extends ExecutionListenerConfig {
  implementationType: ListenerImplementationType.BUILTIN;
  implementation: BuiltinListenerType.LOG;
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** 日志格式 */
  logFormat?: string;
  /** 是否记录变量 */
  logVariables?: boolean;
}

/**
 * 邮件监听器配置
 */
export interface EmailListenerConfig extends ExecutionListenerConfig {
  implementationType: ListenerImplementationType.BUILTIN;
  implementation: BuiltinListenerType.EMAIL;
  /** 收件人（可以是表达式） */
  to: string;
  /** 抄送 */
  cc?: string;
  /** 密送 */
  bcc?: string;
  /** 主题 */
  subject: string;
  /** 内容 */
  body: string;
  /** 是否HTML格式 */
  html?: boolean;
}

/**
 * 变量设置监听器配置
 */
export interface VariableSetListenerConfig extends ExecutionListenerConfig {
  implementationType: ListenerImplementationType.BUILTIN;
  implementation: BuiltinListenerType.VARIABLE_SET;
  /** 变量名 */
  variableName: string;
  /** 变量值（可以是表达式） */
  variableValue: any;
  /** 是否覆盖已存在的变量 */
  overwrite?: boolean;
}

/**
 * 脚本监听器配置
 */
export interface ScriptListenerConfig extends ExecutionListenerConfig {
  implementationType: ListenerImplementationType.BUILTIN;
  implementation: BuiltinListenerType.SCRIPT;
  /** 脚本语言 */
  scriptLanguage: 'javascript' | 'groovy' | 'python';
  /** 脚本内容 */
  script: string;
  /** 脚本文件路径（与script二选一） */
  scriptFile?: string;
}

/**
 * Webhook监听器配置
 */
export interface WebhookListenerConfig extends ExecutionListenerConfig {
  implementationType: ListenerImplementationType.BUILTIN;
  implementation: BuiltinListenerType.WEBHOOK;
  /** Webhook URL */
  url: string;
  /** HTTP方法 */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求体（可以是表达式或模板） */
  body?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
}

/**
 * 审计日志监听器配置
 */
export interface AuditLogListenerConfig extends ExecutionListenerConfig {
  implementationType: ListenerImplementationType.BUILTIN;
  implementation: BuiltinListenerType.AUDIT_LOG;
  /** 是否记录变量变更 */
  logVariableChanges?: boolean;
  /** 是否记录任务变更 */
  logTaskChanges?: boolean;
  /** 是否记录流程状态变更 */
  logProcessStateChanges?: boolean;
  /** 排除的变量名 */
  excludedVariables?: string[];
}

/**
 * 性能统计监听器配置
 */
export interface PerformanceListenerConfig extends ExecutionListenerConfig {
  implementationType: ListenerImplementationType.BUILTIN;
  implementation: BuiltinListenerType.PERFORMANCE;
  /** 统计间隔（毫秒） */
  statsInterval?: number;
  /** 是否记录慢执行 */
  logSlowExecutions?: boolean;
  /** 慢执行阈值（毫秒） */
  slowExecutionThreshold?: number;
}
