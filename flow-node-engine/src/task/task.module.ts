import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HistoryModule } from '../history/history.module';
import { IdentityLinkModule } from '../identity-link/identity-link.module';

import { CCController } from './controllers/cc.controller';
import { TaskRejectController } from './controllers/task-reject.controller';
import { TaskController } from './controllers/task.controller';
import { CcConfigEntity } from './entities/cc-config.entity';
import { CcRecordEntity } from './entities/cc-record.entity';
import { MultiInstanceConfigEntity } from './entities/multi-instance-config.entity';
import { RejectConfigEntity } from './entities/reject-config.entity';
import { TaskCandidateGroupEntity } from './entities/task-candidate-group.entity';
import { TaskCandidateUserEntity } from './entities/task-candidate-user.entity';
import { TaskRejectEntity } from './entities/task-reject.entity';
import { Task } from './entities/task.entity';
import { CcService } from './services/cc.service';
import { MultiInstanceRejectService } from './services/multi-instance-reject.service';
import { TaskListenerService } from './services/task-listener.service';
import { TaskRejectService } from './services/task-reject.service';
import { TaskService } from './services/task.service';


/**
 * 任务模块
 * 包含任务管理、驳回、抄送等功能
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskCandidateUserEntity,
      TaskCandidateGroupEntity,
      TaskRejectEntity,
      RejectConfigEntity,
      CcRecordEntity,
      CcConfigEntity,
      MultiInstanceConfigEntity,
    ]),
    IdentityLinkModule,
    HistoryModule,
  ],
  controllers: [
    TaskController,
    TaskRejectController,
    CCController,
  ],
  providers: [
    TaskService,
    TaskRejectService,
    CcService,
    TaskListenerService,
    MultiInstanceRejectService,
  ],
  exports: [
    TaskService,
    TaskRejectService,
    CcService,
    TaskListenerService,
    MultiInstanceRejectService,
  ],
})
export class TaskModule {}
