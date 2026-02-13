import { Entity, Column, PrimaryColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * 多实例驳回策略枚举
 */
export enum MultiInstanceRejectStrategy {
  /** 全部退回：所有人任务都退回 */
  ALL_BACK = 'ALL_BACK',
  /** 仅当前：只退回当前操作人的任务 */
  ONLY_CURRENT = 'ONLY_CURRENT',
  /** 多数退回：超过半数驳回时全部退回 */
  MAJORITY_BACK = 'MAJORITY_BACK',
  /** 保留已完成：已完成的任务不受影响，只退回未完成的 */
  KEEP_COMPLETED = 'KEEP_COMPLETED',
  /** 重置全部：所有人任务都重置 */
  RESET_ALL = 'RESET_ALL',
  /** 等待完成：等待所有人完成后统一处理 */
  WAIT_COMPLETION = 'WAIT_COMPLETION',
  /** 立即生效：一人驳回立即生效 */
  IMMEDIATE = 'IMMEDIATE',
}

/**
 * 多实例配置实体
 * 用于定义多实例节点的驳回策略配置
 */
@Entity('act_multi_instance_config')
export class MultiInstanceConfigEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

  /**
   * 流程定义ID
   */
  @Column({ length: 64 })
  @Index()
  proc_def_id_: string;

  /**
   * 任务定义Key
   */
  @Column({ length: 255 })
  @Index()
  task_def_key_: string;

  /**
   * 任务名称
   */
  @Column({ length: 255, nullable: true })
  task_name_: string;

  /**
   * 是否为多实例任务
   */
  @Column({ default: false })
  is_multi_instance_: boolean;

  /**
   * 是否为顺序执行
   */
  @Column({ default: false })
  sequential_: boolean;

  /**
   * 驳回策略
   */
  @Column({ length: 30, default: MultiInstanceRejectStrategy.ONLY_CURRENT })
  reject_strategy_: string;

  /**
   * 完成条件表达式
   */
  @Column({ type: 'text', nullable: true })
  completion_condition_: string;

  /**
   * 集合变量名
   */
  @Column({ length: 255, nullable: true })
  collection_variable_: string;

  /**
   * 元素变量名
   */
  @Column({ length: 255, nullable: true })
  element_variable_: string;

  /**
   * 基数（固定实例数）
   */
  @Column({ nullable: true })
  cardinality_: number;

  /**
   * 扩展配置（JSON格式）
   */
  @Column({ type: 'text', nullable: true })
  extra_config_: string;

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
   * 更新时间
   */
  @UpdateDateColumn()
  update_time_: Date;
}

/**
 * 创建多实例配置参数
 */
export interface CreateMultiInstanceConfigParams {
  processDefinitionId: string;
  taskDefKey: string;
  taskName?: string;
  isMultiInstance?: boolean;
  sequential?: boolean;
  rejectStrategy?: MultiInstanceRejectStrategy | string;
  completionCondition?: string;
  collectionVariable?: string;
  elementVariable?: string;
  cardinality?: number;
  extraConfig?: Record<string, any>;
  tenantId?: string;
}

/**
 * 多实例配置信息
 */
export interface MultiInstanceConfigInfo {
  id: string;
  processDefinitionId: string;
  taskDefKey: string;
  taskName?: string;
  isMultiInstance: boolean;
  sequential: boolean;
  rejectStrategy: string;
  completionCondition?: string;
  collectionVariable?: string;
  elementVariable?: string;
  cardinality?: number;
  extraConfig?: Record<string, any>;
  tenantId?: string;
  createTime: Date;
  updateTime: Date;
}
