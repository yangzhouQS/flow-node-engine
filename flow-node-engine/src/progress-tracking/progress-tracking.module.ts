/**
 * 进度追踪模块
 * 提供进度追踪、统计、预警、实时推送等功能
 */
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

// 实体
import { ProgressController } from './controllers/progress.controller';
import { ProgressMetric } from './entities/progress-metric.entity';
import { Progress } from './entities/progress.entity';

// 服务
import { ProgressGateway } from './gateways/progress.gateway';
import { ProgressTrackingService } from './services/progress-tracking.service';

// 控制器

// 网关

@Module({
  imports: [
    TypeOrmModule.forFeature([Progress, ProgressMetric]),
    ScheduleModule,
    EventEmitterModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressTrackingService, ProgressGateway],
  exports: [ProgressTrackingService, ProgressGateway],
})
export class ProgressTrackingModule {}
