/**
 * 站内通知服务
 * 管理用户站内通知的创建、查询、标记已读等操作
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';

import {
  InAppNotification,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
} from '../entities/in-app-notification.entity';

export interface CreateNotificationDto {
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
  expiresAt?: Date;
}

export interface NotificationQueryDto {
  userId: string;
  status?: NotificationStatus;
  type?: NotificationType;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface NotificationSummary {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
  byPriority: Record<NotificationPriority, number>;
}

@Injectable()
export class InAppNotificationService {
  private readonly logger = new Logger(InAppNotificationService.name);

  constructor(
    @InjectRepository(InAppNotification)
    private readonly notificationRepository: Repository<InAppNotification>,
  ) {}

  /**
   * 创建通知
   */
  async createNotification(dto: CreateNotificationDto): Promise<InAppNotification> {
    this.logger.debug(`创建通知: 用户=${dto.userId}, 类型=${dto.type}, 标题=${dto.title}`);

    const notification = this.notificationRepository.create({
      id: this.generateUuid(),
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      content: dto.content || null,
      priority: dto.priority || 'NORMAL',
      status: 'UNREAD',
      taskId: dto.taskId || null,
      processInstanceId: dto.processInstanceId || null,
      processDefinitionId: dto.processDefinitionId || null,
      link: dto.link || null,
      extraData: dto.extraData || null,
      senderId: dto.senderId || null,
      senderName: dto.senderName || null,
      expiresAt: dto.expiresAt || null,
    });

    return this.notificationRepository.save(notification);
  }

  /**
   * 批量创建通知
   */
  async createNotifications(
    notifications: CreateNotificationDto[],
  ): Promise<InAppNotification[]> {
    const entities = notifications.map((dto) =>
      this.notificationRepository.create({
        id: this.generateUuid(),
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        content: dto.content || null,
        priority: dto.priority || 'NORMAL',
        status: 'UNREAD',
        taskId: dto.taskId || null,
        processInstanceId: dto.processInstanceId || null,
        processDefinitionId: dto.processDefinitionId || null,
        link: dto.link || null,
        extraData: dto.extraData || null,
        senderId: dto.senderId || null,
        senderName: dto.senderName || null,
        expiresAt: dto.expiresAt || null,
      }),
    );

    return this.notificationRepository.save(entities);
  }

  /**
   * 获取用户通知列表
   */
  async getNotifications(
    query: NotificationQueryDto,
  ): Promise<{ list: InAppNotification[]; total: number }> {
    const { userId, status, type, unreadOnly, page = 1, pageSize = 20 } = query;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('notification.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('notification.type = :type', { type });
    }

    if (unreadOnly) {
      queryBuilder.andWhere('notification.status = :unreadStatus', {
        unreadStatus: 'UNREAD',
      });
    }

    // 排除已过期的通知
    queryBuilder.andWhere(
      '(notification.expiresAt IS NULL OR notification.expiresAt > :now)',
      { now: new Date() },
    );

    queryBuilder
      .orderBy('notification.priority', 'DESC')
      .addOrderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return { list, total };
  }

  /**
   * 获取单条通知详情
   */
  async getNotificationById(id: string): Promise<InAppNotification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    return notification;
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(id: string, userId: string): Promise<InAppNotification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    if (notification.status === 'UNREAD') {
      notification.status = 'READ';
      notification.readAt = new Date();
      return this.notificationRepository.save(notification);
    }

    return notification;
  }

  /**
   * 批量标记为已读
   */
  async markAsReadBatch(
    ids: string[],
    userId: string,
  ): Promise<{ success: boolean; affected: number }> {
    const result = await this.notificationRepository.update(
      {
        id: In(ids),
        userId,
        status: 'UNREAD',
      },
      {
        status: 'READ',
        readAt: new Date(),
      },
    );

    return {
      success: true,
      affected: result.affected || 0,
    };
  }

  /**
   * 标记所有通知为已读
   */
  async markAllAsRead(userId: string): Promise<{ success: boolean; affected: number }> {
    const result = await this.notificationRepository.update(
      {
        userId,
        status: 'UNREAD',
      },
      {
        status: 'READ',
        readAt: new Date(),
      },
    );

    return {
      success: true,
      affected: result.affected || 0,
    };
  }

  /**
   * 归档通知
   */
  async archiveNotification(
    id: string,
    userId: string,
  ): Promise<InAppNotification> {
    const notification = await this.notificationRepository.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    notification.status = 'ARCHIVED';
    notification.archivedAt = new Date();

    return this.notificationRepository.save(notification);
  }

  /**
   * 删除通知
   */
  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const result = await this.notificationRepository.delete({
      id,
      userId,
    });

    return (result.affected || 0) > 0;
  }

  /**
   * 清理已读通知
   */
  async clearReadNotifications(userId: string): Promise<number> {
    const result = await this.notificationRepository.delete({
      userId,
      status: 'READ',
    });

    return result.affected || 0;
  }

  /**
   * 获取用户通知摘要
   */
  async getNotificationSummary(userId: string): Promise<NotificationSummary> {
    // 获取总数和未读数
    const [total, unread] = await Promise.all([
      this.notificationRepository.count({
        where: {
          userId,
          status: In(['UNREAD', 'READ']),
        },
      }),
      this.notificationRepository.count({
        where: {
          userId,
          status: 'UNREAD',
        },
      }),
    ]);

    // 按类型统计
    const typeStats = await this.notificationRepository
      .createQueryBuilder('notification')
      .select('notification.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.status IN (:...statuses)', {
        statuses: ['UNREAD', 'READ'],
      })
      .groupBy('notification.type')
      .getRawMany();

    const byType: Record<NotificationType, number> = {
      TASK_ASSIGNED: 0,
      TASK_COMPLETED: 0,
      TASK_REJECTED: 0,
      TASK_CC: 0,
      PROCESS_STARTED: 0,
      PROCESS_COMPLETED: 0,
      PROCESS_TERMINATED: 0,
      DEADLINE_WARNING: 0,
      DEADLINE_OVERDUE: 0,
      SYSTEM: 0,
    };

    typeStats.forEach((stat) => {
      byType[stat.type as NotificationType] = parseInt(stat.count, 10);
    });

    // 按优先级统计
    const priorityStats = await this.notificationRepository
      .createQueryBuilder('notification')
      .select('notification.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .where('notification.userId = :userId', { userId })
      .andWhere('notification.status = :status', { status: 'UNREAD' })
      .groupBy('notification.priority')
      .getRawMany();

    const byPriority: Record<NotificationPriority, number> = {
      LOW: 0,
      NORMAL: 0,
      HIGH: 0,
      URGENT: 0,
    };

    priorityStats.forEach((stat) => {
      byPriority[stat.priority as NotificationPriority] = parseInt(stat.count, 10);
    });

    return {
      total,
      unread,
      byType,
      byPriority,
    };
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: {
        userId,
        status: 'UNREAD',
      },
    });
  }

  /**
   * 清理过期通知
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .where('expiresAt IS NOT NULL AND expiresAt < :now', { now: new Date() })
      .execute();

    this.logger.log(`清理过期通知: ${result.affected} 条`);

    return result.affected || 0;
  }

  /**
   * 根据任务ID获取相关通知
   */
  async getNotificationsByTaskId(
    taskId: string,
    userId?: string,
  ): Promise<InAppNotification[]> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.taskId = :taskId', { taskId });

    if (userId) {
      queryBuilder.andWhere('notification.userId = :userId', { userId });
    }

    return queryBuilder.orderBy('notification.createdAt', 'DESC').getMany();
  }

  /**
   * 根据流程实例ID获取相关通知
   */
  async getNotificationsByProcessInstanceId(
    processInstanceId: string,
    userId?: string,
  ): Promise<InAppNotification[]> {
    const queryBuilder = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.processInstanceId = :processInstanceId', {
        processInstanceId,
      });

    if (userId) {
      queryBuilder.andWhere('notification.userId = :userId', { userId });
    }

    return queryBuilder.orderBy('notification.createdAt', 'DESC').getMany();
  }

  /**
   * 生成UUID
   */
  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
