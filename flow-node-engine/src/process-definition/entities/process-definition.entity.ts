import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

import { Deployment } from './deployment.entity';

/**
 * 流程定义实体
 * 用于管理流程定义
 */
@Entity('process_definition')
export class ProcessDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'key', length: 255 })
  key: string;

  @Column({ name: 'version', type: 'int' })
  version: number;

  @Column({ name: 'name', length: 255 })
  name: string;

  @Column({ name: 'category', length: 255, nullable: true })
  category?: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'deployment_id' })
  deploymentId: string;

  @ManyToOne(() => Deployment, (deployment) => deployment.processDefinitions)
  @JoinColumn({ name: 'deployment_id' })
  deployment: Deployment;

  @Column({ name: 'resource_name', length: 255 })
  resourceName: string;

  @Column({ name: 'bpmn_xml', type: 'longtext' })
  bpmnXml: string;

  @Column({ name: 'diagram_svg', type: 'longtext', nullable: true })
  diagramSvg?: string;

  @Column({ name: 'is_suspended', type: 'boolean', default: false })
  isSuspended: boolean;

  @Column({ name: 'start_activity_id', length: 255, nullable: true })
  startActivityId?: string;

  @Column({ name: 'start_activity_name', length: 255, nullable: true })
  startActivityName?: string;

  @Column({ name: 'tenant_id', length: 255, nullable: true })
  tenantId?: string;

  @CreateDateColumn({ name: 'create_time', type: 'datetime' })
  createTime: Date;

  @Column({ name: 'update_time', type: 'datetime', nullable: true })
  updateTime?: Date;
}
