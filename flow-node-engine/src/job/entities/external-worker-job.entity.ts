/**
 * 外部工作者作业实体
 * 存储由外部工作者处理的作业
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 外部工作者作业状态枚举
 */
export enum ExternalWorkerJobStatus {
  /** 待领取 */
  PENDING = 'PENDING',
  /** 已领取 */
  CLAIMED = 'CLAIMED',
  /** 执行中 */
  RUNNING = 'RUNNING',
  /** 已完成 */
  COMPLETED = 'COMPLETED',
  /** 失败 */
  FAILED = 'FAILED',
  /** 已超时 */
  TIMEOUT = 'TIMEOUT',
}

/**
 * 外部工作者作业实体
 */
@Entity('fl_external_worker_job')
export class ExternalWorkerJob {
  /** 主键ID */
  @PrimaryColumn({ length: 64 })
  id_: string;

  /** 作业主题（用于分类和筛选） */
  @Column({ length: 255 })
  @Index()
  topic_: string;

  /** 作业状态 */
  @Column({
    type: 'varchar',
    length: 50,
    default: ExternalWorkerJobStatus.PENDING,
  })
  @Index()
  status_: string;

  /** 关联的流程实例ID */
  @Column({ length: 64, nullable: true })
  @Index()
  process_inst_id_: string;

  /** 关联的执行ID */
  @Column({ length: 64, nullable: true })
  @Index()
  execution_id_: string;

  /** 关联的流程定义ID */
  @Column({ length: 64, nullable: true })
  process_def_id_: string;

  /** 关联的流程定义Key */
  @Column({ length: 255, nullable: true })
  @Index()
  process_def_key_: string;

  /** 关联的活动ID */
  @Column({ length: 255, nullable: true })
  activity_id_: string;

  /** 关联的活动名称 */
  @Column({ length: 255, nullable: true })
  activity_name_: string;

  /** 领取的工作者ID */
  @Column({ length: 255, nullable: true })
  @Index()
  worker_id_: string;

  /** 领取时间 */
  @Column({ type: 'datetime', nullable: true })
  claimed_time_: Date;

  /** 锁定超时时间 */
  @Column({ type: 'datetime', nullable: true })
  lock_expiry_time_: Date;

  /** 锁定持续时间（毫秒） */
  @Column({ type: 'int', default: 300000 }) // 默认5分钟
  lock_duration_: number;

  /** 重试次数 */
  @Column({ type: 'int', default: 0 })
  retry_count_: number;

  /** 最大重试次数 */
  @Column({ type: 'int', default: 3 })
  max_retries_: number;

  /** 优先级（数值越大优先级越高） */
  @Column({ type: 'int', default: 50 })
  @Index()
  priority_: number;

  /** 作业载荷（JSON格式） */
  @Column({ type: 'text', nullable: true })
  payload_: string;

  /** 变量（JSON格式） */
  @Column({ type: 'text', nullable: true })
  variables_: string;

  /** 完成时的输出变量（JSON格式） */
  @Column({ type: 'text', nullable: true })
  output_variables_: string;

  /** 异常消息 */
  @Column({ type: 'text', nullable: true })
  exception_message_: string;

  /** 异常堆栈 */
  @Column({ type: 'text', nullable: true })
  exception_stack_trace_: string;

  /** 错误代码 */
  @Column({ length: 255, nullable: true })
  error_code_: string;

  /** 错误详情（JSON格式） */
  @Column({ type: 'text', nullable: true })
  error_details_: string;

  /** 重试等待时间（毫秒） */
  @Column({ type: 'int', default: 5000 })
  retry_wait_time_: number;

  /** 下次重试时间 */
  @Column({ type: 'datetime', nullable: true })
  @Index()
  next_retry_time_: Date;

  /** 开始执行时间 */
  @Column({ type: 'datetime', nullable: true })
  start_time_: Date;

  /** 完成时间 */
  @Column({ type: 'datetime', nullable: true })
  end_time_: Date;

  /** 作业超时时间（毫秒） */
  @Column({ type: 'int', default: 600000 }) // 默认10分钟
  timeout_: number;

  /** 回调URL */
  @Column({ length: 512, nullable: true })
  callback_url_: string;

  /** 租户ID */
  @Column({ length: 64, nullable: true })
  @Index()
  tenant_id_: string;

  /** 创建时间 */
  @CreateDateColumn()
  @Index()
  create_time_: Date;

  /** 扩展数据（JSON格式） */
  @Column({ type: 'json', nullable: true })
  extra_data_: Record<string, any>;
}
