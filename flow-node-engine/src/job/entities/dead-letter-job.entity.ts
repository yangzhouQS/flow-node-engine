/**
 * 死信作业实体
 * 存储执行失败且超过最大重试次数的作业
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 死信作业实体
 */
@Entity('fl_dead_letter_job')
export class DeadLetterJob {
  /** 主键ID */
  @PrimaryColumn({ length: 64 })
  id_: string;

  /** 原作业ID */
  @Column({ length: 64 })
  @Index()
  original_job_id_: string;

  /** 作业类型 */
  @Column({
    type: 'varchar',
    length: 50,
  })
  @Index()
  type_: string;

  /** 关联的流程实例ID */
  @Column({ length: 64, nullable: true })
  @Index()
  process_inst_id_: string;

  /** 关联的执行ID */
  @Column({ length: 64, nullable: true })
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

  /** 作业处理器的Bean名称 */
  @Column({ length: 255, nullable: true })
  handler_type_: string;

  /** 作业处理器配置（JSON格式） */
  @Column({ type: 'text', nullable: true })
  handler_config_: string;

  /** 作业载荷（JSON格式） */
  @Column({ type: 'text', nullable: true })
  payload_: string;

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

  /** 重试次数 */
  @Column({ type: 'int', default: 0 })
  retry_count_: number;

  /** 最大重试次数 */
  @Column({ type: 'int', default: 3 })
  max_retries_: number;

  /** 异常消息 */
  @Column({ type: 'text', nullable: true })
  exception_message_: string;

  /** 异常堆栈 */
  @Column({ type: 'text', nullable: true })
  exception_stack_trace_: string;

  /** 最终失败时间 */
  @Column({ type: 'datetime' })
  failed_time_: Date;

  /** 累计重试次数 */
  @Column({ type: 'int', default: 0 })
  total_retries_: number;

  /** 是否已处理 */
  @Column({ type: 'boolean', default: false })
  @Index()
  processed_: boolean;

  /** 处理时间 */
  @Column({ type: 'datetime', nullable: true })
  processed_time_: Date;

  /** 处理方式（MANUAL/AUTO_RETRY/IGNORE） */
  @Column({ length: 50, nullable: true })
  processed_action_: string;

  /** 处理备注 */
  @Column({ type: 'text', nullable: true })
  processed_note_: string;

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
