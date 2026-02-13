import { IsString, IsOptional, IsObject, IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 表单验证请求DTO
 */
export class ValidateFormDto {
  @ApiPropertyOptional({ description: '表单ID' })
  @IsOptional()
  @IsUUID()
  formId?: string;

  @ApiPropertyOptional({ description: '表单键' })
  @IsOptional()
  @IsString()
  formKey?: string;

  @ApiProperty({ description: '表单数据' })
  @IsObject()
  @IsNotEmpty()
  data: Record<string, any>;

  @ApiPropertyOptional({ description: '上下文变量（流程变量等）' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @ApiPropertyOptional({ description: '租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

/**
 * 单字段验证请求DTO
 */
export class ValidateSingleFieldDto {
  @ApiProperty({ description: '表单ID' })
  @IsUUID()
  @IsNotEmpty()
  formId: string;

  @ApiProperty({ description: '字段ID' })
  @IsString()
  @IsNotEmpty()
  fieldId: string;

  @ApiProperty({ description: '字段值' })
  value: any;

  @ApiPropertyOptional({ description: '完整表单数据' })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({ description: '上下文变量' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}

/**
 * 验证错误响应DTO
 */
export class ValidationErrorDto {
  @ApiProperty({ description: '字段ID' })
  fieldId: string;

  @ApiProperty({ description: '字段名称' })
  fieldName: string;

  @ApiProperty({ description: '错误消息' })
  message: string;

  @ApiProperty({ description: '规则类型' })
  ruleType: string;
}

/**
 * 验证结果响应DTO
 */
export class ValidationResultDto {
  @ApiProperty({ description: '是否验证通过' })
  valid: boolean;

  @ApiProperty({ description: '验证错误列表', type: [ValidationErrorDto] })
  errors: ValidationErrorDto[];
}

/**
 * JSON Schema导出响应DTO
 */
export class JsonSchemaDto {
  @ApiProperty({ description: 'JSON Schema定义' })
  schema: Record<string, any>;
}
