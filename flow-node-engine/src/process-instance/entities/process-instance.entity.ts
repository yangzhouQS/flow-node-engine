import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
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

@Entity('process_instances')
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
