/**
 * 事件订阅模块
 * 提供消息、信号、条件等事件的订阅和触发功能
 */
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EventSubscription } from './entities/event-subscription.entity';
import { EventSubscriptionService } from './services/event-subscription.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventSubscription]),
    EventEmitterModule.forRoot(),
  ],
  providers: [EventSubscriptionService],
  exports: [EventSubscriptionService],
})
export class EventSubscriptionModule {}
