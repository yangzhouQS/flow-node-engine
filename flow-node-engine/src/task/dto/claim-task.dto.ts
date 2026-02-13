import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt } from 'class-validator';

/**
 * 认领任务DTO
 */
export class ClaimTaskDto {
  @ApiProperty({ description: '任务ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  taskId: string;

  @ApiProperty({ description: '认领人ID', required: false, example: 'user001' })
  @IsOptional()
  @IsString()
  assignee?: string;

  @ApiProperty({ description: '认领人全名', required: false, example: '张三' })
  @IsOptional()
  @IsString()
  assigneeFullName?: string;
}
