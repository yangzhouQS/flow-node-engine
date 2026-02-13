/**
 * 通知服务
 * 统一的多渠道通知发送服务
 */
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { InAppNotificationService } from './in-app-notification.service';
import {
  NotificationType,
  NotificationPriority,
} from '../entities/in-app-notification.entity';

export type NotificationChannel =
  | 'IN_APP'     // 站内通知
  | 'EMAIL'      // 邮件
  | 'SMS'        // 短信
  | 'WECHAT'     // 微信
  | 'DINGTALK'   // 钉钉
  | 'WEBHOOK';   // Webhook回调

export interface NotificationConfig {
  channels: NotificationChannel[];
  emailConfig?: EmailConfig;
  smsConfig?: SmsConfig;
  wechatConfig?: WechatConfig;
  dingtalkConfig?: DingtalkConfig;
  webhookConfig?: WebhookConfig;
}

export interface EmailConfig {
  enabled: boolean;
  from: string;
  templatePrefix?: string;
}

export interface SmsConfig {
  enabled: boolean;
  provider: 'aliyun' | 'tencent' | 'custom';
  accessKeyId?: string;
  accessKeySecret?: string;
  signName?: string;
  templateCode?: string;
}

export interface WechatConfig {
  enabled: boolean;
  corpId?: string;
  agentId?: string;
  secret?: string;
}

export interface DingtalkConfig {
  enabled: boolean;
  webhook?: string;
  secret?: string;
}

export interface WebhookConfig {
  enabled: boolean;
  url?: string;
  headers?: Record<string, string>;
}

