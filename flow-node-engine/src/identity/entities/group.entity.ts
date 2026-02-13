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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', length: 64 })
  name: string;

  @Column({ name: 'description', length: 256, nullable: true })
  description: string;

  @Column({ name: 'code', length: 64, nullable: true })
  @Index()
  code: string;

  @Column({ name: 'parent_id', length: 64, nullable: true })
  @Index()
  parentId: string;

  @Column({ name: 'type', length: 20, nullable: true })
  type: string;

  @Column({ name: 'is_system', type: 'tinyint', width: 1, default: 0 })
  isSystem: boolean;

  @Column({ name: 'sort', type: 'int', default: 0 })
  sort: number;

  @Column({ name: 'tenant_id', length: 64, nullable: true })
  @Index()
  tenantId: string;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time', nullable: true })
  updateTime: Date;

  @OneToMany(() => UserGroup, userGroup => userGroup.group)
  users: UserGroup[];
}
