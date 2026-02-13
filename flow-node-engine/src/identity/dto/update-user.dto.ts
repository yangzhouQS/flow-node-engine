import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ description: '真实姓名', example: '张三', required: false })
  @IsOptional()
  @IsString({ message: '真实姓名必须是字符串' })
  realName?: string;

  @ApiProperty({ description: '邮箱', example: 'zhangsan@example.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: '邮箱格式不正确' })
  email?: string;

  @ApiProperty({ description: '手机号', example: '13800138000', required: false })
  @IsOptional()
  @IsString({ message: '手机号必须是字符串' })
  phone?: string;

  @ApiProperty({ description: '头像 URL', required: false })
  @IsOptional()
  @IsString({ message: '头像 URL 必须是字符串' })
  avatar?: string;

  @ApiProperty({ description: '是否激活', example: true, required: false })
  @IsOptional()
  @IsBoolean({ message: '是否激活必须是布尔值' })
  isActive?: boolean;
}
