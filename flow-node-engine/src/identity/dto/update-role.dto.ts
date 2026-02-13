import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ description: '角色描述', required: false })
  @IsOptional()
  @IsString({ message: '角色描述必须是字符串' })
  description?: string;

  @ApiProperty({ description: '角色代码', example: 'admin', required: false })
  @IsOptional()
  @IsString({ message: '角色代码必须是字符串' })
  code?: string;

  @ApiProperty({ description: '是否系统角色', example: false, required: false })
  @IsOptional()
  @IsBoolean({ message: '是否系统角色必须是布尔值' })
  isSystem?: boolean;

  @ApiProperty({ description: '排序', example: 1, required: false })
  @IsOptional()
  @IsNumber({}, { message: '排序必须是数字' })
  sort?: number;
}
