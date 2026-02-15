/**
 * 流程实例评论集成服务
 * 将评论功能集成到流程实例操作中
 */
import { Injectable, Logger } from '@nestjs/common';
import { CommentType } from '../../comment/entities/comment.entity';
import { CommentService } from '../../comment/services/comment.service';
import { ProcessInstance } from '../../process-instance/entities/process-instance.entity';
import { ProcessInstanceService } from '../../process-instance/services/process-instance.service';

/**
 * 流程实例评论集成服务
 */
@Injectable()
export class ProcessCommentIntegrationService {
  private readonly logger = new Logger(ProcessCommentIntegrationService.name);

  constructor(
    private readonly processInstanceService: ProcessInstanceService,
    private readonly commentService: CommentService,
  ) {}

  /**
   * 启动流程并添加系统评论
   */
  async startWithComment(
    processDefinitionKey: string,
    businessKey: string,
    variables: Record<string, any>,
    startUserId: string,
    tenantId?: string
  ): Promise<ProcessInstance> {
    // 启动流程
    const processInstance = await this.processInstanceService.startProcess({
      processDefinitionKey,
      businessKey,
      variables,
      tenantId,
    });

    // 添加启动评论
    await this.commentService.addSystemComment(
      processInstance.id,
      null,
      `流程已启动，发起人：${startUserId}`,
      tenantId,
      {
        action: 'start',
        startUserId,
        processDefinitionKey,
        businessKey,
      }
    );

    this.logger.log(`Process instance ${processInstance.id} started with comment`);
    return processInstance;
  }

  /**
   * 挂起流程并添加评论
   */
  async suspendWithComment(
    processInstanceId: string,
    suspendReason: string,
    userId: string,
    userName?: string
  ): Promise<ProcessInstance> {
    // 挂起流程
    const processInstance = await this.processInstanceService.suspend(processInstanceId);

    // 添加挂起评论
    await this.commentService.addComment({
      processInstanceId,
      userId,
      userName,
      message: suspendReason || '流程已挂起',
      type: CommentType.SYSTEM,
      isInternal: true,
      tenantId: processInstance.tenantId,
      metadata: {
        action: 'suspend',
      },
    });

    this.logger.log(`Process instance ${processInstanceId} suspended with comment`);
    return processInstance;
  }

  /**
   * 激活流程并添加评论
   */
  async activateWithComment(
    processInstanceId: string,
    activateReason: string,
    userId: string,
    userName?: string
  ): Promise<ProcessInstance> {
    // 激活流程
    const processInstance = await this.processInstanceService.activate(processInstanceId);

    // 添加激活评论
    await this.commentService.addComment({
      processInstanceId,
      userId,
      userName,
      message: activateReason || '流程已激活',
      type: CommentType.SYSTEM,
      isInternal: true,
      tenantId: processInstance.tenantId,
      metadata: {
        action: 'activate',
      },
    });

    this.logger.log(`Process instance ${processInstanceId} activated with comment`);
    return processInstance;
  }

  /**
   * 取消流程并添加评论
   */
  async cancelWithComment(
    processInstanceId: string,
    cancelReason: string,
    userId: string,
    userName?: string
  ): Promise<ProcessInstance> {
    // 取消流程
    const processInstance = await this.processInstanceService.cancel(processInstanceId, cancelReason);

    // 添加取消评论
    await this.commentService.addComment({
      processInstanceId,
      userId,
      userName,
      message: cancelReason || '流程已取消',
      type: CommentType.SYSTEM,
      tenantId: processInstance.tenantId,
      metadata: {
        action: 'cancel',
      },
    });

    this.logger.log(`Process instance ${processInstanceId} cancelled with comment`);
    return processInstance;
  }

  /**
   * 获取流程实例及其评论
   */
  async getProcessInstanceWithComments(processInstanceId: string) {
    const processInstance = await this.processInstanceService.findById(processInstanceId);
    const comments = await this.commentService.getProcessInstanceComments(processInstanceId);

    return {
      processInstance,
      comments: comments.data,
      commentTotal: comments.total,
    };
  }

  /**
   * 获取流程实例评论树
   */
  async getProcessInstanceCommentTree(
    processInstanceId: string,
    includeInternal = false
  ) {
    const processInstance = await this.processInstanceService.findById(processInstanceId);
    const comments = await this.commentService.getCommentTree(
      processInstanceId,
      undefined,
      { includeInternal }
    );

    return {
      processInstance,
      comments: comments.data,
      total: comments.total,
    };
  }

  /**
   * 获取流程实例评论统计
   */
  async getProcessInstanceCommentStats(processInstanceId: string) {
    const processInstance = await this.processInstanceService.findById(processInstanceId);
    const stats = await this.commentService.getCommentStats(processInstanceId);

    return {
      processInstanceId,
      processInstance,
      ...stats,
    };
  }

  /**
   * 批量获取流程实例评论统计
   */
  async batchGetProcessInstanceCommentStats(processInstanceIds: string[]) {
    const results = new Map<string, Awaited<ReturnType<typeof this.commentService.getCommentStats>>>();

    for (const processInstanceId of processInstanceIds) {
      const stats = await this.commentService.getCommentStats(processInstanceId);
      results.set(processInstanceId, stats);
    }

    return results;
  }

  /**
   * 添加流程状态变更评论
   */
  async addStateChangeComment(
    processInstanceId: string,
    fromState: string,
    toState: string,
    userId: string,
    userName?: string,
    reason?: string
  ): Promise<void> {
    const processInstance = await this.processInstanceService.findById(processInstanceId);

    await this.commentService.addSystemComment(
      processInstanceId,
      null,
      `流程状态从 "${fromState}" 变更为 "${toState}"${reason ? `，原因：${reason}` : ''}`,
      processInstance.tenantId,
      {
        action: 'stateChange',
        fromState,
        toState,
        reason,
        triggeredBy: userId,
        triggeredByName: userName,
      }
    );
  }

  /**
   * 添加流程变量变更评论
   */
  async addVariableChangeComment(
    processInstanceId: string,
    variableName: string,
    oldValue: any,
    newValue: any,
    userId: string,
    userName?: string
  ): Promise<void> {
    const processInstance = await this.processInstanceService.findById(processInstanceId);

    await this.commentService.addSystemComment(
      processInstanceId,
      null,
      `流程变量 "${variableName}" 已更新`,
      processInstance.tenantId,
      {
        action: 'variableChange',
        variableName,
        oldValue: typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue,
        newValue: typeof newValue === 'object' ? JSON.stringify(newValue) : newValue,
        changedBy: userId,
        changedByName: userName,
      }
    );
  }

  /**
   * 添加流程催办评论
   */
  async addUrgeComment(
    processInstanceId: string,
    taskId: string,
    urgeMessage: string,
    userId: string,
    userName?: string
  ): Promise<void> {
    const processInstance = await this.processInstanceService.findById(processInstanceId);

    await this.commentService.addComment({
      processInstanceId,
      taskId,
      userId,
      userName,
      message: urgeMessage || '请尽快处理',
      type: CommentType.SYSTEM,
      tenantId: processInstance.tenantId,
      metadata: {
        action: 'urge',
      },
    });
  }
}
