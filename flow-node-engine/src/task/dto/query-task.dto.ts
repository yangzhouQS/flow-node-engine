import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsInt, IsEnum, IsDateString, IsArray } from 'class-validator';

import { TaskStatus } from '../entities/task.entity';

/**
 * 查询任务DTO
 */
export class QueryTaskDto {
  @ApiProperty({ description: '任务ID', required: false, example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiProperty({ description: '流程实例ID', required: false, example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  processInstanceId?: string;

  @ApiProperty({ description: '任务负责人', required: false, example: 'user001' })
  @IsOptional()
  @IsString()
  assignee?: string;

  @ApiProperty({ description: '任务所有者', required: false, example: 'user002' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiProperty({ description: '任务定义Key', required: false, example: 'reviewTask' })
  @IsOptional()
  @IsString()
  taskDefinitionKey?: string;

  @ApiProperty({ description: '任务状态', required: false, enum: TaskStatus, example: TaskStatus.ASSIGNED })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ description: '任务分类', required: false, example: '审批' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: '租户ID', required: false, example: 'tenant001' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '任务状态列表', required: false, enum: TaskStatus, isArray: true, example: [TaskStatus.ASSIGNED, TaskStatus.UNASSIGNED] })
  @IsOptional()
  @IsArray()
  @IsEnum(TaskStatus, { each: true })
  statusList?: TaskStatus[];

  @ApiProperty({ description: '任务负责人列表', required: false, isArray: true, example: ['user001', 'user002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeList?: string[];

  @ApiProperty({ description: '任务定义Key列表', required: false, isArray: true, example: ['reviewTask', 'approveTask'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taskDefinitionKeyList?: string[];

  @ApiProperty({ description: '创建时间开始', required: false, example: '2025-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  createTimeStart?: string;

  @ApiProperty({ description: '创建时间结束', required: false, example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  createTimeEnd?: string;

  @ApiProperty({ description: '截止时间开始', required: false, example: '2025-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  dueDateStart?: string;

  @ApiProperty({ description: '截止时间结束', required: false, example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  dueDateEnd?: string;

  @ApiProperty({ description: '页码', required: false, example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number = 1;

  @ApiProperty({ description: '每页数量', required: false, example: 10, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number = 10;

  @ApiProperty({ description: '排序字段', required: false, example: 'createTime' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createTime';

  @ApiProperty({ description: '排序方向', required: false, example: 'ASC', default: 'DESC' })
  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
