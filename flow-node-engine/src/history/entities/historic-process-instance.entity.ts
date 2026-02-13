import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * 历史流程实例状态枚举
 */
export enum HistoricProcessStatus {
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

/**
 * 历史流程实例实体
 */
@Entity('historic_process_instance')
export class HistoricProcessInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'process_instance_id', length: 255 })
  processInstanceId: string;

  @Column({ name: 'process_definition_id', length: 255 })
  processDefinitionId: string;

  @Column({ name: 'process_definition_key', length: 255 })
  processDefinitionKey: string;

  @Column({ name: 'process_definition_version', type: 'int' })
  processDefinitionVersion: number;

  @Column({ name: 'process_definition_name', length: 255, nullable: true })
  processDefinitionName?: string;

  @Column({ name: 'business_key', length: 255, nullable: true })
  businessKey?: string;

  @Column({ name: 'start_user_id', length: 255, nullable: true })
  startUserId?: string;

  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime?: Date;

  @Column({ name: 'duration', type: 'bigint', nullable: true })
  duration?: number;

  @Column({ name: 'status', type: 'enum', enum: HistoricProcessStatus })
  status: HistoricProcessStatus;

  @Column({ name: 'delete_reason', length: 255, nullable: true })
  deleteReason?: string;

  @Column({ name: 'super_process_instance_id', length: 255, nullable: true })
  superProcessInstanceId?: string;

  @Column({ name: 'root_process_instance_id', length: 255, nullable: true })
  rootProcessInstanceId?: string;

  @Column({ name: 'tenant_id', length: 255, nullable: true })
  tenantId?: string;

  @Column({ name: 'variables', type: 'json', nullable: true })
  variables?: Record<string, any>;

  @CreateDateColumn({ name: 'create_time', type: 'datetime' })
  createTime: Date;
}
