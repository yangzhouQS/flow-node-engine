/**
 * 作业实体
 * 表示流程引擎中的异步作业
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 作业类型枚举
 */
export enum JobType {
  /** 定时器作业 */
  TIMER = 'TIMER',
  /** 消息作业 */
  MESSAGE = 'MESSAGE',
  /** 信号作业 */
  SIGNAL = 'SIGNAL',
  /** 外部工作者作业 */
  EXTERNAL_WORKER = 'EXTERNAL_WORKER',
  /** 异步服务任务作业 */
  ASYNC_SERVICE = 'ASYNC_SERVICE',
  /** 流程实例迁移作业 */
  PROCESS_MIGRATION = 'PROCESS_MIGRATION',
}

/**
 * 作业状态枚举
 */
export enum JobStatus {
  /** 待执行 */
  PENDING = 'PENDING',
  /** 执行中 */
  RUNNING = 'RUNNING',
  /** 已完成 */
  COMPLETED = 'COMPLETED',
  /** 失败 */
  FAILED = 'FAILED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
  /** 已暂停 */
  SUSPENDED = 'SUSPENDED',
}

/**
 * 作业实体
 */
@Entity('fl_job')
export class Job {
  /** 主键ID */
  @PrimaryColumn({ length: 64 })
  id_: string;

  /** 作业类型 */
  @Column({
    type: 'varchar',
    length: 50,
  })
  @Index()
  type_: string;

  /** 作业状态 */
  @Column({
    type: 'varchar',
    length: 50,
    default: JobStatus.PENDING,
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

  /** 关联的任务ID */
  @Column({ length: 64, nullable: true })
  task_id_: string;

  /** 关联的活动ID */
  @Column({ length: 64, nullable: true })
  activity_id_: string;

  /** 关联的活动名称 */
  @Column({ length: 255, nullable: true })
  activity_name_: string;

  /** 元素类型 */
  @Column({ length: 100, nullable: true })
  element_type_: string;

  /** 回调配置（JSON格式） */
  @Column({ type: 'text', nullable: true })
  callback_config_: string;

  /** 到期时间 */
  @Column({ type: 'datetime', nullable: true })
  @Index()
  due_date_: Date;

  /** 执行耗时（毫秒） */
  @Column({ type: 'int', nullable: true })
  duration_: number;

  /** 作业处理器的Bean名称 */
  @Column({ length: 255, nullable: true })
  handler_type_: string;

  /** 作业处理器配置（JSON格式） */
  @Column({ type: 'text', nullable: true })
  handler_config_: string;

  /** 作业载荷（JSON格式） */
  @Column({ type: 'text', nullable: true })
  payload_: string;

  /** 异常消息（失败时记录） */
  @Column({ type: 'text', nullable: true })
  exception_message_: string;

  /** 异常堆栈（失败时记录） */
  @Column({ type: 'text', nullable: true })
  exception_stack_trace_: string;

  /** 重试次数 */
  @Column({ type: 'int', default: 0 })
  retry_count_: number;

  /** 最大重试次数 */
  @Column({ type: 'int', default: 3 })
  max_retries_: number;

  /** 重试等待时间（毫秒） */
  @Column({ type: 'int', default: 5000 })
  retry_wait_time_: number;

  /** 下次重试时间 */
  @Column({ type: 'datetime', nullable: true })
  @Index()
  next_retry_time_: Date;

  /** 优先级（数值越大优先级越高） */
  @Column({ type: 'int', default: 50 })
  @Index()
  priority_: number;

  /** 是否独占（独占作业需要获取锁才能执行） */
  @Column({ type: 'boolean', default: false })
  exclusive_: boolean;

  /** 锁定者（执行器ID） */
  @Column({ length: 255, nullable: true })
  locked_by_: string;

  /** 锁定时间 */
  @Column({ type: 'datetime', nullable: true })
  locked_until_: Date;

  /** 租户ID */
  @Column({ length: 64, nullable: true })
  @Index()
  tenant_id_: string;

  /** 创建时间 */
  @CreateDateColumn()
  @Index()
  create_time_: Date;

  /** 开始执行时间 */
  @Column({ type: 'datetime', nullable: true })
  start_time_: Date;

  /** 完成时间 */
  @Column({ type: 'datetime', nullable: true })
  end_time_: Date;

  /** 作业超时时间（毫秒） */
  @Column({ type: 'int', default: 300000 }) // 默认5分钟
  timeout_: number;

  /** 回调URL（作业完成后回调） */
  @Column({ length: 512, nullable: true })
  callback_url_: string;

  /** 扩展数据（JSON格式） */
  @Column({ type: 'json', nullable: true })
  extra_data_: Record<string, any>;
}
