/**
 * 邮件服务实现
 * 对应 Flowable的 JakartaMailFlowableMailClient
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  IMailService,
  IMailServerConfig,
  ISendMailRequest,
  IMailResponse,
  IExecutableSendMailRequest,
  IMailTemplateVariables,
  ProcessNotificationType,
  TaskNotificationType,
  IMailMessage,
  MailTransport,
} from '../interfaces/mail.interface';
import { MailTemplateService } from './mail-template.service';

/**
 * 可执行邮件发送请求实现
 */
class ExecutableSendMailRequest implements IExecutableSendMailRequest {
  private readonly requestId: string;
  private readonly originalRequest: ISendMailRequest;
  private readonly transporter: nodemailer.Transporter;

  constructor(
    requestId: string,
    originalRequest: ISendMailRequest,
    transporter: nodemailer.Transporter
  ) {
    this.requestId = requestId;
    this.originalRequest = originalRequest;
    this.transporter = transporter;
  }

  getRequestId(): string {
    return this.requestId;
  }

  getOriginalRequest(): ISendMailRequest {
    return this.originalRequest;
  }

  async execute(): Promise<IMailResponse> {
    const message = this.originalRequest.message;
    const mailOptions: nodemailer.SendMailOptions = {
      from: message.fromName ? `${message.fromName} <${message.from}>` : message.from,
      to: message.to.join(', '),
      cc: message.cc?.join(', '),
      bcc: message.bcc?.join(', '),
      replyTo: message.replyTo,
      subject: message.subject,
      text: message.plainContent,
      html: message.htmlContent,
      headers: message.headers,
      priority: message.priority as 'high' | 'normal' | 'low',
      attachments: message.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        cid: att.cid,
      })),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      return {
        success: true,
        messageId: info.messageId,
        sentAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * 邮件服务实现
 */
@Injectable()
export class MailService implements IMailService, OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private serverConfig: IMailServerConfig | null = null;
  private defaultFrom: string;
  private requestCounter = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: MailTemplateService
  ) {
    this.defaultFrom = this.configService.get<string>('mail.defaultFrom', 'noreply@example.com');
  }

  async onModuleInit(): Promise<void> {
    await this.initializeTransporter();
  }

  /**
   * 初始化邮件传输器
   */
  private async initializeTransporter(): Promise<void> {
    const host = this.configService.get<string>('mail.host');
    const port = this.configService.get<number>('mail.port', 587);
    const user = this.configService.get<string>('mail.user');
    const password = this.configService.get<string>('mail.password');
    const transport = this.configService.get<string>('mail.transport', 'smtp');
    const startTlsEnabled = this.configService.get<boolean>('mail.startTlsEnabled', true);
    const secure = transport === MailTransport.SMTPS;

    if (!host) {
      this.logger.warn('Mail host not configured, mail service will be disabled');
      return;
    }

    this.serverConfig = {
      host,
      port,
      transport: transport as MailTransport,
      user,
      password,
      startTlsEnabled,
    };

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
      tls: startTlsEnabled ? { rejectUnauthorized: false } : undefined,
      connectionTimeout: this.configService.get<number>('mail.connectionTimeout', 5000),
      socketTimeout: this.configService.get<number>('mail.writeTimeout', 5000),
    });

    this.logger.log(`Mail transporter initialized: ${host}:${port}`);
  }

  /**
   * 发送邮件
   */
  async sendMail(request: ISendMailRequest): Promise<IMailResponse> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Mail service not configured',
      };
    }

    const executableRequest = this.prepareRequest(request);
    return executableRequest.execute();
  }

  /**
   * 准备可执行邮件请求
   */
  prepareRequest(request: ISendMailRequest): IExecutableSendMailRequest {
    const requestId = this.generateRequestId();
    
    if (!this.transporter) {
      throw new Error('Mail service not configured');
    }

    return new ExecutableSendMailRequest(requestId, request, this.transporter);
  }

  /**
   * 使用模板发送邮件
   */
  async sendTemplateMail(
    templateId: string,
    to: string | string[],
    variables: IMailTemplateVariables,
    tenantId?: string
  ): Promise<IMailResponse> {
    const template = await this.templateService.getTemplate(templateId, tenantId);
    if (!template) {
      return {
        success: false,
        error: `Template not found: ${templateId}`,
      };
    }

    const renderedMessage = await this.templateService.renderTemplate(template, variables);
    const toList = Array.isArray(to) ? to : [to];

    const message: IMailMessage = {
      from: renderedMessage.from || template.defaultFrom || this.defaultFrom,
      to: toList,
      subject: renderedMessage.subject || template.subject,
      plainContent: renderedMessage.plainContent,
      htmlContent: renderedMessage.htmlContent,
      charset: renderedMessage.charset || template.charset,
    };

    return this.sendMail({ message, tenantId });
  }

  /**
   * 发送流程通知邮件
   */
  async sendProcessNotification(
    processInstanceId: string,
    notificationType: ProcessNotificationType,
    variables?: Record<string, unknown>,
    tenantId?: string
  ): Promise<IMailResponse> {
    const templateId = `process_${notificationType}`;
    const templateVariables: IMailTemplateVariables = {
      processInstanceId,
      processVariables: variables,
    };

    return this.sendTemplateMail(templateId, [], templateVariables, tenantId);
  }

  /**
   * 发送任务通知邮件
   */
  async sendTaskNotification(
    taskId: string,
    notificationType: TaskNotificationType,
    variables?: Record<string, unknown>,
    tenantId?: string
  ): Promise<IMailResponse> {
    const templateId = `task_${notificationType}`;
    const templateVariables: IMailTemplateVariables = {
      taskId,
      taskVariables: variables,
    };

    return this.sendTemplateMail(templateId, [], templateVariables, tenantId);
  }

  /**
   * 验证邮件配置
   */
  async validateConfiguration(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error('Mail configuration validation failed', error);
      return false;
    }
  }

  /**
   * 获取服务器配置
   */
  getServerConfig(): IMailServerConfig | null {
    return this.serverConfig;
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const counter = (this.requestCounter++).toString(36).padStart(4, '0');
    const random = Math.random().toString(36).substring(2, 6);
    return `mail_${timestamp}_${counter}_${random}`;
  }
}
