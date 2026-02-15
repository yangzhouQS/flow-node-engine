/**
 * 迁移模块
 * 提供流程实例迁移功能
 */

import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessMigrationService } from './services/process-migration.service';
import { MigrationValidatorService } from './services/migration-validator.service';
import { MigrationExecutorService } from './services/migration-executor.service';
import { CoreModule } from '../core/core.module';
import { EventModule } from '../event/event.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([]), CoreModule, EventModule],
  providers: [ProcessMigrationService, MigrationValidatorService, MigrationExecutorService],
  exports: [ProcessMigrationService, MigrationValidatorService, MigrationExecutorService],
})
export class MigrationModule {}
