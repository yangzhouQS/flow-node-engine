import { Entity, Column, PrimaryColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { RejectType } from './task-reject.entity';

/**
 * 驳回配置实体
 * 用于定义任务节点的驳回策略配置
 */
@Entity('act_reject_config')
export class RejectConfigEntity {
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
   * 允许的驳回类型（JSON数组）
   */
  @Column({ type: 'text', nullable: true })
  allowed_reject_types_: string;

  /**
   * 默认驳回类型
   */
  @Column({ length: 30, default: RejectType.TO_PREVIOUS })
  default_reject_type_: string;

  /**
   * 是否允许驳回
   */
  @Column({ default: true })
  allow_reject_: boolean;

  /**
   * 是否需要填写驳回原因
   */
  @Column({ default: true })
  require_reason_: boolean;

  /**
   * 目标节点配置（JSON数组，用于TO_SPECIFIC类型）
   */
  @Column({ type: 'text', nullable: true })
  target_nodes_: string;

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
 * 创建驳回配置参数
 */
export interface CreateRejectConfigParams {
  processDefinitionId: string;
  taskDefKey: string;
  taskName?: string;
  allowedRejectTypes?: RejectType[];
  defaultRejectType?: RejectType | string;
  allowReject?: boolean;
  requireReason?: boolean;
  targetNodes?: string[];
  extraConfig?: Record<string, any>;
  tenantId?: string;
}

/**
 * 驳回配置信息
 */
export interface RejectConfigInfo {
  id: string;
  processDefinitionId: string;
  taskDefKey: string;
  taskName?: string;
  allowedRejectTypes?: RejectType[];
  defaultRejectType: string;
  allowReject: boolean;
  requireReason: boolean;
  targetNodes?: string[];
  extraConfig?: Record<string, any>;
  tenantId?: string;
  createTime: Date;
  updateTime: Date;
}
