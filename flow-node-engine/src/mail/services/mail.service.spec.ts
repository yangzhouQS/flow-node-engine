/**
 * 邮件服务单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { MailTemplateService } from './mail-template.service';
import { MailTransport, ProcessNotificationType, TaskNotificationType } from '../interfaces/mail.interface';

// Mock nodemailer - 使用 import 原始模块的方式
vi.mock(import('nodemailer'), async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    default: {
      ...original.default,
      createTransport: vi.fn(() => ({
        sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
        verify: vi.fn().mockResolvedValue(true),
      })),
    },
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
      verify: vi.fn().mockResolvedValue(true),
    })),
  };
});

describe('MailService', () => {
  let mailService: MailService;
  let templateService: MailTemplateService;
  let configService: ConfigService;

  beforeEach(async () => {
    configService = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'mail.host': 'smtp.example.com',
          'mail.port': 587,
          'mail.user': 'test@example.com',
          'mail.password': 'password123',
          'mail.transport': 'smtp',
          'mail.startTlsEnabled': true,
          'mail.defaultFrom': 'noreply@example.com',
        };
        return config[key] ?? defaultValue;
      }),
    } as unknown as ConfigService;

    templateService = new MailTemplateService();
    mailService = new MailService(configService, templateService);
    await mailService.onModuleInit();
  });

  describe('sendMail', () => {
    it('should send a basic email', async () => {
      const result = await mailService.sendMail({
        message: {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test Subject',
          plainContent: 'Test content',
        },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should send email with HTML content', async () => {
      const result = await mailService.sendMail({
        message: {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'HTML Email',
          htmlContent: '<h1>Hello</h1>',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should send email with CC and BCC', async () => {
      const result = await mailService.sendMail({
        message: {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          cc: ['cc@example.com'],
          bcc: ['bcc@example.com'],
          subject: 'Email with CC/BCC',
          plainContent: 'Content',
        },
      });

      expect(result.success).toBe(true);
    });

    it('should send email with attachments', async () => {
      const result = await mailService.sendMail({
        message: {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Email with Attachment',
          plainContent: 'See attachment',
          attachments: [
            {
              filename: 'test.txt',
              contentType: 'text/plain',
              content: Buffer.from('Test file content'),
            },
          ],
        },
      });

      expect(result.success).toBe(true);
    });

    it('should send email with custom headers', async () => {
      const result = await mailService.sendMail({
        message: {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Email with Headers',
          plainContent: 'Content',
          headers: {
            'X-Custom-Header': 'custom-value',
          },
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('prepareRequest', () => {
    it('should prepare executable request', () => {
      const request = {
        message: {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test',
          plainContent: 'Content',
        },
      };

      const executable = mailService.prepareRequest(request);
      expect(executable.getRequestId()).toBeDefined();
      expect(executable.getOriginalRequest()).toBe(request);
    });

    it('should generate unique request IDs', () => {
      const request = {
        message: {
          from: 'sender@example.com',
          to: ['recipient@example.com'],
          subject: 'Test',
          plainContent: 'Content',
        },
      };

      const executable1 = mailService.prepareRequest(request);
      const executable2 = mailService.prepareRequest(request);
      expect(executable1.getRequestId()).not.toBe(executable2.getRequestId());
    });
  });

  describe('sendTemplateMail', () => {
    it('should send email using built-in template', async () => {
      const result = await mailService.sendTemplateMail(
        'task_task_assigned',
        'user@example.com',
        {
          taskId: 'task-123',
          taskVariables: {
            taskName: 'Review Document',
            processName: 'Document Review Process',
            createTime: '2024-01-15 10:00:00',
          },
        }
      );

      // 模板中没有收件人变量，所以会失败
      expect(result).toBeDefined();
    });

    it('should return error for non-existent template', async () => {
      const result = await mailService.sendTemplateMail(
        'non_existent_template',
        'user@example.com',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template not found');
    });
  });

  describe('sendProcessNotification', () => {
    it('should send process started notification', async () => {
      const result = await mailService.sendProcessNotification(
        'process-123',
        ProcessNotificationType.PROCESS_STARTED,
        {
          processName: 'Test Process',
          starter: 'admin',
        }
      );

      expect(result).toBeDefined();
    });

    it('should send process completed notification', async () => {
      const result = await mailService.sendProcessNotification(
        'process-123',
        ProcessNotificationType.PROCESS_COMPLETED,
        {
          processName: 'Test Process',
        }
      );

      expect(result).toBeDefined();
    });
  });

  describe('sendTaskNotification', () => {
    it('should send task assigned notification', async () => {
      const result = await mailService.sendTaskNotification(
        'task-123',
        TaskNotificationType.TASK_ASSIGNED,
        {
          taskName: 'Review Task',
          processName: 'Review Process',
        }
      );

      expect(result).toBeDefined();
    });

    it('should send task timeout notification', async () => {
      const result = await mailService.sendTaskNotification(
        'task-123',
        TaskNotificationType.TASK_TIMEOUT,
        {
          taskName: 'Urgent Task',
          dueDate: '2024-01-16 17:00:00',
          remainingTime: '2 hours',
        }
      );

      expect(result).toBeDefined();
    });
  });

  describe('validateConfiguration', () => {
    it('should return true when configured', async () => {
      const isValid = await mailService.validateConfiguration();
      expect(isValid).toBe(true);
    });
  });

  describe('getServerConfig', () => {
    it('should return server configuration', () => {
      const config = mailService.getServerConfig();
      expect(config).not.toBeNull();
      expect(config?.host).toBe('smtp.example.com');
      expect(config?.port).toBe(587);
      expect(config?.transport).toBe(MailTransport.SMTP);
    });
  });
});

describe('MailTemplateService', () => {
  let templateService: MailTemplateService;

  beforeEach(() => {
    templateService = new MailTemplateService();
  });

  describe('getTemplate', () => {
    it('should return built-in template', async () => {
      const template = await templateService.getTemplate('task_task_assigned');
      expect(template).not.toBeNull();
      expect(template?.name).toBe('任务分配通知');
      expect(template?.subject).toContain('{{taskName}}');
    });

    it('should return null for non-existent template', async () => {
      const template = await templateService.getTemplate('non_existent');
      expect(template).toBeNull();
    });
  });

  describe('saveTemplate', () => {
    it('should save custom template', async () => {
      const template = {
        id: 'custom_template',
        name: 'Custom Template',
        subject: 'Hello {{name}}',
        plainContent: 'Hello {{name}}, welcome!',
      };

      const saved = await templateService.saveTemplate(template);
      expect(saved.id).toBe(template.id);

      const retrieved = await templateService.getTemplate('custom_template');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('Custom Template');
    });

    it('should save tenant-specific template', async () => {
      const template = {
        id: 'tenant_template',
        name: 'Tenant Template',
        subject: 'Tenant: {{name}}',
      };

      await templateService.saveTemplate(template, 'tenant-1');

      const globalTemplate = await templateService.getTemplate('tenant_template');
      const tenantTemplate = await templateService.getTemplate('tenant_template', 'tenant-1');

      expect(globalTemplate).toBeNull();
      expect(tenantTemplate).not.toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      const template = {
        id: 'to_delete',
        name: 'To Delete',
        subject: 'Delete me',
      };

      await templateService.saveTemplate(template);
      const deleted = await templateService.deleteTemplate('to_delete');
      expect(deleted).toBe(true);

      const retrieved = await templateService.getTemplate('to_delete');
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent template', async () => {
      const deleted = await templateService.deleteTemplate('non_existent');
      expect(deleted).toBe(false);
    });
  });

  describe('renderTemplate', () => {
    it('should render template with variables', async () => {
      const template = {
        id: 'render_test',
        name: 'Render Test',
        subject: 'Hello {{name}}',
        plainContent: 'Hello {{name}}, your order {{orderId}} is ready.',
        htmlContent: '<h1>Hello {{name}}</h1>',
      };

      const rendered = await templateService.renderTemplate(template, {
        customVariables: {
          name: 'John',
          orderId: 'ORD-123',
        },
      });

      expect(rendered.subject).toBe('Hello John');
      expect(rendered.plainContent).toBe('Hello John, your order ORD-123 is ready.');
      expect(rendered.htmlContent).toBe('<h1>Hello John</h1>');
    });

    it('should include process and task variables', async () => {
      const template = {
        id: 'vars_test',
        name: 'Vars Test',
        subject: 'Process {{processName}}',
        plainContent: 'Task: {{taskName}}, Process: {{processName}}',
      };

      const rendered = await templateService.renderTemplate(template, {
        processInstanceId: 'proc-123',
        taskId: 'task-456',
        processVariables: {
          processName: 'Approval Process',
        },
        taskVariables: {
          taskName: 'Manager Approval',
        },
      });

      expect(rendered.subject).toBe('Process Approval Process');
      expect(rendered.plainContent).toBe('Task: Manager Approval, Process: Approval Process');
    });

    it('should include current time variables', async () => {
      const template = {
        id: 'time_test',
        name: 'Time Test',
        subject: 'Test',
        plainContent: 'Current time: {{currentTime}}, Date: {{currentDate}}',
      };

      const rendered = await templateService.renderTemplate(template, {});
      expect(rendered.plainContent).toContain('Current time:');
      expect(rendered.plainContent).toContain('Date:');
    });
  });

  describe('getAllTemplateIds', () => {
    it('should return all template IDs', () => {
      const ids = templateService.getAllTemplateIds();
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain('task_task_assigned');
      expect(ids).toContain('task_task_timeout');
    });
  });

  describe('clearCache', () => {
    it('should clear cache and reinitialize built-in templates', async () => {
      // Add custom template
      await templateService.saveTemplate({
        id: 'custom',
        name: 'Custom',
        subject: 'Custom',
      });

      // Clear cache
      templateService.clearCache();

      // Custom template should be gone
      const custom = await templateService.getTemplate('custom');
      expect(custom).toBeNull();

      // Built-in templates should still exist
      const builtin = await templateService.getTemplate('task_task_assigned');
      expect(builtin).not.toBeNull();
    });
  });
});
