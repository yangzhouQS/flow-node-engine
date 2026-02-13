import { Entity, Column, PrimaryColumn, Index, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * 驳回类型枚举
 */
export enum RejectType {
  /** 退回到上一节点 */
  TO_PREVIOUS = 'TO_PREVIOUS',
  /** 退回到发起人 */
  TO_STARTER = 'TO_STARTER',
  /** 退回到指定节点 */
  TO_SPECIFIC = 'TO_SPECIFIC',
  /** 退回到任意历史节点 */
  TO_ANY_HISTORY = 'TO_ANY_HISTORY',
  /** 不允许驳回 */
  NOT_ALLOWED = 'NOT_ALLOWED',
}

/**
 * 驳回状态枚举
 */
export enum RejectStatus {
  /** 待处理 */
  PENDING = 'PENDING',
  /** 已执行 */
  EXECUTED = 'EXECUTED',
  /** 已取消 */
  CANCELLED = 'CANCELLED',
  /** 执行失败 */
  FAILED = 'FAILED',
}

/**
 * 任务驳回记录实体
 * 用于记录任务的驳回操作历史
 */
@Entity('act_ru_task_reject')
export class TaskRejectEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

  /**
   * 任务ID
   */
  @Column({ length: 64 })
  @Index()
  task_id_: string;

  /**
   * 任务定义Key
   */
  @Column({ length: 255, nullable: true })
  @Index()
  task_def_key_: string;

  /**
   * 流程实例ID
   */
  @Column({ length: 64 })
  @Index()
  proc_inst_id_: string;

  /**
   * 流程定义ID
   */
  @Column({ length: 64, nullable: true })
  proc_def_id_: string;

  /**
   * 执行ID
   */
  @Column({ length: 64, nullable: true })
  execution_id_: string;

  /**
   * 驳回类型
   */
  @Column({ length: 30 })
  reject_type_: string;

  /**
   * 驳回原因
   */
  @Column({ type: 'text', nullable: true })
  reject_reason_: string;

  /**
   * 驳回操作人
   */
  @Column({ length: 64, nullable: true })
  @Index()
  reject_user_id_: string;

  /**
   * 目标节点Key（退回到指定节点时使用）
   */
  @Column({ length: 255, nullable: true })
  target_task_def_key_: string;

  /**
   * 目标节点名称
   */
  @Column({ length: 255, nullable: true })
  target_task_name_: string;

  /**
   * 驳回状态
   */
  @Column({ length: 30, default: RejectStatus.PENDING })
  status_: string;

  /**
   * 是否为多实例驳回
   */
  @Column({ default: false })
  is_multi_instance_: boolean;

  /**
   * 多实例驳回策略
   */
  @Column({ length: 30, nullable: true })
  multi_instance_strategy_: string;

  /**
   * 扩展数据（JSON格式）
   */
  @Column({ type: 'text', nullable: true })
  extra_data_: string;

  /**
   * 租户ID
   */
  @Column({ length: 64, nullable: true })
  tenant_id_: string;

  /**
   * 创建时间
   */
  @CreateDateColumn()
  create_time_: Date;

  /**
   * 处理时间
   */
  @Column({ type: 'datetime', nullable: true })
  process_time_: Date;
}

/**
 * 创建任务驳回记录参数
 */
export interface CreateTaskRejectParams {
  taskId: string;
  taskDefKey?: string;
  processInstanceId: string;
  processDefinitionId?: string;
  executionId?: string;
  rejectType: RejectType | string;
  rejectReason?: string;
  rejectUserId?: string;
  targetTaskDefKey?: string;
  targetTaskName?: string;
  isMultiInstance?: boolean;
  multiInstanceStrategy?: string;
  extraData?: Record<string, any>;
  tenantId?: string;
}

/**
 * 任务驳回记录信息
 */
export interface TaskRejectInfo {
  id: string;
  taskId: string;
  taskDefKey?: string;
  processInstanceId: string;
  processDefinitionId?: string;
  executionId?: string;
  rejectType: string;
  rejectReason?: string;
  rejectUserId?: string;
  targetTaskDefKey?: string;
  targetTaskName?: string;
  status: string;
  isMultiInstance: boolean;
  multiInstanceStrategy?: string;
  extraData?: Record<string, any>;
  tenantId?: string;
  createTime: Date;
  processTime?: Date;
}
