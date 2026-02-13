/**
 * 通知控制器
 */
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { NotificationType, NotificationStatus } from '../entities/in-app-notification.entity';
import { InAppNotificationService } from '../services/in-app-notification.service';
import { NotificationService } from '../services/notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly inAppNotificationService: InAppNotificationService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 获取当前用户的通知列表
   */
  @Get()
  async getNotifications(
    @Request() req: any,
    @Query('status') status?: NotificationStatus,
    @Query('type') type?: NotificationType,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = req.user?.id || 'test-user'; // 从请求中获取用户ID

    return this.inAppNotificationService.getNotifications({
      userId,
      status,
      type,
      unreadOnly: unreadOnly === 'true',
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  /**
   * 获取通知摘要
   */
  @Get('summary')
  async getNotificationSummary(@Request() req: any) {
    const userId = req.user?.id || 'test-user';

    return this.inAppNotificationService.getNotificationSummary(userId);
  }

  /**
   * 获取未读通知数量
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const userId = req.user?.id || 'test-user';

    const count = await this.inAppNotificationService.getUnreadCount(userId);

    return { count };
  }

  /**
   * 获取单条通知详情
   */
  @Get(':id')
  async getNotificationById(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id || 'test-user';

    const notification = await this.inAppNotificationService.getNotificationById(id);

    // 验证通知所属用户
    if (notification.userId !== userId) {
      return { error: '无权访问此通知' };
    }

    return notification;
  }

  /**
   * 标记通知为已读
   */
  @Put(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id || 'test-user';

    return this.inAppNotificationService.markAsRead(id, userId);
  }

  /**
   * 批量标记为已读
   */
  @Post('read-batch')
  async markAsReadBatch(
    @Body() body: { ids: string[] },
    @Request() req: any,
  ) {
    const userId = req.user?.id || 'test-user';

    return this.inAppNotificationService.markAsReadBatch(body.ids, userId);
  }

  /**
   * 标记所有通知为已读
   */
  @Post('read-all')
  async markAllAsRead(@Request() req: any) {
    const userId = req.user?.id || 'test-user';

    return this.inAppNotificationService.markAllAsRead(userId);
  }

  /**
   * 归档通知
   */
  @Put(':id/archive')
  async archiveNotification(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id || 'test-user';

    return this.inAppNotificationService.archiveNotification(id, userId);
  }

  /**
   * 删除通知
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id || 'test-user';

    await this.inAppNotificationService.deleteNotification(id, userId);
  }

  /**
   * 清理已读通知
   */
  @Delete('clear-read')
  async clearReadNotifications(@Request() req: any) {
    const userId = req.user?.id || 'test-user';

    const count = await this.inAppNotificationService.clearReadNotifications(userId);

    return { deleted: count };
  }

  /**
   * 获取任务相关通知
   */
  @Get('task/:taskId')
  async getNotificationsByTaskId(
    @Param('taskId') taskId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id || 'test-user';

    return this.inAppNotificationService.getNotificationsByTaskId(taskId, userId);
  }

  /**
   * 获取流程实例相关通知
   */
  @Get('process/:processInstanceId')
  async getNotificationsByProcessInstanceId(
    @Param('processInstanceId') processInstanceId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id || 'test-user';

    return this.inAppNotificationService.getNotificationsByProcessInstanceId(
      processInstanceId,
      userId,
    );
  }
}
