import { IsString, IsOptional, IsArray, IsBoolean, IsEnum } from 'class-validator';

/**
 * 抄送状态枚举
 */
export enum CCStatus {
  /** 未读 */
  UNREAD = 'UNREAD',
  /** 已读 */
  READ = 'READ',
  /** 已处理 */
  HANDLED = 'HANDLED',
  /** 已归档 */
  ARCHIVED = 'ARCHIVED',
}

/**
 * 抄送类型枚举
 */
export enum CCType {
  /** 任务抄送 */
  TASK = 'TASK',
  /** 流程抄送 */
  PROCESS = 'PROCESS',
  /** 手动抄送 */
  MANUAL = 'MANUAL',
  /** 自动抄送 */
  AUTO = 'AUTO',
}

/**
 * 创建抄送DTO
 */
export class CreateCCDto {
  @IsString()
  taskId?: string;

  @IsString()
  processInstanceId?: string;

  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  groupIds?: string[];

  @IsString()
  @IsOptional()
  reason?: string;

  @IsEnum(CCType)
  @IsOptional()
  type?: CCType;
}

/**
 * 批量创建抄送DTO
 */
export class BatchCreateCCDto {
  @IsString()
  taskId?: string;

  @IsString()
  processInstanceId?: string;

  @IsArray()
  userIds: string[];

  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * 查询抄送记录DTO
 */
export class QueryCCDto {
  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  processInstanceId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  fromUserId?: string;

  @IsEnum(CCStatus)
  @IsOptional()
  status?: CCStatus;

  @IsEnum(CCType)
  @IsOptional()
  type?: CCType;

  @IsString()
  @IsOptional()
  startTimeAfter?: string;

  @IsString()
  @IsOptional()
  startTimeBefore?: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  pageSize?: string;
}

/**
 * 更新抄送状态DTO
 */
export class UpdateCCStatusDto {
  @IsEnum(CCStatus)
  status: CCStatus;

  @IsString()
  @IsOptional()
  comment?: string;
}

/**
 * 抄送配置DTO
 */
export class CCConfigDto {
  @IsString()
  processDefinitionKey: string;

  @IsString()
  @IsOptional()
  activityId?: string;

  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  groupIds?: string[];

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsEnum(CCType)
  @IsOptional()
  type?: CCType;
}

/**
 * 抄送记录响应DTO
 */
export class CCRecordResponseDto {
  id: string;
  taskId?: string;
  taskName?: string;
  processInstanceId: string;
  processDefinitionKey?: string;
  processDefinitionName?: string;
  userId: string;
  userName?: string;
  fromUserId: string;
  fromUserName?: string;
  status: CCStatus;
  type: CCType;
  reason?: string;
  readTime?: Date;
  createTime: Date;
}

/**
 * 我的抄送列表响应DTO
 */
export class MyCCListResponseDto {
  total: number;
  unreadCount: number;
  list: CCRecordResponseDto[];
}

/**
 * 抄送统计响应DTO
 */
export class CCStatisticsResponseDto {
  totalCount: number;
  unreadCount: number;
  readCount: number;
  handledCount: number;
  archivedCount: number;
  todayCount: number;
  weekCount: number;
  monthCount: number;
}

/**
 * 抄送用户信息DTO
 */
export class CCUserDto {
  userId: string;
  userName?: string;
  email?: string;
  department?: string;
}

/**
 * 抄送详情响应DTO
 */
export class CCDetailResponseDto {
  id: string;
  taskId?: string;
  taskName?: string;
  taskDescription?: string;
  processInstanceId: string;
  processDefinitionKey?: string;
  processDefinitionName?: string;
  processStartTime?: Date;
  starterId?: string;
  starterName?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  fromUserId: string;
  fromUserName?: string;
  status: CCStatus;
  type: CCType;
  reason?: string;
  comment?: string;
  readTime?: Date;
  handleTime?: Date;
  createTime: Date;
  taskVariables?: Record<string, any>;
  processVariables?: Record<string, any>;
}
