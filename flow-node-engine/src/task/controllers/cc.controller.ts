import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import {
  CreateCCDto,
  BatchCreateCCDto,
  QueryCCDto,
  UpdateCCStatusDto,
  CCConfigDto,
  CCRecordResponseDto,
  MyCCListResponseDto,
  CCStatisticsResponseDto,
  CCDetailResponseDto,
  CCStatus,
  CCType,
} from '../dto/cc.dto';
import { CcService } from '../services/cc.service';

// 临时装饰器占位，待auth模块实现后替换
const CurrentUser = (field?: string) => (target: any, propertyKey: string | symbol, parameterIndex: number) => {};
const JwtAuthGuard = class {};

/**
 * 抄送控制器
 * 提供任务抄送相关API
 */
@Controller('cc')
@UseGuards(JwtAuthGuard)
export class CCController {
  constructor(private readonly ccService: CcService) {}

  /**
   * 创建抄送
   * POST /cc
   */
  @Post()
  async create(
    @Body() dto: CreateCCDto,
    @CurrentUser('userId') fromUserId: string,
  ): Promise<CCRecordResponseDto[]> {
    const records = await this.ccService.create({
      taskId: dto.taskId,
      processInstanceId: dto.processInstanceId,
      userIds: dto.userIds,
      groupIds: dto.groupIds,
      reason: dto.reason,
      type: dto.type || CCType.MANUAL,
      fromUserId,
    });
    return records.map((record) => this.toRecordResponseDto(record));
  }

  /**
   * 批量创建抄送
   * POST /cc/batch
   */
  @Post('batch')
  async batchCreate(
    @Body() dto: BatchCreateCCDto,
    @CurrentUser('userId') fromUserId: string,
  ): Promise<CCRecordResponseDto[]> {
    const records = await this.ccService.batchCreate({
      taskId: dto.taskId,
      processInstanceId: dto.processInstanceId,
      userIds: dto.userIds,
      reason: dto.reason,
      fromUserId,
    });
    return records.map((record) => this.toRecordResponseDto(record));
  }

  /**
   * 获取我的抄送列表
   * GET /cc/my
   */
  @Get('my')
  async getMyCCList(
    @Query() query: QueryCCDto,
    @CurrentUser('userId') userId: string,
  ): Promise<MyCCListResponseDto> {
    const { total, unreadCount, list } = await this.ccService.getMyCCList({
      userId,
      status: query.status,
      type: query.type,
      startTimeAfter: query.startTimeAfter ? new Date(query.startTimeAfter) : undefined,
      startTimeBefore: query.startTimeBefore ? new Date(query.startTimeBefore) : undefined,
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    });
    return {
      total,
      unreadCount,
      list: list.map((record) => this.toRecordResponseDto(record)),
    };
  }

  /**
   * 获取抄送统计信息
   * GET /cc/statistics
   */
  @Get('statistics')
  async getStatistics(
    @CurrentUser('userId') userId: string,
  ): Promise<CCStatisticsResponseDto> {
    return this.ccService.getStatistics(userId);
  }

  /**
   * 获取抄送详情
   * GET /cc/:id
   */
  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<CCDetailResponseDto> {
    const detail = await this.ccService.getDetail(id, userId);
    return {
      id: detail.id_,
      taskId: detail.task_id_,
      taskName: detail.task_name_,
      taskDescription: detail.task_description_,
      processInstanceId: detail.proc_inst_id_,
      processDefinitionKey: detail.proc_def_key_,
      processDefinitionName: detail.proc_def_name_,
      processStartTime: detail.proc_start_time_,
      starterId: detail.starter_id_,
      starterName: detail.starter_name_,
      userId: detail.user_id_,
      userName: detail.user_name_,
      userEmail: detail.user_email_,
      fromUserId: detail.from_user_id_,
      fromUserName: detail.from_user_name_,
      status: detail.status_ as CCStatus,
      type: detail.type_ as CCType,
      reason: detail.reason_,
      comment: detail.comment_,
      readTime: detail.read_time_,
      handleTime: detail.handle_time_,
      createTime: detail.create_time_,
      taskVariables: detail.task_variables_,
      processVariables: detail.process_variables_,
    };
  }

