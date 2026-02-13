import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CreateIdentityLinkDto,
  BatchCreateIdentityLinkDto,
  QueryIdentityLinkDto,
  DeleteIdentityLinkDto,
  IdentityLinkResponseDto,
  TaskCandidatesResponseDto,
  ProcessParticipantsResponseDto,
} from '../dto/identity-link.dto';
import { IdentityLinkService } from '../services/identity-link.service';

/**
 * 身份链接控制器
 * 管理任务候选人和流程参与者的身份链接
 */
@Controller('identity-link')
@UseGuards(JwtAuthGuard)
export class IdentityLinkController {
  constructor(private readonly identityLinkService: IdentityLinkService) {}

  /**
   * 创建身份链接
   * POST /identity-link
   */
  @Post()
  async create(@Body() dto: CreateIdentityLinkDto): Promise<IdentityLinkResponseDto> {
    const link = await this.identityLinkService.create({
      taskId: dto.taskId,
      processInstanceId: dto.processInstanceId,
      linkType: dto.type,
      userId: dto.userId,
      groupId: dto.groupId,
    });
    return this.toResponseDto(link);
  }

  /**
   * 批量创建身份链接
   * POST /identity-link/batch
   */
  @Post('batch')
  async batchCreate(@Body() dto: BatchCreateIdentityLinkDto): Promise<IdentityLinkResponseDto[]> {
    // 构建批量创建参数数组
    const paramsList: Array<{
      taskId?: string;
      processInstanceId?: string;
      linkType: string;
      userId?: string;
      groupId?: string;
    }> = [];

    // 添加用户链接
    if (dto.userIds) {
      for (const userId of dto.userIds) {
        paramsList.push({
          taskId: dto.taskId,
          processInstanceId: dto.processInstanceId,
          linkType: dto.type,
          userId,
        });
      }
    }

    // 添加组链接
    if (dto.groupIds) {
      for (const groupId of dto.groupIds) {
        paramsList.push({
          taskId: dto.taskId,
          processInstanceId: dto.processInstanceId,
          linkType: dto.type,
          groupId,
        });
      }
    }

    const links = await this.identityLinkService.batchCreate(paramsList);
    return links.map((link) => this.toResponseDto(link));
  }

  /**
   * 查询身份链接列表
   * GET /identity-link
   */
  @Get()
  async query(@Query() query: QueryIdentityLinkDto): Promise<IdentityLinkResponseDto[]> {
    const links = await this.identityLinkService.query({
      taskId: query.taskId,
      processInstanceId: query.processInstanceId,
      linkType: query.type,
      userId: query.userId,
      groupId: query.groupId,
      tenantId: query.tenantId,
    });
    return links.map((link) => this.toResponseDto(link));
  }

  /**
   * 获取任务的候选人信息
   * GET /identity-link/task/:taskId/candidates
   */
  @Get('task/:taskId/candidates')
  async getTaskCandidates(@Param('taskId') taskId: string): Promise<TaskCandidatesResponseDto> {
    const result = await this.identityLinkService.getTaskCandidates(taskId);
    return {
      taskId,
      candidateUsers: result.users.map((userId) => ({ userId })),
      candidateGroups: result.groups.map((groupId) => ({ groupId })),
    };
  }

  /**
   * 获取流程实例的参与者信息
   * GET /identity-link/process-instance/:processInstanceId/participants
   */
  @Get('process-instance/:processInstanceId/participants')
  async getProcessParticipants(
    @Param('processInstanceId') processInstanceId: string,
  ): Promise<ProcessParticipantsResponseDto> {
    const participants = await this.identityLinkService.getProcessParticipants(processInstanceId);
    return {
      processInstanceId,
      participants: participants.map((userId) => ({ userId })),
    };
  }

  /**
   * 添加候选用户
   * POST /identity-link/task/:taskId/candidate-user
   */
  @Post('task/:taskId/candidate-user')
  async addCandidateUser(
    @Param('taskId') taskId: string,
    @Body('userId') userId: string,
  ): Promise<IdentityLinkResponseDto> {
    const link = await this.identityLinkService.addCandidateUser(taskId, userId);
    return this.toResponseDto(link);
  }

  /**
   * 删除候选用户
   * DELETE /identity-link/task/:taskId/candidate-user/:userId
   */
  @Delete('task/:taskId/candidate-user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCandidateUser(
    @Param('taskId') taskId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.identityLinkService.deleteCandidateUser(taskId, userId);
  }

  /**
   * 添加候选组
   * POST /identity-link/task/:taskId/candidate-group
   */
  @Post('task/:taskId/candidate-group')
  async addCandidateGroup(
    @Param('taskId') taskId: string,
    @Body('groupId') groupId: string,
  ): Promise<IdentityLinkResponseDto> {
    const link = await this.identityLinkService.addCandidateGroup(taskId, groupId);
    return this.toResponseDto(link);
  }

  /**
   * 删除候选组
   * DELETE /identity-link/task/:taskId/candidate-group/:groupId
   */
  @Delete('task/:taskId/candidate-group/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCandidateGroup(
    @Param('taskId') taskId: string,
    @Param('groupId') groupId: string,
  ): Promise<void> {
    await this.identityLinkService.deleteCandidateGroup(taskId, groupId);
  }

  /**
   * 设置任务受让人
   * POST /identity-link/task/:taskId/assignee
   */
  @Post('task/:taskId/assignee')
  async setAssignee(
    @Param('taskId') taskId: string,
    @Body('userId') userId: string,
  ): Promise<IdentityLinkResponseDto> {
    const link = await this.identityLinkService.setAssignee(taskId, userId);
    return this.toResponseDto(link);
  }

  /**
   * 设置任务拥有者
   * POST /identity-link/task/:taskId/owner
   */
  @Post('task/:taskId/owner')
  async setOwner(
    @Param('taskId') taskId: string,
    @Body('userId') userId: string,
  ): Promise<IdentityLinkResponseDto> {
    const link = await this.identityLinkService.setOwner(taskId, userId);
    return this.toResponseDto(link);
  }

  /**
   * 删除身份链接
   * DELETE /identity-link
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Body() dto: DeleteIdentityLinkDto): Promise<void> {
    // 先查询匹配的身份链接
    const links = await this.identityLinkService.query({
      taskId: dto.taskId,
      processInstanceId: dto.processInstanceId,
      linkType: dto.type,
      userId: dto.userId,
      groupId: dto.groupId,
    });
    
    // 删除所有匹配的链接
    for (const link of links) {
      await this.identityLinkService.delete(link.id_);
    }
  }

  /**
   * 检查用户是否有权限操作任务
   * GET /identity-link/task/:taskId/check-access
   */
  @Get('task/:taskId/check-access')
  async checkTaskAccess(
    @Param('taskId') taskId: string,
    @Query('userId') userId: string,
    @Query('groups') groups?: string,
  ): Promise<{ hasAccess: boolean; reason?: string }> {
    const groupList = groups ? groups.split(',') : [];
    const hasAccess = await this.identityLinkService.checkTaskAccess(taskId, userId, groupList);
    return {
      hasAccess,
      reason: hasAccess ? undefined : 'User does not have access to this task',
    };
  }

  /**
   * 转换为响应DTO
   */
  private toResponseDto(link: any): IdentityLinkResponseDto {
    return {
      id: link.id_,
      taskId: link.task_id_,
      processInstanceId: link.proc_inst_id_,
      type: link.type_,
      userId: link.user_id_,
      groupId: link.group_id_,
      createTime: link.create_time_,
      tenantId: link.tenant_id_,
    };
  }
}
