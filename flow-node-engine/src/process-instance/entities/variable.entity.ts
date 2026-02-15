import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
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
  @ApiProperty({ description: '变量ID', example: 'uuid-xxx-xxx' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '流程实例ID' })
  @Column({ name: 'process_instance_id' })
  processInstanceId: string;

  @ApiProperty({ description: '执行ID', required: false })
  @Column({ name: 'execution_id', nullable: true })
  executionId: string;

  @ApiProperty({ description: '变量名', example: 'approveResult' })
  @Column({ name: 'name' })
  name: string;

  @ApiProperty({ description: '变量类型', example: 'string' })
  @Column({ name: 'type' })
  type: string;

  @ApiProperty({ description: '变量值' })
  @Column({ name: 'value', type: 'text' })
  value: string;

  @ApiProperty({ description: '是否本地变量', example: true })
  @Column({ name: 'is_local', default: true })
  isLocal: boolean;

  @ApiProperty({ description: '作用域', example: 'global' })
  @Column({ name: 'scope' })
  scope: string;

  @ApiProperty({ description: '删除原因', required: false })
  @Column({ name: 'delete_reason', nullable: true })
  deleteReason: string;

  @ApiProperty({ description: '创建时间' })
  @Column({ name: 'create_time', type: 'timestamp' })
  createTime: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date;

  @ApiHideProperty()
  @ManyToOne(() => ProcessInstance, (variable) => variable.variableList)
  @JoinColumn({ name: 'process_instance_id' })
  processInstance: ProcessInstance;

  @ApiHideProperty()
  @ManyToOne(() => Execution, (variable) => variable.variableList)
  @JoinColumn({ name: 'execution_id' })
  execution: Execution;
}
