import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

import { Deployment } from './deployment.entity';

/**
 * 流程定义实体
 * 用于管理流程定义
 */
@Entity('process_definition')
export class ProcessDefinition {
  @ApiProperty({ description: '流程定义ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '流程键', example: 'leave-process' })
  @Column({ name: 'key', length: 255 })
  key: string;

  @ApiProperty({ description: '版本号', example: 1 })
  @Column({ name: 'version', type: 'int' })
  version: number;

  @ApiProperty({ description: '流程名称', example: '请假流程' })
  @Column({ name: 'name', length: 255 })
  name: string;

  @ApiProperty({ description: '流程分类', example: '人力资源', required: false })
  @Column({ name: 'category', length: 255, nullable: true })
  category?: string;

  @ApiProperty({ description: '流程描述', example: '员工请假审批流程', required: false })
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: '部署ID' })
  @Column({ name: 'deployment_id' })
  deploymentId: string;

  @ApiHideProperty()
  @ManyToOne(() => Deployment, (deployment) => deployment.processDefinitions)
  @JoinColumn({ name: 'deployment_id' })
  deployment: Deployment;

  @ApiProperty({ description: '资源名称', example: 'leave-process.bpmn20.xml' })
  @Column({ name: 'resource_name', length: 255 })
  resourceName: string;

  @ApiProperty({ description: 'BPMN XML 内容' })
  @Column({ name: 'bpmn_xml', type: 'longtext' })
  bpmnXml: string;

  @ApiProperty({ description: '流程图 SVG', required: false })
  @Column({ name: 'diagram_svg', type: 'longtext', nullable: true })
  diagramSvg?: string;

  @ApiProperty({ description: '是否挂起', example: false })
  @Column({ name: 'is_suspended', type: 'boolean', default: false })
  isSuspended: boolean;

  @ApiProperty({ description: '开始活动ID', required: false })
  @Column({ name: 'start_activity_id', length: 255, nullable: true })
  startActivityId?: string;

  @ApiProperty({ description: '开始活动名称', required: false })
  @Column({ name: 'start_activity_name', length: 255, nullable: true })
  startActivityName?: string;

  @ApiProperty({ description: '租户ID', required: false })
  @Column({ name: 'tenant_id', length: 255, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ name: 'create_time', type: 'datetime' })
  createTime: Date;

  @ApiProperty({ description: '更新时间', required: false })
  @Column({ name: 'update_time', type: 'datetime', nullable: true })
  updateTime?: Date;
}
