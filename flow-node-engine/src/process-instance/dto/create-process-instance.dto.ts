import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateProcessInstanceDto {
  @IsString()
  @IsNotEmpty()
  processDefinitionId: string;

  @IsString()
  @IsOptional()
  businessKey?: string;

  @IsString()
  @IsOptional()
  startUserId?: string;

  @IsOptional()
  variables?: Record<string, any>;

  @IsString()
  @IsOptional()
  tenantId?: string;
}
