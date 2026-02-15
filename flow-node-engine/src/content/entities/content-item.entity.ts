/**
 * 内容项实体
 * 用于存储流程实例和任务相关的内容元数据
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
} from 'typeorm';

/**
 * 内容项类型枚举
 */
export enum ContentItemType {
  /** 文件附件 */
  FILE = 'FILE',
  /** 图片 */
  IMAGE = 'IMAGE',
  /** 文档 */
  DOCUMENT = 'DOCUMENT',
  /** 链接 */
  LINK = 'LINK',
  /** 其他 */
  OTHER = 'OTHER',
}

/**
 * 内容项状态枚举
 */
export enum ContentItemStatus {
  /** 活跃 */
  ACTIVE = 'ACTIVE',
  /** 已归档 */
  ARCHIVED = 'ARCHIVED',
  /** 已删除 */
  DELETED = 'DELETED',
}

/**
 * 内容项实体
 * 存储内容的基本信息和元数据
 */
@Entity('content_item')
export class ContentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name_', length: 255, comment: '内容名称' })
  @Index()
  name: string;

  @Column({ name: 'description_', type: 'text', nullable: true, comment: '内容描述' })
  description: string;

  @Column({
    name: 'type_',
    type: 'enum',
    enum: ContentItemType,
    default: ContentItemType.FILE,
    comment: '内容类型',
  })
  type: ContentItemType;

  @Column({ name: 'mime_type_', length: 100, nullable: true, comment: 'MIME类型' })
  mimeType: string;

  @Column({ name: 'content_size_', type: 'bigint', nullable: true, comment: '内容大小（字节）' })
  contentSize: number;

  @Column({ name: 'content_store_id_', length: 255, nullable: true, comment: '存储服务ID' })
  contentStoreId: string;

  @Column({ name: 'content_store_name_', length: 100, nullable: true, comment: '存储服务名称' })
  contentStoreName: string;

  @Column({ name: 'content_url_', type: 'text', nullable: true, comment: '内容访问URL' })
  contentUrl: string;

  @Column({ name: 'thumbnail_url_', type: 'text', nullable: true, comment: '缩略图URL' })
  thumbnailUrl: string;

  @Column({ name: 'process_instance_id_', length: 64, nullable: true, comment: '流程实例ID' })
  @Index()
  processInstanceId: string;

  @Column({ name: 'task_id_', length: 64, nullable: true, comment: '任务ID' })
  @Index()
  taskId: string;

  @Column({ name: 'scope_id_', length: 64, nullable: true, comment: '作用域ID' })
  scopeId: string;

  @Column({ name: 'scope_type_', length: 50, nullable: true, comment: '作用域类型' })
  scopeType: string;

  @Column({
    name: 'status_',
    type: 'enum',
    enum: ContentItemStatus,
    default: ContentItemStatus.ACTIVE,
    comment: '内容状态',
  })
  @Index()
  status: ContentItemStatus;

  @Column({ name: 'version_', type: 'int', default: 1, comment: '版本号' })
  version: number;

  @Column({ name: 'created_by_', length: 64, nullable: true, comment: '创建人ID' })
  @Index()
  createdBy: string;

  @Column({ name: 'last_modified_by_', length: 64, nullable: true, comment: '最后修改人ID' })
  lastModifiedBy: string;

  @Column({ name: 'tenant_id_', length: 64, nullable: true, comment: '租户ID' })
  @Index()
  tenantId: string;

  @Column({ name: 'metadata_', type: 'json', nullable: true, comment: '扩展元数据' })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'create_time_', comment: '创建时间' })
  @Index()
  createTime: Date;

  @UpdateDateColumn({ name: 'last_modified_', comment: '最后修改时间' })
  lastModified: Date;
}
