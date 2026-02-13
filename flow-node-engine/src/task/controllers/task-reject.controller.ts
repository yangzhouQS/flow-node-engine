import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CreateTaskRejectDto,
  BatchRejectDto,
  QueryRejectRecordDto,
  MultiInstanceRejectDto,
  GetRejectableNodesDto,
  RejectRecordResponseDto,
  RejectableNodeResponseDto,
  RejectConfigResponseDto,
  RejectStrategy,
  RejectType,
  MultiInstanceRejectStrategy,
} from '../dto/task-reject.dto';
import { TaskRejectService } from '../services/task-reject.service';

/**
 * 任务驳回控制器
 * 提供任务驳回、退回相关API
 */
@Controller('task')
@UseGuards(JwtAuthGuard)
export class TaskRejectController {
  constructor(private readonly taskRejectService: TaskRejectService) {}

  /**
   * 驳回/退回任务
   * POST /task/:taskId/reject
   */
  @Post(':taskId/reject')
  async rejectTask(
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskRejectDto,
    @CurrentUser('userId') userId: string,
  ): Promise<RejectRecordResponseDto> {
    const record = await this.taskRejectService.reject({
      taskId: dto.taskId || taskId,
      rejectType: dto.rejectType || RejectType.ROLLBACK,
      strategy: dto.strategy || RejectStrategy.TO_PREVIOUS,
      targetActivityId: dto.targetActivityId,
      reason: dto.reason,
      comment: dto.comment,
      variables: dto.variables,
      userId,
      skipListeners: dto.skipListeners,
    });
    return this.toRecordResponseDto(record);
  }

  /**
   * 批量驳回任务
   * POST /task/batch-reject
   */
  @Post('batch-reject')
  async batchReject(
    @Body() dto: BatchRejectDto,
    @CurrentUser('userId') userId: string,
  ): Promise<RejectRecordResponseDto[]> {
    const records = await this.taskRejectService.batchReject({
      taskIds: dto.taskIds,
      rejectType: dto.rejectType || RejectType.ROLLBACK,
      reason: dto.reason,
      comment: dto.comment,
      userId,
    });
    return records.map((record) => this.toRecordResponseDto(record));
  }

  /**
   * 获取可退回的节点列表
   * GET /task/:taskId/rejectable-nodes
   */
  @Get(':taskId/rejectable-nodes')
  async getRejectableNodes(
    @Param('taskId') taskId: string,
  ): Promise<RejectableNodeResponseDto[]> {
    const nodes = await this.taskRejectService.getRejectableNodes(taskId);
    return nodes.map((node) => ({
      activityId: node.activityId,
      activityName: node.activityName,
      activityType: node.activityType,
      assignee: node.assignee,
      candidateUsers: node.candidateUsers,
      candidateGroups: node.candidateGroups,
      createTime: node.createTime,
      endTime: node.endTime,
    }));
  }

  /**
   * 获取驳回记录列表
   * GET /task/reject-records
   */
  @Get('reject-records')
  async queryRejectRecords(
    @Query() query: QueryRejectRecordDto,
  ): Promise<{ total: number; list: RejectRecordResponseDto[] }> {
    const { total, list } = await this.taskRejectService.queryRejectRecords({
      taskId: query.taskId,
      processInstanceId: query.processInstanceId,
      userId: query.userId,
      rejectType: query.rejectType,
      startTimeAfter: query.startTimeAfter ? new Date(query.startTimeAfter) : undefined,
      startTimeBefore: query.startTimeBefore ? new Date(query.startTimeBefore) : undefined,
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    });
    return {
      total,
      list: list.map((record) => this.toRecordResponseDto(record)),
    };
  }

  /**
   * 获取单条驳回记录详情
   * GET /task/reject-records/:id
   */
  @Get('reject-records/:id')
  async getRejectRecord(@Param('id') id: string): Promise<RejectRecordResponseDto> {
    const record = await this.taskRejectService.getRejectRecordById(id);
    return this.toRecordResponseDto(record);
  }

  /**
   * 获取任务的退回策略配置
   * GET /task/:taskId/reject-config
   */
  @Get(':taskId/reject-config')
  async getRejectConfig(@Param('taskId') taskId: string): Promise<RejectConfigResponseDto> {
    const config = await this.taskRejectService.getRejectConfig(taskId);
    return {
      processDefinitionId: config.processDefinitionId,
      processDefinitionKey: config.processDefinitionKey,
      activityId: config.activityId,
      strategy: config.strategy as RejectStrategy,
      allowedTargetActivities: config.allowedTargetActivities,
      multiInstanceStrategy: config.multiInstanceStrategy as MultiInstanceRejectStrategy,
      rejectPercentage: config.rejectPercentage,
      allowUserChoice: config.allowUserChoice,
    };
  }

  /**
   * 多实例任务驳回处理
   * POST /task/:taskId/multi-instance-reject
   */
  @Post(':taskId/multi-instance-reject')
  async multiInstanceReject(
    @Param('taskId') taskId: string,
    @Body() dto: MultiInstanceRejectDto,
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: boolean; message: string; shouldReject?: boolean }> {
    return this.taskRejectService.handleMultiInstanceReject({
      taskId: dto.taskId || taskId,
      strategy: dto.strategy || MultiInstanceRejectStrategy.ANY_REJECT,
      reason: dto.reason,
      variables: dto.variables,
      userId,
    });
  }

  /**
   * 检查任务是否可以驳回
   * GET /task/:taskId/can-reject
   */
  @Get(':taskId/can-reject')
  async canReject(
    @Param('taskId') taskId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ canReject: boolean; reason?: string; strategies?: RejectStrategy[] }> {
    return this.taskRejectService.checkCanReject(taskId, userId);
  }

  /**
   * 退回到指定节点
   * POST /task/:taskId/reject-to/:activityId
   */
  @Post(':taskId/reject-to/:activityId')
  async rejectToActivity(
    @Param('taskId') taskId: string,
    @Param('activityId') activityId: string,
    @Body('reason') reason: string,
    @Body('variables') variables: Record<string, any>,
    @CurrentUser('userId') userId: string,
  ): Promise<RejectRecordResponseDto> {
    const record = await this.taskRejectService.reject({
      taskId,
      rejectType: RejectType.ROLLBACK,
      strategy: RejectStrategy.TO_SPECIFIC,
      targetActivityId: activityId,
      reason,
      variables,
      userId,
    });
    return this.toRecordResponseDto(record);
  }

  /**
   * 转换为响应DTO
   */
  private toRecordResponseDto(record: any): RejectRecordResponseDto {
    return {
      id: record.id_,
      taskId: record.task_id_,
      processInstanceId: record.proc_inst_id_,
      executionId: record.execution_id_,
      rejectType: record.reject_type_ as RejectType,
      strategy: record.strategy_ as RejectStrategy,
      sourceActivityId: record.source_activity_id_,
      targetActivityId: record.target_activity_id_,
      userId: record.user_id_,
      reason: record.reason_,
      comment: record.comment_,
      createTime: record.create_time_,
    };
  }
}
