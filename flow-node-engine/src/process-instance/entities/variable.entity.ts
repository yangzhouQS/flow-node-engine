import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Execution } from './execution.entity';
import { ProcessInstance } from './process-instance.entity';

/**
 * 变量实体
 * 
 * 索引策略：
 * - idx_variable_process_instance: 按流程实例查询变量
 * - idx_variable_execution: 按执行ID查询变量
 * - idx_variable_name: 按变量名查询
 * - idx_variable_process_name: 复合索引，流程实例+变量名查询（常用）
 */
@Entity('variables')
@Index('idx_variable_process_instance', ['processInstanceId'])
@Index('idx_variable_execution', ['executionId'])
@Index('idx_variable_name', ['name'])
@Index('idx_variable_process_name', ['processInstanceId', 'name'])
@Index('idx_variable_scope', ['scope'])
export class Variable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'process_instance_id' })
  processInstanceId: string;

  @Column({ name: 'execution_id', nullable: true })
  executionId: string;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'type' })
  type: string;

  @Column({ name: 'value', type: 'text' })
  value: string;

  @Column({ name: 'is_local', default: true })
  isLocal: boolean;

  @Column({ name: 'scope' })
  scope: string;

  @Column({ name: 'delete_reason', nullable: true })
  deleteReason: string;

  @Column({ name: 'create_time', type: 'timestamp' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @ManyToOne(() => ProcessInstance, (variable) => variable.variableList)
  @JoinColumn({ name: 'process_instance_id' })
  processInstance: ProcessInstance;

  @ManyToOne(() => Execution, (variable) => variable.variableList)
  @JoinColumn({ name: 'execution_id' })
  execution: Execution;
}
