import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam,  } from '@nestjs/swagger';

import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { HistoryService } from '../services/history.service';

/**
 * 历史控制器
 */
@ApiTags('history')
@Controller('history')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  /**
   * 查询历史活动实例
   */
  @Get('activities')
  @ApiOperation({ summary: '查询历史活动实例' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricActivityInstances(@Query() query: any) {
    const result = await this.historyService.findHistoricActivityInstances(query);
    return {
      code: 200,
      message: '查询成功',
      data: result.activities,
      total: result.total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  /**
   * 根据ID查询历史活动实例
   */
  @Get('activities/:id')
  @ApiOperation({ summary: '根据ID查询历史活动实例' })
  @ApiParam({ name: 'id', description: '历史活动实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: '历史活动实例不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricActivityInstanceById(@Param('id') id: string) {
    const activity = await this.historyService.findHistoricActivityInstanceById(id);
    return {
      code: 200,
      message: '查询成功',
      data: activity,
    };
  }

  /**
   * 根据流程实例ID查询历史活动实例
   */
  @Get('activities/process-instance/:processInstanceId')
  @ApiOperation({ summary: '根据流程实例ID查询历史活动实例' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricActivityInstancesByProcessInstanceId(@Param('processInstanceId') processInstanceId: string) {
    const activities = await this.historyService.findHistoricActivityInstancesByProcessInstanceId(processInstanceId);
    return {
      code: 200,
      message: '查询成功',
      data: activities,
    };
  }

  /**
   * 查询历史任务实例
   */
  @Get('tasks')
  @ApiOperation({ summary: '查询历史任务实例' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricTaskInstances(@Query() query: any) {
    const result = await this.historyService.findHistoricTaskInstances(query);
    return {
      code: 200,
      message: '查询成功',
      data: result.tasks,
      total: result.total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  /**
   * 根据ID查询历史任务实例
   */
  @Get('tasks/:id')
  @ApiOperation({ summary: '根据ID查询历史任务实例' })
  @ApiParam({ name: 'id', description: '历史任务实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: '历史任务实例不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricTaskInstanceById(@Param('id') id: string) {
    const task = await this.historyService.findHistoricTaskInstanceById(id);
    return {
      code: 200,
      message: '查询成功',
      data: task,
    };
  }

  /**
   * 根据流程实例ID查询历史任务实例
   */
  @Get('tasks/process-instance/:processInstanceId')
  @ApiOperation({ summary: '根据流程实例ID查询历史任务实例' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricTaskInstancesByProcessInstanceId(@Param('processInstanceId') processInstanceId: string) {
    const tasks = await this.historyService.findHistoricTaskInstancesByProcessInstanceId(processInstanceId);
    return {
      code: 200,
      message: '查询成功',
      data: tasks,
    };
  }

  /**
   * 根据任务负责人查询历史任务实例
   */
  @Get('tasks/assignee/:assignee')
  @ApiOperation({ summary: '根据任务负责人查询历史任务实例' })
  @ApiParam({ name: 'assignee', description: '任务负责人ID', example: 'user001' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricTaskInstancesByAssignee(@Param('assignee') assignee: string) {
    const tasks = await this.historyService.findHistoricTaskInstancesByAssignee(assignee);
    return {
      code: 200,
      message: '查询成功',
      data: tasks,
    };
  }

  /**
   * 查询历史流程实例
   */
  @Get('processes')
  @ApiOperation({ summary: '查询历史流程实例' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricProcessInstances(@Query() query: any) {
    const result = await this.historyService.findHistoricProcessInstances(query);
    return {
      code: 200,
      message: '查询成功',
      data: result.processes,
      total: result.total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  /**
   * 根据ID查询历史流程实例
   */
  @Get('processes/:id')
  @ApiOperation({ summary: '根据ID查询历史流程实例' })
  @ApiParam({ name: 'id', description: '历史流程实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: '历史流程实例不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricProcessInstanceById(@Param('id') id: string) {
    const process = await this.historyService.findHistoricProcessInstanceById(id);
    return {
      code: 200,
      message: '查询成功',
      data: process,
    };
  }

  /**
   * 根据流程实例ID查询历史流程实例
   */
  @Get('processes/process-instance/:processInstanceId')
  @ApiOperation({ summary: '根据流程实例ID查询历史流程实例' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricProcessInstanceByProcessInstanceId(@Param('processInstanceId') processInstanceId: string) {
    const process = await this.historyService.findHistoricProcessInstanceByProcessInstanceId(processInstanceId);
    return {
      code: 200,
      message: '查询成功',
      data: process,
    };
  }

  /**
   * 根据业务Key查询历史流程实例
   */
  @Get('processes/business-key/:businessKey')
  @ApiOperation({ summary: '根据业务Key查询历史流程实例' })
  @ApiParam({ name: 'businessKey', description: '业务Key', example: 'BUSINESS_001' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findHistoricProcessInstancesByBusinessKey(@Param('businessKey') businessKey: string) {
    const processes = await this.historyService.findHistoricProcessInstancesByBusinessKey(businessKey);
    return {
      code: 200,
      message: '查询成功',
      data: processes,
    };
  }

  /**
   * 获取流程实例的完整历史
   */
  @Get('process-instance/:processInstanceId/full')
  @ApiOperation({ summary: '获取流程实例的完整历史' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async getProcessInstanceHistory(@Param('processInstanceId') processInstanceId: string) {
    const history = await this.historyService.getProcessInstanceHistory(processInstanceId);
    return {
      code: 200,
      message: '查询成功',
      data: history,
    };
  }

  /**
   * 删除历史流程实例
   */
  @Delete('processes/:id')
  @ApiOperation({ summary: '删除历史流程实例' })
  @ApiParam({ name: 'id', description: '历史流程实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '删除成功', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: '历史流程实例不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async deleteHistoricProcessInstance(@Param('id') id: string) {
    await this.historyService.deleteHistoricProcessInstance(id);
    return {
      code: 200,
      message: '删除成功',
    };
  }

  /**
   * 删除历史任务实例
   */
  @Delete('tasks/:id')
  @ApiOperation({ summary: '删除历史任务实例' })
  @ApiParam({ name: 'id', description: '历史任务实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '删除成功', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: '历史任务实例不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async deleteHistoricTaskInstance(@Param('id') id: string) {
    await this.historyService.deleteHistoricTaskInstance(id);
    return {
      code: 200,
      message: '删除成功',
    };
  }

  /**
   * 删除历史活动实例
   */
  @Delete('activities/:id')
  @ApiOperation({ summary: '删除历史活动实例' })
  @ApiParam({ name: 'id', description: '历史活动实例ID', example: '550e8400-e29b-41d4-a716-4466554400000' })
  @ApiResponse({ status: 200, description: '删除成功', type: ApiResponseDto })
  @ApiResponse({ status: 404, description: '历史活动实例不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async deleteHistoricActivityInstance(@Param('id') id: string) {
    await this.historyService.deleteHistoricActivityInstance(id);
    return {
      code: 200,
      message: '删除成功',
    };
  }
}
