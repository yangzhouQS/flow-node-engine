/**
 * 内容服务
 * 管理内容项和附件的CRUD操作
 */
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { ContentItem, ContentItemStatus, ContentItemType } from '../entities/content-item.entity';
import { Attachment, AttachmentType } from '../entities/attachment.entity';
import { StorageService } from './storage.service';
import {
  CreateContentItemDto,
  UpdateContentItemDto,
  QueryContentItemDto,
  CreateAttachmentDto,
  QueryAttachmentDto,
  ContentItemResponseDto,
  AttachmentResponseDto,
  ContentPageResponseDto,
  UploadFileResponseDto,
} from '../dto/content.dto';

/**
 * 内容服务
 */
@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(
    @InjectRepository(ContentItem)
    private readonly contentItemRepository: Repository<ContentItem>,
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    private readonly storageService: StorageService,
  ) {}

  // ==================== 内容项操作 ====================

  /**
   * 创建内容项
   */
  async createContentItem(dto: CreateContentItemDto): Promise<ContentItem> {
    const contentItem = this.contentItemRepository.create({
      name: dto.name,
      description: dto.description,
      type: dto.type || ContentItemType.FILE,
      mimeType: dto.mimeType,
      contentSize: dto.contentSize,
      contentStoreId: dto.contentStoreId,
      contentStoreName: dto.contentStoreName,
      contentUrl: dto.contentUrl,
      thumbnailUrl: dto.thumbnailUrl,
      processInstanceId: dto.processInstanceId,
      taskId: dto.taskId,
      scopeId: dto.scopeId,
      scopeType: dto.scopeType,
      status: ContentItemStatus.ACTIVE,
      version: 1,
      createdBy: dto.createdBy,
      lastModifiedBy: dto.createdBy,
      tenantId: dto.tenantId,
      metadata: dto.metadata,
    });

    const saved = await this.contentItemRepository.save(contentItem);
    
    this.logger.log(`Content item created: ${saved.id}`);
    return saved;
  }

  /**
   * 上传文件并创建内容项
   */
  async uploadFile(
    file: Express.Multer.File,
    options: {
      processInstanceId?: string;
      taskId?: string;
      scopeId?: string;
      scopeType?: string;
      userId?: string;
      tenantId?: string;
      description?: string;
    } = {}
  ): Promise<UploadFileResponseDto> {
    // 存储文件
    const folder = this.getStorageFolder(options);
    const uploadResult = await this.storageService.store(file, { folder });

    // 确定内容类型
    const contentType = this.determineContentType(file.mimetype);

    // 创建内容项
    const contentItem = await this.createContentItem({
      name: file.originalname,
      description: options.description,
      type: contentType,
      mimeType: file.mimetype,
      contentSize: file.size,
      contentStoreId: uploadResult.storeId,
      contentStoreName: uploadResult.storeName,
      contentUrl: uploadResult.url,
      processInstanceId: options.processInstanceId,
      taskId: options.taskId,
      scopeId: options.scopeId,
      scopeType: options.scopeType,
      createdBy: options.userId,
      tenantId: options.tenantId,
    });

    return {
      contentItemId: contentItem.id,
      name: contentItem.name,
      mimeType: contentItem.mimeType,
      size: contentItem.contentSize,
      url: contentItem.contentUrl,
    };
  }

  /**
   * 更新内容项
   */
  async updateContentItem(id: string, dto: UpdateContentItemDto): Promise<ContentItem> {
    const contentItem = await this.findContentItemById(id);
    
    if (dto.name !== undefined) {
      contentItem.name = dto.name;
    }
    if (dto.description !== undefined) {
      contentItem.description = dto.description;
    }
    if (dto.status !== undefined) {
      contentItem.status = dto.status;
    }
    if (dto.metadata !== undefined) {
      contentItem.metadata = { ...contentItem.metadata, ...dto.metadata };
    }
    if (dto.lastModifiedBy !== undefined) {
      contentItem.lastModifiedBy = dto.lastModifiedBy;
    }
    contentItem.version += 1;

    const saved = await this.contentItemRepository.save(contentItem);
    this.logger.log(`Content item updated: ${id}`);
    return saved;
  }

  /**
   * 根据ID查找内容项
   */
  async findContentItemById(id: string): Promise<ContentItem> {
    const contentItem = await this.contentItemRepository.findOne({
      where: { id },
    });

    if (!contentItem) {
      throw new NotFoundException(`Content item not found: ${id}`);
    }

    return contentItem;
  }

  /**
   * 查询内容项列表
   */
  async queryContentItems(query: QueryContentItemDto): Promise<ContentPageResponseDto<ContentItemResponseDto>> {
    const queryBuilder = this.contentItemRepository.createQueryBuilder('item');

    // 构建查询条件
    if (query.processInstanceId) {
      queryBuilder.andWhere('item.process_instance_id_ = :processInstanceId', {
        processInstanceId: query.processInstanceId,
      });
    }
    if (query.taskId) {
      queryBuilder.andWhere('item.task_id_ = :taskId', { taskId: query.taskId });
    }
    if (query.scopeId) {
      queryBuilder.andWhere('item.scope_id_ = :scopeId', { scopeId: query.scopeId });
    }
    if (query.scopeType) {
      queryBuilder.andWhere('item.scope_type_ = :scopeType', { scopeType: query.scopeType });
    }
    if (query.type) {
      queryBuilder.andWhere('item.type_ = :type', { type: query.type });
    }
    if (query.status) {
      queryBuilder.andWhere('item.status_ = :status', { status: query.status });
    }
    if (query.createdBy) {
      queryBuilder.andWhere('item.created_by_ = :createdBy', { createdBy: query.createdBy });
    }
    if (query.tenantId) {
      queryBuilder.andWhere('item.tenant_id_ = :tenantId', { tenantId: query.tenantId });
    }
    if (query.name) {
      queryBuilder.andWhere('item.name_ LIKE :name', { name: `%${query.name}%` });
    }

    // 排序
    queryBuilder.orderBy('item.create_time_', 'DESC');

    // 分页
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    queryBuilder.skip(skip).take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data: data.map(this.toContentItemResponseDto),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 删除内容项
   */
  async deleteContentItem(id: string, deletedBy?: string): Promise<void> {
    const contentItem = await this.findContentItemById(id);

    // 删除存储的文件
    if (contentItem.contentStoreId) {
      try {
        await this.storageService.delete(contentItem.contentStoreId);
      } catch (error) {
        this.logger.warn(`Failed to delete storage file: ${contentItem.contentStoreId}`);
      }
    }

    // 软删除：更新状态
    await this.contentItemRepository.update(id, {
      status: ContentItemStatus.DELETED,
    });

    this.logger.log(`Content item deleted: ${id}`);
  }

  /**
   * 归档内容项
   */
  async archiveContentItem(id: string): Promise<ContentItem> {
    return this.updateContentItem(id, { status: ContentItemStatus.ARCHIVED });
  }

  /**
   * 获取内容文件
   */
  async getContentFile(id: string): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
    const contentItem = await this.findContentItemById(id);

    if (!contentItem.contentStoreId) {
      throw new BadRequestException('Content item has no stored file');
    }

    const buffer = await this.storageService.retrieve(contentItem.contentStoreId);

    return {
      buffer,
      mimeType: contentItem.mimeType,
      name: contentItem.name,
    };
  }

  // ==================== 附件操作 ====================

  /**
   * 创建附件
   */
  async createAttachment(dto: CreateAttachmentDto): Promise<Attachment> {
    // 验证内容项存在
    await this.findContentItemById(dto.contentItemId);

    const attachment = this.attachmentRepository.create({
      contentItemId: dto.contentItemId,
      processInstanceId: dto.processInstanceId,
      taskId: dto.taskId,
      commentId: dto.commentId,
      attachmentType: dto.attachmentType || AttachmentType.GENERAL,
      name: dto.name,
      description: dto.description,
      url: dto.url,
      createdBy: dto.createdBy,
      tenantId: dto.tenantId,
      isDeleted: false,
    });

    const saved = await this.attachmentRepository.save(attachment);
    this.logger.log(`Attachment created: ${saved.id}`);
    return saved;
  }

  /**
   * 查询附件列表
   */
  async queryAttachments(query: QueryAttachmentDto): Promise<ContentPageResponseDto<AttachmentResponseDto>> {
    const queryBuilder = this.attachmentRepository.createQueryBuilder('att');

    // 左连接内容项
    queryBuilder.leftJoinAndSelect('att.contentItem', 'contentItem');

    // 构建查询条件
    if (query.processInstanceId) {
      queryBuilder.andWhere('att.process_instance_id_ = :processInstanceId', {
        processInstanceId: query.processInstanceId,
      });
    }
    if (query.taskId) {
      queryBuilder.andWhere('att.task_id_ = :taskId', { taskId: query.taskId });
    }
    if (query.commentId) {
      queryBuilder.andWhere('att.comment_id_ = :commentId', { commentId: query.commentId });
    }
    if (query.attachmentType) {
      queryBuilder.andWhere('att.attachment_type_ = :attachmentType', {
        attachmentType: query.attachmentType,
      });
    }
    if (query.createdBy) {
      queryBuilder.andWhere('att.created_by_ = :createdBy', { createdBy: query.createdBy });
    }
    if (query.tenantId) {
      queryBuilder.andWhere('att.tenant_id_ = :tenantId', { tenantId: query.tenantId });
    }
    if (!query.includeDeleted) {
      queryBuilder.andWhere('att.is_deleted_ = :isDeleted', { isDeleted: false });
    }

    // 排序
    queryBuilder.orderBy('att.create_time_', 'DESC');

    // 分页
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    queryBuilder.skip(skip).take(pageSize);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data: data.map(this.toAttachmentResponseDto),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 删除附件（软删除）
   */
  async deleteAttachment(id: string, deletedBy?: string): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({ where: { id } });
    if (!attachment) {
      throw new NotFoundException(`Attachment not found: ${id}`);
    }

    await this.attachmentRepository.update(id, {
      isDeleted: true,
      deleteTime: new Date(),
      deletedBy: deletedBy,
    });

    this.logger.log(`Attachment deleted: ${id}`);
  }

  /**
   * 恢复附件
   */
  async restoreAttachment(id: string): Promise<void> {
    await this.attachmentRepository.update(id, {
      isDeleted: false,
      deleteTime: null,
      deletedBy: null,
    });

    this.logger.log(`Attachment restored: ${id}`);
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取存储文件夹路径
   */
  private getStorageFolder(options: { processInstanceId?: string; taskId?: string }): string {
    if (options.taskId) {
      return `tasks/${options.taskId}`;
    }
    if (options.processInstanceId) {
      return `processes/${options.processInstanceId}`;
    }
    return 'general';
  }

  /**
   * 根据MIME类型确定内容类型
   */
  private determineContentType(mimeType: string): ContentItemType {
    if (mimeType.startsWith('image/')) {
      return ContentItemType.IMAGE;
    }
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('powerpoint')
    ) {
      return ContentItemType.DOCUMENT;
    }
    return ContentItemType.FILE;
  }

  /**
   * 转换为响应DTO
   */
  private toContentItemResponseDto(item: ContentItem): ContentItemResponseDto {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      type: item.type,
      mimeType: item.mimeType,
      contentSize: item.contentSize,
      contentStoreId: item.contentStoreId,
      contentStoreName: item.contentStoreName,
      contentUrl: item.contentUrl,
      thumbnailUrl: item.thumbnailUrl,
      processInstanceId: item.processInstanceId,
      taskId: item.taskId,
      scopeId: item.scopeId,
      scopeType: item.scopeType,
      status: item.status,
      version: item.version,
      createdBy: item.createdBy,
      lastModifiedBy: item.lastModifiedBy,
      tenantId: item.tenantId,
      metadata: item.metadata,
      createTime: item.createTime,
      lastModified: item.lastModified,
    };
  }

  /**
   * 转换附件为响应DTO
   */
  private toAttachmentResponseDto(att: Attachment): AttachmentResponseDto {
    return {
      id: att.id,
      contentItemId: att.contentItemId,
      processInstanceId: att.processInstanceId,
      taskId: att.taskId,
      commentId: att.commentId,
      attachmentType: att.attachmentType,
      name: att.name,
      description: att.description,
      url: att.url,
      createdBy: att.createdBy,
      tenantId: att.tenantId,
      createTime: att.createTime,
      isDeleted: att.isDeleted,
      deleteTime: att.deleteTime,
      deletedBy: att.deletedBy,
      contentItem: att.contentItem ? this.toContentItemResponseDto(att.contentItem) : undefined,
    };
  }
}
