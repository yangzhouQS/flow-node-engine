import { IsString, IsOptional } from 'class-validator';

export class UpdateProcessInstanceDto {
  @IsString()
  @IsOptional()
  businessKey?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsOptional()
  variables?: Record<string, any>;
}
