import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsDateString, IsEnum, IsObject } from 'class-validator';

import { TaskStatus } from '../entities/task.entity';

/**
 * 更新任务DTO
 */
export class UpdateTaskDto {
  @ApiProperty({ description: '任务名称', required: false, example: '审核申请' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '任务描述', required: false, example: '审核用户的申请信息' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '任务负责人', required: false, example: 'user001' })
  @IsOptional()
  @IsString()
  assignee?: string;

  @ApiProperty({ description: '任务负责人全名', required: false, example: '张三' })
  @IsOptional()
  @IsString()
  assigneeFullName?: string;

  @ApiProperty({ description: '任务所有者', required: false, example: 'user002' })
  @IsOptional()
  @IsString()
  owner?: string;

  @ApiProperty({ description: '任务优先级', required: false, example: 1 })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiProperty({ description: '任务截止日期', required: false, example: '2025-02-12T12:00:00Z' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ description: '任务分类', required: false, example: '审批' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: '任务状态', required: false, enum: TaskStatus, example: TaskStatus.ASSIGNED })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ description: '表单数据', required: false, type: Object, example: { comment: '同意' } })
  @IsOptional()
  @IsObject()
  formData?: Record<string, any>;

  @ApiProperty({ description: '任务变量', required: false, type: Object, example: { amount: 1000 } })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}
