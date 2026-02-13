import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsDateString, IsObject,  } from 'class-validator';

/**
 * 创建任务DTO
 */
export class CreateTaskDto {
  @ApiProperty({ description: '任务名称', example: '审核申请' })
  @IsString()
  name: string;

  @ApiProperty({ description: '任务描述', required: false, example: '审核用户的申请信息' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: '任务定义Key', example: 'reviewTask' })
  @IsString()
  taskDefinitionKey: string;

  @ApiProperty({ description: '任务定义ID', example: 'reviewTask_1' })
  @IsString()
  taskDefinitionId: string;

  @ApiProperty({ description: '任务定义版本', example: 1 })
  @IsInt()
  taskDefinitionVersion: number;

  @ApiProperty({ description: '流程实例ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  processInstanceId: string;

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

  @ApiProperty({ description: '任务优先级', required: false, example: 1, default: 1 })
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

  @ApiProperty({ description: '租户ID', required: false, example: 'tenant001' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '父任务ID', required: false, example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @ApiProperty({ description: '表单Key', required: false, example: 'reviewForm' })
  @IsOptional()
  @IsString()
  formKey?: string;

  @ApiProperty({ description: '表单数据', required: false, type: Object, example: { comment: '同意' } })
  @IsOptional()
  @IsObject()
  formData?: Record<string, any>;

  @ApiProperty({ description: '任务变量', required: false, type: Object, example: { amount: 1000 } })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}
