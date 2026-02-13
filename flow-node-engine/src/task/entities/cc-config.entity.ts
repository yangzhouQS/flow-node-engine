import { Entity, Column, PrimaryColumn, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

import { CcType } from './cc-record.entity';

/**
 * 抄送配置实体
 * 用于定义流程/任务节点的自动抄送规则
 */
@Entity('act_cc_config')
export class CcConfigEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

  /**
   * 流程定义ID
   */
  @Column({ length: 64 })
  @Index()
  proc_def_id_: string;

  /**
   * 任务定义Key（可选，为空表示流程级别配置）
   */
  @Column({ length: 255, nullable: true })
  @Index()
  task_def_key_: string;

  /**
   * 任务名称
   */
  @Column({ length: 255, nullable: true })
  task_name_: string;

  /**
   * 抄送类型
   */
  @Column({ length: 30, default: CcType.AUTO })
  cc_type_: string;

  /**
   * 被抄送人表达式（支持表达式如 ${initiator}）
   */
  @Column({ type: 'text', nullable: true })
  cc_to_expression_: string;

  /**
   * 被抄送人ID列表（JSON数组）
   */
  @Column({ type: 'text', nullable: true })
  cc_to_users_: string;

  /**
   * 被抄送组ID列表（JSON数组）
   */
  @Column({ type: 'text', nullable: true })
  cc_to_groups_: string;

  /**
   * 是否启用
   */
  @Column({ default: true })
  enabled_: boolean;

  /**
   * 触发条件（表达式）
   */
  @Column({ type: 'text', nullable: true })
  condition_: string;

  /**
   * 抄送说明
   */
  @Column({ type: 'text', nullable: true })
  description_: string;

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
 * 创建抄送配置参数
 */
export interface CreateCcConfigParams {
  processDefinitionId: string;
  taskDefKey?: string;
  taskName?: string;
  ccType?: CcType | string;
  ccToExpression?: string;
  ccToUsers?: string[];
  ccToGroups?: string[];
  enabled?: boolean;
  condition?: string;
  description?: string;
  extraConfig?: Record<string, any>;
  tenantId?: string;
}

/**
 * 抄送配置信息
 */
export interface CcConfigInfo {
  id: string;
  processDefinitionId: string;
  taskDefKey?: string;
  taskName?: string;
  ccType: string;
  ccToExpression?: string;
  ccToUsers?: string[];
  ccToGroups?: string[];
  enabled: boolean;
  condition?: string;
  description?: string;
  extraConfig?: Record<string, any>;
  tenantId?: string;
  createTime: Date;
  updateTime: Date;
}
