/**
 * 任务评论集成服务
 * 将评论功能集成到任务操作中
 */
import { Injectable, Logger } from '@nestjs/common';
import { TaskService } from '../../task/services/task.service';
import { CommentService } from '../../comment/services/comment.service';
import { CommentType } from '../../comment/entities/comment.entity';
import { CompleteTaskDto } from '../../task/dto/complete-task.dto';
import { Task, TaskStatus } from '../../task/entities/task.entity';

/**
 * 任务评论集成服务
 */
@Injectable()
export class TaskCommentIntegrationService {
  private readonly logger = new Logger(TaskCommentIntegrationService.name);

  constructor(
    private readonly taskService: TaskService,
    private readonly commentService: CommentService,
  ) {}

  /**
   * 完成任务并添加评论
   */
  async completeWithComment(
    completeTaskDto: CompleteTaskDto,
    commentMessage?: string,
    userName?: string
  ): Promise<Task> {
    const task = await this.taskService.complete(completeTaskDto);

    // 添加审批评论
    if (commentMessage && task.processInstanceId) {
      await this.commentService.addApprovalComment(
        task.processInstanceId,
        task.id,
        completeTaskDto.userId,
        commentMessage,
        userName,
        task.tenantId
      );
    }

    this.logger.log(`Task ${task.id} completed with comment`);
    return task;
  }

  /**
   * 驳回任务并添加评论
   */
  async rejectWithComment(
    taskId: string,
    userId: string,
    rejectReason: string,
    userName?: string
  ): Promise<Task> {
    const task = await this.taskService.findById(taskId);

    // 检查任务状态
    if (task.status !== TaskStatus.ASSIGNED) {
      throw new Error('Task is not assigned');
    }

    // 添加驳回评论
    if (task.processInstanceId) {
      await this.commentService.addRejectComment(
        task.processInstanceId,
        task.id,
        userId,
        rejectReason,
        userName,
        task.tenantId
      );
    }

    // 取消任务
    const cancelledTask = await this.taskService.cancel(taskId, rejectReason);

    this.logger.log(`Task ${taskId} rejected with comment`);
    return cancelledTask;
  }

  /**
   * 转办任务并添加评论
   */
  async transferWithComment(
    taskId: string,
    fromUserId: string,
    toUserId: string,
    toUserName: string,
    transferReason: string,
    fromUserName?: string
  ): Promise<Task> {
    const task = await this.taskService.findById(taskId);

    // 取消当前任务的认领
    await this.taskService.unclaim(taskId);

    // 重新认领给目标用户
    await this.taskService.claim({
      taskId,
      assignee: toUserId,
      assigneeFullName: toUserName,
    });

    // 添加转办评论
    if (task.processInstanceId) {
      await this.commentService.addComment({
        processInstanceId: task.processInstanceId,
        taskId: task.id,
        userId: fromUserId,
        userName: fromUserName,
        message: `任务已转办给 ${toUserName}。原因：${transferReason}`,
        type: CommentType.DELEGATE,
        tenantId: task.tenantId,
      });
    }

    this.logger.log(`Task ${taskId} transferred from ${fromUserId} to ${toUserId}`);
    return this.taskService.findById(taskId);
  }

  /**
   * 退回任务并添加评论
   */
  async returnWithComment(
    taskId: string,
    userId: string,
    returnReason: string,
    targetTaskDefinitionKey?: string,
    userName?: string
  ): Promise<Task> {
    const task = await this.taskService.findById(taskId);

    // 添加退回评论
    if (task.processInstanceId) {
      await this.commentService.addComment({
        processInstanceId: task.processInstanceId,
        taskId: task.id,
        userId,
        userName,
        message: returnReason,
        type: CommentType.RETURN,
        tenantId: task.tenantId,
        metadata: {
          targetTaskDefinitionKey,
          returnFrom: task.taskDefinitionKey,
        },
      });
    }

    // 取消当前任务
    const cancelledTask = await this.taskService.cancel(taskId, returnReason);

    this.logger.log(`Task ${taskId} returned with comment`);
    return cancelledTask;
  }

  /**
   * 认领任务并添加系统评论
   */
  async claimWithSystemComment(
    taskId: string,
    assignee: string,
    assigneeFullName: string
  ): Promise<Task> {
    const task = await this.taskService.claim({
      taskId,
      assignee,
      assigneeFullName,
    });

    // 添加系统评论
    if (task.processInstanceId) {
      await this.commentService.addSystemComment(
        task.processInstanceId,
        task.id,
        `任务已被 ${assigneeFullName} 认领`,
        task.tenantId,
        {
          action: 'claim',
          assignee,
          assigneeFullName,
        }
      );
    }

    this.logger.log(`Task ${taskId} claimed by ${assignee}`);
    return task;
  }

  /**
   * 取消认领任务并添加系统评论
   */
  async unclaimWithSystemComment(taskId: string): Promise<Task> {
    const task = await this.taskService.findById(taskId);
    const previousAssignee = task.assignee;
    const previousAssigneeName = task.assigneeFullName;

    const updatedTask = await this.taskService.unclaim(taskId);

    // 添加系统评论
    if (task.processInstanceId && previousAssignee) {
      await this.commentService.addSystemComment(
        task.processInstanceId,
        task.id,
        `任务已取消认领（原负责人：${previousAssigneeName || previousAssignee}）`,
        task.tenantId,
        {
          action: 'unclaim',
          previousAssignee,
          previousAssigneeName,
        }
      );
    }

    this.logger.log(`Task ${taskId} unclaimed`);
    return updatedTask;
  }

  /**
   * 获取任务及其评论
   */
  async getTaskWithComments(taskId: string) {
    const task = await this.taskService.findById(taskId);
    const comments = await this.commentService.getTaskComments(taskId);

    return {
      task,
      comments: comments.data,
      commentTotal: comments.total,
    };
  }

  /**
   * 批量获取任务评论统计
   */
  async getTaskCommentStats(taskIds: string[]) {
    const stats = new Map<string, { total: number; byType: Record<CommentType, number> }>();

    for (const taskId of taskIds) {
      const commentStats = await this.commentService.getCommentStats(undefined, taskId);
      stats.set(taskId, {
        total: commentStats.totalComments + commentStats.totalReplies,
        byType: commentStats.byType,
      });
    }

    return stats;
  }
}
