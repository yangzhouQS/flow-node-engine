import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';

/**
 * 身份链接类型枚举
 */
export enum IdentityLinkType {
  /** 受让人 */
  ASSIGNEE = 'assignee',
  /** 候选人 */
  CANDIDATE = 'candidate',
  /** 候选组 */
  CANDIDATE_GROUP = 'candidateGroup',
  /** 拥有者 */
  OWNER = 'owner',
  /** 发起人 */
  STARTER = 'starter',
  /** 参与者 */
  PARTICIPANT = 'participant',
  /** 重新激活者 */
  REACTIVATOR = 'reactivator',
}

/**
 * 创建身份链接DTO
 */
export class CreateIdentityLinkDto {
  @IsString()
  taskId?: string;

  @IsString()
  processInstanceId?: string;

  @IsEnum(IdentityLinkType)
  type: IdentityLinkType;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  groupId?: string;
}

/**
 * 批量创建身份链接DTO
 */
export class BatchCreateIdentityLinkDto {
  @IsString()
  taskId?: string;

  @IsString()
  processInstanceId?: string;

  @IsEnum(IdentityLinkType)
  type: IdentityLinkType;

  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];
}

/**
 * 查询身份链接DTO
 */
export class QueryIdentityLinkDto {
  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  processInstanceId?: string;

  @IsEnum(IdentityLinkType)
  @IsOptional()
  type?: IdentityLinkType;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  groupId?: string;

  @IsString()
  @IsOptional()
  tenantId?: string;
}

/**
 * 删除身份链接DTO
 */
export class DeleteIdentityLinkDto {
  @IsString()
  taskId?: string;

  @IsString()
  processInstanceId?: string;

  @IsEnum(IdentityLinkType)
  type: IdentityLinkType;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  groupId?: string;
}

/**
 * 身份链接响应DTO
 */
export class IdentityLinkResponseDto {
  id: string;
  taskId?: string;
  processInstanceId?: string;
  type: IdentityLinkType;
  userId?: string;
  groupId?: string;
  createTime: Date;
  tenantId?: string;
}

/**
 * 候选用户信息DTO
 */
export class CandidateUserDto {
  userId: string;
  userName?: string;
  email?: string;
}

/**
 * 候选组信息DTO
 */
export class CandidateGroupDto {
  groupId: string;
  groupName?: string;
  type?: string;
}

/**
 * 任务候选人响应DTO
 */
export class TaskCandidatesResponseDto {
  taskId: string;
  assignee?: CandidateUserDto;
  owner?: CandidateUserDto;
  candidateUsers: CandidateUserDto[];
  candidateGroups: CandidateGroupDto[];
}

/**
 * 流程参与者响应DTO
 */
export class ProcessParticipantsResponseDto {
  processInstanceId: string;
  starter?: CandidateUserDto;
  participants: CandidateUserDto[];
}
