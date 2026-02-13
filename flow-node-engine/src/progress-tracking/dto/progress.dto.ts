/**
 * 进度追踪DTO定义
 */
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsNumber, IsBoolean, IsDate, IsObject, Min, Max } from 'class-validator';

import { MetricType, MetricCategory } from '../entities/progress-metric.entity';
import { ProgressStatus, ProgressType } from '../entities/progress.entity';

/**
 * 创建进度DTO
 */
export class CreateProgressDto {
  @IsString()
  id_: string;

  @IsEnum(ProgressType)
  @IsOptional()
  type_?: string;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  task_id_?: string;

  @IsString()
  @IsOptional()
  process_def_id_?: string;

  @IsString()
  @IsOptional()
  task_def_key_?: string;

  @IsString()
  @IsOptional()
  name_?: string;

  @IsString()
  @IsOptional()
  description_?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  total_steps_?: number;

  @IsNumber()
  @IsOptional()
  estimated_duration_?: number;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  estimated_end_time_?: Date;

  @IsObject()
  @IsOptional()
  extra_data_?: Record<string, any>;

  @IsString()
  @IsOptional()
  tenant_id_?: string;
}

/**
 * 更新进度DTO
 */
export class UpdateProgressDto {
  @IsEnum(ProgressStatus)
  @IsOptional()
  status_?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  percentage_?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  completed_steps_?: number;

  @IsString()
  @IsOptional()
  current_step_name_?: string;

  @IsString()
  @IsOptional()
  current_step_description_?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  end_time_?: Date;

  @IsBoolean()
  @IsOptional()
  is_warning_?: boolean;

  @IsString()
  @IsOptional()
  warning_message_?: string;

  @IsBoolean()
  @IsOptional()
  is_timeout_?: boolean;

  @IsObject()
  @IsOptional()
  extra_data_?: Record<string, any>;
}

/**
 * 进度查询DTO
 */
export class ProgressQueryDto {
  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  task_id_?: string;

  @IsString()
  @IsOptional()
  process_def_id_?: string;

  @IsEnum(ProgressType)
  @IsOptional()
  type_?: string;

  @IsEnum(ProgressStatus)
  @IsOptional()
  status_?: string;

  @IsBoolean()
  @IsOptional()
  is_warning_?: boolean;

  @IsBoolean()
  @IsOptional()
  is_timeout_?: boolean;

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
 * 进度统计查询DTO
 */
export class ProgressStatisticsQueryDto {
  @IsString()
  @IsOptional()
  process_def_key_?: string;

  @IsString()
  @IsOptional()
  process_def_id_?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  start_time?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  end_time?: Date;

  @IsString()
  @IsOptional()
  tenant_id_?: string;
}

/**
 * 进度统计结果DTO
 */
export class ProgressStatisticsDto {
  /** 总流程实例数 */
  total_instances: number;

  /** 进行中实例数 */
  in_progress_instances: number;

  /** 已完成实例数 */
  completed_instances: number;

  /** 已取消实例数 */
  cancelled_instances: number;

  /** 预警实例数 */
  warning_instances: number;

  /** 超时实例数 */
  timeout_instances: number;

  /** 平均完成百分比 */
  avg_percentage: number;

  /** 平均持续时间（毫秒） */
  avg_duration: number;

  /** 按状态分组统计 */
  by_status: Record<string, number>;

  /** 按流程定义分组统计 */
  by_process_def: Record<string, number>;
}

/**
 * 创建进度指标DTO
 */
export class CreateProgressMetricDto {
  @IsString()
  id_: string;

  @IsString()
  name_: string;

  @IsString()
  @IsOptional()
  description_?: string;

  @IsEnum(MetricType)
  @IsOptional()
  type_?: string;

  @IsEnum(MetricCategory)
  @IsOptional()
  category_?: string;

  @IsNumber()
  value_: number;

  @IsString()
  @IsOptional()
  unit_?: string;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  task_id_?: string;

  @IsString()
  @IsOptional()
  process_def_key_?: string;

  @IsString()
  @IsOptional()
  progress_id_?: string;

  @IsObject()
  @IsOptional()
  labels_?: Record<string, string>;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  collect_time_?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  expire_time_?: Date;

  @IsString()
  @IsOptional()
  tenant_id_?: string;
}

/**
 * 进度指标查询DTO
 */
export class ProgressMetricQueryDto {
  @IsString()
  @IsOptional()
  name_?: string;

  @IsEnum(MetricCategory)
  @IsOptional()
  category_?: string;

  @IsString()
  @IsOptional()
  process_inst_id_?: string;

  @IsString()
  @IsOptional()
  process_def_key_?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  start_time?: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  end_time?: Date;

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
 * 进度看板数据DTO
 */
export class ProgressDashboardDto {
  /** 时间范围 */
  time_range: {
    start: Date;
    end: Date;
  };

  /** 概览统计 */
  overview: {
    total: number;
    in_progress: number;
    completed: number;
    warning: number;
    timeout: number;
  };

  /** 趋势数据 */
  trend: {
    time: string;
    total: number;
    completed: number;
  }[];

  /** 按流程定义分布 */
  by_process_def: {
    process_def_key: string;
    process_def_name: string;
    count: number;
    percentage: number;
  }[];

  /** 预警列表 */
  warnings: {
    id: string;
    process_inst_id: string;
    name: string;
    warning_message: string;
    warning_time: Date;
  }[];

  /** 超时列表 */
  timeouts: {
    id: string;
    process_inst_id: string;
    name: string;
    timeout_time: Date;
  }[];
}
