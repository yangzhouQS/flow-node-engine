import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

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
 * 
 * 索引策略：
 * - idx_historic_task_process_inst: 按流程实例查询历史任务
 * - idx_historic_task_assignee: 按受让人查询历史任务
 * - idx_historic_task_status: 按状态查询历史任务
 * - idx_historic_task_process_def: 按流程定义查询历史任务
 * - idx_historic_task_create_time: 按创建时间排序查询
 * - idx_historic_task_completion_time: 按完成时间排序查询
 * - idx_historic_task_assignee_status: 复合索引，用户历史任务查询优化
 */
@Entity('historic_task_instance')
@Index('idx_historic_task_process_inst', ['processInstanceId'])
@Index('idx_historic_task_assignee', ['assignee'])
@Index('idx_historic_task_status', ['status'])
@Index('idx_historic_task_process_def', ['processDefinitionKey'])
@Index('idx_historic_task_create_time', ['createTime'])
@Index('idx_historic_task_completion_time', ['completionTime'])
@Index('idx_historic_task_assignee_status', ['assignee', 'status'])
@Index('idx_historic_task_process_status', ['processInstanceId', 'status'])
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
