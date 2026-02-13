import { Entity, Column, PrimaryColumn, Index, CreateDateColumn } from 'typeorm';

/**
 * 历史变量实例实体
 * 对应Flowable的act_hi_varinst表
 */
@Entity('act_hi_varinst')
export class HistoricVariableInstanceEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

  /**
   * 流程实例ID
   */
  @Column({ length: 64 })
  @Index()
  proc_inst_id_: string;

  /**
   * 执行ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  execution_id_: string;

  /**
   * 任务ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  task_id_: string;

  /**
   * 变量名称
   */
  @Column({ length: 255 })
  @Index()
  name_: string;

  /**
   * 变量类型（string/integer/boolean/date/json等）
   */
  @Column({ length: 100 })
  var_type_: string;

  /**
   * 变量值（对于简单类型直接存储，复杂类型存储JSON）
   */
  @Column({ type: 'text', nullable: true })
  text_: string;

  /**
   * 变量值（长文本）
   */
  @Column({ type: 'longtext', nullable: true })
  text2_: string;

  /**
   * 双精度值（用于数值类型）
   */
  @Column({ type: 'double', nullable: true })
  double_: number;

  /**
   * 长整型值（用于整数类型）
   */
  @Column({ type: 'bigint', nullable: true })
  long_: number;

  /**
   * 字节值（用于二进制数据）
   */
  @Column({ type: 'blob', nullable: true })
  bytes_: Buffer;

  /**
   * 流程定义ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  proc_def_id_: string;

  /**
   * 流程定义Key
   */
  @Column({ length: 255, nullable: true })
  @Index()
  proc_def_key_: string;

  /**
   * 租户ID
   */
  @Column({ length: 64, nullable: true })
  tenant_id_: string;

  /**
   * 活动实例ID
   */
  @Column({ length: 64, nullable: true })
  @Index()
  act_inst_id_: string;

  /**
   * 作用域ID
   */
  @Column({ length: 64, nullable: true })
  scope_id_: string;

  /**
   * 作用域类型
   */
  @Column({ length: 64, nullable: true })
  scope_type_: string;

  /**
   * 状态（CREATED/DELETED）
   */
  @Column({ length: 20, default: 'CREATED' })
  state_: string;

  /**
   * 创建时间
   */
  @CreateDateColumn()
  create_time_: Date;

  /**
   * 最后更新时间
   */
  @Column({ type: 'datetime', nullable: true })
  last_updated_time_: Date;

  /**
   * 删除时间
   */
  @Column({ type: 'datetime', nullable: true })
  delete_time_: Date;
}

/**
 * 历史变量类型枚举
 */
export enum HistoricVariableType {
  STRING = 'string',
  INTEGER = 'integer',
  LONG = 'long',
  DOUBLE = 'double',
  BOOLEAN = 'boolean',
  DATE = 'date',
  JSON = 'json',
  BINARY = 'binary',
  SERIALIZABLE = 'serializable',
}

/**
 * 创建历史变量参数
 */
export interface CreateHistoricVariableParams {
  processInstanceId: string;
  executionId?: string;
  taskId?: string;
  name: string;
  type: HistoricVariableType | string;
  value?: any;
  processDefinitionId?: string;
  processDefinitionKey?: string;
  tenantId?: string;
}

/**
 * 历史变量信息
 */
export interface HistoricVariableInfo {
  id: string;
  processInstanceId: string;
  executionId?: string;
  taskId?: string;
  name: string;
  type: string;
  value?: any;
  processDefinitionId?: string;
  processDefinitionKey?: string;
  tenantId?: string;
  createTime: Date;
  lastUpdatedTime?: Date;
}

/**
 * 历史变量查询参数
 */
export interface QueryHistoricVariableParams {
  processInstanceId?: string;
  executionId?: string;
  taskId?: string;
  name?: string;
  nameLike?: string;
  type?: string;
  processDefinitionId?: string;
  processDefinitionKey?: string;
  tenantId?: string;
  createTimeAfter?: Date;
  createTimeBefore?: Date;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}
