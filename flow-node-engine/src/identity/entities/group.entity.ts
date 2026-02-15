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

@Entity('group')
@Index(['name'], { unique: true })
export class Group {
  @ApiProperty({ description: '组ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '组名称', example: '开发组' })
  @Column({ name: 'name', length: 64 })
  name: string;

  @ApiProperty({ description: '组描述', required: false })
  @Column({ name: 'description', length: 256, nullable: true })
  description: string;

  @ApiProperty({ description: '组代码', required: false })
  @Column({ name: 'code', length: 64, nullable: true })
  @Index()
  code: string;

  @ApiProperty({ description: '父组ID', required: false })
  @Column({ name: 'parent_id', length: 64, nullable: true })
  @Index()
  parentId: string;

  @ApiProperty({ description: '类型', required: false })
  @Column({ name: 'type', length: 20, nullable: true })
  type: string;

  @ApiProperty({ description: '是否系统组', example: false })
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
  @OneToMany(() => UserGroup, userGroup => userGroup.group)
  users: UserGroup[];
}
