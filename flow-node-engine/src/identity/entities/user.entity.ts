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

import { UserGroup } from './user-group.entity';
import { UserRole } from './user-role.entity';

@Entity('user')
@Index(['username'], { unique: true })
export class User {
  @ApiProperty({ description: '用户ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '用户名', example: 'admin' })
  @Column({ name: 'username', length: 64 })
  username: string;

  @ApiHideProperty()
  @Column({ name: 'password', length: 128 })
  password: string;

  @ApiProperty({ description: '真实姓名', required: false })
  @Column({ name: 'real_name', length: 64, nullable: true })
  realName: string;

  @ApiProperty({ description: '邮箱', required: false })
  @Column({ name: 'email', length: 128, nullable: true })
  @Index()
  email: string;

  @ApiProperty({ description: '手机号', required: false })
  @Column({ name: 'phone', length: 20, nullable: true })
  phone: string;

  @ApiProperty({ description: '头像', required: false })
  @Column({ name: 'avatar', length: 255, nullable: true })
  avatar: string;

  @ApiProperty({ description: '是否激活', example: true })
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  @Index()
  isActive: boolean;

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
  @OneToMany(() => UserRole, userRole => userRole.user)
  roles: UserRole[];

  @ApiHideProperty()
  @OneToMany(() => UserGroup, userGroup => userGroup.user)
  groups: UserGroup[];
}
