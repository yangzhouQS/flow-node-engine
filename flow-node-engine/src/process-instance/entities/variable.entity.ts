import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { Execution } from './execution.entity';
import { ProcessInstance } from './process-instance.entity';

@Entity('variables')
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
