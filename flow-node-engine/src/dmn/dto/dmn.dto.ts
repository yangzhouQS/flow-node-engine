import { IsString, IsOptional, IsEnum, IsObject, IsInt, Min, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HitPolicy, AggregationType, DmnDecisionStatus } from '../entities/dmn-decision.entity';

/**
 * 决策表输入定义DTO
 */
export class DecisionInputDto {
  @ApiProperty({ description: '输入ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: '输入标签' })
  @IsString()
  label: string;

  @ApiProperty({ description: '输入表达式' })
  @IsString()
  expression: string;

  @ApiPropertyOptional({ description: '输入类型' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '是否必填' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

/**
 * 决策表输出定义DTO
 */
export class DecisionOutputDto {
  @ApiProperty({ description: '输出ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: '输出标签' })
  @IsString()
  label: string;

  @ApiProperty({ description: '输出名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '输出类型' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: '默认值' })
  @IsOptional()
  defaultValue?: any;
}

/**
 * 决策规则条件DTO
 */
export class RuleConditionDto {
  @ApiProperty({ description: '输入ID' })
  @IsString()
  inputId: string;

  @ApiProperty({ description: '操作符', example: '==, !=, >, <, >=, <=, in, not in, between' })
  @IsString()
  operator: string;

  @ApiProperty({ description: '条件值' })
  value: any;
}

/**
 * 决策规则输出DTO
 */
export class RuleOutputDto {
  @ApiProperty({ description: '输出ID' })
  @IsString()
  outputId: string;

  @ApiProperty({ description: '输出值' })
  value: any;
}

/**
 * 决策规则DTO
 */
export class DecisionRuleDto {
  @ApiPropertyOptional({ description: '规则ID' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: '规则条件列表' })
  @IsArray()
  conditions: RuleConditionDto[];

  @ApiProperty({ description: '规则输出列表' })
  @IsArray()
  outputs: RuleOutputDto[];

  @ApiPropertyOptional({ description: '规则描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '规则优先级' })
  @IsOptional()
  @IsInt()
  priority?: number;
}

/**
 * 创建决策DTO
 */
export class CreateDecisionDto {
  @ApiProperty({ description: '决策Key' })
  @IsString()
  decisionKey: string;

  @ApiPropertyOptional({ description: '决策名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '分类' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ description: 'Hit Policy', enum: HitPolicy })
  @IsEnum(HitPolicy)
  hitPolicy: HitPolicy;

  @ApiPropertyOptional({ description: '聚合类型', enum: AggregationType })
  @IsOptional()
  @IsEnum(AggregationType)
  aggregation?: AggregationType;

  @ApiProperty({ description: '输入定义列表' })
  @IsArray()
  inputs: DecisionInputDto[];

  @ApiProperty({ description: '输出定义列表' })
  @IsArray()
  outputs: DecisionOutputDto[];

  @ApiProperty({ description: '规则列表' })
  @IsArray()
  rules: DecisionRuleDto[];

  @ApiPropertyOptional({ description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: '扩展属性' })
  @IsOptional()
  @IsObject()
  extra?: Record<string, any>;
}

/**
 * 更新决策DTO
 */
export class UpdateDecisionDto {
  @ApiPropertyOptional({ description: '决策名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '分类' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Hit Policy', enum: HitPolicy })
  @IsOptional()
  @IsEnum(HitPolicy)
  hitPolicy?: HitPolicy;

  @ApiPropertyOptional({ description: '聚合类型', enum: AggregationType })
  @IsOptional()
  @IsEnum(AggregationType)
  aggregation?: AggregationType;

  @ApiPropertyOptional({ description: '输入定义列表' })
  @IsOptional()
  @IsArray()
  inputs?: DecisionInputDto[];

  @ApiPropertyOptional({ description: '输出定义列表' })
  @IsOptional()
  @IsArray()
  outputs?: DecisionOutputDto[];

  @ApiPropertyOptional({ description: '规则列表' })
  @IsOptional()
  @IsArray()
  rules?: DecisionRuleDto[];

  @ApiPropertyOptional({ description: '扩展属性' })
  @IsOptional()
  @IsObject()
  extra?: Record<string, any>;
}

/**
 * 执行决策DTO
 */
export class ExecuteDecisionDto {
  @ApiPropertyOptional({ description: '决策ID' })
  @IsOptional()
  @IsString()
  decisionId?: string;

  @ApiPropertyOptional({ description: '决策Key' })
  @IsOptional()
  @IsString()
  decisionKey?: string;

  @ApiPropertyOptional({ description: '决策版本' })
  @IsOptional()
  @IsInt()
  version?: number;

  @ApiProperty({ description: '输入数据' })
  @IsObject()
  inputData: Record<string, any>;

  @ApiPropertyOptional({ description: '流程实例ID' })
  @IsOptional()
  @IsString()
  processInstanceId?: string;

  @ApiPropertyOptional({ description: '执行ID' })
  @IsOptional()
  @IsString()
  executionId?: string;

  @ApiPropertyOptional({ description: '活动ID' })
  @IsOptional()
  @IsString()
  activityId?: string;

  @ApiPropertyOptional({ description: '任务ID' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiPropertyOptional({ description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

/**
 * 决策查询DTO
 */
export class QueryDecisionDto {
  @ApiPropertyOptional({ description: '决策ID' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional({ description: '决策Key' })
  @IsOptional()
  @IsString()
  decisionKey?: string;

  @ApiPropertyOptional({ description: '决策名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '状态', enum: DmnDecisionStatus })
  @IsOptional()
  @IsEnum(DmnDecisionStatus)
  status?: DmnDecisionStatus;

  @ApiPropertyOptional({ description: '分类' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: '版本' })
  @IsOptional()
  @IsInt()
  version?: number;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number;
}

/**
 * 决策响应DTO
 */
export class DecisionResponseDto {
  @ApiProperty({ description: '决策ID' })
  id: string;

  @ApiProperty({ description: '决策Key' })
  decisionKey: string;

  @ApiPropertyOptional({ description: '决策名称' })
  name?: string;

  @ApiProperty({ description: '版本' })
  version: number;

  @ApiProperty({ description: '状态' })
  status: string;

  @ApiPropertyOptional({ description: '描述' })
  description?: string;

  @ApiPropertyOptional({ description: '分类' })
  category?: string;

  @ApiProperty({ description: 'Hit Policy' })
  hitPolicy: string;

  @ApiPropertyOptional({ description: '聚合类型' })
  aggregation?: string;

  @ApiProperty({ description: '输入定义' })
  inputs: DecisionInputDto[];

  @ApiProperty({ description: '输出定义' })
  outputs: DecisionOutputDto[];

  @ApiProperty({ description: '规则数量' })
  ruleCount: number;

  @ApiPropertyOptional({ description: '租户ID' })
  tenantId?: string;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiPropertyOptional({ description: '发布时间' })
  publishTime?: Date;
}

/**
 * 决策执行结果DTO
 */
export class DecisionResultDto {
  @ApiProperty({ description: '执行ID' })
  executionId: string;

  @ApiProperty({ description: '决策ID' })
  decisionId: string;

  @ApiProperty({ description: '决策Key' })
  decisionKey: string;

  @ApiProperty({ description: '决策版本' })
  decisionVersion: number;

  @ApiProperty({ description: '执行状态' })
  status: string;

  @ApiPropertyOptional({ description: '输出结果' })
  outputResult?: Record<string, any> | Record<string, any>[];

  @ApiPropertyOptional({ description: '匹配的规则ID列表' })
  matchedRules?: string[];

  @ApiProperty({ description: '匹配的规则数量' })
  matchedCount: number;

  @ApiProperty({ description: '执行时间（毫秒）' })
  executionTimeMs: number;

  @ApiPropertyOptional({ description: '错误信息' })
  errorMessage?: string;
}

/**
 * 决策执行历史响应DTO
 */
export class ExecutionHistoryDto {
  @ApiProperty({ description: '执行ID' })
  id: string;

  @ApiProperty({ description: '决策ID' })
  decisionId: string;

  @ApiProperty({ description: '决策Key' })
  decisionKey: string;

  @ApiProperty({ description: '决策版本' })
  decisionVersion: number;

  @ApiProperty({ description: '执行状态' })
  status: string;

  @ApiPropertyOptional({ description: '输入数据' })
  inputData?: Record<string, any>;

  @ApiPropertyOptional({ description: '输出结果' })
  outputResult?: Record<string, any> | Record<string, any>[];

  @ApiPropertyOptional({ description: '匹配的规则数量' })
  matchedCount?: number;

  @ApiPropertyOptional({ description: '执行时间（毫秒）' })
  executionTimeMs?: number;

  @ApiPropertyOptional({ description: '流程实例ID' })
  processInstanceId?: string;

  @ApiPropertyOptional({ description: '活动ID' })
  activityId?: string;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;
}
