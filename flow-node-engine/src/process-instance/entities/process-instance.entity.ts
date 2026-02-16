import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';

import { ProcessDefinition } from '../../process-definition/entities/process-definition.entity';

import { Execution } from './execution.entity';
import { Variable } from './variable.entity';

/**
 * 流程实例状态枚举
 */
export enum ProcessInstanceStatus {
  /** 运行中 */
  RUNNING = 'RUNNING',
  /** 已完成 */
  COMPLETED = 'COMPLETED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
  /** 已暂停 */
  SUSPENDED = 'SUSPENDED',
  /** 已终止 */
  TERMINATED = 'TERMINATED',
}

/**
 * 流程实例实体
 * 
 * 索引策略：
 * - idx_proc_inst_def_id: 按流程定义ID查询实例
 * - idx_proc_inst_def_key: 按流程定义Key查询实例
 * - idx_proc_inst_status: 按状态查询实例
 * - idx_proc_inst_business_key: 按业务键查询实例（唯一性查询）
 * - idx_proc_inst_tenant: 多租户查询
 * - idx_proc_inst_start_user: 按发起人查询
 * - idx_proc_inst_start_time: 按开始时间排序查询
 * - idx_proc_inst_status_start_time: 复合索引，运行中实例按时间排序
 */
@Entity('process_instances')
@Index('idx_proc_inst_def_id', ['processDefinitionId'])
@Index('idx_proc_inst_def_key', ['processDefinitionKey'])
@Index('idx_proc_inst_status', ['status'])
@Index('idx_proc_inst_business_key', ['businessKey'])
@Index('idx_proc_inst_tenant', ['tenantId'])
@Index('idx_proc_inst_start_user', ['startUserId'])
@Index('idx_proc_inst_start_time', ['startTime'])
@Index('idx_proc_inst_status_start_time', ['status', 'startTime'])
export class ProcessInstance {
  @ApiProperty({ description: '流程实例ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '流程定义ID' })
  @Column({ name: 'process_definition_id' })
  processDefinitionId: string;

  @ApiProperty({ description: '流程定义Key', example: 'leave-process' })
  @Column({ name: 'process_definition_key' })
  processDefinitionKey: string;

  @ApiProperty({ description: '业务键', required: false })
  @Column({ name: 'business_key', nullable: true })
  businessKey: string;

  @ApiProperty({ description: '租户ID', required: false })
  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @ApiProperty({ description: '开始时间' })
  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @ApiProperty({ description: '结束时间', required: false })
  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @ApiProperty({ description: '状态', example: 'running' })
  @Column({ name: 'state', default: 'running' })
  state: string;

  @ApiProperty({ description: '流程状态', enum: ProcessInstanceStatus, example: 'RUNNING' })
  @Column({
    name: 'status',
    type: 'varchar',
    length: '20',
    default: ProcessInstanceStatus.RUNNING
  })
  status: ProcessInstanceStatus;

  @ApiProperty({ description: '发起人ID', required: false })
  @Column({ name: 'start_user_id', nullable: true })
  startUserId: string;

  @ApiProperty({ description: '流程变量', required: false })
  @Column({ name: 'variables', type: 'json', nullable: true })
  variables: Record<string, any>;

  @ApiProperty({ description: '删除原因', required: false })
  @Column({ name: 'delete_reason', nullable: true })
  deleteReason: string;

  @ApiProperty({ description: '父流程实例ID', required: false })
  @Column({ name: 'super_process_instance_id', nullable: true })
  superProcessInstanceId: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @ApiHideProperty()
  @ManyToOne(() => ProcessDefinition, { nullable: true })
  @JoinColumn({ name: 'process_definition_id' })
  processDefinition: ProcessDefinition;

  @ApiHideProperty()
  @OneToMany(() => Execution, (execution) => execution.processInstance)
  executions: Execution[];

  @ApiHideProperty()
  @OneToMany(() => Variable, (variable) => variable.processInstance)
  variableList: Variable[];
}
