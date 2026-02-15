import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({ description: '历史任务ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '任务ID' })
  @Column({ name: 'task_id', length: 255 })
  taskId: string;

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

  @ApiProperty({ description: '流程定义ID' })
  @Column({ name: 'process_definition_id', length: 255 })
  processDefinitionId: string;

  @ApiProperty({ description: '流程定义Key', example: 'leave-process' })
  @Column({ name: 'process_definition_key', length: 255 })
  processDefinitionKey: string;

  @ApiProperty({ description: '流程定义版本', example: 1 })
  @Column({ name: 'process_definition_version', type: 'int' })
  processDefinitionVersion: number;

  @ApiProperty({ description: '执行ID', required: false })
  @Column({ name: 'execution_id', length: 255, nullable: true })
  executionId?: string;

  @ApiProperty({ description: '任务名称', example: '审批任务' })
  @Column({ name: 'name', length: 255 })
  name: string;

  @ApiProperty({ description: '任务描述', required: false })
  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

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

  @ApiProperty({ description: '任务状态', enum: HistoricTaskStatus })
  @Column({ name: 'status', type: 'enum', enum: HistoricTaskStatus })
  status: HistoricTaskStatus;

  @ApiProperty({ description: '创建时间' })
  @Column({ name: 'create_time', type: 'datetime' })
  createTime: Date;

  @ApiProperty({ description: '认领时间', required: false })
  @Column({ name: 'claim_time', type: 'datetime', nullable: true })
  claimTime?: Date;

  @ApiProperty({ description: '完成时间', required: false })
  @Column({ name: 'completion_time', type: 'datetime', nullable: true })
  completionTime?: Date;

  @ApiProperty({ description: '持续时间(毫秒)', required: false })
  @Column({ name: 'duration', type: 'bigint', nullable: true })
  duration?: number;

  @ApiProperty({ description: '表单Key', required: false })
  @Column({ name: 'form_key', length: 255, nullable: true })
  formKey?: string;

  @ApiProperty({ description: '表单数据', required: false })
  @Column({ name: 'form_data', type: 'json', nullable: true })
  formData?: Record<string, any>;

  @ApiProperty({ description: '任务变量', required: false })
  @Column({ name: 'variables', type: 'json', nullable: true })
  variables?: Record<string, any>;

  @ApiProperty({ description: '删除原因', required: false })
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
