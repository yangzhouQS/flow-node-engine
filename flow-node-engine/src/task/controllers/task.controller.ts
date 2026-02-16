import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';

import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { ClaimTaskDto } from '../dto/claim-task.dto';
import { CompleteTaskDto } from '../dto/complete-task.dto';
import { CreateTaskDto } from '../dto/create-task.dto';
import { QueryTaskDto } from '../dto/query-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { TaskService } from '../services/task.service';

/**
 * 任务控制器
 */
@ApiTags('tasks')
@Controller('tasks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * 创建任务
   */
  @Post()
  @ApiOperation({ summary: '创建任务' })
  @ApiResponse({ status: 201, description: '任务创建成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权' })
  async create(@Body() createTaskDto: CreateTaskDto) {
    const task = await this.taskService.create(createTaskDto);
    return {
      code: 200,
      message: '任务创建成功',
      data: task,
    };
  }

  /**
   * 查询所有任务
   */
  @Get()
  @ApiOperation({ summary: '查询所有任务' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findAll(@Query() query: QueryTaskDto) {
    const result = await this.taskService.findAll(query);
    return {
      code: 200,
      message: '查询成功',
      data: result.tasks,
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * 根据ID查询任务
   */
  @Get(':id')
  @ApiOperation({ summary: '根据ID查询任务' })
  @ApiParam({ name: 'id', description: '任务ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 404, description: '任务不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async findById(@Param('id') id: string) {
    const task = await this.taskService.findById(id);
    return {
      code: 200,
      message: '查询成功',
      data: task,
    };
  }

  /**
   * 根据流程实例ID查询任务
   */
  @Get('process-instance/:processInstanceId')
  @ApiOperation({ summary: '根据流程实例ID查询任务' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findByProcessInstanceId(@Param('processInstanceId') processInstanceId: string) {
    const tasks = await this.taskService.findByProcessInstanceId(processInstanceId);
    return {
      code: 200,
      message: '查询成功',
      data: tasks,
    };
  }

  /**
   * 根据任务负责人查询任务
   */
  @Get('assignee/:assignee')
  @ApiOperation({ summary: '根据任务负责人查询任务' })
  @ApiParam({ name: 'assignee', description: '任务负责人ID', example: 'user001' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async findByAssignee(@Param('assignee') assignee: string) {
    const tasks = await this.taskService.findByAssignee(assignee);
    return {
      code: 200,
      message: '查询成功',
      data: tasks,
    };
  }

  /**
   * 更新任务
   */
  @Put(':id')
  @ApiOperation({ summary: '更新任务' })
  @ApiParam({ name: 'id', description: '任务ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '更新成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    const task = await this.taskService.update(id, updateTaskDto);
    return {
      code: 200,
      message: '更新成功',
      data: task,
    };
  }

  /**
   * 认领任务
   */
  @Post('claim')
  @ApiOperation({ summary: '认领任务' })
  @ApiResponse({ status: 200, description: '认领成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async claim(@Body() claimTaskDto: ClaimTaskDto) {
    const task = await this.taskService.claim(claimTaskDto);
    return {
      code: 200,
      message: '认领成功',
      data: task,
    };
  }

  /**
   * 取消认领任务
   */
  @Post(':id/unclaim')
  @ApiOperation({ summary: '取消认领任务' })
  @ApiParam({ name: 'id', description: '任务ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '取消认领成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 404, description: '任务不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async unclaim(@Param('id') id: string) {
    const task = await this.taskService.unclaim(id);
    return {
      code: 200,
      message: '取消认领成功',
      data: task,
    };
  }

  /**
   * 完成任务
   */
  @Post('complete')
  @ApiOperation({ summary: '完成任务' })
  @ApiResponse({ status: 200, description: '完成成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @ApiResponse({ status: 404, description: '任务不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async complete(@Body() completeTaskDto: CompleteTaskDto) {
    const task = await this.taskService.complete(completeTaskDto);
    return {
      code: 200,
      message: '完成成功',
      data: task,
    };
  }

  /**
   * 取消任务
   */
  @Post(':id/cancel')
  @ApiOperation({ summary: '取消任务' })
  @ApiParam({ name: 'id', description: '任务ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiQuery({ name: 'reason', description: '取消原因', required: false, example: '任务不再需要' })
  @ApiResponse({ status: 200, description: '取消成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 404, description: '任务不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async cancel(@Param('id') id: string, @Query('reason') reason?: string) {
    const task = await this.taskService.cancel(id, reason);
    return {
      code: 200,
      message: '取消成功',
      data: task,
    };
  }

  /**
   * 删除任务
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除任务' })
  @ApiParam({ name: 'id', description: '任务ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiResponse({ status: 200, description: '删除成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 404, description: '任务不存在' })
  @ApiResponse({ status: 401, description: '未授权' })
  async delete(@Param('id') id: string) {
    await this.taskService.delete(id);
    return {
      code: 200,
      message: '删除成功',
    };
  }

  /**
   * 获取任务统计信息
   */
  @Get('statistics')
  @ApiOperation({ summary: '获取任务统计信息' })
  @ApiQuery({ name: 'assignee', description: '任务负责人ID', required: false, example: 'user001' })
  @ApiResponse({ status: 200, description: '查询成功', type: () => ApiResponseDto })
  @ApiResponse({ status: 401, description: '未授权' })
  async getStatistics(@Query('assignee') assignee?: string) {
    const statistics = await this.taskService.getStatistics(assignee);
    return {
      code: 200,
      message: '查询成功',
      data: statistics,
    };
  }
}
