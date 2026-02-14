import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

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
 * 
 * 索引策略：
 * - idx_historic_proc_inst_id: 按流程实例ID查询历史
 * - idx_historic_proc_def_key: 按流程定义Key查询历史
 * - idx_historic_proc_status: 按状态查询历史
 * - idx_historic_proc_start_user: 按发起人查询历史
 * - idx_historic_proc_start_time: 按开始时间排序查询
 * - idx_historic_proc_end_time: 按结束时间排序查询
 * - idx_historic_proc_business_key: 按业务键查询历史
 * - idx_historic_proc_tenant: 多租户查询
 */
@Entity('historic_process_instance')
@Index('idx_historic_proc_inst_id', ['processInstanceId'])
@Index('idx_historic_proc_def_key', ['processDefinitionKey'])
@Index('idx_historic_proc_status', ['status'])
@Index('idx_historic_proc_start_user', ['startUserId'])
@Index('idx_historic_proc_start_time', ['startTime'])
@Index('idx_historic_proc_end_time', ['endTime'])
@Index('idx_historic_proc_business_key', ['businessKey'])
@Index('idx_historic_proc_tenant', ['tenantId'])
@Index('idx_historic_proc_status_start_time', ['status', 'startTime'])
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
