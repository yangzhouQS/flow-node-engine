import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, IsString } from 'class-validator';

export class AssignRoleDto {
  @ApiProperty({ description: '角色 ID 列表', example: ['role-id-1', 'role-id-2'] })
  @IsNotEmpty({ message: '角色 ID 列表不能为空' })
  @IsArray({ message: '角色 ID 列表必须是数组' })
  @IsString({ each: true, message: '每个角色 ID 必须是字符串' })
  roleIds: string[];
}
