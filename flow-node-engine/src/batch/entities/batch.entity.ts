import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 批处理状态枚举
 */
export enum BatchStatus {
  /** 待执行 */
  PENDING = 'pending',
  /** 执行中 */
  RUNNING = 'running',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 失败 */
  FAILED = 'failed',
  /** 已取消 */
  CANCELLED = 'cancelled',
}

/**
 * 批处理类型枚举
 */
export enum BatchType {
  /** 删除流程实例 */
  DELETE_PROCESS_INSTANCES = 'deleteProcessInstances',
  /** 删除历史流程实例 */
  DELETE_HISTORIC_PROCESS_INSTANCES = 'deleteHistoricProcessInstances',
  /** 删除任务 */
  DELETE_TASKS = 'deleteTasks',
  /** 删除历史任务 */
  DELETE_HISTORIC_TASKS = 'deleteHistoricTasks',
  /** 批量部署 */
  DEPLOY = 'deploy',
  /** 批量启动流程 */
  START_PROCESS_INSTANCES = 'startProcessInstances',
  /** 批量完成任务 */
  COMPLETE_TASKS = 'completeTasks',
  /** 自定义批处理 */
  CUSTOM = 'custom',
}

/**
 * 批处理实体
 * 用于管理批量操作的执行状态和进度
 */
@Entity('ACT_RU_BATCH')
@Index('IDX_BATCH_STATUS', ['status'])
@Index('IDX_BATCH_TYPE', ['type'])
@Index('IDX_BATCH_TENANT', ['tenantId'])
export class BatchEntity {
  /** 批处理ID */
  @PrimaryColumn({ name: 'ID_', type: 'varchar', length: 64 })
  id: string;

  /** 批处理类型 */
  @Column({ name: 'TYPE_', type: 'varchar', length: 64 })
  type: BatchType | string;

  /** 批处理总数量 */
  @Column({ name: 'TOTAL_', type: 'int', default: 0 })
  total: number;

  /** 已处理数量 */
  @Column({ name: 'BATCH_PROC_TOTAL_', type: 'int', default: 0 })
  processedTotal: number;

  /** 成功数量 */
  @Column({ name: 'SUCCESS_TOTAL_', type: 'int', default: 0 })
  successTotal: number;

  /** 失败数量 */
  @Column({ name: 'FAIL_TOTAL_', type: 'int', default: 0 })
  failTotal: number;

  /** 批处理状态 */
  @Column({ name: 'STATUS_', type: 'varchar', length: 20, default: BatchStatus.PENDING })
  status: BatchStatus;

  /** 批处理配置（JSON格式） */
  @Column({ name: 'CONFIG_', type: 'text', nullable: true })
  config: string;

  /** 搜索键（用于查询） */
  @Column({ name: 'SEARCH_KEY_', type: 'varchar', length: 255, nullable: true })
  searchKey: string;

  /** 搜索键2（用于查询） */
  @Column({ name: 'SEARCH_KEY2_', type: 'varchar', length: 255, nullable: true })
  searchKey2: string;

  /** 租户ID */
  @Column({ name: 'TENANT_ID_', type: 'varchar', length: 255, nullable: true })
  tenantId: string;

  /** 创建者 */
  @Column({ name: 'CREATE_USER_', type: 'varchar', length: 64, nullable: true })
  createUser: string;

  /** 创建时间 */
  @CreateDateColumn({ name: 'CREATE_TIME_', type: 'datetime' })
  createTime: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: 'UPDATE_TIME_', type: 'datetime', nullable: true })
  updateTime: Date;

  /** 完成时间 */
  @Column({ name: 'COMPLETE_TIME_', type: 'datetime', nullable: true })
  completeTime: Date;

  /** 批处理描述 */
  @Column({ name: 'DESCRIPTION_', type: 'varchar', length: 500, nullable: true })
  description: string;

  /** 是否异步执行 */
  @Column({ name: 'ASYNC_', type: 'boolean', default: true })
  async: boolean;

  /** 批处理优先级 */
  @Column({ name: 'PRIORITY_', type: 'int', default: 0 })
  priority: number;

  /** 重试次数 */
  @Column({ name: 'RETRY_COUNT_', type: 'int', default: 0 })
  retryCount: number;

  /** 最大重试次数 */
  @Column({ name: 'MAX_RETRIES_', type: 'int', default: 3 })
  maxRetries: number;

  /** 错误信息 */
  @Column({ name: 'ERROR_MSG_', type: 'text', nullable: true })
  errorMessage: string;

  /** 扩展属性（JSON格式） */
  @Column({ name: 'EXTRA_', type: 'text', nullable: true })
  extra: string;
}
