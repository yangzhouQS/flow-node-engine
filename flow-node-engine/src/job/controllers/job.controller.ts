/**
 * 作业控制器
 * 提供作业管理、定时器作业、外部工作者作业、死信作业等REST API
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
  CreateJobDto,
  JobQueryDto,
  JobResultDto,
  CreateTimerJobDto,
  TimerJobQueryDto,
  CreateExternalWorkerJobDto,
  ExternalWorkerJobQueryDto,
  FetchAndLockDto,
  CompleteExternalWorkerJobDto,
  FailExternalWorkerJobDto,
  DeadLetterJobQueryDto,
  ProcessDeadLetterJobDto,
  JobStatisticsDto,
} from '../dto/job.dto';
import { DeadLetterJob } from '../entities/dead-letter-job.entity';
import { ExternalWorkerJob } from '../entities/external-worker-job.entity';
import { Job, JobStatus } from '../entities/job.entity';
import { TimerJob } from '../entities/timer-job.entity';
import { JobService } from '../services/job.service';

@ApiTags('作业管理')
@Controller('job')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  // ==================== 通用作业API ====================

  /**
   * 创建作业
   */
  @Post()
  @ApiOperation({ summary: '创建作业' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '创建成功', type: Job })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  async createJob(@Body() dto: CreateJobDto): Promise<Job> {
    try {
      return await this.jobService.createJob(dto);
    } catch (error) {
      throw new BadRequestException(`创建作业失败: ${(error as Error).message}`);
    }
  }

  /**
   * 根据ID获取作业
   */
  @Get(':id')
  @ApiOperation({ summary: '根据ID获取作业' })
  @ApiParam({ name: 'id', description: '作业ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: Job })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '作业不存在' })
  async getJobById(@Param('id') id: string): Promise<Job> {
    const job = await this.jobService.getJobById(id);
    if (!job) {
      throw new NotFoundException(`作业不存在: ${id}`);
    }
    return job;
  }

  /**
   * 查询作业列表
   */
  @Get()
  @ApiOperation({ summary: '查询作业列表' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async queryJobs(@Query() query: JobQueryDto): Promise<{ list: Job[]; total: number }> {
    return this.jobService.queryJobs(query);
  }

  /**
   * 获取待执行作业
   */
  @Get('pending/list')
  @ApiOperation({ summary: '获取待执行作业' })
  @ApiQuery({ name: 'limit', required: false, description: '限制数量' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功' })
  async getPendingJobs(@Query('limit') limit?: number): Promise<Job[]> {
    return this.jobService.getPendingJobs(limit || 10);
  }

  /**
   * 执行作业
   */
  @Post(':id/execute')
  @ApiOperation({ summary: '执行作业' })
  @ApiParam({ name: 'id', description: '作业ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '执行完成', type: Object })
  async executeJob(@Param('id') id: string): Promise<JobResultDto> {
    return this.jobService.executeJob(id);
  }

  /**
   * 重试作业
   */
  @Post(':id/retry')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '重试作业' })
  @ApiParam({ name: 'id', description: '作业ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '重试已提交' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: '作业不存在' })
  async retryJob(@Param('id') id: string): Promise<void> {
    try {
      await this.jobService.retryJob(id);
    } catch (error) {
      if ((error as Error).message.includes('不存在')) {
        throw new NotFoundException((error as Error).message);
      }
      throw new BadRequestException(`重试作业失败: ${(error as Error).message}`);
    }
  }

  /**
   * 删除作业
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除作业' })
  @ApiParam({ name: 'id', description: '作业ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '删除成功' })
  async deleteJob(@Param('id') id: string): Promise<void> {
    await this.jobService.deleteJob(id);
  }

  /**
   * 获取作业统计
   */
  @Get('statistics')
  @ApiOperation({ summary: '获取作业统计' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功', type: JobStatisticsDto })
  async getStatistics(): Promise<JobStatisticsDto> {
    return this.jobService.getStatistics();
  }

  // ==================== 定时器作业API ====================

  /**
   * 创建定时器作业
   */
  @Post('timer')
  @ApiOperation({ summary: '创建定时器作业' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '创建成功', type: TimerJob })
  async createTimerJob(@Body() dto: CreateTimerJobDto): Promise<TimerJob> {
    return this.jobService.createTimerJob(dto);
  }

  /**
   * 查询定时器作业列表
   */
  @Get('timer')
  @ApiOperation({ summary: '查询定时器作业列表' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async queryTimerJobs(@Query() query: TimerJobQueryDto): Promise<{ list: TimerJob[]; total: number }> {
    return this.jobService.queryTimerJobs(query);
  }

  /**
   * 取消定时器作业
   */
  @Post('timer/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '取消定时器作业' })
  @ApiParam({ name: 'id', description: '定时器作业ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '取消成功' })
  async cancelTimerJob(@Param('id') id: string): Promise<void> {
    await this.jobService.cancelTimerJob(id);
  }

  // ==================== 外部工作者作业API ====================

  /**
   * 创建外部工作者作业
   */
  @Post('external-worker')
  @ApiOperation({ summary: '创建外部工作者作业' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '创建成功', type: ExternalWorkerJob })
  async createExternalWorkerJob(@Body() dto: CreateExternalWorkerJobDto): Promise<ExternalWorkerJob> {
    return this.jobService.createExternalWorkerJob(dto);
  }

  /**
   * 查询外部工作者作业列表
   */
  @Get('external-worker')
  @ApiOperation({ summary: '查询外部工作者作业列表' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async queryExternalWorkerJobs(
    @Query() query: ExternalWorkerJobQueryDto,
  ): Promise<{ list: ExternalWorkerJob[]; total: number }> {
    return this.jobService.queryExternalWorkerJobs(query);
  }

  /**
   * 获取并锁定作业（外部工作者）
   */
  @Post('external-worker/fetch-and-lock')
  @ApiOperation({ summary: '获取并锁定作业（外部工作者）' })
  @ApiResponse({ status: HttpStatus.OK, description: '获取成功' })
  async fetchAndLock(@Body() dto: FetchAndLockDto): Promise<ExternalWorkerJob[]> {
    return this.jobService.fetchAndLock(dto);
  }

  /**
   * 完成外部工作者作业
   */
  @Post('external-worker/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '完成外部工作者作业' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '完成成功' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  async completeExternalWorkerJob(@Body() dto: CompleteExternalWorkerJobDto): Promise<void> {
    try {
      await this.jobService.completeExternalWorkerJob(dto);
    } catch (error) {
      throw new BadRequestException(`完成作业失败: ${(error as Error).message}`);
    }
  }

  /**
   * 外部工作者作业失败
   */
  @Post('external-worker/fail')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '外部工作者作业失败' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '已标记失败' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  async failExternalWorkerJob(@Body() dto: FailExternalWorkerJobDto): Promise<void> {
    try {
      await this.jobService.failExternalWorkerJob(dto);
    } catch (error) {
      throw new BadRequestException(`标记作业失败失败: ${(error as Error).message}`);
    }
  }

  // ==================== 死信作业API ====================

  /**
   * 查询死信作业列表
   */
  @Get('dead-letter')
  @ApiOperation({ summary: '查询死信作业列表' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async queryDeadLetterJobs(
    @Query() query: DeadLetterJobQueryDto,
  ): Promise<{ list: DeadLetterJob[]; total: number }> {
    return this.jobService.queryDeadLetterJobs(query);
  }

  /**
   * 处理死信作业
   */
  @Post('dead-letter/process')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '处理死信作业' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '处理成功' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: '请求参数错误' })
  async processDeadLetterJob(@Body() dto: ProcessDeadLetterJobDto): Promise<void> {
    try {
      await this.jobService.processDeadLetterJob(dto);
    } catch (error) {
      throw new BadRequestException(`处理死信作业失败: ${(error as Error).message}`);
    }
  }
}
