import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { ProcessInstance } from './process-instance.entity';
import { Variable } from './variable.entity';

/**
 * 执行实体
 * 
 * 索引策略：
 * - idx_execution_process_instance: 按流程实例查询执行
 * - idx_execution_activity: 按活动ID查询执行
 * - idx_execution_state: 按状态查询执行
 * - idx_execution_tenant: 多租户查询
 * - idx_execution_process_activity: 复合索引，流程实例+活动ID查询
 */
@Entity('executions')
@Index('idx_execution_process_instance', ['processInstanceId'])
@Index('idx_execution_activity', ['activityId'])
@Index('idx_execution_state', ['state'])
@Index('idx_execution_tenant', ['tenantId'])
@Index('idx_execution_process_activity', ['processInstanceId', 'activityId'])
@Index('idx_execution_process_state', ['processInstanceId', 'state'])
export class Execution {
  @ApiProperty({ description: '执行ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '流程实例ID' })
  @Column({ name: 'process_instance_id' })
  processInstanceId: string;

  @ApiProperty({ description: '活动ID', example: 'userTask1' })
  @Column({ name: 'activity_id' })
  activityId: string;

  @ApiProperty({ description: '活动名称', example: '审批任务' })
  @Column({ name: 'activity_name' })
  activityName: string;

  @ApiProperty({ description: '活动类型', example: 'userTask' })
  @Column({ name: 'activity_type' })
  activityType: string;

  @ApiProperty({ description: '父活动ID', required: false })
  @Column({ name: 'parent_activity_id', nullable: true })
  parentActivityId: string;

  @ApiProperty({ description: '状态', example: 'active' })
  @Column({ name: 'state', default: 'active' })
  state: string;

  @ApiProperty({ description: '业务键', required: false })
  @Column({ name: 'business_key', nullable: true })
  businessKey: string;

  @ApiProperty({ description: '租户ID', required: false })
  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @ApiProperty({ description: '变量', required: false })
  @Column({ name: 'variables', type: 'json', nullable: true })
  variables: Record<string, any>;

  @ApiProperty({ description: '删除原因', required: false })
  @Column({ name: 'delete_reason', nullable: true })
  deleteReason: string;

  @ApiProperty({ description: '开始时间' })
  @Column({ name: 'start_time', type: 'timestamp' })
  startTime: Date;

  @ApiProperty({ description: '结束时间', required: false })
  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @ApiProperty({ description: '创建时间' })
  @Column({ name: 'create_time', type: 'timestamp' })
  createTime: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @ApiHideProperty()
  @ManyToOne(() => ProcessInstance)
  @JoinColumn({ name: 'process_instance_id' })
  processInstance: ProcessInstance;

  @ApiHideProperty()
  @OneToMany(() => Variable, (variable) => variable.execution)
  variableList: Variable[];
}
