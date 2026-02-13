import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CoreModule } from '../core/core.module';

import { EventController } from './controllers/event.controller';
import { Event } from './entities/event.entity';
import { EventPublishService } from './services/event-publish.service';
import { EventSubscriptionService } from './services/event-subscription.service';


@Module({
  imports: [
    TypeOrmModule.forFeature([Event]),
    ScheduleModule.forRoot(),
    CoreModule,
  ],
  controllers: [EventController],
  providers: [EventSubscriptionService, EventPublishService],
  exports: [EventSubscriptionService, EventPublishService],
})
export class EventModule {}
