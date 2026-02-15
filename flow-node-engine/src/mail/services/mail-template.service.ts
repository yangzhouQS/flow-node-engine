/**
 * 邮件模板服务实现
 * 支持模板管理和变量渲染
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  IMailTemplateService,
  IMailTemplate,
  IMailTemplateVariables,
  IMailMessage,
} from '../interfaces/mail.interface';
import { HandlebarsTemplateDelegate, compile } from 'handlebars';

/**
 * 模板缓存条目
 */
interface TemplateCacheEntry {
  template: IMailTemplate;
  compiledSubject: HandlebarsTemplateDelegate;
  compiledPlainContent?: HandlebarsTemplateDelegate;
  compiledHtmlContent?: HandlebarsTemplateDelegate;
  compiledAt: Date;
}

/**
 * 邮件模板服务实现
 */
@Injectable()
export class MailTemplateService implements IMailTemplateService {
  private readonly logger = new Logger(MailTemplateService.name);
  private readonly templateStore: Map<string, TemplateCacheEntry> = new Map();
  private readonly tenantTemplates: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeBuiltinTemplates();
  }

  /**
   * 初始化内置模板
   */
  private initializeBuiltinTemplates(): void {
    // 流程启动通知模板
    this.registerBuiltinTemplate({
      id: 'process_process_started',
      name: '流程启动通知',
      subject: '流程已启动: {{processName}}',
      plainContent: `您好,

流程 "{{processName}}" 已启动。
流程实例ID: {{processInstanceId}}
启动时间: {{startTime}}
启动人: {{starter}}

请及时处理相关任务。

此邮件由系统自动发送，请勿回复。`,
      htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif;">
<h2>流程已启动: {{processName}}</h2>
<p>您好,</p>
<p>流程 "<strong>{{processName}}</strong>" 已启动。</p>
<ul>
<li>流程实例ID: {{processInstanceId}}</li>
<li>启动时间: {{startTime}}</li>
<li>启动人: {{starter}}</li>
</ul>
<p>请及时处理相关任务。</p>
<hr>
<p style="color: #999; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
</body>
</html>`,
      defaultFrom: 'noreply@example.com',
      charset: 'UTF-8',
    });

    // 任务分配通知模板
    this.registerBuiltinTemplate({
      id: 'task_task_assigned',
      name: '任务分配通知',
      subject: '新任务: {{taskName}}',
      plainContent: `您好,

您有一个新任务需要处理:
任务名称: {{taskName}}
任务ID: {{taskId}}
流程名称: {{processName}}
创建时间: {{createTime}}

请登录系统处理该任务。

此邮件由系统自动发送，请勿回复。`,
      htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif;">
<h2>新任务: {{taskName}}</h2>
<p>您好,</p>
<p>您有一个新任务需要处理:</p>
<ul>
<li>任务名称: <strong>{{taskName}}</strong></li>
<li>任务ID: {{taskId}}</li>
<li>流程名称: {{processName}}</li>
<li>创建时间: {{createTime}}</li>
</ul>
<p><a href="{{taskUrl}}">点击此处处理任务</a></p>
<hr>
<p style="color: #999; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
</body>
</html>`,
      defaultFrom: 'noreply@example.com',
      charset: 'UTF-8',
    });

    // 任务超时提醒模板
    this.registerBuiltinTemplate({
      id: 'task_task_timeout',
      name: '任务超时提醒',
      subject: '任务即将超时: {{taskName}}',
      plainContent: `您好,

您的任务即将超时:
任务名称: {{taskName}}
任务ID: {{taskId}}
截止时间: {{dueDate}}
剩余时间: {{remainingTime}}

请尽快处理该任务，以免超时。

此邮件由系统自动发送，请勿回复。`,
      htmlContent: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif;">
<h2 style="color: #e74c3c;">任务即将超时: {{taskName}}</h2>
<p>您好,</p>
<p>您的任务即将超时:</p>
<ul>
<li>任务名称: <strong>{{taskName}}</strong></li>
<li>任务ID: {{taskId}}</li>
<li>截止时间: <span style="color: #e74c3c;">{{dueDate}}</span></li>
<li>剩余时间: {{remainingTime}}</li>
</ul>
<p style="color: #e74c3c; font-weight: bold;">请尽快处理该任务，以免超时。</p>
<p><a href="{{taskUrl}}">点击此处处理任务</a></p>
<hr>
<p style="color: #999; font-size: 12px;">此邮件由系统自动发送，请勿回复。</p>
</body>
</html>`,
      defaultFrom: 'noreply@example.com',
      charset: 'UTF-8',
    });

    this.logger.log('Built-in mail templates initialized');
  }

  /**
   * 注册内置模板
   */
  private registerBuiltinTemplate(template: IMailTemplate): void {
    const compiledSubject = compile(template.subject);
    const compiledPlainContent = template.plainContent
      ? compile(template.plainContent)
      : undefined;
    const compiledHtmlContent = template.htmlContent
      ? compile(template.htmlContent)
      : undefined;

    this.templateStore.set(template.id, {
      template,
      compiledSubject,
      compiledPlainContent,
      compiledHtmlContent,
      compiledAt: new Date(),
    });
  }

  /**
   * 获取邮件模板
   */
  async getTemplate(templateId: string, tenantId?: string): Promise<IMailTemplate | null> {
    // 如果有租户ID，先查找租户特定模板
    if (tenantId) {
      const tenantTemplateKey = `${tenantId}:${templateId}`;
      const entry = this.templateStore.get(tenantTemplateKey);
      if (entry) {
        return entry.template;
      }
    }

    // 查找全局模板
    const entry = this.templateStore.get(templateId);
    return entry?.template || null;
  }

  /**
   * 保存邮件模板
   */
  async saveTemplate(template: IMailTemplate, tenantId?: string): Promise<IMailTemplate> {
    const templateKey = tenantId ? `${tenantId}:${template.id}` : template.id;

    // 编译模板
    const compiledSubject = compile(template.subject);
    const compiledPlainContent = template.plainContent
      ? compile(template.plainContent)
      : undefined;
    const compiledHtmlContent = template.htmlContent
      ? compile(template.htmlContent)
      : undefined;

    // 存储模板
    this.templateStore.set(templateKey, {
      template,
      compiledSubject,
      compiledPlainContent,
      compiledHtmlContent,
      compiledAt: new Date(),
    });

    // 记录租户模板关系
    if (tenantId) {
      if (!this.tenantTemplates.has(tenantId)) {
        this.tenantTemplates.set(tenantId, new Set());
      }
      this.tenantTemplates.get(tenantId)!.add(template.id);
    }

    this.logger.log(`Mail template saved: ${templateKey}`);
    return template;
  }

  /**
   * 删除邮件模板
   */
  async deleteTemplate(templateId: string, tenantId?: string): Promise<boolean> {
    const templateKey = tenantId ? `${tenantId}:${templateId}` : templateId;
    const deleted = this.templateStore.delete(templateKey);

    if (deleted && tenantId) {
      const tenantTemplateSet = this.tenantTemplates.get(tenantId);
      if (tenantTemplateSet) {
        tenantTemplateSet.delete(templateId);
      }
    }

    if (deleted) {
      this.logger.log(`Mail template deleted: ${templateKey}`);
    }
    return deleted;
  }

  /**
   * 渲染模板
   */
  async renderTemplate(
    template: IMailTemplate,
    variables: IMailTemplateVariables
  ): Promise<Partial<IMailMessage>> {
    // 获取编译后的模板
    const templateKey = variables.processInstanceId || template.id;
    let entry = this.templateStore.get(templateKey);

    if (!entry || entry.template.id !== template.id) {
      // 如果缓存中没有，重新编译
      entry = {
        template,
        compiledSubject: compile(template.subject),
        compiledPlainContent: template.plainContent ? compile(template.plainContent) : undefined,
        compiledHtmlContent: template.htmlContent ? compile(template.htmlContent) : undefined,
        compiledAt: new Date(),
      };
    }

    // 准备渲染上下文
    const context = this.buildRenderContext(variables);

    // 渲染模板
    const result: Partial<IMailMessage> = {
      subject: entry.compiledSubject(context),
      charset: template.charset,
    };

    if (entry.compiledPlainContent) {
      result.plainContent = entry.compiledPlainContent(context);
    }

    if (entry.compiledHtmlContent) {
      result.htmlContent = entry.compiledHtmlContent(context);
    }

    if (template.defaultFrom) {
      result.from = template.defaultFrom;
    }

    return result;
  }

  /**
   * 构建渲染上下文
   */
  private buildRenderContext(variables: IMailTemplateVariables): Record<string, unknown> {
    const context: Record<string, unknown> = {
      // 流程相关变量
      processInstanceId: variables.processInstanceId,
      taskId: variables.taskId,
      executionId: variables.executionId,
      // 时间变量
      currentTime: new Date().toISOString(),
      currentDate: new Date().toLocaleDateString(),
      currentTimeStr: new Date().toLocaleTimeString(),
    };

    // 合并流程变量
    if (variables.processVariables) {
      Object.assign(context, variables.processVariables);
    }

    // 合并任务变量
    if (variables.taskVariables) {
      Object.assign(context, variables.taskVariables);
    }

    // 合并自定义变量
    if (variables.customVariables) {
      Object.assign(context, variables.customVariables);
    }

    return context;
  }

  /**
   * 获取所有模板ID
   */
  getAllTemplateIds(tenantId?: string): string[] {
    if (tenantId) {
      const tenantSet = this.tenantTemplates.get(tenantId);
      return tenantSet ? Array.from(tenantSet) : [];
    }

    return Array.from(this.templateStore.keys()).filter((key) => !key.includes(':'));
  }

  /**
   * 清除模板缓存
   */
  clearCache(): void {
    this.templateStore.clear();
    this.tenantTemplates.clear();
    this.initializeBuiltinTemplates();
    this.logger.log('Mail template cache cleared');
  }
}
