/**
 * 作业模块
 * 提供作业管理、定时器作业、外部工作者作业、死信作业等功能
 */
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JobController } from './controllers/job.controller';
import { DeadLetterJob } from './entities/dead-letter-job.entity';
import { ExternalWorkerJob } from './entities/external-worker-job.entity';
import { Job } from './entities/job.entity';
import { TimerJob } from './entities/timer-job.entity';
import { AsyncExecutorService } from './services/async-executor.service';
import { JobService } from './services/job.service';
import { TimerService } from './services/timer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, DeadLetterJob, TimerJob, ExternalWorkerJob]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  controllers: [JobController],
  providers: [JobService, TimerService, AsyncExecutorService],
  exports: [JobService, TimerService, AsyncExecutorService],
})
export class JobModule {}
