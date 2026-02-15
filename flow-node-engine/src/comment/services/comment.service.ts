/**
 * 评论服务
 * 管理流程实例和任务的评论
 */
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  AddCommentDto,
  UpdateCommentDto,
  QueryCommentDto,
  CommentResponseDto,
  CommentPageResponseDto,
  CommentStatsDto,
} from '../dto/comment.dto';
import { Comment, CommentType } from '../entities/comment.entity';

/**
 * 评论服务
 */
@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 添加评论
   */
  async addComment(dto: AddCommentDto): Promise<Comment> {
    // 验证必须关联流程实例或任务
    if (!dto.processInstanceId && !dto.taskId) {
      throw new BadRequestException('Comment must be associated with a process instance or task');
    }

    // 验证父评论存在
    if (dto.parentId) {
      const parent = await this.commentRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`Parent comment not found: ${dto.parentId}`);
      }
    }

    const comment = this.commentRepository.create({
      userId: dto.userId,
      userName: dto.userName,
      processInstanceId: dto.processInstanceId,
      taskId: dto.taskId,
      type: dto.type || CommentType.COMMENT,
      message: dto.message,
      parentId: dto.parentId,
      rootId: dto.rootId || dto.parentId,
      replyToUserId: dto.replyToUserId,
      replyToUserName: dto.replyToUserName,
      isInternal: dto.isInternal || false,
      tenantId: dto.tenantId,
      metadata: dto.metadata,
      likeCount: 0,
      replyCount: 0,
      isEdited: false,
      isPinned: false,
      isDeleted: false,
    });

    const saved = await this.commentRepository.save(comment);

    // 更新父评论的回复数
    if (dto.parentId) {
      await this.incrementReplyCount(dto.parentId);
    }

    this.logger.log(`Comment added: ${saved.id}`);
    return saved;
  }

  /**
   * 更新评论
   */
  async updateComment(id: string, dto: UpdateCommentDto): Promise<Comment> {
    const comment = await this.findCommentById(id);

    comment.message = dto.message;
    comment.isEdited = true;
    if (dto.metadata) {
      comment.metadata = { ...comment.metadata, ...dto.metadata };
    }

    const saved = await this.commentRepository.save(comment);
    this.logger.log(`Comment updated: ${id}`);
    return saved;
  }

  /**
   * 根据ID查找评论
   */
  async findCommentById(id: string, includeDeleted = false): Promise<Comment> {
    const queryBuilder = this.commentRepository.createQueryBuilder('comment');
    queryBuilder.where('comment.id = :id', { id });
    
    if (!includeDeleted) {
      queryBuilder.andWhere('comment.is_deleted_ = :isDeleted', { isDeleted: false });
    }

    const comment = await queryBuilder.getOne();
    if (!comment) {
      throw new NotFoundException(`Comment not found: ${id}`);
    }

    return comment;
  }

  /**
   * 查询评论列表
   */
  async queryComments(query: QueryCommentDto): Promise<CommentPageResponseDto<CommentResponseDto>> {
    const queryBuilder = this.commentRepository.createQueryBuilder('comment');

    // 构建查询条件
    if (query.processInstanceId) {
      queryBuilder.andWhere('comment.process_instance_id_ = :processInstanceId', {
        processInstanceId: query.processInstanceId,
      });
    }
    if (query.taskId) {
      queryBuilder.andWhere('comment.task_id_ = :taskId', { taskId: query.taskId });
    }
    if (query.userId) {
      queryBuilder.andWhere('comment.user_id_ = :userId', { userId: query.userId });
    }
    if (query.type) {
      queryBuilder.andWhere('comment.type_ = :type', { type: query.type });
    }
    if (query.parentId) {
      queryBuilder.andWhere('comment.parent_id_ = :parentId', { parentId: query.parentId });
    }
    if (query.rootId) {
      queryBuilder.andWhere('comment.root_id_ = :rootId', { rootId: query.rootId });
    }
    if (!query.includeDeleted) {
      queryBuilder.andWhere('comment.is_deleted_ = :isDeleted', { isDeleted: false });
    }
    if (!query.includeInternal) {
      queryBuilder.andWhere('comment.is_internal_ = :isInternal', { isInternal: false });
    }
    if (query.onlyPinned) {
      queryBuilder.andWhere('comment.is_pinned_ = :isPinned', { isPinned: true });
    }
    if (query.tenantId) {
      queryBuilder.andWhere('comment.tenant_id_ = :tenantId', { tenantId: query.tenantId });
    }

    // 排序：置顶优先，然后按指定字段排序
    queryBuilder.addOrderBy('comment.is_pinned_', 'DESC');
    const sortColumn = query.sortBy === 'createTime' ? 'comment.create_time_' :
                       query.sortBy === 'likeCount' ? 'comment.like_count_' :
                       'comment.reply_count_';
    queryBuilder.addOrderBy(sortColumn, query.sortOrder || 'DESC');

    // 分页
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    queryBuilder.skip(skip).take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data: data.map(this.toCommentResponseDto),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取评论树（根评论 + 回复）
   */
  async getCommentTree(
    processInstanceId?: string,
    taskId?: string,
    options: { includeInternal?: boolean; pageSize?: number } = {}
  ): Promise<CommentPageResponseDto<CommentResponseDto>> {
    // 查询根评论（没有父评论的）
    const queryBuilder = this.commentRepository.createQueryBuilder('comment');
    queryBuilder.where('comment.parent_id_ IS NULL');

    if (processInstanceId) {
      queryBuilder.andWhere('comment.process_instance_id_ = :processInstanceId', {
        processInstanceId,
      });
    }
    if (taskId) {
      queryBuilder.andWhere('comment.task_id_ = :taskId', { taskId });
    }
    if (!options.includeInternal) {
      queryBuilder.andWhere('comment.is_internal_ = :isInternal', { isInternal: false });
    }
    queryBuilder.andWhere('comment.is_deleted_ = :isDeleted', { isDeleted: false });

    // 排序：置顶优先，然后按时间倒序
    queryBuilder.orderBy('comment.is_pinned_', 'DESC')
               .addOrderBy('comment.create_time_', 'DESC');

    const pageSize = options.pageSize || 20;
    queryBuilder.take(pageSize);

    const [rootComments, total] = await queryBuilder.getManyAndCount();

    // 获取每个根评论的回复
    const rootIds = rootComments.map(c => c.id);
    let replies: Comment[] = [];
    if (rootIds.length > 0) {
      replies = await this.commentRepository.find({
        where: {
          rootId: In(rootIds),
          isDeleted: false,
        },
        order: { createTime: 'ASC' },
      });
    }

    // 组装评论树
    const replyMap = new Map<string, Comment[]>();
    for (const reply of replies) {
      const parentId = reply.parentId;
      if (!replyMap.has(parentId)) {
        replyMap.set(parentId, []);
      }
      replyMap.get(parentId)!.push(reply);
    }

    const data = rootComments.map(root => {
      const dto = this.toCommentResponseDto(root);
      dto.replies = (replyMap.get(root.id) || []).map(this.toCommentResponseDto);
      return dto;
    });

    return {
      data,
      total,
      page: 1,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 删除评论（软删除）
   */
  async deleteComment(id: string, deletedBy?: string): Promise<void> {
    const comment = await this.findCommentById(id);

    await this.commentRepository.update(id, {
      isDeleted: true,
      deleteTime: new Date(),
      deletedBy: deletedBy,
    });

    // 更新父评论的回复数
    if (comment.parentId) {
      await this.decrementReplyCount(comment.parentId);
    }

    this.logger.log(`Comment deleted: ${id}`);
  }

  /**
   * 点赞评论
   */
  async likeComment(id: string, unlike = false): Promise<Comment> {
    const comment = await this.findCommentById(id);

    if (unlike) {
      comment.likeCount = Math.max(0, comment.likeCount - 1);
    } else {
      comment.likeCount += 1;
    }

    return this.commentRepository.save(comment);
  }

  /**
   * 置顶评论
   */
  async pinComment(id: string, pinned = true): Promise<Comment> {
    const comment = await this.findCommentById(id);
    comment.isPinned = pinned;
    return this.commentRepository.save(comment);
  }

  /**
   * 获取评论统计
   */
  async getCommentStats(processInstanceId?: string, taskId?: string): Promise<CommentStatsDto> {
    const queryBuilder = this.commentRepository.createQueryBuilder('comment');
    queryBuilder.where('comment.is_deleted_ = :isDeleted', { isDeleted: false });

    if (processInstanceId) {
      queryBuilder.andWhere('comment.process_instance_id_ = :processInstanceId', {
        processInstanceId,
      });
    }
    if (taskId) {
      queryBuilder.andWhere('comment.task_id_ = :taskId', { taskId });
    }

    const comments = await queryBuilder.getMany();

    // 统计总数
    const totalComments = comments.filter(c => !c.parentId).length;
    const totalReplies = comments.filter(c => c.parentId).length;

    // 按类型统计
    const byType: Record<CommentType, number> = {
      [CommentType.COMMENT]: 0,
      [CommentType.APPROVAL]: 0,
      [CommentType.SYSTEM]: 0,
      [CommentType.REJECT]: 0,
      [CommentType.DELEGATE]: 0,
      [CommentType.RETURN]: 0,
    };
    for (const comment of comments) {
      byType[comment.type] = (byType[comment.type] || 0) + 1;
    }

    // 按用户统计
    const userCountMap = new Map<string, { userName?: string; count: number }>();
    for (const comment of comments) {
      const existing = userCountMap.get(comment.userId);
      if (existing) {
        existing.count++;
      } else {
        userCountMap.set(comment.userId, {
          userName: comment.userName,
          count: 1,
        });
      }
    }

    const byUser = Array.from(userCountMap.entries())
      .map(([userId, data]) => ({
        userId,
        userName: data.userName,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 最近评论
    const recentComments = comments
      .sort((a, b) => b.createTime.getTime() - a.createTime.getTime())
      .slice(0, 5)
      .map(this.toCommentResponseDto);

    return {
      totalComments,
      totalReplies,
      byType,
      byUser,
      recentComments,
    };
  }

  /**
   * 获取流程实例的评论
   */
  async getProcessInstanceComments(
    processInstanceId: string,
    query?: Partial<QueryCommentDto>
  ): Promise<CommentPageResponseDto<CommentResponseDto>> {
    return this.queryComments({
      ...query,
      processInstanceId,
    });
  }

  /**
   * 获取任务的评论
   */
  async getTaskComments(
    taskId: string,
    query?: Partial<QueryCommentDto>
  ): Promise<CommentPageResponseDto<CommentResponseDto>> {
    return this.queryComments({
      ...query,
      taskId,
    });
  }

  /**
   * 添加审批意见
   */
  async addApprovalComment(
    processInstanceId: string,
    taskId: string,
    userId: string,
    message: string,
    userName?: string,
    tenantId?: string
  ): Promise<Comment> {
    return this.addComment({
      processInstanceId,
      taskId,
      userId,
      userName,
      message,
      type: CommentType.APPROVAL,
      tenantId,
    });
  }

  /**
   * 添加驳回意见
   */
  async addRejectComment(
    processInstanceId: string,
    taskId: string,
    userId: string,
    message: string,
    userName?: string,
    tenantId?: string
  ): Promise<Comment> {
    return this.addComment({
      processInstanceId,
      taskId,
      userId,
      userName,
      message,
      type: CommentType.REJECT,
      tenantId,
    });
  }

  /**
   * 添加系统评论
   */
  async addSystemComment(
    processInstanceId: string,
    taskId: string | null,
    message: string,
    tenantId?: string,
    metadata?: Record<string, any>
  ): Promise<Comment> {
    return this.addComment({
      processInstanceId,
      taskId: taskId || undefined,
      userId: 'system',
      userName: '系统',
      message,
      type: CommentType.SYSTEM,
      isInternal: false,
      tenantId,
      metadata,
    });
  }

  // ==================== 私有方法 ====================

  /**
   * 增加回复数
   */
  private async incrementReplyCount(parentId: string): Promise<void> {
    await this.commentRepository.increment({ id: parentId }, 'replyCount', 1);
  }

  /**
   * 减少回复数
   */
  private async decrementReplyCount(parentId: string): Promise<void> {
    await this.commentRepository.decrement(
      { id: parentId, replyCount: 0 },
      'replyCount',
      1
    );
  }

  /**
   * 转换为响应DTO
   */
  private toCommentResponseDto(comment: Comment): CommentResponseDto {
    return {
      id: comment.id,
      userId: comment.userId,
      userName: comment.userName,
      processInstanceId: comment.processInstanceId,
      taskId: comment.taskId,
      type: comment.type,
      message: comment.message,
      parentId: comment.parentId,
      rootId: comment.rootId,
      replyToUserId: comment.replyToUserId,
      replyToUserName: comment.replyToUserName,
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      isEdited: comment.isEdited,
      isPinned: comment.isPinned,
      isInternal: comment.isInternal,
      isDeleted: comment.isDeleted,
      deleteTime: comment.deleteTime,
      deletedBy: comment.deletedBy,
      tenantId: comment.tenantId,
      metadata: comment.metadata,
      createTime: comment.createTime,
      updateTime: comment.updateTime,
    };
  }
}
