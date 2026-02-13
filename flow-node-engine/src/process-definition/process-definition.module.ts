import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProcessDefinitionController } from './controllers/process-definition.controller';
import { Deployment } from './entities/deployment.entity';
import { ProcessDefinition } from './entities/process-definition.entity';
import { ProcessDefinitionService } from './services/process-definition.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProcessDefinition, Deployment]),
  ],
  controllers: [ProcessDefinitionController],
  providers: [ProcessDefinitionService],
  exports: [ProcessDefinitionService],
})
export class ProcessDefinitionModule {}
