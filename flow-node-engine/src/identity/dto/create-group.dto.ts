import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ description: '组名称', example: '研发部' })
  @IsNotEmpty({ message: '组名称不能为空' })
  @IsString({ message: '组名称必须是字符串' })
  name: string;

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

  @ApiProperty({ description: '租户 ID', required: false })
  @IsOptional()
  @IsString({ message: '租户 ID 必须是字符串' })
  tenantId?: string;
}
