/**
 * 进度指标实体
 * 用于记录进度相关的指标数据，支持Prometheus采集
 */
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 指标类型枚举
 */
export enum MetricType {
  /** 计数器 */
  COUNTER = 'COUNTER',
  /** 仪表盘 */
  GAUGE = 'GAUGE',
  /** 直方图 */
  HISTOGRAM = 'HISTOGRAM',
  /** 摘要 */
  SUMMARY = 'SUMMARY',
}

/**
 * 指标分类枚举
 */
export enum MetricCategory {
  /** 流程指标 */
  PROCESS = 'PROCESS',
  /** 任务指标 */
  TASK = 'TASK',
  /** 性能指标 */
  PERFORMANCE = 'PERFORMANCE',
  /** 业务指标 */
  BUSINESS = 'BUSINESS',
  /** 系统指标 */
  SYSTEM = 'SYSTEM',
}

/**
 * 进度指标实体
 */
@Entity('fl_progress_metric')
export class ProgressMetric {
  /** 主键ID */
  @PrimaryColumn({ length: 64 })
  id_: string;

  /** 指标名称 */
  @Column({ length: 255 })
  @Index()
  name_: string;

  /** 指标描述 */
  @Column({ type: 'text', nullable: true })
  description_: string;

  /** 指标类型 */
  @Column({
    type: 'varchar',
    length: 50,
    default: MetricType.GAUGE,
  })
  type_: string;

  /** 指标分类 */
  @Column({
    type: 'varchar',
    length: 50,
    default: MetricCategory.PROCESS,
  })
  category_: string;

  /** 指标值 */
  @Column({ type: 'double' })
  value_: number;

  /** 指标单位 */
  @Column({ length: 50, nullable: true })
  unit_: string;

  /** 关联的流程实例ID */
  @Column({ length: 64, nullable: true })
  @Index()
  process_inst_id_: string;

  /** 关联的任务ID */
  @Column({ length: 64, nullable: true })
  @Index()
  task_id_: string;

  /** 关联的流程定义Key */
  @Column({ length: 255, nullable: true })
  @Index()
  process_def_key_: string;

  /** 关联的进度ID */
  @Column({ length: 64, nullable: true })
  @Index()
  progress_id_: string;

  /** 标签（JSON格式，用于Prometheus） */
  @Column({ type: 'json', nullable: true })
  labels_: Record<string, string>;

  /** 采集时间 */
  @Column({ type: 'datetime' })
  @Index()
  collect_time_: Date;

  /** 过期时间（用于数据清理） */
  @Column({ type: 'datetime', nullable: true })
  expire_time_: Date;

  /** 租户ID */
  @Column({ length: 64, nullable: true })
  tenant_id_: string;

  /** 创建时间 */
  @CreateDateColumn()
  create_time_: Date;
}
