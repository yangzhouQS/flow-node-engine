/**
 * 评论实体
 * 用于存储流程实例和任务的评论
 */
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

/**
 * 评论类型枚举
 */
export enum CommentType {
  /** 普通评论 */
  COMMENT = 'COMMENT',
  /** 审批意见 */
  APPROVAL = 'APPROVAL',
  /** 系统消息 */
  SYSTEM = 'SYSTEM',
  /** 驳回意见 */
  REJECT = 'REJECT',
  /** 转办意见 */
  DELEGATE = 'DELEGATE',
  /** 退回意见 */
  RETURN = 'RETURN',
}

/**
 * 评论实体
 * 存储流程实例和任务的评论信息
 */
@Entity('comment')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id_', length: 64, comment: '评论用户ID' })
  @Index()
  userId: string;

  @Column({ name: 'user_name_', length: 128, nullable: true, comment: '评论用户名称' })
  userName: string;

  @Column({ name: 'process_instance_id_', length: 64, nullable: true, comment: '流程实例ID' })
  @Index()
  processInstanceId: string;

  @Column({ name: 'task_id_', length: 64, nullable: true, comment: '任务ID' })
  @Index()
  taskId: string;

  @Column({ name: 'type_', type: 'enum', enum: CommentType, default: CommentType.COMMENT, comment: '评论类型' })
  @Index()
  type: CommentType;

  @Column({ name: 'message_', type: 'text', comment: '评论内容' })
  message: string;

  @Column({ name: 'parent_id_', length: 64, nullable: true, comment: '父评论ID（用于回复）' })
  @Index()
  parentId: string;

  @Column({ name: 'root_id_', length: 64, nullable: true, comment: '根评论ID（用于评论树）' })
  @Index()
  rootId: string;

  @Column({ name: 'reply_to_user_id_', length: 64, nullable: true, comment: '回复目标用户ID' })
  replyToUserId: string;

  @Column({ name: 'reply_to_user_name_', length: 128, nullable: true, comment: '回复目标用户名称' })
  replyToUserName: string;

  @Column({ name: 'like_count_', type: 'int', default: 0, comment: '点赞数' })
  likeCount: number;

  @Column({ name: 'reply_count_', type: 'int', default: 0, comment: '回复数' })
  replyCount: number;

  @Column({ name: 'is_edited_', type: 'tinyint', width: 1, default: 0, comment: '是否已编辑' })
  isEdited: boolean;

  @Column({ name: 'is_pinned_', type: 'tinyint', width: 1, default: 0, comment: '是否置顶' })
  isPinned: boolean;

  @Column({ name: 'is_internal_', type: 'tinyint', width: 1, default: 0, comment: '是否内部评论（仅管理员可见）' })
  isInternal: boolean;

  @Column({ name: 'is_deleted_', type: 'tinyint', width: 1, default: 0, comment: '是否已删除' })
  isDeleted: boolean;

  @Column({ name: 'delete_time_', type: 'datetime', nullable: true, comment: '删除时间' })
  deleteTime: Date;

  @Column({ name: 'deleted_by_', length: 64, nullable: true, comment: '删除人ID' })
  deletedBy: string;

  @Column({ name: 'tenant_id_', length: 64, nullable: true, comment: '租户ID' })
  @Index()
  tenantId: string;

  @Column({ name: 'metadata_', type: 'json', nullable: true, comment: '扩展元数据' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'create_time_', comment: '创建时间' })
  @Index()
  createTime: Date;

  @UpdateDateColumn({ name: 'update_time_', comment: '更新时间' })
  updateTime: Date;

  // 关联关系（自引用）
  @ManyToOne(() => Comment, { nullable: true })
  @JoinColumn({ name: 'parent_id_' })
  parent: Comment;

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies: Comment[];
}
