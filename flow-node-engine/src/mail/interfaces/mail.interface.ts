/**
 * 邮件服务接口定义
 * 对应 Flowable mail模块的API设计
 */

/**
 * 邮件传输协议
 */
export enum MailTransport {
  SMTP = 'smtp',
  SMTPS = 'smtps',
}

/**
 * 邮件服务器配置接口
 */
export interface IMailServerConfig {
  /** 服务器主机地址 */
  host: string;
  /** 服务器端口 */
  port: number;
  /** 传输协议 */
  transport: MailTransport;
  /** 用户名 */
  user?: string;
  /** 密码 */
  password?: string;
  /** 是否启用 STARTTLS */
  startTlsEnabled?: boolean;
  /** 连接超时时间(毫秒) */
  connectionTimeout?: number;
  /** 写入超时时间(毫秒) */
  writeTimeout?: number;
}

/**
 * JNDI邮件服务器配置(用于应用服务器托管的邮件会话)
 */
export interface IMailJndiServerConfig {
  /** JNDI名称 */
  jndiName: string;
}

/**
 * 邮件服务器配置联合类型
 */
export type MailServerConfiguration = IMailServerConfig | IMailJndiServerConfig;

/**
 * 邮件附件接口
 */
export interface IMailAttachment {
  /** 文件名 */
  filename: string;
  /** MIME类型 */
  contentType: string;
  /** 文件内容(Buffer或Base64字符串) */
  content: Buffer | string;
  /** 内容ID(用于内嵌图片) */
  cid?: string;
}

/**
 * 邮件消息接口
 */
export interface IMailMessage {
  /** 发件人地址 */
  from: string;
  /** 发件人显示名称 */
  fromName?: string;
  /** 收件人列表 */
  to: string[];
  /** 抄送列表 */
  cc?: string[];
  /** 密送列表 */
  bcc?: string[];
  /** 回复地址 */
  replyTo?: string;
  /** 邮件主题 */
  subject: string;
  /** 纯文本内容 */
  plainContent?: string;
  /** HTML内容 */
  htmlContent?: string;
  /** 字符集编码 */
  charset?: string;
  /** 附件列表 */
  attachments?: IMailAttachment[];
  /** 自定义邮件头 */
  headers?: Record<string, string>;
  /** 优先级(1-5, 1最高) */
  priority?: number;
}

/**
 * 邮件发送请求接口
 */
export interface ISendMailRequest {
  /** 租户ID */
  tenantId?: string;
  /** 邮件消息 */
  message: IMailMessage;
  /** 异步发送 */
  async?: boolean;
}

/**
 * 邮件发送响应接口
 */
export interface IMailResponse {
  /** 是否成功 */
  success: boolean;
  /** 消息ID */
  messageId?: string;
  /** 错误信息 */
  error?: string;
  /** 发送时间 */
  sentAt?: Date;
}

/**
 * 可执行邮件发送请求接口
 */
export interface IExecutableSendMailRequest {
  /** 执行发送 */
  execute(): Promise<IMailResponse>;
  /** 获取请求ID */
  getRequestId(): string;
  /** 获取原始请求 */
  getOriginalRequest(): ISendMailRequest;
}

/**
 * 邮件模板变量接口
 */
export interface IMailTemplateVariables {
  /** 流程实例ID */
  processInstanceId?: string;
  /** 任务ID */
  taskId?: string;
  /** 执行ID */
  executionId?: string;
  /** 流程变量 */
  processVariables?: Record<string, unknown>;
  /** 任务变量 */
  taskVariables?: Record<string, unknown>;
  /** 自定义变量 */
  customVariables?: Record<string, unknown>;
}

/**
 * 邮件模板配置接口
 */
export interface IMailTemplate {
  /** 模板ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板主题(支持变量替换) */
  subject: string;
  /** 纯文本模板(支持变量替换) */
  plainContent?: string;
  /** HTML模板(支持变量替换) */
  htmlContent?: string;
  /** 默认发件人 */
  defaultFrom?: string;
  /** 默认收件人变量名 */
  toVariable?: string;
  /** 字符集 */
  charset?: string;
}

/**
 * 邮件任务配置接口(用于BPMN邮件任务)
 */