export interface SendNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  content?: string;
  priority?: NotificationPriority;
  taskId?: string;
  processInstanceId?: string;
  processDefinitionId?: string;
  link?: string;
  extraData?: Record<string, any>;
  senderId?: string;
  senderName?: string;
  channels?: NotificationChannel[];
  // 额外的通知渠道参数
  email?: string;
  phone?: string;
  wechatUserId?: string;
  dingtalkUserId?: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  channelResults?: Record<NotificationChannel, { success: boolean; error?: string }>;
  error?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  private config: NotificationConfig = {
    channels: ['IN_APP'],
  };

  constructor(
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  /**
   * 发送通知
   */
  async sendNotification(dto: SendNotificationDto): Promise<NotificationResult> {
    this.logger.log(`发送通知: 用户=${dto.userId}, 类型=${dto.type}, 标题=${dto.title}`);

    const channels = dto.channels || this.config.channels;
    const channelResults: Record<string, { success: boolean; error?: string }> = {};

    let notificationId: string | undefined;

    try {
      // 1. 始终创建站内通知
      const inAppNotification = await this.inAppNotificationService.createNotification({
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        priority: dto.priority,
        taskId: dto.taskId,
        processInstanceId: dto.processInstanceId,
        processDefinitionId: dto.processDefinitionId,
        link: dto.link,
        extraData: dto.extraData,
        senderId: dto.senderId,
        senderName: dto.senderName,
      });

      notificationId = inAppNotification.id;
      channelResults['IN_APP'] = { success: true };

      // 2. 发送到其他渠道
      for (const channel of channels) {
        if (channel === 'IN_APP') continue; // 已处理

        try {
          switch (channel) {
            case 'EMAIL':
              await this.sendEmailNotification(dto);
              channelResults['EMAIL'] = { success: true };
              break;
            case 'SMS':
              await this.sendSmsNotification(dto);
              channelResults['SMS'] = { success: true };
              break;
            case 'WECHAT':
              await this.sendWechatNotification(dto);
              channelResults['WECHAT'] = { success: true };
              break;
            case 'DINGTALK':
              await this.sendDingtalkNotification(dto);
              channelResults['DINGTALK'] = { success: true };
              break;
            case 'WEBHOOK':
              await this.sendWebhookNotification(dto);
              channelResults['WEBHOOK'] = { success: true };
              break;
          }
        } catch (error) {
          this.logger.error(`通知渠道 ${channel} 发送失败: ${error.message}`);
          channelResults[channel] = { success: false, error: error.message };
        }
      }

      return {
        success: true,
        notificationId,
        channelResults: channelResults as any,
      };
    } catch (error) {
      this.logger.error(`发送通知失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 批量发送通知
   */
  async sendNotifications(
    notifications: SendNotificationDto[],
  ): Promise<NotificationResult[]> {
    return Promise.all(notifications.map((n) => this.sendNotification(n)));
  }

  /**
   * 任务分配事件处理
   */
  @OnEvent('task.assigned')
  async handleTaskAssignedEvent(event: any): Promise<void> {
    this.logger.debug(`处理任务分配事件: ${event.taskId}`);

    await this.sendNotification({
      userId: event.assignee,
      type: 'TASK_ASSIGNED',
      title: `新任务：${event.taskName}`,
      content: `您有一个新的待办任务需要处理`,
      priority: 'NORMAL',
      taskId: event.taskId,
      processInstanceId: event.processInstanceId,
      link: `/task/${event.taskId}`,
      senderId: event.assignerId,
      senderName: event.assignerName,
    });
  }

  /**
   * 任务完成事件处理
   */
  @OnEvent('task.completed')
  async handleTaskCompletedEvent(event: any): Promise<void> {
    this.logger.debug(`处理任务完成事件: ${event.taskId}`);

    // 通知流程发起人
    if (event.starterId) {
      await this.sendNotification({
        userId: event.starterId,
        type: 'TASK_COMPLETED',
        title: `任务已完成：${event.taskName}`,
        content: `任务已被 ${event.completerName || '用户'} 完成`,
        priority: 'LOW',
        taskId: event.taskId,
        processInstanceId: event.processInstanceId,
        link: `/process/${event.processInstanceId}`,
      });
    }
  }

  /**
   * 任务驳回事件处理
   */
  @OnEvent('task.rejected')
  async handleTaskRejectedEvent(event: any): Promise<void> {
    this.logger.debug(`处理任务驳回事件: ${event.taskId}`);

    await this.sendNotification({
      userId: event.rejectToUserId,
      type: 'TASK_REJECTED',
      title: `任务被驳回：${event.rejectToTaskName}`,
      content: `任务已被驳回，原因：${event.reason || '无'}`,
      priority: 'HIGH',
      taskId: event.rejectToTaskId,
      processInstanceId: event.processInstanceId,
      link: `/task/${event.rejectToTaskId}`,
      senderId: event.rejectUserId,
      senderName: event.rejectUserName,
    });
  }

  /**
   * 抄送事件处理
   */
  @OnEvent('task.cc')
  async handleTaskCcEvent(event: any): Promise<void> {
    this.logger.debug(`处理抄送事件: ${event.taskId}`);

    const notifications = event.ccUserIds.map((userId: string) => ({
      userId,
      type: 'TASK_CC' as NotificationType,
      title: `抄送给您：${event.taskName}`,
      content: event.comment || '您收到一条抄送消息',
      priority: 'LOW' as NotificationPriority,
      taskId: event.taskId,
      processInstanceId: event.processInstanceId,
      link: `/task/${event.taskId}?view=cc`,
      senderId: event.senderId,
      senderName: event.senderName,
    }));

    await this.sendNotifications(notifications);
  }

  /**
   * 流程启动事件处理
   */
  @OnEvent('process.started')
  async handleProcessStartedEvent(event: any): Promise<void> {
    this.logger.debug(`处理流程启动事件: ${event.processInstanceId}`);
    // 可以添加流程启动通知逻辑
  }

  /**
   * 流程完成事件处理
   */
  @OnEvent('process.completed')
  async handleProcessCompletedEvent(event: any): Promise<void> {
    this.logger.debug(`处理流程完成事件: ${event.processInstanceId}`);

    if (event.starterId) {
      await this.sendNotification({
        userId: event.starterId,
        type: 'PROCESS_COMPLETED',
        title: `流程已完成：${event.processName}`,
        content: `您的流程已成功完成`,
        priority: 'NORMAL',
        processInstanceId: event.processInstanceId,
        link: `/process/${event.processInstanceId}`,
      });
    }
  }

  /**
   * 流程终止事件处理
   */
  @OnEvent('process.terminated')
  async handleProcessTerminatedEvent(event: any): Promise<void> {
    this.logger.debug(`处理流程终止事件: ${event.processInstanceId}`);

    if (event.starterId) {
      await this.sendNotification({
        userId: event.starterId,
        type: 'PROCESS_TERMINATED',
        title: `流程已终止：${event.processName}`,
        content: `流程已被终止，原因：${event.reason || '无'}`,
        priority: 'HIGH',
        processInstanceId: event.processInstanceId,
        link: `/process/${event.processInstanceId}`,
        senderId: event.terminatorId,
        senderName: event.terminatorName,
      });
    }
  }

  /**
   * 截止日期警告事件处理
   */
  @OnEvent('task.deadline.warning')
  async handleDeadlineWarningEvent(event: any): Promise<void> {
    this.logger.debug(`处理截止日期警告事件: ${event.taskId}`);

    await this.sendNotification({
      userId: event.assignee,
      type: 'DEADLINE_WARNING',
      title: `任务即将超期：${event.taskName}`,
      content: `任务将在 ${event.remainingTime} 后超期，请尽快处理`,
      priority: 'HIGH',
      taskId: event.taskId,
      processInstanceId: event.processInstanceId,
      link: `/task/${event.taskId}`,
    });
  }

  /**
   * 任务超期事件处理
   */
  @OnEvent('task.deadline.overdue')
  async handleDeadlineOverdueEvent(event: any): Promise<void> {
    this.logger.debug(`处理任务超期事件: ${event.taskId}`);

    await this.sendNotification({
      userId: event.assignee,
      type: 'DEADLINE_OVERDUE',
      title: `任务已超期：${event.taskName}`,
      content: `任务已超期 ${event.overdueTime}，请立即处理`,
      priority: 'URGENT',
      taskId: event.taskId,
      processInstanceId: event.processInstanceId,
      link: `/task/${event.taskId}`,
    });
  }

  /**
   * 发送邮件通知
   */
  private async sendEmailNotification(dto: SendNotificationDto): Promise<void> {
    if (!this.config.emailConfig?.enabled || !dto.email) {
      return;
    }

    this.logger.debug(`发送邮件通知到: ${dto.email}`);
    // TODO: 实现邮件发送逻辑
    // 可以集成 nodemailer 或其他邮件服务
  }

  /**
   * 发送短信通知
   */
  private async sendSmsNotification(dto: SendNotificationDto): Promise<void> {
    if (!this.config.smsConfig?.enabled || !dto.phone) {
      return;
    }

    this.logger.debug(`发送短信通知到: ${dto.phone}`);
    // TODO: 实现短信发送逻辑
    // 可以集成阿里云、腾讯云短信服务
  }

  /**
   * 发送微信通知
   */
  private async sendWechatNotification(dto: SendNotificationDto): Promise<void> {
    if (!this.config.wechatConfig?.enabled || !dto.wechatUserId) {
      return;
    }

    this.logger.debug(`发送微信通知到: ${dto.wechatUserId}`);
    // TODO: 实现微信消息发送逻辑
    // 可以集成企业微信API
  }

  /**
   * 发送钉钉通知
   */
  private async sendDingtalkNotification(dto: SendNotificationDto): Promise<void> {
    if (!this.config.dingtalkConfig?.enabled) {
      return;
    }

    this.logger.debug(`发送钉钉通知`);
    // TODO: 实现钉钉消息发送逻辑
    // 可以集成钉钉机器人API
  }

  /**
   * 发送Webhook通知
   */
  private async sendWebhookNotification(dto: SendNotificationDto): Promise<void> {
    if (!this.config.webhookConfig?.enabled || !this.config.webhookConfig.url) {
      return;
    }

    this.logger.debug(`发送Webhook通知到: ${this.config.webhookConfig.url}`);
    
    try {
      const response = await fetch(this.config.webhookConfig.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhookConfig.headers,
        },
        body: JSON.stringify({
          userId: dto.userId,
          type: dto.type,
          title: dto.title,
          content: dto.content,
          priority: dto.priority,
          taskId: dto.taskId,
          processInstanceId: dto.processInstanceId,
          link: dto.link,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook请求失败: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Webhook通知发送失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新通知配置
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log(`通知配置已更新`);
  }

  /**
   * 获取当前配置
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }
}
