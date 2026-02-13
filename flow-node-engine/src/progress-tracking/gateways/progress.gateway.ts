/**
 * 进度WebSocket网关
 * 提供实时进度推送功能
 */
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { ProgressTrackingService, ProgressEvent, ProgressEventType } from '../services/progress-tracking.service';

/**
 * 客户端订阅信息
 */
interface ClientSubscription {
  socketId: string;
  processInstanceIds: Set<string>;
  taskIds: Set<string>;
  tenantId?: string;
  userId?: string;
}

/**
 * 进度WebSocket网关配置
 */
@WebSocketGateway({
  namespace: '/progress',
  cors: {
    origin: '*', // 生产环境应配置具体域名
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class ProgressGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(ProgressGateway.name);

  /** 客户端订阅映射 */
  private clientSubscriptions: Map<string, ClientSubscription> = new Map();

  /** 进度ID到Socket的映射 */
  private progressToSockets: Map<string, Set<string>> = new Map();

  constructor(private readonly progressTrackingService: ProgressTrackingService) {}

  /**
   * 客户端连接时
   */
  handleConnection(client: Socket): void {
    this.logger.log(`客户端连接: ${client.id}`);

    // 初始化订阅信息
    this.clientSubscriptions.set(client.id, {
      socketId: client.id,
      processInstanceIds: new Set(),
      taskIds: new Set(),
    });

    // 从握手信息中获取用户信息
    const tenantId = client.handshake.query.tenantId as string;
    const userId = client.handshake.query.userId as string;

    if (tenantId) {
      this.clientSubscriptions.get(client.id)!.tenantId = tenantId;
    }
    if (userId) {
      this.clientSubscriptions.get(client.id)!.userId = userId;
    }
  }

  /**
   * 客户端断开连接时
   */
  handleDisconnect(client: Socket): void {
    this.logger.log(`客户端断开连接: ${client.id}`);

    // 清理订阅映射
    const subscription = this.clientSubscriptions.get(client.id);
    if (subscription) {
      // 清理进度到Socket的映射
      subscription.processInstanceIds.forEach((processInstanceId) => {
        const sockets = this.progressToSockets.get(processInstanceId);
        if (sockets) {
          sockets.delete(client.id);
          if (sockets.size === 0) {
            this.progressToSockets.delete(processInstanceId);
          }
        }
      });

      this.clientSubscriptions.delete(client.id);
    }
  }

  // ==================== 订阅消息处理 ====================

  /**
   * 订阅流程实例进度
   */
  @SubscribeMessage('subscribe:process')
  async handleSubscribeProcess(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { processInstanceId: string },
  ): Promise<void> {
    const subscription = this.clientSubscriptions.get(client.id);
    if (!subscription) {
      return;
    }

    subscription.processInstanceIds.add(data.processInstanceId);

    // 更新进度到Socket的映射
    if (!this.progressToSockets.has(data.processInstanceId)) {
      this.progressToSockets.set(data.processInstanceId, new Set());
    }
    this.progressToSockets.get(data.processInstanceId)!.add(client.id);

    this.logger.debug(`客户端 ${client.id} 订阅流程实例: ${data.processInstanceId}`);

    // 发送当前进度状态
    try {
      const progress = await this.progressTrackingService.getProgressByProcessInstanceId(
        data.processInstanceId,
      );
      if (progress) {
        client.emit('progress:initial', {
          processInstanceId: data.processInstanceId,
          progress: this.sanitizeProgress(progress),
        });
      }
    } catch (error) {
      this.logger.error(`获取初始进度失败: ${data.processInstanceId}`, error);
    }
  }

  /**
   * 取消订阅流程实例进度
   */
  @SubscribeMessage('unsubscribe:process')
  handleUnsubscribeProcess(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { processInstanceId: string },
  ): void {
    const subscription = this.clientSubscriptions.get(client.id);
    if (!subscription) {
      return;
    }

    subscription.processInstanceIds.delete(data.processInstanceId);

    // 更新进度到Socket的映射
    const sockets = this.progressToSockets.get(data.processInstanceId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.progressToSockets.delete(data.processInstanceId);
      }
    }

    this.logger.debug(`客户端 ${client.id} 取消订阅流程实例: ${data.processInstanceId}`);
  }

  /**
   * 订阅任务进度
   */
  @SubscribeMessage('subscribe:task')
  async handleSubscribeTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ): Promise<void> {
    const subscription = this.clientSubscriptions.get(client.id);
    if (!subscription) {
      return;
    }

    subscription.taskIds.add(data.taskId);

    this.logger.debug(`客户端 ${client.id} 订阅任务: ${data.taskId}`);

    // 发送当前进度状态
    try {
      const progress = await this.progressTrackingService.getProgressByTaskId(data.taskId);
      if (progress) {
        client.emit('progress:initial', {
          taskId: data.taskId,
          progress: this.sanitizeProgress(progress),
        });
      }
    } catch (error) {
      this.logger.error(`获取初始进度失败: ${data.taskId}`, error);
    }
  }

  /**
   * 取消订阅任务进度
   */
  @SubscribeMessage('unsubscribe:task')
  handleUnsubscribeTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { taskId: string },
  ): void {
    const subscription = this.clientSubscriptions.get(client.id);
    if (!subscription) {
      return;
    }

    subscription.taskIds.delete(data.taskId);
    this.logger.debug(`客户端 ${client.id} 取消订阅任务: ${data.taskId}`);
  }

  /**
   * 订阅租户所有进度
   */
  @SubscribeMessage('subscribe:tenant')
  handleSubscribeTenant(@ConnectedSocket() client: Socket): void {
    const subscription = this.clientSubscriptions.get(client.id);
    if (!subscription) {
      return;
    }

    // 标记为订阅租户所有进度
    subscription.processInstanceIds.add('*');
    this.logger.debug(`客户端 ${client.id} 订阅租户所有进度`);
  }

  /**
   * 获取进度看板数据
   */
  @SubscribeMessage('dashboard:get')
  async handleGetDashboard(@ConnectedSocket() client: Socket): Promise<void> {
    const subscription = this.clientSubscriptions.get(client.id);
    if (!subscription) {
      return;
    }

    try {
      const dashboard = await this.progressTrackingService.getDashboard(subscription.tenantId);
      client.emit('dashboard:data', dashboard);
    } catch (error) {
      this.logger.error('获取看板数据失败', error);
      client.emit('error', { message: '获取看板数据失败' });
    }
  }

  // ==================== 事件监听 ====================

  /**
   * 监听进度创建事件
   */
  @OnEvent(ProgressEventType.PROGRESS_CREATED)
  handleProgressCreated(event: ProgressEvent): void {
    this.broadcastProgress(event);
  }

  /**
   * 监听进度更新事件
   */
  @OnEvent(ProgressEventType.PROGRESS_UPDATED)
  handleProgressUpdated(event: ProgressEvent): void {
    this.broadcastProgress(event);
  }

  /**
   * 监听进度完成事件
   */
  @OnEvent(ProgressEventType.PROGRESS_COMPLETED)
  handleProgressCompleted(event: ProgressEvent): void {
    this.broadcastProgress(event);
  }

  /**
   * 监听进度取消事件
   */
  @OnEvent(ProgressEventType.PROGRESS_CANCELLED)
  handleProgressCancelled(event: ProgressEvent): void {
    this.broadcastProgress(event);
  }

  /**
   * 监听进度预警事件
   */
  @OnEvent(ProgressEventType.PROGRESS_WARNING)
  handleProgressWarning(event: ProgressEvent): void {
    this.broadcastProgress(event);
  }

  /**
   * 监听进度超时事件
   */
  @OnEvent(ProgressEventType.PROGRESS_TIMEOUT)
  handleProgressTimeout(event: ProgressEvent): void {
    this.broadcastProgress(event);
  }

  /**
   * 监听通用进度变更事件
   */
  @OnEvent('progress.changed')
  handleProgressChanged(event: ProgressEvent): void {
    // 可以在这里添加额外的处理逻辑
    this.logger.debug(`进度变更: ${event.progressId}, 类型: ${event.type}`);
  }

  // ==================== 广播方法 ====================

  /**
   * 广播进度更新
   */
  private broadcastProgress(event: ProgressEvent): void {
    const progress = event.data;
    const processInstanceId = progress.process_inst_id_;
    const taskId = progress.task_id_;

    // 构造发送数据
    const payload = {
      type: event.type,
      progressId: event.progressId,
      timestamp: event.timestamp.toISOString(),
      data: this.sanitizeProgress(progress),
    };

    // 发送给订阅了特定流程实例的客户端
    if (processInstanceId) {
      const sockets = this.progressToSockets.get(processInstanceId);
      if (sockets) {
        sockets.forEach((socketId) => {
          this.server.to(socketId).emit('progress:update', {
            ...payload,
            processInstanceId,
          });
        });
      }
    }

    // 发送给订阅了租户所有进度的客户端
    this.clientSubscriptions.forEach((subscription, socketId) => {
      if (subscription.processInstanceIds.has('*')) {
        this.server.to(socketId).emit('progress:update', payload);
      }
    });

    // 发送给订阅了特定任务的客户端
    if (taskId) {
      this.clientSubscriptions.forEach((subscription, socketId) => {
        if (subscription.taskIds.has(taskId)) {
          this.server.to(socketId).emit('progress:update', {
            ...payload,
            taskId,
          });
        }
      });
    }
  }

  /**
   * 广播给所有客户端
   */
  broadcastToAll(event: string, data: any): void {
    this.server.emit(event, data);
  }

  /**
   * 广播给特定租户的客户端
   */
  broadcastToTenant(tenantId: string, event: string, data: any): void {
    this.clientSubscriptions.forEach((subscription, socketId) => {
      if (subscription.tenantId === tenantId) {
        this.server.to(socketId).emit(event, data);
      }
    });
  }

  /**
   * 广播给特定用户的客户端
   */
  broadcastToUser(userId: string, event: string, data: any): void {
    this.clientSubscriptions.forEach((subscription, socketId) => {
      if (subscription.userId === userId) {
        this.server.to(socketId).emit(event, data);
      }
    });
  }

  // ==================== 辅助方法 ====================

  /**
   * 清理进度数据，只返回必要字段
   */
  private sanitizeProgress(progress: any): any {
    return {
      id: progress.id_,
      type: progress.type_,
      processInstanceId: progress.process_inst_id_,
      taskId: progress.task_id_,
      name: progress.name_,
      status: progress.status_,
      percentage: progress.percentage_,
      totalSteps: progress.total_steps_,
      completedSteps: progress.completed_steps_,
      currentStepName: progress.current_step_name_,
      currentStepDescription: progress.current_step_description_,
      startTime: progress.start_time_?.toISOString(),
      endTime: progress.end_time_?.toISOString(),
      estimatedEndTime: progress.estimated_end_time_?.toISOString(),
      estimatedDuration: progress.estimated_duration_,
      actualDuration: progress.actual_duration_,
      isWarning: progress.is_warning_,
      warningMessage: progress.warning_message_,
      warningTime: progress.warning_time_?.toISOString(),
      isTimeout: progress.is_timeout_,
      extraData: progress.extra_data_,
    };
  }

  /**
   * 获取在线客户端数量
   */
  getOnlineCount(): number {
    return this.clientSubscriptions.size;
  }

  /**
   * 获取订阅统计
   */
  getSubscriptionStats(): {
    totalClients: number;
    totalProcessSubscriptions: number;
    totalTaskSubscriptions: number;
  } {
    let totalProcessSubscriptions = 0;
    let totalTaskSubscriptions = 0;

    this.clientSubscriptions.forEach((subscription) => {
      totalProcessSubscriptions += subscription.processInstanceIds.size;
      totalTaskSubscriptions += subscription.taskIds.size;
    });

    return {
      totalClients: this.clientSubscriptions.size,
      totalProcessSubscriptions,
      totalTaskSubscriptions,
    };
  }
}
