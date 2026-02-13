import { IsNotEmpty } from 'class-validator';

export class UpdateVariablesDto {
  @IsNotEmpty()
  variables: Record<string, any>;
}
