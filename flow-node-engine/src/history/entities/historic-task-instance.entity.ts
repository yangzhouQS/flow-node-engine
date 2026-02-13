import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * 历史任务状态枚举
 */
export enum HistoricTaskStatus {
  CREATED = 'CREATED',
  ASSIGNED = 'ASSIGNED',
  UNASSIGNED = 'UNASSIGNED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/**
 * 历史任务实例实体
 */
@Entity('historic_task_instance')
export class HistoricTaskInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_id', length: 255 })
  taskId: string;

  @Column({ name: 'task_definition_key', length: 255 })
  taskDefinitionKey: string;

  @Column({ name: 'task_definition_id', length: 255 })
  taskDefinitionId: string;

  @Column({ name: 'task_definition_version', type: 'int' })
  taskDefinitionVersion: number;

  @Column({ name: 'process_instance_id', length: 255 })
  processInstanceId: string;

  @Column({ name: 'process_definition_id', length: 255 })
  processDefinitionId: string;

  @Column({ name: 'process_definition_key', length: 255 })
  processDefinitionKey: string;

  @Column({ name: 'process_definition_version', type: 'int' })
  processDefinitionVersion: number;

  @Column({ name: 'execution_id', length: 255, nullable: true })
  executionId?: string;

  @Column({ name: 'name', length: 255 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

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

  @Column({ name: 'status', type: 'enum', enum: HistoricTaskStatus })
  status: HistoricTaskStatus;

  @Column({ name: 'create_time', type: 'datetime' })
  createTime: Date;

  @Column({ name: 'claim_time', type: 'datetime', nullable: true })
  claimTime?: Date;

  @Column({ name: 'completion_time', type: 'datetime', nullable: true })
  completionTime?: Date;

  @Column({ name: 'duration', type: 'bigint', nullable: true })
  duration?: number;

  @Column({ name: 'form_key', length: 255, nullable: true })
  formKey?: string;

  @Column({ name: 'form_data', type: 'json', nullable: true })
  formData?: Record<string, any>;

  @Column({ name: 'variables', type: 'json', nullable: true })
  variables?: Record<string, any>;

  @Column({ name: 'delete_reason', length: 255, nullable: true })
  deleteReason?: string;

  // Getter属性 - 提供别名访问
  /**
   * 开始时间 - createTime的别名
   */
  get startTime(): Date {
    return this.createTime;
  }

  /**
   * 结束时间 - completionTime的别名
   */
  get endTime(): Date | undefined {
    return this.completionTime;
  }
}
