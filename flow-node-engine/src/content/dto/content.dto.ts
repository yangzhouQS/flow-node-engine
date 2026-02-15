/**
 * 内容模块 DTO 定义
 */
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  IsObject,
  IsBoolean,
  MaxLength,
  Min,
  IsUrl,
} from 'class-validator';
import { AttachmentType } from '../entities/attachment.entity';
import { ContentItemType, ContentItemStatus } from '../entities/content-item.entity';

/**
 * 创建内容项 DTO
 */
export class CreateContentItemDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ContentItemType)
  type?: ContentItemType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  contentSize?: number;

  @IsOptional()
  @IsString()
  contentStoreId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentStoreName?: string;

  @IsOptional()
  @IsUrl()
  contentUrl?: string;

  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @IsOptional()
  @IsUUID()
  processInstanceId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsString()
  scopeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  scopeType?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * 更新内容项 DTO
 */
export class UpdateContentItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ContentItemStatus)
  status?: ContentItemStatus;

  @IsOptional()
  @IsString()
  lastModifiedBy?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * 查询内容项 DTO
 */
export class QueryContentItemDto {
  @IsOptional()
  @IsUUID()
  processInstanceId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsString()
  scopeId?: string;

  @IsOptional()
  @IsString()
  scopeType?: string;

  @IsOptional()
  @IsEnum(ContentItemType)
  type?: ContentItemType;

  @IsOptional()
  @IsEnum(ContentItemStatus)
  status?: ContentItemStatus;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 20;
}

/**
 * 创建附件 DTO
 */
export class CreateAttachmentDto {
  @IsUUID()
  contentItemId: string;

  @IsOptional()
  @IsUUID()
  processInstanceId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  commentId?: string;

  @IsOptional()
  @IsEnum(AttachmentType)
  attachmentType?: AttachmentType;

  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

/**
 * 查询附件 DTO
 */
export class QueryAttachmentDto {
  @IsOptional()
  @IsUUID()
  processInstanceId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsUUID()
  commentId?: string;

  @IsOptional()
  @IsEnum(AttachmentType)
  attachmentType?: AttachmentType;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeDeleted?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number = 20;
}

/**
 * 内容项响应 DTO
 */
export class ContentItemResponseDto {
  id: string;
  name: string;
  description?: string;
  type: ContentItemType;
  mimeType?: string;
  contentSize?: number;
  contentStoreId?: string;
  contentStoreName?: string;
  contentUrl?: string;
  thumbnailUrl?: string;
  processInstanceId?: string;
  taskId?: string;
  scopeId?: string;
  scopeType?: string;
  status: ContentItemStatus;
  version: number;
  createdBy?: string;
  lastModifiedBy?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
  createTime: Date;
  lastModified: Date;
}

/**
 * 附件响应 DTO
 */
export class AttachmentResponseDto {
  id: string;
  contentItemId: string;
  processInstanceId?: string;
  taskId?: string;
  commentId?: string;
  attachmentType: AttachmentType;
  name: string;
  description?: string;
  url?: string;
  createdBy?: string;
  tenantId?: string;
  createTime: Date;
  isDeleted: boolean;
  deleteTime?: Date;
  deletedBy?: string;
  // 关联的内容项信息
  contentItem?: ContentItemResponseDto;
}

/**
 * 分页响应 DTO
 */
export class ContentPageResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 上传文件响应 DTO
 */
export class UploadFileResponseDto {
  contentItemId: string;
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

/**
 * 存储配置 DTO
 */
export class StorageConfigDto {
  @IsString()
  storageType: 'local' | 's3' | 'oss' | 'cos';

  @IsOptional()
  @IsString()
  basePath?: string;

  @IsOptional()
  @IsString()
  bucket?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  accessKeyId?: string;

  @IsOptional()
  @IsString()
  accessKeySecret?: string;

  @IsOptional()
  @IsString()
  endpoint?: string;

  @IsOptional()
  @IsBoolean()
  useSSL?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxFileSize?: number;

  @IsOptional()
  @IsString()
  allowedMimeTypes?: string;
}
