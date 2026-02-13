import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * 活动类型枚举
 */
export enum ActivityType {
  START_EVENT = 'START_EVENT',
  END_EVENT = 'END_EVENT',
  USER_TASK = 'USER_TASK',
  SERVICE_TASK = 'SERVICE_TASK',
  SCRIPT_TASK = 'SCRIPT_TASK',
  EXCLUSIVE_GATEWAY = 'EXCLUSIVE_GATEWAY',
  PARALLEL_GATEWAY = 'PARALLEL_GATEWAY',
  INCLUSIVE_GATEWAY = 'INCLUSIVE_GATEWAY',
  EVENT_BASED_GATEWAY = 'EVENT_BASED_GATEWAY',
  SUBPROCESS = 'SUBPROCESS',
  CALL_ACTIVITY = 'CALL_ACTIVITY',
}

/**
 * 历史活动实例实体
 */
@Entity('historic_activity_instance')
export class HistoricActivityInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'activity_id', length: 255 })
  activityId: string;

  @Column({ name: 'activity_name', length: 255, nullable: true })
  activityName?: string;

  @Column({ name: 'activity_type', type: 'enum', enum: ActivityType })
  activityType: ActivityType;

  @Column({ name: 'process_definition_id', length: 255 })
  processDefinitionId: string;

  @Column({ name: 'process_definition_key', length: 255 })
  processDefinitionKey: string;

  @Column({ name: 'process_definition_version', type: 'int' })
  processDefinitionVersion: number;

  @Column({ name: 'process_instance_id', length: 255 })
  processInstanceId: string;

  @Column({ name: 'execution_id', length: 255, nullable: true })
  executionId?: string;

  @Column({ name: 'task_id', length: 255, nullable: true })
  taskId?: string;

  @Column({ name: 'called_process_instance_id', length: 255, nullable: true })
  calledProcessInstanceId?: string;

  @Column({ name: 'called_case_instance_id', length: 255, nullable: true })
  calledCaseInstanceId?: string;

  @Column({ name: 'tenant_id', length: 255, nullable: true })
  tenantId?: string;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime?: Date;

  @Column({ name: 'duration', type: 'bigint', nullable: true })
  duration?: number;

  @Column({ name: 'assignee', length: 255, nullable: true })
  assignee?: string;

  @Column({ name: 'variables', type: 'json', nullable: true })
  variables?: Record<string, any>;

  @CreateDateColumn({ name: 'create_time', type: 'datetime' })
  createTime: Date;
}
