import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, IsArray, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BatchType, BatchStatus } from '../entities/batch.entity';
import { BatchPartStatus } from '../entities/batch-part.entity';

/**
 * 创建批处理DTO
 */
export class CreateBatchDto {
  @ApiProperty({ description: '批处理类型', enum: BatchType })
  @IsEnum(BatchType)
  type: BatchType | string;

  @ApiPropertyOptional({ description: '批处理描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '批处理配置（JSON）' })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: '搜索键' })
  @IsOptional()
  @IsString()
  searchKey?: string;

  @ApiPropertyOptional({ description: '搜索键2' })
  @IsOptional()
  @IsString()
  searchKey2?: string;

  @ApiPropertyOptional({ description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: '是否异步执行', default: true })
  @IsOptional()
  @IsBoolean()
  async?: boolean;

  @ApiPropertyOptional({ description: '优先级', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: '最大重试次数', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxRetries?: number;

  @ApiPropertyOptional({ description: '批处理数据项列表' })
  @IsOptional()
  @IsArray()
  items?: BatchPartItemDto[];

  @ApiPropertyOptional({ description: '扩展属性' })
  @IsOptional()
  @IsObject()
  extra?: Record<string, any>;
}

/**
 * 批处理数据项DTO
 */
export class BatchPartItemDto {
  @ApiPropertyOptional({ description: '部分类型' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ description: '处理数据' })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ description: '扩展属性' })
  @IsOptional()
  @IsObject()
  extra?: Record<string, any>;
}

/**
 * 更新批处理DTO
 */
export class UpdateBatchDto {
  @ApiPropertyOptional({ description: '批处理状态', enum: BatchStatus })
  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @ApiPropertyOptional({ description: '批处理描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '优先级' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: '错误信息' })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiPropertyOptional({ description: '扩展属性' })
  @IsOptional()
  @IsObject()
  extra?: Record<string, any>;
}

/**
 * 批处理查询DTO
 */
export class QueryBatchDto {
  @ApiPropertyOptional({ description: '批处理ID' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ description: '批处理类型', enum: BatchType })
  @IsOptional()
  @IsEnum(BatchType)
  type?: BatchType | string;

  @ApiPropertyOptional({ description: '批处理状态', enum: BatchStatus })
  @IsOptional()
  @IsEnum(BatchStatus)
  status?: BatchStatus;

  @ApiPropertyOptional({ description: '搜索键' })
  @IsOptional()
  @IsString()
  searchKey?: string;

  @ApiPropertyOptional({ description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: '创建者' })
  @IsOptional()
  @IsString()
  createUser?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number;
}

/**
 * 批处理部分查询DTO
 */
export class QueryBatchPartDto {
  @ApiProperty({ description: '批处理ID' })
  @IsString()
  batchId: string;

  @ApiPropertyOptional({ description: '部分状态', enum: BatchPartStatus })
  @IsOptional()
  @IsEnum(BatchPartStatus)
  status?: BatchPartStatus;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number;
}

/**
 * 批处理响应DTO
 */
export class BatchResponseDto {
  @ApiProperty({ description: '批处理ID' })
  id: string;

  @ApiProperty({ description: '批处理类型' })
  type: string;

  @ApiProperty({ description: '总数量' })
  total: number;

  @ApiProperty({ description: '已处理数量' })
  processedTotal: number;

  @ApiProperty({ description: '成功数量' })
  successTotal: number;

  @ApiProperty({ description: '失败数量' })
  failTotal: number;

  @ApiProperty({ description: '批处理状态' })
  status: string;

  @ApiPropertyOptional({ description: '批处理配置' })
  config?: Record<string, any>;

  @ApiPropertyOptional({ description: '搜索键' })
  searchKey?: string;

  @ApiPropertyOptional({ description: '搜索键2' })
  searchKey2?: string;

  @ApiPropertyOptional({ description: '租户ID' })
  tenantId?: string;

  @ApiPropertyOptional({ description: '创建者' })
  createUser?: string;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiPropertyOptional({ description: '更新时间' })
  updateTime?: Date;

  @ApiPropertyOptional({ description: '完成时间' })
  completeTime?: Date;

  @ApiPropertyOptional({ description: '描述' })
  description?: string;

  @ApiProperty({ description: '是否异步执行' })
  async: boolean;

  @ApiProperty({ description: '优先级' })
  priority: number;

  @ApiPropertyOptional({ description: '错误信息' })
  errorMessage?: string;

  @ApiProperty({ description: '进度百分比' })
  progress: number;
}

/**
 * 批处理部分响应DTO
 */
export class BatchPartResponseDto {
  @ApiProperty({ description: '部分ID' })
  id: string;

  @ApiProperty({ description: '批处理ID' })
  batchId: string;

  @ApiPropertyOptional({ description: '部分类型' })
  type?: string;

  @ApiProperty({ description: '部分状态' })
  status: string;

  @ApiPropertyOptional({ description: '处理数据' })
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: '处理结果' })
  result?: Record<string, any>;

  @ApiPropertyOptional({ description: '错误信息' })
  errorMessage?: string;

  @ApiProperty({ description: '重试次数' })
  retryCount: number;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiPropertyOptional({ description: '开始时间' })
  startTime?: Date;

  @ApiPropertyOptional({ description: '完成时间' })
  completeTime?: Date;
}

/**
 * 批处理统计DTO
 */
export class BatchStatisticsDto {
  @ApiProperty({ description: '总批处理数' })
  totalBatches: number;

  @ApiProperty({ description: '待执行数' })
  pendingBatches: number;

  @ApiProperty({ description: '执行中数' })
  runningBatches: number;

  @ApiProperty({ description: '已完成数' })
  completedBatches: number;

  @ApiProperty({ description: '失败数' })
  failedBatches: number;

  @ApiProperty({ description: '已取消数' })
  cancelledBatches: number;

  @ApiProperty({ description: '总数据项数' })
  totalParts: number;

  @ApiProperty({ description: '待处理数据项数' })
  pendingParts: number;

  @ApiProperty({ description: '已完成数据项数' })
  completedParts: number;

  @ApiProperty({ description: '失败数据项数' })
  failedParts: number;
}
