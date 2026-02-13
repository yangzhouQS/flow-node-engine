/**
 * 通知模块
 * 提供多渠道通知发送功能
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InAppNotification } from './entities/in-app-notification.entity';
import { InAppNotificationService } from './services/in-app-notification.service';
import { NotificationService } from './services/notification.service';
import { NotificationController } from './controllers/notification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([InAppNotification]),
  ],
  controllers: [NotificationController],
  providers: [
    InAppNotificationService,
    NotificationService,
  ],
  exports: [
    InAppNotificationService,
    NotificationService,
  ],
})
export class NotificationModule {}
