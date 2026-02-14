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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'process_definition_id' })
  processDefinitionId: string;

  @Column({ name: 'process_definition_key' })
  processDefinitionKey: string;

  @Column({ name: 'business_key', nullable: true })
  businessKey: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ name: 'state', default: 'running' })
  state: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: '20',
    default: ProcessInstanceStatus.RUNNING
  })
  status: ProcessInstanceStatus;

  @Column({ name: 'start_user_id', nullable: true })
  startUserId: string;

  @Column({ name: 'variables', type: 'json', nullable: true })
  variables: Record<string, any>;

  @Column({ name: 'delete_reason', nullable: true })
  deleteReason: string;

  @Column({ name: 'super_process_instance_id', nullable: true })
  superProcessInstanceId: string;

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @ManyToOne(() => ProcessDefinition, { nullable: true })
  @JoinColumn({ name: 'process_definition_id' })
  processDefinition: ProcessDefinition;

  @OneToMany(() => Execution, (execution) => execution.processInstance)
  executions: Execution[];

  @OneToMany(() => Variable, (variable) => variable.processInstance)
  variableList: Variable[];
}
