import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';

import { ProcessInstance } from '../../process-instance/entities/process-instance.entity';

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  CREATED = 'CREATED',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * 任务实体
 * 
 * 索引策略：
 * - idx_task_process_instance: 按流程实例查询任务
 * - idx_task_assignee: 按受让人查询任务（常用查询）
 * - idx_task_status: 按状态查询任务
 * - idx_task_create_time: 按创建时间排序查询
 * - idx_task_tenant: 多租户查询
 * - idx_task_process_def_key: 按流程定义键查询
 * - idx_task_assignee_status: 复合索引，用户待办任务查询优化
 */
@Entity('task')
@Index('idx_task_process_instance', ['processInstanceId'])
@Index('idx_task_assignee', ['assignee'])
@Index('idx_task_status', ['status'])
@Index('idx_task_create_time', ['createTime'])
@Index('idx_task_tenant', ['tenantId'])
@Index('idx_task_process_def_key', ['taskDefinitionKey'])
@Index('idx_task_assignee_status', ['assignee', 'status'])
@Index('idx_task_process_status', ['processInstanceId', 'status'])
export class Task {
  @ApiProperty({ description: '任务ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '任务名称', example: '审批任务' })
  @Column({ name: 'name', length: 255 })
  name: string;

  @ApiProperty({ description: '任务描述', required: false })
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @ApiProperty({ description: '任务定义Key', example: 'userTask1' })
  @Column({ name: 'task_definition_key', length: 255 })
  taskDefinitionKey: string;

  @ApiProperty({ description: '任务定义ID' })
  @Column({ name: 'task_definition_id', length: 255 })
  taskDefinitionId: string;

  @ApiProperty({ description: '任务定义版本', example: 1 })
  @Column({ name: 'task_definition_version', type: 'int' })
  taskDefinitionVersion: number;

  @ApiProperty({ description: '流程实例ID' })
  @Column({ name: 'process_instance_id', length: 255 })
  processInstanceId: string;

  @ApiHideProperty()
  @ManyToOne(() => ProcessInstance, (instance) => instance.id)
  @JoinColumn({ name: 'process_instance_id' })
  processInstance: ProcessInstance;

  @ApiProperty({ description: '受让人', required: false })
  @Column({ name: 'assignee', length: 255, nullable: true })
  assignee?: string;

  @ApiProperty({ description: '受让人全名', required: false })
  @Column({ name: 'assignee_full_name', length: 255, nullable: true })
  assigneeFullName?: string;

  @ApiProperty({ description: '拥有者', required: false })
  @Column({ name: 'owner', length: 255, nullable: true })
  owner?: string;

  @ApiProperty({ description: '优先级', example: 1 })
  @Column({ name: 'priority', type: 'int', default: 1 })
  priority: number;

  @ApiProperty({ description: '到期日期', required: false })
  @Column({ name: 'due_date', type: 'datetime', nullable: true })
  dueDate?: Date;

  @ApiProperty({ description: '分类', required: false })
  @Column({ name: 'category', length: 255, nullable: true })
  category?: string;

  @ApiProperty({ description: '租户ID', required: false })
  @Column({ name: 'tenant_id', length: 255, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: '任务状态', enum: TaskStatus, example: 'CREATED' })
  @Column({ name: 'status', type: 'enum', enum: TaskStatus, default: TaskStatus.CREATED })
  status: TaskStatus;

  @ApiProperty({ description: '创建时间' })
  @Column({ name: 'create_time', type: 'datetime' })
  createTime: Date;

  @ApiProperty({ description: '认领时间', required: false })
  @Column({ name: 'claim_time', type: 'datetime', nullable: true })
  claimTime?: Date;

  @ApiProperty({ description: '完成时间', required: false })
  @Column({ name: 'completion_time', type: 'datetime', nullable: true })
  completionTime?: Date;

  @ApiProperty({ description: '父任务ID', required: false })
  @Column({ name: 'parent_task_id', length: 255, nullable: true })
  parentTaskId?: string;

  @ApiProperty({ description: '表单Key', required: false })
  @Column({ name: 'form_key', length: 255, nullable: true })
  formKey?: string;

  @ApiProperty({ description: '表单数据', required: false })
  @Column({ name: 'form_data', type: 'json', nullable: true })
  formData?: Record<string, any>;

  @ApiProperty({ description: '任务变量', required: false })
  @Column({ name: 'variables', type: 'json', nullable: true })
  variables?: Record<string, any>;

  @ApiProperty({ description: '更新时间', required: false })
  @Column({ name: 'update_time', type: 'datetime', nullable: true })
  updateTime?: Date;
}
