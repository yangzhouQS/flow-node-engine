/**
 * 附件实体
 * 用于关联内容项与任务/流程实例的中间表
 */
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ContentItem } from './content-item.entity';

/**
 * 附件类型枚举
 */
export enum AttachmentType {
  /** 普通附件 */
  GENERAL = 'GENERAL',
  /** 审批附件 */
  APPROVAL = 'APPROVAL',
  /** 评论附件 */
  COMMENT = 'COMMENT',
  /** 表单附件 */
  FORM = 'FORM',
  /** 其他 */
  OTHER = 'OTHER',
}

/**
 * 附件实体
 * 表示内容项与业务对象的关联关系
 */
@Entity('attachment')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'content_item_id_', length: 64, comment: '内容项ID' })
  @Index()
  contentItemId: string;

  @ManyToOne(() => ContentItem)
  @JoinColumn({ name: 'content_item_id_' })
  contentItem: ContentItem;

  @Column({ name: 'process_instance_id_', length: 64, nullable: true, comment: '流程实例ID' })
  @Index()
  processInstanceId: string;

  @Column({ name: 'task_id_', length: 64, nullable: true, comment: '任务ID' })
  @Index()
  taskId: string;

  @Column({ name: 'comment_id_', length: 64, nullable: true, comment: '评论ID' })
  @Index()
  commentId: string;

  @Column({
    name: 'attachment_type_',
    type: 'enum',
    enum: AttachmentType,
    default: AttachmentType.GENERAL,
    comment: '附件类型',
  })
  attachmentType: AttachmentType;

  @Column({ name: 'name_', length: 255, comment: '附件显示名称' })
  name: string;

  @Column({ name: 'description_', type: 'text', nullable: true, comment: '附件描述' })
  description: string;

  @Column({ name: 'url_', type: 'text', nullable: true, comment: '附件访问URL' })
  url: string;

  @Column({ name: 'created_by_', length: 64, nullable: true, comment: '上传人ID' })
  @Index()
  createdBy: string;

  @Column({ name: 'tenant_id_', length: 64, nullable: true, comment: '租户ID' })
  @Index()
  tenantId: string;

  @CreateDateColumn({ name: 'create_time_', comment: '创建时间' })
  @Index()
  createTime: Date;

  @Column({ name: 'is_deleted_', type: 'tinyint', width: 1, default: 0, comment: '是否已删除' })
  isDeleted: boolean;

  @Column({ name: 'delete_time_', type: 'datetime', nullable: true, comment: '删除时间' })
  deleteTime: Date;

  @Column({ name: 'deleted_by_', length: 64, nullable: true, comment: '删除人ID' })
  deletedBy: string;
}
