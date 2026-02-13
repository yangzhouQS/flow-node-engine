import { Entity, Column, PrimaryColumn, Index, CreateDateColumn } from 'typeorm';

/**
 * 任务候选组实体
 * 用于存储任务的候选组列表（候选部门/角色）
 */
@Entity('act_ru_task_candidate_group')
export class TaskCandidateGroupEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

  /**
   * 关联的任务ID
   */
  @Column({ length: 64 })
  @Index()
  task_id_: string;

  /**
   * 流程实例ID
   */
  @Column({ length: 64 })
  @Index()
  proc_inst_id_: string;

  /**
   * 组ID
   */
  @Column({ length: 64 })
  @Index()
  group_id_: string;

  /**
   * 任务定义Key
   */
  @Column({ length: 255, nullable: true })
  task_def_key_: string;

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
 * 创建任务候选组参数
 */
export interface CreateTaskCandidateGroupParams {
  taskId: string;
  processInstanceId: string;
  groupId: string;
  taskDefinitionKey?: string;
  tenantId?: string;
}

/**
 * 任务候选组信息
 */
export interface TaskCandidateGroupInfo {
  id: string;
  taskId: string;
  processInstanceId: string;
  groupId: string;
  taskDefinitionKey?: string;
  tenantId?: string;
  createTime: Date;
}
