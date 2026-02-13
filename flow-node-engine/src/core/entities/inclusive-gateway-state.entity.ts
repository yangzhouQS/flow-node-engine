import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * 包容网关状态实体
 * 用于跟踪包容网关的分叉和汇聚状态
 * 
 * 包容网关特点：
 * - 分叉时：选择所有满足条件的分支
 * - 汇聚时：等待所有激活的分支完成后才继续
 */
@Entity('act_ru_inclusive_gateway_state')
export class InclusiveGatewayStateEntity {
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
  execution_id_: string;

  /**
   * 网关活动ID（BPMN元素ID）
   */
  @Column({ length: 255 })
  @Index()
  gateway_id_: string;

  /**
   * 网关类型：fork（分叉）或 join（汇聚）
   */
  @Column({ length: 20 })
  gateway_type_: 'fork' | 'join';

  /**
   * 激活的分支数量
   * - 对于分叉网关：表示创建的分支数
   * - 对于汇聚网关：表示需要等待的分支数
   */
  @Column({ type: 'int', default: 0 })
  active_branches_: number;

  /**
   * 已完成的分支数量
   * 用于汇聚网关跟踪已到达的分支
   */
  @Column({ type: 'int', default: 0 })
  completed_branches_: number;

  /**
   * 分支目标ID列表（JSON数组）
   * 记录分叉时激活的所有分支目标ID
   */
  @Column({ type: 'text', nullable: true })
  branch_targets_: string;

  /**
   * 是否已激活
   */
  @Column({ type: 'boolean', default: true })
  is_active_: boolean;

  /**
   * 流程定义ID
   */
  @Column({ length: 64, nullable: true })
  proc_def_id_: string;

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
   * 最后更新时间
   */
  @Column({ type: 'datetime', nullable: true })
  update_time_: Date;
}
