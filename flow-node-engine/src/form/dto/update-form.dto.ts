import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class UpdateFormDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  version?: number;

  @IsOptional()
  formDefinition?: Record<string, any>;

  @IsString()
  @IsOptional()
  deploymentId?: string;

  @IsString()
  @IsOptional()
  resourceName?: string;

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
