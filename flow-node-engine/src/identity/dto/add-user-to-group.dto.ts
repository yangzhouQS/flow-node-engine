import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, IsString } from 'class-validator';

export class AddUserToGroupDto {
  @ApiProperty({ description: '用户 ID 列表', example: ['user-id-1', 'user-id-2'] })
  @IsNotEmpty({ message: '用户 ID 列表不能为空' })
  @IsArray({ message: '用户 ID 列表必须是数组' })
  @IsString({ each: true, message: '每个用户 ID 必须是字符串' })
  userIds: string[];
}
