/**
 * 评论模块 DTO 定义
 */
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsObject,
  MaxLength,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { CommentType } from '../entities/comment.entity';

/**
 * 添加评论 DTO
 */
export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  userName?: string;

  @IsOptional()
  @IsUUID()
  processInstanceId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUUID()
  rootId?: string;

  @IsOptional()
  @IsString()
  replyToUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  replyToUserName?: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * 更新评论 DTO
 */
export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

/**
 * 查询评论 DTO
 */
export class QueryCommentDto {
  @IsOptional()
  @IsUUID()
  processInstanceId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEnum(CommentType)
  type?: CommentType;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUUID()
  rootId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeDeleted?: boolean = false;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeInternal?: boolean = false;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  onlyPinned?: boolean = false;

  @IsOptional()
  @IsString()
  tenantId?: string;

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

  @IsOptional()
  @IsString()
  sortBy?: 'createTime' | 'likeCount' | 'replyCount' = 'createTime';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

/**
 * 评论响应 DTO
 */
export class CommentResponseDto {
  id: string;
  userId: string;
  userName?: string;
  processInstanceId?: string;
  taskId?: string;
  type: CommentType;
  message: string;
  parentId?: string;
  rootId?: string;
  replyToUserId?: string;
  replyToUserName?: string;
  likeCount: number;
  replyCount: number;
  isEdited: boolean;
  isPinned: boolean;
  isInternal: boolean;
  isDeleted: boolean;
  deleteTime?: Date;
  deletedBy?: string;
  tenantId?: string;
  metadata?: Record<string, any>;
  createTime: Date;
  updateTime: Date;
  // 子评论（回复）
  replies?: CommentResponseDto[];
}

/**
 * 评论树响应 DTO（带层级的评论）
 */
export class CommentTreeResponseDto {
  root: CommentResponseDto;
  replies: CommentResponseDto[];
  totalReplies: number;
}

/**
 * 分页响应 DTO
 */
export class CommentPageResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 点赞 DTO
 */
export class LikeCommentDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsBoolean()
  unlike?: boolean;
}

/**
 * 置顶评论 DTO
 */
export class PinCommentDto {
  @IsOptional()
  @IsBoolean()
  pinned?: boolean = true;
}

/**
 * 评论统计 DTO
 */
export class CommentStatsDto {
  totalComments: number;
  totalReplies: number;
  byType: Record<CommentType, number>;
  byUser: Array<{ userId: string; userName?: string; count: number }>;
  recentComments: CommentResponseDto[];
}