  /**
   * 标记抄送为已读
   * PUT /cc/:id/read
   */
  @Put(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<CCRecordResponseDto> {
    const record = await this.ccService.markAsReadWithUser(id, userId);
    return this.toRecordResponseDto(record);
  }

  /**
   * 批量标记为已读
   * PUT /cc/batch-read
   */
  @Put('batch-read')
  async batchMarkAsRead(
    @Body('ids') ids: string[],
    @CurrentUser('userId') userId: string,
  ): Promise<{ success: boolean; count: number }> {
    const count = await this.ccService.batchMarkAsReadWithUser(ids, userId);
    return { success: true, count };
  }

  /**
   * 更新抄送状态
   * PUT /cc/:id/status
   */
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCCStatusDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CCRecordResponseDto> {
    const record = await this.ccService.updateStatus({
      id,
      status: dto.status,
      comment: dto.comment,
      userId,
    });
    return this.toRecordResponseDto(record);
  }

  /**
   * 归档抄送
   * PUT /cc/:id/archive
   */
  @Put(':id/archive')
  async archive(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<CCRecordResponseDto> {
    const record = await this.ccService.archive(id, userId);
    return this.toRecordResponseDto(record);
  }

  /**
   * 删除抄送
   * DELETE /cc/:id
   */
  @Post(':id/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.ccService.deleteWithUser(id, userId);
  }

  /**
   * 获取任务的抄送记录
   * GET /cc/task/:taskId
   */
  @Get('task/:taskId')
  async getByTaskId(
    @Param('taskId') taskId: string,
    @Query() query: QueryCCDto,
  ): Promise<{ total: number; list: CCRecordResponseDto[] }> {
    const { total, list } = await this.ccService.query({
      taskId,
      status: query.status,
      type: query.type,
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    });
    return {
      total,
      list: list.map((record) => this.toRecordResponseDto(record)),
    };
  }

  /**
   * 获取流程实例的抄送记录
   * GET /cc/process-instance/:processInstanceId
   */
  @Get('process-instance/:processInstanceId')
  async getByProcessInstanceId(
    @Param('processInstanceId') processInstanceId: string,
    @Query() query: QueryCCDto,
  ): Promise<{ total: number; list: CCRecordResponseDto[] }> {
    const { total, list } = await this.ccService.query({
      processInstanceId,
      status: query.status,
      type: query.type,
      page: query.page ? parseInt(query.page, 10) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize, 10) : 20,
    });
    return {
      total,
      list: list.map((record) => this.toRecordResponseDto(record)),
    };
  }

  /**
   * 创建抄送配置
   * POST /cc/config
   */
  @Post('config')
  async createConfig(@Body() dto: CCConfigDto): Promise<{ id: string }> {
    const config = await this.ccService.createConfig({
      processDefinitionKey: dto.processDefinitionKey,
      activityId: dto.activityId,
      userIds: dto.userIds,
      groupIds: dto.groupIds,
      enabled: dto.enabled ?? true,
      type: dto.type || CCType.AUTO,
    });
    return { id: config.id_ };
  }

  /**
   * 获取抄送配置
   * GET /cc/config/:processDefinitionKey
   */
  @Get('config/:processDefinitionKey')
  async getConfig(
    @Param('processDefinitionKey') processDefinitionKey: string,
    @Query('activityId') activityId?: string,
  ): Promise<any[]> {
    return this.ccService.getConfig(processDefinitionKey, activityId);
  }

  /**
   * 更新抄送配置
   * PUT /cc/config/:id
   */
  @Put('config/:id')
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: Partial<CCConfigDto>,
  ): Promise<{ success: boolean }> {
    await this.ccService.updateConfig(id, dto);
    return { success: true };
  }

  /**
   * 删除抄送配置
   * DELETE /cc/config/:id
   */
  @Post('config/:id/delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConfig(@Param('id') id: string): Promise<void> {
    await this.ccService.deleteConfig(id);
  }

  /**
   * 转换为响应DTO
   */
  private toRecordResponseDto(record: any): CCRecordResponseDto {
    return {
      id: record.id_,
      taskId: record.task_id_,
      taskName: record.task_name_,
      processInstanceId: record.proc_inst_id_,
      processDefinitionKey: record.proc_def_key_,
      processDefinitionName: record.proc_def_name_,
      userId: record.user_id_,
      userName: record.user_name_,
      fromUserId: record.from_user_id_,
      fromUserName: record.from_user_name_,
      status: record.status_ as CCStatus,
      type: record.type_ as CCType,
      reason: record.reason_,
      readTime: record.read_time_,
      createTime: record.create_time_,
    };
  }
}