export interface IMailTaskConfig {
  /** 收件人(可以是表达式) */
  to: string;
  /** 发件人(可以是表达式) */
  from?: string;
  /** 抄送(可以是表达式) */
  cc?: string;
  /** 密送(可以是表达式) */
  bcc?: string;
  /** 主题(可以是表达式) */
  subject: string;
  /** 内容(可以是表达式) */
  text?: string;
  /** HTML内容(可以是表达式) */
  html?: string;
  /** 字符集 */
  charset?: string;
  /** 模板名称 */
  template?: string;
  /** 模板变量 */
  templateVariables?: Record<string, string>;
  /** 附件变量名 */
  attachmentsVariable?: string;
}

/**
 * 邮件服务接口
 */
export interface IMailService {
  /**
   * 发送邮件
   * @param request 邮件发送请求
   * @returns 邮件发送响应
   */
  sendMail(request: ISendMailRequest): Promise<IMailResponse>;

  /**
   * 准备可执行邮件请求
   * @param request 邮件发送请求
   * @returns 可执行邮件请求
   */
  prepareRequest(request: ISendMailRequest): IExecutableSendMailRequest;

  /**
   * 使用模板发送邮件
   * @param templateId 模板ID
   * @param to 收件人
   * @param variables 模板变量
   * @param tenantId 租户ID
   * @returns 邮件发送响应
   */
  sendTemplateMail(
    templateId: string,
    to: string | string[],
    variables: IMailTemplateVariables,
    tenantId?: string
  ): Promise<IMailResponse>;

  /**
   * 发送流程通知邮件
   * @param processInstanceId 流程实例ID
   * @param notificationType 通知类型
   * @param variables 变量
   * @param tenantId 租户ID
   * @returns 邮件发送响应
   */
  sendProcessNotification(
    processInstanceId: string,
    notificationType: ProcessNotificationType,
    variables?: Record<string, unknown>,
    tenantId?: string
  ): Promise<IMailResponse>;

  /**
   * 发送任务通知邮件
   * @param taskId 任务ID
   * @param notificationType 通知类型
   * @param variables 变量
   * @param tenantId 租户ID
   * @returns 邮件发送响应
   */
  sendTaskNotification(
    taskId: string,
    notificationType: TaskNotificationType,
    variables?: Record<string, unknown>,
    tenantId?: string
  ): Promise<IMailResponse>;

  /**
   * 验证邮件配置
   * @returns 是否有效
   */
  validateConfiguration(): Promise<boolean>;
}

/**
 * 流程通知类型
 */
export enum ProcessNotificationType {
  /** 流程启动 */
  PROCESS_STARTED = 'process_started',
  /** 流程完成 */
  PROCESS_COMPLETED = 'process_completed',
  /** 流程终止 */
  PROCESS_TERMINATED = 'process_terminated',
  /** 流程挂起 */
  PROCESS_SUSPENDED = 'process_suspended',
  /** 流程激活 */
  PROCESS_ACTIVATED = 'process_activated',
}

/**
 * 任务通知类型
 */
export enum TaskNotificationType {
  /** 任务创建 */
  TASK_CREATED = 'task_created',
  /** 任务分配 */
  TASK_ASSIGNED = 'task_assigned',
  /** 任务完成 */
  TASK_COMPLETED = 'task_completed',
  /** 任务超时 */
  TASK_TIMEOUT = 'task_timeout',
  /** 任务委派 */
  TASK_DELEGATED = 'task_delegated',
}

/**
 * 邮件模板服务接口
 */
export interface IMailTemplateService {
  /**
   * 获取邮件模板
   * @param templateId 模板ID
   * @param tenantId 租户ID
   * @returns 邮件模板
   */
  getTemplate(templateId: string, tenantId?: string): Promise<IMailTemplate | null>;

  /**
   * 保存邮件模板
   * @param template 邮件模板
   * @param tenantId 租户ID
   * @returns 保存的模板
   */
  saveTemplate(template: IMailTemplate, tenantId?: string): Promise<IMailTemplate>;

  /**
   * 删除邮件模板
   * @param templateId 模板ID
   * @param tenantId 租户ID
   * @returns 是否成功
   */
  deleteTemplate(templateId: string, tenantId?: string): Promise<boolean>;

  /**
   * 渲染模板
   * @param template 模板
   * @param variables 变量
   * @returns 渲染后的邮件消息
   */
  renderTemplate(
    template: IMailTemplate,
    variables: IMailTemplateVariables
  ): Promise<Partial<IMailMessage>>;
}
