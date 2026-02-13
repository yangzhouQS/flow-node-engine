import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { BatchEntity } from './batch.entity';

/**
 * 批处理部分状态枚举
 */
export enum BatchPartStatus {
  /** 待执行 */
  PENDING = 'pending',
  /** 执行中 */
  RUNNING = 'running',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 失败 */
  FAILED = 'failed',
  /** 已跳过 */
  SKIPPED = 'skipped',
}

/**
 * 批处理部分实体
 * 用于存储批处理中的每个独立操作项
 */
@Entity('ACT_RU_BATCH_PART')
@Index('IDX_BATCH_PART_BATCH_ID', ['batchId'])
@Index('IDX_BATCH_PART_STATUS', ['status'])
@Index('IDX_BATCH_PART_BATCH_STATUS', ['batchId', 'status'])
export class BatchPartEntity {
  /** 批处理部分ID */
  @PrimaryColumn({ name: 'ID_', type: 'varchar', length: 64 })
  id: string;

  /** 所属批处理ID */
  @Column({ name: 'BATCH_ID_', type: 'varchar', length: 64 })
  batchId: string;

  /** 批处理部分类型 */
  @Column({ name: 'TYPE_', type: 'varchar', length: 64, nullable: true })
  type: string;

  /** 批处理部分状态 */
  @Column({ name: 'STATUS_', type: 'varchar', length: 20, default: BatchPartStatus.PENDING })
  status: BatchPartStatus;

  /** 处理数据（JSON格式） */
  @Column({ name: 'DATA_', type: 'text', nullable: true })
  data: string;

  /** 处理结果（JSON格式） */
  @Column({ name: 'RESULT_', type: 'text', nullable: true })
  result: string;

  /** 错误信息 */
  @Column({ name: 'ERROR_MSG_', type: 'text', nullable: true })
  errorMessage: string;

  /** 错误详情 */
  @Column({ name: 'ERROR_DETAILS_', type: 'text', nullable: true })
  errorDetails: string;

  /** 重试次数 */
  @Column({ name: 'RETRY_COUNT_', type: 'int', default: 0 })
  retryCount: number;

  /** 创建时间 */
  @CreateDateColumn({ name: 'CREATE_TIME_', type: 'datetime' })
  createTime: Date;

  /** 开始处理时间 */
  @Column({ name: 'START_TIME_', type: 'datetime', nullable: true })
  startTime: Date;

  /** 完成时间 */
  @Column({ name: 'COMPLETE_TIME_', type: 'datetime', nullable: true })
  completeTime: Date;

  /** 租户ID */
  @Column({ name: 'TENANT_ID_', type: 'varchar', length: 255, nullable: true })
  tenantId: string;

  /** 扩展属性（JSON格式） */
  @Column({ name: 'EXTRA_', type: 'text', nullable: true })
  extra: string;

  /** 关联的批处理 */
  @ManyToOne(() => BatchEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'BATCH_ID_' })
  batch: BatchEntity;
}
