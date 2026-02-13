/**
 * 定时器作业实体
 * 存储定时触发的作业，如定时边界事件、定时启动事件等
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 定时器类型枚举
 */
export enum TimerType {
  /** 日期时间触发 */
  DATE = 'DATE',
  /** 周期触发 */
  DURATION = 'DURATION',
  /** 循环触发 */
  CYCLE = 'CYCLE',
}

/**
 * 定时器作业状态枚举
 */
export enum TimerJobStatus {
  /** 待执行 */
  PENDING = 'PENDING',
  /** 已执行 */
  EXECUTED = 'EXECUTED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
  /** 执行失败 */
  FAILED = 'FAILED',
}

/**
 * 定时器作业实体
 */
@Entity('fl_timer_job')
export class TimerJob {
  /** 主键ID */
  @PrimaryColumn({ length: 64 })
  id_: string;

  /** 定时器类型 */
  @Column({
    type: 'varchar',
    length: 50,
  })
  @Index()
  timer_type_: string;

  /** 定时器表达式（ISO 8601日期时间或CRON表达式） */
  @Column({ type: 'text' })
  timer_expression_: string;

  /** 计划执行时间 */
  @Column({ type: 'datetime' })
  @Index()
  due_date_: Date;

  /** 实际执行时间 */
  @Column({ type: 'datetime', nullable: true })
  executed_time_: Date;

  /** 作业状态 */
  @Column({
    type: 'varchar',
    length: 50,
    default: TimerJobStatus.PENDING,
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

  /** 元素类型（边界事件、启动事件等） */
  @Column({ length: 100, nullable: true })
  element_type_: string;

  /** 最大执行次数（用于循环定时器） */
  @Column({ type: 'int', nullable: true })
  max_executions_: number;

  /** 已执行次数 */
  @Column({ type: 'int', default: 0 })
  execution_count_: number;

  /** 下次执行时间（用于循环定时器） */
  @Column({ type: 'datetime', nullable: true })
  next_execution_time_: Date;

  /** 是否重复执行 */
  @Column({ type: 'boolean', default: false })
  repeat_: boolean;

  /** 重复间隔（毫秒） */
  @Column({ type: 'int', nullable: true })
  repeat_interval_: number;

  /** 结束时间 */
  @Column({ type: 'datetime', nullable: true })
  end_time_: Date;

  /** 回调配置（JSON格式） */
  @Column({ type: 'text', nullable: true })
  callback_config_: string;

  /** 作业载荷（JSON格式） */
  @Column({ type: 'text', nullable: true })
  payload_: string;

  /** 异常消息 */
  @Column({ type: 'text', nullable: true })
  exception_message_: string;

  /** 重试次数 */
  @Column({ type: 'int', default: 0 })
  retry_count_: number;

  /** 最大重试次数 */
  @Column({ type: 'int', default: 3 })
  max_retries_: number;

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

  /** 扩展数据（JSON格式） */
  @Column({ type: 'json', nullable: true })
  extra_data_: Record<string, any>;
}
