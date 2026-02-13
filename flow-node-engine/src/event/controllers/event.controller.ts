import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';

import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { JwtAuthGuard } from '../../identity/guards/jwt-auth.guard';
import { Event, EventType, EventStatus } from '../entities/event.entity';
import { EventPublishService } from '../services/event-publish.service';
import { EventSubscriptionService } from '../services/event-subscription.service';

@ApiTags('events')
@Controller('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventController {
  constructor(
    private readonly eventSubscriptionService: EventSubscriptionService,
    private readonly eventPublishService: EventPublishService,
  ) {}

  @Get()
  @ApiOperation({ summary: '查询所有事件（分页）' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '页码，默认1' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: '每页数量，默认10' })
  async findAll(@Query('page') page?: number, @Query('pageSize') pageSize?: number) {
    const pageNum = page || 1;
    const size = pageSize || 10;
    const result = await this.eventSubscriptionService.findAll(pageNum, size);
    return ApiResponseDto.success(result.events, '查询成功', {
      total: result.total,
      page: pageNum,
      pageSize: size,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID查询事件' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiParam({ name: 'id', description: '事件ID' })
  async findById(@Param('id') id: string) {
    const event = await this.eventSubscriptionService.findById(id);
    return ApiResponseDto.success(event);
  }

  @Get('process-instance/:processInstanceId')
  @ApiOperation({ summary: '根据流程实例ID查询事件' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID' })
  async findByProcessInstanceId(@Param('processInstanceId') processInstanceId: string) {
    const events = await this.eventSubscriptionService.findByProcessInstanceId(processInstanceId);
    return ApiResponseDto.success(events);
  }

  @Get('task/:taskId')
  @ApiOperation({ summary: '根据任务ID查询事件' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiParam({ name: 'taskId', description: '任务ID' })
  async findByTaskId(@Param('taskId') taskId: string) {
    const events = await this.eventSubscriptionService.findByTaskId(taskId);
    return ApiResponseDto.success(events);
  }

  @Get('type/:eventType')
  @ApiOperation({ summary: '根据事件类型查询事件' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiParam({ name: 'eventType', description: '事件类型', enum: EventType })
  async findByEventType(@Param('eventType') eventType: EventType) {
    const events = await this.eventSubscriptionService.findByEventType(eventType);
    return ApiResponseDto.success(events);
  }

  @Get('status/:eventStatus')
  @ApiOperation({ summary: '根据事件状态查询事件' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiParam({ name: 'eventStatus', description: '事件状态', enum: EventStatus })
  async findByEventStatus(@Param('eventStatus') eventStatus: EventStatus) {
    const events = await this.eventSubscriptionService.findByEventStatus(eventStatus);
    return ApiResponseDto.success(events);
  }

  @Put(':id/status')
  @ApiOperation({ summary: '更新事件状态' })
  @ApiResponse({ status: 200, description: '更新成功', type: ApiResponseDto })
  @ApiParam({ name: 'id', description: '事件ID' })
  async updateEventStatus(
    @Param('id') id: string,
    @Body() body: { status: EventStatus; errorMessage?: string },
  ) {
    const event = await this.eventSubscriptionService.updateEventStatus(
      id,
      body.status,
      body.errorMessage,
    );
    return ApiResponseDto.success(event, '更新成功');
  }

  @Post(':id/retry')
  @ApiOperation({ summary: '重试失败的事件' })
  @ApiResponse({ status: 200, description: '重试成功', type: ApiResponseDto })
  @ApiParam({ name: 'id', description: '事件ID' })
  async retryFailedEvent(@Param('id') id: string) {
    const event = await this.eventSubscriptionService.retryFailedEvent(id);
    return ApiResponseDto.success(event, '重试成功');
  }

  @Post(':id/process')
  @ApiOperation({ summary: '标记事件为已处理' })
  @ApiResponse({ status: 200, description: '标记成功', type: ApiResponseDto })
  @ApiParam({ name: 'id', description: '事件ID' })
  async markEventAsProcessed(@Param('id') id: string) {
    const event = await this.eventPublishService.markEventAsProcessed(id);
    return ApiResponseDto.success(event, '标记成功');
  }

  @Post('process/batch')
  @ApiOperation({ summary: '批量标记事件为已处理' })
  @ApiResponse({ status: 200, description: '标记成功', type: ApiResponseDto })
  async markEventsAsProcessed(@Body() body: { eventIds: string[] }) {
    await this.eventPublishService.markEventsAsProcessed(body.eventIds);
    return ApiResponseDto.success(null, '批量标记成功');
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除事件' })
  @ApiResponse({ status: 200, description: '删除成功', type: ApiResponseDto })
  @ApiParam({ name: 'id', description: '事件ID' })
  async delete(@Param('id') id: string) {
    await this.eventSubscriptionService.delete(id);
    return ApiResponseDto.success(null, '删除成功');
  }

  @Post('delete/batch')
  @ApiOperation({ summary: '批量删除事件' })
  @ApiResponse({ status: 200, description: '删除成功', type: ApiResponseDto })
  async deleteMany(@Body() body: { ids: string[] }) {
    await this.eventSubscriptionService.deleteMany(body.ids);
    return ApiResponseDto.success(null, '批量删除成功');
  }

  @Get('count/total')
  @ApiOperation({ summary: '统计事件总数' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async count() {
    const count = await this.eventSubscriptionService.count();
    return ApiResponseDto.success({ count });
  }

  @Get('count/status/:eventStatus')
  @ApiOperation({ summary: '根据状态统计事件数量' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  @ApiParam({ name: 'eventStatus', description: '事件状态', enum: EventStatus })
  async countByStatus(@Param('eventStatus') eventStatus: EventStatus) {
    const count = await this.eventSubscriptionService.countByStatus(eventStatus);
    return ApiResponseDto.success({ count });
  }

  @Get('statistics')
  @ApiOperation({ summary: '获取事件统计信息' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async getStatistics() {
    const statistics = await this.eventPublishService.getEventStatistics();
    return ApiResponseDto.success(statistics);
  }

  @Get('count/pending')
  @ApiOperation({ summary: '获取待发布事件数量' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async getPendingEventCount() {
    const count = await this.eventPublishService.getPendingEventCount();
    return ApiResponseDto.success({ count });
  }

  @Get('count/failed')
  @ApiOperation({ summary: '获取失败事件数量' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async getFailedEventCount() {
    const count = await this.eventPublishService.getFailedEventCount();
    return ApiResponseDto.success({ count });
  }

  @Get('count/processed')
  @ApiOperation({ summary: '获取已处理事件数量' })
  @ApiResponse({ status: 200, description: '查询成功', type: ApiResponseDto })
  async getProcessedEventCount() {
    const count = await this.eventPublishService.getProcessedEventCount();
    return ApiResponseDto.success({ count });
  }
}
