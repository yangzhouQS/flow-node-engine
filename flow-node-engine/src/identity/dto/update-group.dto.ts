import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class UpdateGroupDto {
  @ApiProperty({ description: '组描述', required: false })
  @IsOptional()
  @IsString({ message: '组描述必须是字符串' })
  description?: string;

  @ApiProperty({ description: '组代码', example: 'rd', required: false })
  @IsOptional()
  @IsString({ message: '组代码必须是字符串' })
  code?: string;

  @ApiProperty({ description: '父组 ID', required: false })
  @IsOptional()
  @IsString({ message: '父组 ID 必须是字符串' })
  parentId?: string;

  @ApiProperty({ description: '组类型', example: 'department', required: false })
  @IsOptional()
  @IsString({ message: '组类型必须是字符串' })
  type?: string;

  @ApiProperty({ description: '是否系统组', example: false, required: false })
  @IsOptional()
  @IsBoolean({ message: '是否系统组必须是布尔值' })
  isSystem?: boolean;

  @ApiProperty({ description: '排序', example: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: '排序必须是数字' })
  sort?: number;
}
