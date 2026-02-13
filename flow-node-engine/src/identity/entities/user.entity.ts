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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'username', length: 64 })
  username: string;

  @Column({ name: 'password', length: 128 })
  password: string;

  @Column({ name: 'real_name', length: 64, nullable: true })
  realName: string;

  @Column({ name: 'email', length: 128, nullable: true })
  @Index()
  email: string;

  @Column({ name: 'phone', length: 20, nullable: true })
  phone: string;

  @Column({ name: 'avatar', length: 255, nullable: true })
  avatar: string;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  @Index()
  isActive: boolean;

  @Column({ name: 'tenant_id', length: 64, nullable: true })
  @Index()
  tenantId: string;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time', nullable: true })
  updateTime: Date;

  @OneToMany(() => UserRole, userRole => userRole.user)
  roles: UserRole[];

  @OneToMany(() => UserGroup, userGroup => userGroup.user)
  groups: UserGroup[];
}
