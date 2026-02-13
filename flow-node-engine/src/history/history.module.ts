import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HistoryController } from './controllers/history.controller';
import { HistoricActivityInstance } from './entities/historic-activity-instance.entity';
import { HistoricProcessInstance } from './entities/historic-process-instance.entity';
import { HistoricTaskInstance } from './entities/historic-task-instance.entity';
import { HistoricVariableInstanceEntity } from './entities/historic-variable-instance.entity';
import { HistoricVariableInstanceService } from './services/historic-variable-instance.service';
import { HistoryService } from './services/history.service';

/**
 * 历史模块
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      HistoricActivityInstance,
      HistoricTaskInstance,
      HistoricProcessInstance,
      HistoricVariableInstanceEntity,
    ]),
  ],
  controllers: [HistoryController],
  providers: [HistoryService, HistoricVariableInstanceService],
  exports: [HistoryService, HistoricVariableInstanceService],
})
export class HistoryModule {}
