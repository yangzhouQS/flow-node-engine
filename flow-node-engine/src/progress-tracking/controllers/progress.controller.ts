/**
 * 进度追踪控制器
 * 提供进度查询、统计、看板等REST API
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
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

import {
  CreateProgressDto,
  UpdateProgressDto,
  ProgressQueryDto,
  ProgressStatisticsQueryDto,
  ProgressStatisticsDto,
  ProgressDashboardDto,
  CreateProgressMetricDto,
  ProgressMetricQueryDto,
} from '../dto/progress.dto';
import { Progress } from '../entities/progress.entity';
import { ProgressGateway } from '../gateways/progress.gateway';
import { ProgressTrackingService } from '../services/progress-tracking.service';

@ApiTags('进度追踪')
@Controller('progress')
export class ProgressController {
  constructor(
    private readonly progressTrackingService: ProgressTrackingService,
    private readonly progressGateway: ProgressGateway,
  ) {}

  // ==================== 进度管理API ====================

  /**
   * 创建进度记录
   */
  @Post()
  @ApiOperation({ summary: '创建进度记录' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '创建成功', type: () => Progress })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  async create(@Body() dto: CreateProgressDto): Promise<Progress> {
    try {
      return await this.progressTrackingService.createProgress(dto);
    } catch (error) {
      throw new BadRequestException(`创建进度失败: ${(error as Error).message}`);
    }
  }

  /**
   * 更新进度
   */
  @Put(':id')
  @ApiOperation({ summary: '更新进度' })
  @ApiParam({ name: 'id', description: '进度ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '更新成功', type: () => Progress })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '进度记录不存在' })
  async update(@Param('id') id: string, @Body() dto: UpdateProgressDto): Promise<Progress> {
    try {
      return await this.progressTrackingService.updateProgress(id, dto);
    } catch (error) {
      if ((error as Error).message.includes('不存在')) {
        throw new NotFoundException((error as Error).message);
      }
      throw new BadRequestException(`更新进度失败: ${(error as Error).message}`);
    }
  }

  /**
   * 根据ID获取进度
   */
  @Get(':id')
  @ApiOperation({ summary: '根据ID获取进度' })
  @ApiParam({ name: 'id', description: '进度ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: () => Progress })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '进度记录不存在' })
  async getById(@Param('id') id: string): Promise<Progress> {
    const progress = await this.progressTrackingService.getProgressById(id);
    if (!progress) {
      throw new NotFoundException(`进度记录不存在: ${id}`);
    }
    return progress;
  }

  /**
   * 根据流程实例ID获取进度
   */
  @Get('process-instance/:processInstanceId')
  @ApiOperation({ summary: '根据流程实例ID获取进度' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: () => Progress })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '进度记录不存在' })
  async getByProcessInstanceId(@Param('processInstanceId') processInstanceId: string): Promise<Progress> {
    const progress = await this.progressTrackingService.getProgressByProcessInstanceId(processInstanceId);
    if (!progress) {
      throw new NotFoundException(`流程实例进度不存在: ${processInstanceId}`);
    }
    return progress;
  }

  /**
   * 根据任务ID获取进度
   */
  @Get('task/:taskId')
  @ApiOperation({ summary: '根据任务ID获取进度' })
  @ApiParam({ name: 'taskId', description: '任务ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: () => Progress })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '进度记录不存在' })
  async getByTaskId(@Param('taskId') taskId: string): Promise<Progress> {
    const progress = await this.progressTrackingService.getProgressByTaskId(taskId);
    if (!progress) {
      throw new NotFoundException(`任务进度不存在: ${taskId}`);
    }
    return progress;
  }

  /**
   * 查询进度列表
   */
  @Get()
  @ApiOperation({ summary: '查询进度列表' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async query(@Query() query: ProgressQueryDto): Promise<{ list: Progress[]; total: number }> {
    return this.progressTrackingService.queryProgress(query);
  }

  /**
   * 删除进度
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除进度' })
  @ApiParam({ name: 'id', description: '进度ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '删除成功' })
  async delete(@Param('id') id: string): Promise<void> {
    await this.progressTrackingService.deleteProgress(id);
  }

  // ==================== 进度操作API ====================

  /**
   * 完成流程进度
   */
  @Post('process-instance/:processInstanceId/complete')
  @ApiOperation({ summary: '完成流程进度' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '操作成功', type: () => Progress })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '进度记录不存在' })
  async completeProcessProgress(@Param('processInstanceId') processInstanceId: string): Promise<Progress> {
    try {
      return await this.progressTrackingService.completeProcessProgress(processInstanceId);
    } catch (error) {
      if ((error as Error).message.includes('不存在')) {
        throw new NotFoundException((error as Error).message);
      }
      throw new BadRequestException(`完成进度失败: ${(error as Error).message}`);
    }
  }

  /**
   * 计算流程进度百分比
   */
  @Get('process-instance/:processInstanceId/percentage')
  @ApiOperation({ summary: '计算流程进度百分比' })
  @ApiParam({ name: 'processInstanceId', description: '流程实例ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '计算成功' })
  async calculatePercentage(@Param('processInstanceId') processInstanceId: string): Promise<{ percentage: number }> {
    const percentage = await this.progressTrackingService.calculateProcessProgress(processInstanceId);
    return { percentage };
  }

  // ==================== 统计API ====================

  /**
   * 获取进度统计
   */
  @Get('statistics')
  @ApiOperation({ summary: '获取进度统计' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: () => ProgressStatisticsDto })
  async getStatistics(@Query() query: ProgressStatisticsQueryDto): Promise<ProgressStatisticsDto> {
    return this.progressTrackingService.getStatistics(query);
  }

  /**
   * 获取进度看板数据
   */
  @Get('dashboard')
  @ApiOperation({ summary: '获取进度看板数据' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: () => ProgressDashboardDto })
  async getDashboard(@Query('tenantId') tenantId?: string): Promise<ProgressDashboardDto> {
    return this.progressTrackingService.getDashboard(tenantId);
  }

  // ==================== WebSocket状态API ====================

  /**
   * 获取WebSocket连接统计
   */
  @Get('websocket/stats')
  @ApiOperation({ summary: '获取WebSocket连接统计' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功' })
  getWebSocketStats(): {
    onlineCount: number;
    subscriptions: {
      totalClients: number;
      totalProcessSubscriptions: number;
      totalTaskSubscriptions: number;
    };
  } {
    return {
      onlineCount: this.progressGateway.getOnlineCount(),
      subscriptions: this.progressGateway.getSubscriptionStats(),
    };
  }

  // ==================== 指标API ====================

  /**
   * 记录指标
   */
  @Post('metrics')
  @ApiOperation({ summary: '记录指标' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '记录成功' })
  async recordMetric(@Body() dto: CreateProgressMetricDto): Promise<void> {
    await this.progressTrackingService.recordMetric(dto);
  }

  /**
   * 查询指标
   */
  @Get('metrics')
  @ApiOperation({ summary: '查询指标' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async queryMetrics(@Query() query: ProgressMetricQueryDto): Promise<{ list: any[]; total: number }> {
    return this.progressTrackingService.queryMetrics(query);
  }

  /**
   * 获取Prometheus格式指标
   */
  @Get('metrics/prometheus')
  @ApiOperation({ summary: '获取Prometheus格式指标' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: String })
  async getPrometheusMetrics(): Promise<string> {
    return this.progressTrackingService.getPrometheusMetrics();
  }
}
