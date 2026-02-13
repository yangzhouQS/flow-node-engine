import { Entity, Column, PrimaryColumn, Index, CreateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * 抄送类型枚举
 */
export enum CcType {
  /** 手动抄送 */
  MANUAL = 'MANUAL',
  /** 自动抄送 */
  AUTO = 'AUTO',
}

/**
 * 抄送状态枚举
 */
export enum CcStatus {
  /** 未读 */
  UNREAD = 'UNREAD',
  /** 已读 */
  READ = 'READ',
}

/**
 * 抄送记录实体
 * 用于记录流程/任务的抄送信息
 */
@Entity('act_ru_cc_record')
export class CcRecordEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

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
   * 任务ID（可选）
   */
  @Column({ length: 64, nullable: true })
  @Index()
  task_id_: string;

  /**
   * 任务定义Key（可选）
   */
  @Column({ length: 255, nullable: true })
  task_def_key_: string;

  /**
   * 抄送类型
   */
  @Column({ length: 30 })
  cc_type_: string;

  /**
   * 抄送人ID
   */
  @Column({ length: 64 })
  @Index()
  cc_from_user_id_: string;

  /**
   * 抄送人名称
   */
  @Column({ length: 255, nullable: true })
  cc_from_user_name_: string;

  /**
   * 被抄送人ID
   */
  @Column({ length: 64 })
  @Index()
  cc_to_user_id_: string;

  /**
   * 被抄送人名称
   */
  @Column({ length: 255, nullable: true })
  cc_to_user_name_: string;

  /**
   * 抄送原因/备注
   */
  @Column({ type: 'text', nullable: true })
  cc_reason_: string;

  /**
   * 抄送状态
   */
  @Column({ length: 30, default: CcStatus.UNREAD })
  status_: string;

  /**
   * 阅读时间
   */
  @Column({ type: 'datetime', nullable: true })
  read_time_: Date;

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
}

/**
 * 创建抄送记录参数
 */
export interface CreateCcRecordParams {
  processInstanceId: string;
  processDefinitionId?: string;
  taskId?: string;
  taskDefKey?: string;
  ccType: CcType | string;
  ccFromUserId: string;
  ccFromUserName?: string;
  ccToUserId: string;
  ccToUserName?: string;
  ccReason?: string;
  extraData?: Record<string, any>;
  tenantId?: string;
}

/**
 * 抄送记录信息
 */
export interface CcRecordInfo {
  id: string;
  processInstanceId: string;
  processDefinitionId?: string;
  taskId?: string;
  taskDefKey?: string;
  ccType: string;
  ccFromUserId: string;
  ccFromUserName?: string;
  ccToUserId: string;
  ccToUserName?: string;
  ccReason?: string;
  status: string;
  readTime?: Date;
  extraData?: Record<string, any>;
  tenantId?: string;
  createTime: Date;
}
