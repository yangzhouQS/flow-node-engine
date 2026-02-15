import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({ description: '历史流程实例ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @ApiProperty({ description: '流程定义名称', required: false })
  @Column({ name: 'process_definition_name', length: 255, nullable: true })
  processDefinitionName?: string;

  @ApiProperty({ description: '业务键', required: false })
  @Column({ name: 'business_key', length: 255, nullable: true })
  businessKey?: string;

  @ApiProperty({ description: '发起人ID', required: false })
  @Column({ name: 'start_user_id', length: 255, nullable: true })
  startUserId?: string;

  @ApiProperty({ description: '开始时间' })
  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @ApiProperty({ description: '结束时间', required: false })
  @Column({ name: 'end_time', type: 'datetime', nullable: true })
  endTime?: Date;

  @ApiProperty({ description: '持续时间(毫秒)', required: false })
  @Column({ name: 'duration', type: 'bigint', nullable: true })
  duration?: number;

  @ApiProperty({ description: '流程状态', enum: HistoricProcessStatus })
  @Column({ name: 'status', type: 'enum', enum: HistoricProcessStatus })
  status: HistoricProcessStatus;

  @ApiProperty({ description: '删除原因', required: false })
  @Column({ name: 'delete_reason', length: 255, nullable: true })
  deleteReason?: string;

  @ApiProperty({ description: '父流程实例ID', required: false })
  @Column({ name: 'super_process_instance_id', length: 255, nullable: true })
  superProcessInstanceId?: string;

  @ApiProperty({ description: '根流程实例ID', required: false })
  @Column({ name: 'root_process_instance_id', length: 255, nullable: true })
  rootProcessInstanceId?: string;

  @ApiProperty({ description: '租户ID', required: false })
  @Column({ name: 'tenant_id', length: 255, nullable: true })
  tenantId?: string;

  @ApiProperty({ description: '流程变量', required: false })
  @Column({ name: 'variables', type: 'json', nullable: true })
  variables?: Record<string, any>;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ name: 'create_time', type: 'datetime' })
  createTime: Date;
}
