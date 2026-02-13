import { Entity, Column, PrimaryColumn, Index, CreateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * 身份链接类型枚举
 */
export enum IdentityLinkType {
  /** 受让人 */
  ASSIGNEE = 'assignee',
  /** 候选人 */
  CANDIDATE = 'candidate',
  /** 拥有者 */
  OWNER = 'owner',
  /** 发起人 */
  STARTER = 'starter',
  /** 参与者 */
  PARTICIPANT = 'participant',
  /** 重新激活者 */
  REACTIVATOR = 'reactivator',
}

/**
 * 身份链接实体
 * 用于关联任务/流程实例与用户/组的关系
 */
@Entity('act_ru_identitylink')
export class IdentityLinkEntity {
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
 * 创建身份链接参数
 */
export interface CreateIdentityLinkParams {
  type?: string;
  userId?: string;
  groupId?: string;
  taskId?: string;
  processInstanceId?: string;
  processDefinitionId?: string;
  linkType: IdentityLinkType | string;
  tenantId?: string;
}

/**
 * 身份链接信息
 */
export interface IdentityLinkInfo {
  id: string;
  type?: string;
  userId?: string;
  groupId?: string;
  taskId?: string;
  processInstanceId?: string;
  processDefinitionId?: string;
  linkType: string;
  tenantId?: string;
  createTime: Date;
}
