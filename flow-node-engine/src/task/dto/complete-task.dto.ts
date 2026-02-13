import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';

/**
 * 完成任务DTO
 */
export class CompleteTaskDto {
  @ApiProperty({ description: '任务ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  taskId: string;

  @ApiProperty({ description: '完成人ID', required: false, example: 'user001' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: '表单数据', required: false, type: Object, example: { comment: '同意', approved: true } })
  @IsOptional()
  @IsObject()
  formData?: Record<string, any>;

  @ApiProperty({ description: '任务变量', required: false, type: Object, example: { amount: 1000, approved: true } })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}
