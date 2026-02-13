import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  UpdateDateColumn,
} from 'typeorm';

import { ProcessInstance } from './process-instance.entity';
import { Variable } from './variable.entity';

@Entity('executions')
export class Execution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'process_instance_id' })
  processInstanceId: string;

  @Column({ name: 'activity_id' })
  activityId: string;

  @Column({ name: 'activity_name' })
  activityName: string;

  @Column({ name: 'activity_type' })
  activityType: string;

  @Column({ name: 'parent_activity_id', nullable: true })
  parentActivityId: string;

  @Column({ name: 'state', default: 'active' })
  state: string;

  @Column({ name: 'business_key', nullable: true })
  businessKey: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ name: 'variables', type: 'json', nullable: true })
  variables: Record<string, any>;

  @Column({ name: 'delete_reason', nullable: true })
  deleteReason: string;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ name: 'create_time', type: 'timestamp' })
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @ManyToOne(() => ProcessInstance)
  @JoinColumn({ name: 'process_instance_id' })
  processInstance: ProcessInstance;

  @OneToMany(() => Variable, (variable) => variable.execution)
  variableList: Variable[];
}
