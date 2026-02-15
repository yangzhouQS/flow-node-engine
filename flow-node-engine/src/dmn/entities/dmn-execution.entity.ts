import { ApiProperty, ApiHideProperty } from '@nestjs/swagger';
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { DmnDecisionEntity } from './dmn-decision.entity';

/**
 * 决策执行状态枚举
 */
export enum DmnExecutionStatus {
  /** 成功 */
  SUCCESS = 'success',
  /** 失败 */
  FAILED = 'failed',
  /** 无匹配规则 */
  NO_MATCH = 'no_match',
}

/**
 * DMN决策执行历史实体
 * 用于记录决策执行的结果
 */
@Entity('ACT_DMN_EXECUTION')
@Index('IDX_DMN_EXEC_DECISION_ID', ['decisionId'])
@Index('IDX_DMN_EXEC_PROCESS_INSTANCE', ['processInstanceId'])
@Index('IDX_DMN_EXEC_TIME', ['createTime'])
export class DmnExecutionEntity {
  @ApiProperty({ description: '执行ID' })
  @PrimaryColumn({ name: 'ID_', type: 'varchar', length: 64 })
  id: string;

  @ApiProperty({ description: '决策ID' })
  @Column({ name: 'DECISION_ID_', type: 'varchar', length: 64 })
  decisionId: string;

  @ApiProperty({ description: '决策Key' })
  @Column({ name: 'DECISION_KEY_', type: 'varchar', length: 255 })
  decisionKey: string;

  @ApiProperty({ description: '决策版本' })
  @Column({ name: 'DECISION_VERSION_', type: 'int' })
  decisionVersion: number;

  @ApiProperty({ description: '执行状态', enum: DmnExecutionStatus })
  @Column({ name: 'STATUS_', type: 'varchar', length: 20 })
  status: DmnExecutionStatus;

  @ApiProperty({ description: '输入数据' })
  @Column({ name: 'INPUT_DATA_', type: 'text' })
  inputData: string;

  @ApiProperty({ description: '输出结果', required: false })
  @Column({ name: 'OUTPUT_RESULT_', type: 'text', nullable: true })
  outputResult: string;

  @ApiProperty({ description: '匹配的规则ID列表', required: false })
  @Column({ name: 'MATCHED_RULES_', type: 'text', nullable: true })
  matchedRules: string;

  @ApiProperty({ description: '匹配的规则数量', example: 0 })
  @Column({ name: 'MATCHED_COUNT_', type: 'int', default: 0 })
  matchedCount: number;

  @ApiProperty({ description: '执行时间(毫秒)', required: false })
  @Column({ name: 'EXECUTION_TIME_MS_', type: 'int', nullable: true })
  executionTimeMs: number;

  @ApiProperty({ description: '流程实例ID', required: false })
  @Column({ name: 'PROCESS_INSTANCE_ID_', type: 'varchar', length: 64, nullable: true })
  processInstanceId: string;

  @ApiProperty({ description: '执行ID', required: false })
  @Column({ name: 'EXECUTION_ID_', type: 'varchar', length: 64, nullable: true })
  executionId: string;

  @ApiProperty({ description: '活动ID', required: false })
  @Column({ name: 'ACTIVITY_ID_', type: 'varchar', length: 255, nullable: true })
  activityId: string;

  @ApiProperty({ description: '任务ID', required: false })
  @Column({ name: 'TASK_ID_', type: 'varchar', length: 64, nullable: true })
  taskId: string;

  @ApiProperty({ description: '租户ID', required: false })
  @Column({ name: 'TENANT_ID_', type: 'varchar', length: 255, nullable: true })
  tenantId: string;

  @ApiProperty({ description: '执行者', required: false })
  @Column({ name: 'EXECUTOR_', type: 'varchar', length: 64, nullable: true })
  executor: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ name: 'CREATE_TIME_', type: 'datetime' })
  createTime: Date;

  @ApiProperty({ description: '错误信息', required: false })
  @Column({ name: 'ERROR_MSG_', type: 'text', nullable: true })
  errorMessage: string;

  @ApiProperty({ description: '错误详情', required: false })
  @Column({ name: 'ERROR_DETAILS_', type: 'text', nullable: true })
  errorDetails: string;

  @ApiProperty({ description: '扩展属性', required: false })
  @Column({ name: 'EXTRA_', type: 'text', nullable: true })
  extra: string;

  @ApiHideProperty()
  @ManyToOne(() => DmnDecisionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'DECISION_ID_' })
  decision: DmnDecisionEntity;
}
