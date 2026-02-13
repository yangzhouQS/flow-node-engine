import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateFormDto {
  @IsString()
  @IsNotEmpty()
  formKey: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  version?: number;

  @IsNotEmpty()
  formDefinition: Record<string, any>;

  @IsString()
  @IsOptional()
  deploymentId?: string;

  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  resourceName?: string;

  @IsOptional()
  isSystem?: boolean;
}
