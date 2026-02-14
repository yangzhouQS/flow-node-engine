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
  /** 执行ID */
  @PrimaryColumn({ name: 'ID_', type: 'varchar', length: 64 })
  id: string;

  /** 决策ID */
  @Column({ name: 'DECISION_ID_', type: 'varchar', length: 64 })
  decisionId: string;

  /** 决策Key */
  @Column({ name: 'DECISION_KEY_', type: 'varchar', length: 255 })
  decisionKey: string;

  /** 决策版本 */
  @Column({ name: 'DECISION_VERSION_', type: 'int' })
  decisionVersion: number;

  /** 执行状态 */
  @Column({ name: 'STATUS_', type: 'varchar', length: 20 })
  status: DmnExecutionStatus;

  /** 输入数据（JSON格式） */
  @Column({ name: 'INPUT_DATA_', type: 'text' })
  inputData: string;

  /** 输出结果（JSON格式） */
  @Column({ name: 'OUTPUT_RESULT_', type: 'text', nullable: true })
  outputResult: string;

  /** 匹配的规则ID列表（JSON格式） */
  @Column({ name: 'MATCHED_RULES_', type: 'text', nullable: true })
  matchedRules: string;

  /** 匹配的规则数量 */
  @Column({ name: 'MATCHED_COUNT_', type: 'int', default: 0 })
  matchedCount: number;

  /** 执行时间（毫秒） */
  @Column({ name: 'EXECUTION_TIME_MS_', type: 'int', nullable: true })
  executionTimeMs: number;

  /** 流程实例ID */
  @Column({ name: 'PROCESS_INSTANCE_ID_', type: 'varchar', length: 64, nullable: true })
  processInstanceId: string;

  /** 执行ID */
  @Column({ name: 'EXECUTION_ID_', type: 'varchar', length: 64, nullable: true })
  executionId: string;

  /** 活动ID */
  @Column({ name: 'ACTIVITY_ID_', type: 'varchar', length: 255, nullable: true })
  activityId: string;

  /** 任务ID */
  @Column({ name: 'TASK_ID_', type: 'varchar', length: 64, nullable: true })
  taskId: string;

  /** 租户ID */
  @Column({ name: 'TENANT_ID_', type: 'varchar', length: 255, nullable: true })
  tenantId: string;

  /** 执行者 */
  @Column({ name: 'EXECUTOR_', type: 'varchar', length: 64, nullable: true })
  executor: string;

  /** 创建时间 */
  @CreateDateColumn({ name: 'CREATE_TIME_', type: 'datetime' })
  createTime: Date;

  /** 错误信息 */
  @Column({ name: 'ERROR_MSG_', type: 'text', nullable: true })
  errorMessage: string;

  /** 错误详情 */
  @Column({ name: 'ERROR_DETAILS_', type: 'text', nullable: true })
  errorDetails: string;

  /** 扩展属性（JSON格式） */
  @Column({ name: 'EXTRA_', type: 'text', nullable: true })
  extra: string;

  /** 关联的决策 */
  @ManyToOne(() => DmnDecisionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'DECISION_ID_' })
  decision: DmnDecisionEntity;
}
