import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProcessInstanceController } from './controllers/process-instance.controller';
import { Execution } from './entities/execution.entity';
import { ProcessInstance } from './entities/process-instance.entity';
import { Variable } from './entities/variable.entity';
import { ExecutionService } from './services/execution.service';
import { ProcessInstanceService } from './services/process-instance.service';
import { VariableService } from './services/variable.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcessInstance,
      Execution,
      Variable,
    ]),
  ],
  controllers: [ProcessInstanceController],
  providers: [
    ProcessInstanceService,
    ExecutionService,
    VariableService,
  ],
  exports: [
    ProcessInstanceService,
    ExecutionService,
    VariableService,
  ],
})
export class ProcessInstanceModule {}
