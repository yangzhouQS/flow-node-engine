import { Entity, Column, PrimaryColumn, Index, CreateDateColumn } from 'typeorm';

import { IdentityLinkType } from './identity-link.entity';

/**
 * 历史身份链接实体
 * 用于存储已完成的任务/流程实例的身份链接历史记录
 */
@Entity('act_hi_identitylink')
export class HistoricIdentityLinkEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

  /**
   * 关联的类型（task/process）
   */
  @Column({ length: 30, nullable: true })
  type_: string;

  /**
   * 用户ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  user_id_: string;

  /**
   * 组ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  group_id_: string;

  /**
   * 任务ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  task_id_: string;

  /**
   * 历史任务实例ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  historic_task_id_: string;

  /**
   * 流程实例ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  proc_inst_id_: string;

  /**
   * 流程定义ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  proc_def_id_: string;

  /**
   * 身份链接类型
   */
  @Column({ length: 30 })
  link_type_: string;

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
}

/**
 * 创建历史身份链接参数
 */
export interface CreateHistoricIdentityLinkParams {
  type?: string;
  userId?: string;
  groupId?: string;
  taskId?: string;
  historicTaskId?: string;
  processInstanceId?: string;
  processDefinitionId?: string;
  linkType: IdentityLinkType | string;
  tenantId?: string;
}

/**
 * 历史身份链接信息
 */
export interface HistoricIdentityLinkInfo {
  id: string;
  type?: string;
  userId?: string;
  groupId?: string;
  taskId?: string;
  historicTaskId?: string;
  processInstanceId?: string;
  processDefinitionId?: string;
  linkType: string;
  tenantId?: string;
  createTime: Date;
}
