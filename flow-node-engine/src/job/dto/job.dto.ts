/**
 * 作业DTO定义
 */
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsDate, IsObject, Min, Max, IsArray } from 'class-validator';

import { ExternalWorkerJobStatus } from '../entities/external-worker-job.entity';
import { JobType, JobStatus } from '../entities/job.entity';
import { TimerType, TimerJobStatus } from '../entities/timer-job.entity';

// ==================== 通用作业DTO ====================

/**
 * 创建作业DTO
 */
export class CreateJobDto {
  @IsString()
  id_: string;

  @IsEnum(JobType)
  type_: string;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  execution_id_?: string;

  @IsString()
  @IsOptional()
  process_def_id_?: string;

  @IsString()
  @IsOptional()
  task_id_?: string;

  @IsString()
  @IsOptional()
  handler_type_?: string;

  @IsString()
  @IsOptional()
  handler_config_?: string;

  @IsString()
  @IsOptional()
  payload_?: string;

  @IsNumber()
  @IsOptional()
  max_retries_?: number;

  @IsNumber()
  @IsOptional()
  retry_wait_time_?: number;

  @IsNumber()
  @IsOptional()
  priority_?: number;

  @IsBoolean()
  @IsOptional()
  exclusive_?: boolean;

  @IsNumber()
  @IsOptional()
  timeout_?: number;

  @IsString()
  @IsOptional()
  callback_url_?: string;

  @IsString()
  @IsOptional()
  tenant_id_?: string;

  @IsObject()
  @IsOptional()
  extra_data_?: Record<string, any>;
}

/**
 * 作业查询DTO
 */
export class JobQueryDto {
  @IsEnum(JobType)
  @IsOptional()
  type_?: string;

  @IsEnum(JobStatus)
  @IsOptional()
  status_?: string;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  execution_id_?: string;

  @IsString()
  @IsOptional()
  process_def_id_?: string;

  @IsString()
  @IsOptional()
  tenant_id_?: string;

  @IsBoolean()
  @IsOptional()
  exclusive_?: boolean;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}

/**
 * 作业执行结果DTO
 */
export class JobResultDto {
  @IsString()
  job_id_: string;

  @IsBoolean()
  success_: boolean;

  @IsString()
  @IsOptional()
  result_?: string;

  @IsString()
  @IsOptional()
  error_message_?: string;

  @IsObject()
  @IsOptional()
  output_variables_?: Record<string, any>;
}

// ==================== 定时器作业DTO ====================

/**
 * 创建定时器作业DTO
 */
export class CreateTimerJobDto {
  @IsString()
  id_: string;

  @IsEnum(TimerType)
  timer_type_: string;

  @IsString()
  timer_expression_: string;

  @IsDate()
  @Type(() => Date)
  due_date_: Date;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  execution_id_?: string;

  @IsString()
  @IsOptional()
  process_def_id_?: string;

  @IsString()
  @IsOptional()
  activity_id_?: string;

  @IsString()
  @IsOptional()
  activity_name_?: string;

  @IsNumber()
  @IsOptional()
  max_executions_?: number;

  @IsBoolean()
  @IsOptional()
  repeat_?: boolean;

  @IsNumber()
  @IsOptional()
  repeat_interval_?: number;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  end_time_?: Date;

  @IsString()
  @IsOptional()
  callback_config_?: string;

  @IsString()
  @IsOptional()
  payload_?: string;

  @IsString()
  @IsOptional()
  tenant_id_?: string;

  @IsObject()
  @IsOptional()
  extra_data_?: Record<string, any>;
}

/**
 * 定时器作业查询DTO
 */
export class TimerJobQueryDto {
  @IsEnum(TimerType)
  @IsOptional()
  timer_type_?: string;

  @IsEnum(TimerJobStatus)
  @IsOptional()
  status_?: string;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  process_def_key_?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  due_before?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  due_after?: Date;

  @IsString()
  @IsOptional()
  tenant_id_?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}

// ==================== 外部工作者作业DTO ====================

/**
 * 创建外部工作者作业DTO
 */
export class CreateExternalWorkerJobDto {
  @IsString()
  id_: string;

  @IsString()
  topic_: string;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  execution_id_?: string;

  @IsString()
  @IsOptional()
  process_def_id_?: string;

