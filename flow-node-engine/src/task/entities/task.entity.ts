import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';

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
 */
@Entity('task')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', length: 255 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'task_definition_key', length: 255 })
  taskDefinitionKey: string;

  @Column({ name: 'task_definition_id', length: 255 })
  taskDefinitionId: string;

  @Column({ name: 'task_definition_version', type: 'int' })
  taskDefinitionVersion: number;

  @Column({ name: 'process_instance_id', length: 255 })
  processInstanceId: string;

  @ManyToOne(() => ProcessInstance, (instance) => instance.id)
  @JoinColumn({ name: 'process_instance_id' })
  processInstance: ProcessInstance;

  @Column({ name: 'assignee', length: 255, nullable: true })
  assignee?: string;

  @Column({ name: 'assignee_full_name', length: 255, nullable: true })
  assigneeFullName?: string;

  @Column({ name: 'owner', length: 255, nullable: true })
  owner?: string;

  @Column({ name: 'priority', type: 'int', default: 1 })
  priority: number;

  @Column({ name: 'due_date', type: 'datetime', nullable: true })
  dueDate?: Date;

  @Column({ name: 'category', length: 255, nullable: true })
  category?: string;

  @Column({ name: 'tenant_id', length: 255, nullable: true })
  tenantId?: string;

  @Column({ name: 'status', type: 'enum', enum: TaskStatus, default: TaskStatus.CREATED })
  status: TaskStatus;

  @Column({ name: 'create_time', type: 'datetime' })
  createTime: Date;

  @Column({ name: 'claim_time', type: 'datetime', nullable: true })
  claimTime?: Date;

  @Column({ name: 'completion_time', type: 'datetime', nullable: true })
  completionTime?: Date;

  @Column({ name: 'parent_task_id', length: 255, nullable: true })
  parentTaskId?: string;

  @Column({ name: 'form_key', length: 255, nullable: true })
  formKey?: string;

  @Column({ name: 'form_data', type: 'json', nullable: true })
  formData?: Record<string, any>;

  @Column({ name: 'variables', type: 'json', nullable: true })
  variables?: Record<string, any>;

  @Column({ name: 'update_time', type: 'datetime', nullable: true })
  updateTime?: Date;
}
