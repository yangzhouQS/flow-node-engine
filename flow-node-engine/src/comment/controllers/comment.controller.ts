/**
 * 评论控制器
 * 提供评论管理的 REST API
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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CommentService } from '../services/comment.service';
import {
  AddCommentDto,
  UpdateCommentDto,
  QueryCommentDto,
  CommentResponseDto,
  CommentPageResponseDto,
  LikeCommentDto,
  PinCommentDto,
  CommentStatsDto,
} from '../dto/comment.dto';

@Controller('comments')
export class CommentController {
  private readonly logger = new Logger(CommentController.name);

  constructor(private readonly commentService: CommentService) {}

  /**
   * 添加评论
   * POST /comments
   */
  @Post()
  async addComment(@Body() dto: AddCommentDto): Promise<CommentResponseDto> {
    this.logger.log(`Adding comment from user: ${dto.userId}`);
    const comment = await this.commentService.addComment(dto);
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
      tenantId: comment.tenantId,
      metadata: comment.metadata,
      createTime: comment.createTime,
      updateTime: comment.updateTime,
    };
  }

  /**
   * 查询评论列表
   * GET /comments
   */
  @Get()
  async queryComments(@Query() query: QueryCommentDto): Promise<CommentPageResponseDto<CommentResponseDto>> {
    this.logger.log(`Querying comments with filters: ${JSON.stringify(query)}`);
    return this.commentService.queryComments(query);
  }

  /**
   * 获取评论详情
   * GET /comments/:id
   */
  @Get(':id')
  async getComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeDeleted') includeDeleted?: boolean
  ): Promise<CommentResponseDto> {
    this.logger.log(`Getting comment: ${id}`);
    const comment = await this.commentService.findCommentById(id, includeDeleted);
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

  /**
   * 更新评论
   * PUT /comments/:id
   */
  @Put(':id')
  async updateComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommentDto
  ): Promise<CommentResponseDto> {
    this.logger.log(`Updating comment: ${id}`);
    const comment = await this.commentService.updateComment(id, dto);
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
      tenantId: comment.tenantId,
      metadata: comment.metadata,
      createTime: comment.createTime,
      updateTime: comment.updateTime,
    };
  }

  /**
   * 删除评论（软删除）
   * DELETE /comments/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('deletedBy') deletedBy?: string
  ): Promise<void> {
    this.logger.log(`Deleting comment: ${id}`);
    await this.commentService.deleteComment(id, deletedBy);
  }

  /**
   * 点赞评论
   * POST /comments/:id/like
   */
  @Post(':id/like')
  async likeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LikeCommentDto
  ): Promise<CommentResponseDto> {
    this.logger.log(`${dto.unlike ? 'Unliking' : 'Liking'} comment: ${id}`);
    const comment = await this.commentService.likeComment(id, dto.unlike);
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
      tenantId: comment.tenantId,
      createTime: comment.createTime,
      updateTime: comment.updateTime,
    };
  }

  /**
   * 置顶评论
   * PUT /comments/:id/pin
   */
  @Put(':id/pin')
  async pinComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PinCommentDto
  ): Promise<CommentResponseDto> {
    this.logger.log(`${dto.pinned ? 'Pinning' : 'Unpinning'} comment: ${id}`);
    const comment = await this.commentService.pinComment(id, dto.pinned);
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
      tenantId: comment.tenantId,
      createTime: comment.createTime,
      updateTime: comment.updateTime,
    };
  }

  /**
   * 获取评论统计
   * GET /comments/stats
   */
  @Get('stats/overview')
  async getCommentStats(
    @Query('processInstanceId') processInstanceId?: string,
    @Query('taskId') taskId?: string
  ): Promise<CommentStatsDto> {
    this.logger.log(`Getting comment stats for process: ${processInstanceId}, task: ${taskId}`);
    return this.commentService.getCommentStats(processInstanceId, taskId);
  }

  /**
   * 获取流程实例的评论树
   * GET /comments/process-instance/:processInstanceId/tree
   */
  @Get('process-instance/:processInstanceId/tree')
  async getProcessInstanceCommentTree(
    @Param('processInstanceId', ParseUUIDPipe) processInstanceId: string,
    @Query('includeInternal') includeInternal?: boolean,
    @Query('pageSize') pageSize?: number
  ): Promise<CommentPageResponseDto<CommentResponseDto>> {
    this.logger.log(`Getting comment tree for process instance: ${processInstanceId}`);
    return this.commentService.getCommentTree(processInstanceId, undefined, {
      includeInternal: includeInternal === true,
      pageSize: pageSize ? parseInt(pageSize as any, 10) : 20,
    });
  }

  /**
   * 获取流程实例的评论列表
   * GET /comments/process-instance/:processInstanceId
   */
  @Get('process-instance/:processInstanceId')
  async getProcessInstanceComments(
    @Param('processInstanceId', ParseUUIDPipe) processInstanceId: string,
    @Query() query: Partial<QueryCommentDto>
  ): Promise<CommentPageResponseDto<CommentResponseDto>> {
    this.logger.log(`Getting comments for process instance: ${processInstanceId}`);
    return this.commentService.getProcessInstanceComments(processInstanceId, query);
  }

  /**
   * 获取任务的评论树
   * GET /comments/task/:taskId/tree
   */
  @Get('task/:taskId/tree')
  async getTaskCommentTree(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('includeInternal') includeInternal?: boolean,
    @Query('pageSize') pageSize?: number
  ): Promise<CommentPageResponseDto<CommentResponseDto>> {
    this.logger.log(`Getting comment tree for task: ${taskId}`);
    return this.commentService.getCommentTree(undefined, taskId, {
      includeInternal: includeInternal === true,
      pageSize: pageSize ? parseInt(pageSize as any, 10) : 20,
    });
  }

  /**
   * 获取任务的评论列表
   * GET /comments/task/:taskId
   */
  @Get('task/:taskId')
  async getTaskComments(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query() query: Partial<QueryCommentDto>
  ): Promise<CommentPageResponseDto<CommentResponseDto>> {
    this.logger.log(`Getting comments for task: ${taskId}`);
    return this.commentService.getTaskComments(taskId, query);
  }

  /**
   * 添加审批意见
   * POST /comments/approval
   */
  @Post('approval')
  async addApprovalComment(@Body() body: {
    processInstanceId: string;
    taskId: string;
    userId: string;
    message: string;
    userName?: string;
    tenantId?: string;
  }): Promise<CommentResponseDto> {
    this.logger.log(`Adding approval comment from user: ${body.userId}`);
    const comment = await this.commentService.addApprovalComment(
      body.processInstanceId,
      body.taskId,
      body.userId,
      body.message,
      body.userName,
      body.tenantId
    );
    return {
      id: comment.id,
      userId: comment.userId,
      userName: comment.userName,
      processInstanceId: comment.processInstanceId,
      taskId: comment.taskId,
      type: comment.type,
      message: comment.message,
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      isEdited: comment.isEdited,
      isPinned: comment.isPinned,
      isInternal: comment.isInternal,
      isDeleted: comment.isDeleted,
      tenantId: comment.tenantId,
      createTime: comment.createTime,
      updateTime: comment.updateTime,
    };
  }

  /**
   * 添加驳回意见
   * POST /comments/reject
   */
  @Post('reject')
  async addRejectComment(@Body() body: {
    processInstanceId: string;
    taskId: string;
    userId: string;
    message: string;
    userName?: string;
    tenantId?: string;
  }): Promise<CommentResponseDto> {
    this.logger.log(`Adding reject comment from user: ${body.userId}`);
    const comment = await this.commentService.addRejectComment(
      body.processInstanceId,
      body.taskId,
      body.userId,
      body.message,
      body.userName,
      body.tenantId
    );
    return {
      id: comment.id,
      userId: comment.userId,
      userName: comment.userName,
      processInstanceId: comment.processInstanceId,
      taskId: comment.taskId,
      type: comment.type,
      message: comment.message,
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      isEdited: comment.isEdited,
      isPinned: comment.isPinned,
      isInternal: comment.isInternal,
      isDeleted: comment.isDeleted,
      tenantId: comment.tenantId,
      createTime: comment.createTime,
      updateTime: comment.updateTime,
    };
  }

  /**
   * 添加系统评论
   * POST /comments/system
   */
  @Post('system')
  async addSystemComment(@Body() body: {
    processInstanceId: string;
    taskId?: string;
    message: string;
    tenantId?: string;
    metadata?: Record<string, any>;
  }): Promise<CommentResponseDto> {
    this.logger.log(`Adding system comment for process: ${body.processInstanceId}`);
    const comment = await this.commentService.addSystemComment(
      body.processInstanceId,
      body.taskId || null,
      body.message,
      body.tenantId,
      body.metadata
    );
    return {
      id: comment.id,
      userId: comment.userId,
      userName: comment.userName,
      processInstanceId: comment.processInstanceId,
      taskId: comment.taskId,
      type: comment.type,
      message: comment.message,
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      isEdited: comment.isEdited,
      isPinned: comment.isPinned,
      isInternal: comment.isInternal,
      isDeleted: comment.isDeleted,
      tenantId: comment.tenantId,
      metadata: comment.metadata,
      createTime: comment.createTime,
      updateTime: comment.updateTime,
    };
  }
}
