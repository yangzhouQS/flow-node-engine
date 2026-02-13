import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

import {
  CreateBatchDto,
  UpdateBatchDto,
  QueryBatchDto,
  QueryBatchPartDto,
  BatchResponseDto,
  BatchPartResponseDto,
  BatchStatisticsDto,
} from '../dto/batch.dto';
import { BatchPartEntity } from '../entities/batch-part.entity';
import { BatchEntity } from '../entities/batch.entity';
import { BatchService } from '../services/batch.service';

@ApiTags('批处理管理')
@ApiBearerAuth()
@Controller('batches')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  // ==================== 批处理管理 ====================

  @Post()
  @ApiOperation({ summary: '创建批处理' })
  @ApiResponse({ status: HttpStatus.CREATED, description: '创建成功', type: BatchEntity })
  async createBatch(@Body() dto: CreateBatchDto): Promise<BatchEntity> {
    return this.batchService.createBatch(dto);
  }

  @Get()
  @ApiOperation({ summary: '查询批处理列表' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async queryBatches(@Query() dto: QueryBatchDto): Promise<{ data: BatchResponseDto[]; total: number }> {
    const { data, total } = await this.batchService.queryBatches(dto);
    return {
      data: data.map(batch => this.batchService.toResponseDto(batch)),
      total,
    };
  }

  @Get('statistics')
  @ApiOperation({ summary: '获取批处理统计' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功', type: BatchStatisticsDto })
  async getStatistics(): Promise<BatchStatisticsDto> {
    return this.batchService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取批处理详情' })
  @ApiParam({ name: 'id', description: '批处理ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功', type: BatchResponseDto })
  async getBatch(@Param('id') id: string): Promise<BatchResponseDto> {
    const batch = await this.batchService.getBatchById(id);
    if (!batch) {
      throw new Error(`Batch not found: ${id}`);
    }
    return this.batchService.toResponseDto(batch);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新批处理' })
  @ApiParam({ name: 'id', description: '批处理ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '更新成功', type: BatchResponseDto })
  async updateBatch(
    @Param('id') id: string,
    @Body() dto: UpdateBatchDto,
  ): Promise<BatchResponseDto> {
    const batch = await this.batchService.updateBatch(id, dto);
    return this.batchService.toResponseDto(batch);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '取消批处理' })
  @ApiParam({ name: 'id', description: '批处理ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '取消成功', type: BatchResponseDto })
  async cancelBatch(@Param('id') id: string): Promise<BatchResponseDto> {
    const batch = await this.batchService.cancelBatch(id);
    return this.batchService.toResponseDto(batch);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除批处理' })
  @ApiParam({ name: 'id', description: '批处理ID' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: '删除成功' })
  async deleteBatch(@Param('id') id: string): Promise<void> {
    await this.batchService.deleteBatch(id);
  }

  // ==================== 批处理部分管理 ====================

  @Get(':id/parts')
  @ApiOperation({ summary: '查询批处理部分列表' })
  @ApiParam({ name: 'id', description: '批处理ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功' })
  async queryBatchParts(
    @Param('id') id: string,
    @Query() dto: Omit<QueryBatchPartDto, 'batchId'>,
  ): Promise<{ data: BatchPartResponseDto[]; total: number }> {
    const { data, total } = await this.batchService.queryBatchParts({
      ...dto,
      batchId: id,
    });
    return {
      data: data.map(part => this.batchService.toPartResponseDto(part)),
      total,
    };
  }

  @Get(':batchId/parts/:partId')
  @ApiOperation({ summary: '获取批处理部分详情' })
  @ApiParam({ name: 'batchId', description: '批处理ID' })
  @ApiParam({ name: 'partId', description: '部分ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '查询成功', type: BatchPartResponseDto })
  async getBatchPart(
    @Param('batchId') batchId: string,
    @Param('partId') partId: string,
  ): Promise<BatchPartResponseDto> {
    const part = await this.batchService.getBatchPartById(partId);
    if (!part) {
      throw new Error(`Batch part not found: ${partId}`);
    }
    return this.batchService.toPartResponseDto(part);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重试失败的批处理部分' })
  @ApiParam({ name: 'id', description: '批处理ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '重试成功' })
  async retryFailedParts(@Param('id') id: string): Promise<{ count: number }> {
    const count = await this.batchService.retryFailedParts(id);
    return { count };
  }

  // ==================== 批处理执行控制 ====================

  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '手动执行批处理' })
  @ApiParam({ name: 'id', description: '批处理ID' })
  @ApiResponse({ status: HttpStatus.OK, description: '执行成功' })
  async executeBatch(@Param('id') id: string): Promise<{ message: string }> {
    const batch = await this.batchService.getBatchById(id);
    if (!batch) {
      throw new Error(`Batch not found: ${id}`);
    }
    
    // 异步执行批处理
    this.batchService.executeBatch(batch).catch(error => {
      console.error(`Error executing batch ${id}:`, error);
    });
    
    return { message: 'Batch execution started' };
  }
}
