import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

import { ProcessDefinition } from './process-definition.entity';

/**
 * 部署实体
 * 用于管理流程定义的部署
 */
@Entity('deployment')
export class Deployment {
  @ApiProperty({ description: '部署ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '部署名称', example: '请假流程部署' })
  @Column({ name: 'name', length: 255 })
  name: string;

  @ApiProperty({ description: '分类', example: '人力资源', required: false })
  @Column({ name: 'category', length: 255, nullable: true })
  category?: string;

  @ApiProperty({ description: '租户ID', required: false })
  @Column({ name: 'tenant_id', length: 255, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: '部署时间' })
  @CreateDateColumn({ name: 'deploy_time', type: 'datetime' })
  deployTime: Date;

  @ApiProperty({ description: '是否最新版本', example: true })
  @Column({ name: 'is_latest_version', type: 'boolean', default: false })
  isLatestVersion: boolean;

  @ApiHideProperty()
  @OneToMany(() => ProcessDefinition, (definition) => definition.deployment)
  processDefinitions: ProcessDefinition[];
}
