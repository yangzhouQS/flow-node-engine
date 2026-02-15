import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

import { UserRole } from './user-role.entity';

@Entity('role')
@Index(['name'], { unique: true })
export class Role {
  @ApiProperty({ description: '角色ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '角色名称', example: '管理员' })
  @Column({ name: 'name', length: 64 })
  name: string;

  @ApiProperty({ description: '角色描述', required: false })
  @Column({ name: 'description', length: 256, nullable: true })
  description: string;

  @ApiProperty({ description: '角色代码', required: false })
  @Column({ name: 'code', length: 64, nullable: true })
  @Index()
  code: string;

  @ApiProperty({ description: '是否系统角色', example: false })
  @Column({ name: 'is_system', type: 'tinyint', width: 1, default: 0 })
  isSystem: boolean;

  @ApiProperty({ description: '排序', example: 0 })
  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number;

  @ApiProperty({ description: '租户ID', required: false })
  @Column({ name: 'tenant_id', length: 64, nullable: true })
  @Index()
  tenantId: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ name: 'update_time', nullable: true })
  updateTime: Date;

  @ApiHideProperty()
  @OneToMany(() => UserRole, userRole => userRole.role)
  users: UserRole[];
}