  @IsString()
  @IsOptional()
  activity_id_?: string;

  @IsString()
  @IsOptional()
  payload_?: string;

  @IsString()
  @IsOptional()
  variables_?: string;

  @IsNumber()
  @IsOptional()
  lock_duration_?: number;

  @IsNumber()
  @IsOptional()
  max_retries_?: number;

  @IsNumber()
  @IsOptional()
  priority_?: number;

  @IsNumber()
  @IsOptional()
  timeout_?: number;

  @IsString()
  @IsOptional()
  callback_url_?: string;

  @IsString()
  @IsOptional()
  tenant_id_?: string;

  @IsObject()
  @IsOptional()
  extra_data_?: Record<string, any>;
}

/**
 * 领取外部工作者作业DTO
 */
export class ClaimExternalWorkerJobDto {
  @IsString()
  worker_id_: string;

  @IsNumber()
  @IsOptional()
  lock_duration_?: number;
}

/**
 * 完成外部工作者作业DTO
 */
export class CompleteExternalWorkerJobDto {
  @IsString()
  job_id_: string;

  @IsString()
  worker_id_: string;

  @IsObject()
  @IsOptional()
  variables_?: Record<string, any>;
}

/**
 * 外部工作者作业失败DTO
 */
export class FailExternalWorkerJobDto {
  @IsString()
  job_id_: string;

  @IsString()
  worker_id_: string;

  @IsString()
  @IsOptional()
  error_message_?: string;

  @IsString()
  @IsOptional()
  error_code_?: string;

  @IsObject()
  @IsOptional()
  error_details_?: Record<string, any>;

  @IsNumber()
  @IsOptional()
  retry_timeout_?: number;
}

/**
 * 外部工作者作业查询DTO
 */
export class ExternalWorkerJobQueryDto {
  @IsString()
  @IsOptional()
  topic_?: string;

  @IsEnum(ExternalWorkerJobStatus)
  @IsOptional()
  status_?: string;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  worker_id_?: string;

  @IsString()
  @IsOptional()
  tenant_id_?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}

/**
 * 获取可领取作业DTO
 */
export class FetchAndLockDto {
  @IsString()
  worker_id_: string;

  @IsNumber()
  @IsOptional()
  max_tasks_?: number;

  @IsArray()
  topics_: TopicFetchDto[];

  @IsBoolean()
  @IsOptional()
  use_priority_?: boolean;
}

/**
 * 主题获取DTO
 */
export class TopicFetchDto {
  @IsString()
  topic_name_: string;

  @IsNumber()
  lock_duration_: number;

  @IsObject()
  @IsOptional()
  variables_?: Record<string, any>;

  @IsString()
  @IsOptional()
  business_key_?: string;

  @IsBoolean()
  @IsOptional()
  deserialize_values_?: boolean;
}

// ==================== 死信作业DTO ====================

/**
 * 死信作业查询DTO
 */
export class DeadLetterJobQueryDto {
  @IsString()
  @IsOptional()
  original_job_id_?: string;

  @IsString()
  @IsOptional()
  type_?: string;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsBoolean()
  @IsOptional()
  processed_?: boolean;

  @IsString()
  @IsOptional()
  tenant_id_?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 20;
}

/**
 * 处理死信作业DTO
 */
export class ProcessDeadLetterJobDto {
  @IsString()
  id_: string;

  @IsString()
  action_: string; // 'RETRY' | 'DELETE' | 'IGNORE'

  @IsString()
  @IsOptional()
  note_?: string;
}

// ==================== 作业统计DTO ====================

/**
 * 作业统计DTO
 */
export class JobStatisticsDto {
  /** 总作业数 */
  total_jobs: number;

  /** 待执行作业数 */
  pending_jobs: number;

  /** 执行中作业数 */
  running_jobs: number;

  /** 已完成作业数 */
  completed_jobs: number;

  /** 失败作业数 */
  failed_jobs: number;

  /** 死信作业数 */
  dead_letter_jobs: number;

  /** 按类型分组统计 */
  by_type: Record<string, number>;

  /** 按优先级分组统计 */
  by_priority: Record<string, number>;

  /** 平均执行时间（毫秒） */
  avg_execution_time: number;
}
