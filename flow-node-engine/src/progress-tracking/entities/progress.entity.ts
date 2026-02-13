/**
 * 进度追踪实体
 * 用于记录流程实例和任务的进度信息
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 进度状态枚举
 */
export enum ProgressStatus {
  /** 未开始 */
  NOT_STARTED = 'NOT_STARTED',
  /** 进行中 */
  IN_PROGRESS = 'IN_PROGRESS',
  /** 已完成 */
  COMPLETED = 'COMPLETED',
  /** 已暂停 */
  SUSPENDED = 'SUSPENDED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
}

/**
 * 进度类型枚举
 */
export enum ProgressType {
  /** 流程实例进度 */
  PROCESS_INSTANCE = 'PROCESS_INSTANCE',
  /** 任务进度 */
  TASK = 'TASK',
  /** 阶段进度 */
  STAGE = 'STAGE',
}

/**
 * 进度追踪实体
 */
@Entity('fl_progress')
export class Progress {
  /** 主键ID */
  @PrimaryColumn({ length: 64 })
  id_: string;

  /** 进度类型 */
  @Column({
    type: 'varchar',
    length: 50,
    default: ProgressType.PROCESS_INSTANCE,
  })
  type_: string;

  /** 关联的流程实例ID */
  @Column({ length: 64, nullable: true })
  @Index()
  process_inst_id_: string;

  /** 关联的任务ID */
  @Column({ length: 64, nullable: true })
  @Index()
  task_id_: string;

  /** 关联的流程定义ID */
  @Column({ length: 64, nullable: true })
  process_def_id_: string;

  /** 关联的任务定义Key */
  @Column({ length: 255, nullable: true })
  task_def_key_: string;

  /** 进度名称 */
  @Column({ length: 255, nullable: true })
  name_: string;

  /** 进度描述 */
  @Column({ type: 'text', nullable: true })
  description_: string;

  /** 进度状态 */
  @Column({
    type: 'varchar',
    length: 50,
    default: ProgressStatus.NOT_STARTED,
  })
  status_: string;

  /** 进度百分比 (0-100) */
  @Column({ type: 'int', default: 0 })
  percentage_: number;

  /** 总步骤数 */
  @Column({ type: 'int', default: 0 })
  total_steps_: number;

  /** 已完成步骤数 */
  @Column({ type: 'int', default: 0 })
  completed_steps_: number;

  /** 当前步骤名称 */
  @Column({ length: 255, nullable: true })
  current_step_name_: string;

  /** 当前步骤描述 */
  @Column({ type: 'text', nullable: true })
  current_step_description_: string;

  /** 开始时间 */
  @Column({ type: 'datetime', nullable: true })
  start_time_: Date;

  /** 结束时间 */
  @Column({ type: 'datetime', nullable: true })
  end_time_: Date;

  /** 预计完成时间 */
  @Column({ type: 'datetime', nullable: true })
  estimated_end_time_: Date;

  /** 持续时间（毫秒） */
  @Column({ type: 'bigint', nullable: true })
  duration_: number;

  /** 实际持续时间（毫秒） */
  @Column({ type: 'bigint', nullable: true })
  actual_duration_: number;

  /** 预计持续时间（毫秒） */
  @Column({ type: 'bigint', nullable: true })
  estimated_duration_: number;

  /** 预警标志 */
  @Column({ type: 'boolean', default: false })
  is_warning_: boolean;

  /** 预警消息 */
  @Column({ type: 'text', nullable: true })
  warning_message_: string;

  /** 预警时间 */
  @Column({ type: 'datetime', nullable: true })
  warning_time_: Date;

  /** 超时标志 */
  @Column({ type: 'boolean', default: false })
  is_timeout_: boolean;

  /** 超时时间 */
  @Column({ type: 'datetime', nullable: true })
  timeout_time_: Date;

  /** 扩展数据（JSON格式） */
  @Column({ type: 'json', nullable: true })
  extra_data_: Record<string, any>;

  /** 租户ID */
  @Column({ length: 64, nullable: true })
  tenant_id_: string;

  /** 创建时间 */
  @CreateDateColumn()
  create_time_: Date;

  /** 更新时间 */
  @UpdateDateColumn()
  update_time_: Date;
}
