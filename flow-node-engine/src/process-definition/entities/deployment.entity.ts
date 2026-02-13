import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

import { ProcessDefinition } from './process-definition.entity';

/**
 * 部署实体
 * 用于管理流程定义的部署
 */
@Entity('deployment')
export class Deployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', length: 255 })
  name: string;

  @Column({ name: 'category', length: 255, nullable: true })
  category?: string;

  @Column({ name: 'tenant_id', length: 255, nullable: true })
  tenantId?: string;

  @CreateDateColumn({ name: 'deploy_time', type: 'datetime' })
  deployTime: Date;

  @Column({ name: 'is_latest_version', type: 'boolean', default: false })
  isLatestVersion: boolean;

  @OneToMany(() => ProcessDefinition, (definition) => definition.deployment)
  processDefinitions: ProcessDefinition[];
}
