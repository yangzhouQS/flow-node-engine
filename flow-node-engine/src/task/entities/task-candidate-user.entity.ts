import { Entity, Column, PrimaryColumn, Index, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * 任务候选用户实体
 * 用于存储任务的候选用户列表（候选人）
 */
@Entity('act_ru_task_candidate_user')
export class TaskCandidateUserEntity {
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
   * 用户ID
   */
  @Column({ length: 64 })
  @Index()
  user_id_: string;

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
 * 创建任务候选用户参数
 */
export interface CreateTaskCandidateUserParams {
  taskId: string;
  processInstanceId: string;
  userId: string;
  taskDefinitionKey?: string;
  tenantId?: string;
}

/**
 * 任务候选用户信息
 */
export interface TaskCandidateUserInfo {
  id: string;
  taskId: string;
  processInstanceId: string;
  userId: string;
  taskDefinitionKey?: string;
  tenantId?: string;
  createTime: Date;
}
