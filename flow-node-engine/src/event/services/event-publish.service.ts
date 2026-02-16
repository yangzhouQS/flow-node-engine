import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

import { EventBusService } from '../../core/services/event-bus.service';
import { Event } from '../entities/event.entity';

enum EventStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

@Injectable()
export class EventPublishService {
  private readonly logger = new Logger(EventPublishService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly eventBusService: EventBusService,
  ) {}

  /**
   * 定时任务：每10秒处理一次待发布的事件
   */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async processPendingEvents(): Promise<void> {
    try {
      const pendingEvents = await this.eventRepository.find({
        where: { eventStatus: EventStatus.PENDING },
        order: { createTime: 'ASC' },
        take: 100,
      });

      if (pendingEvents.length === 0) {
        return;
      }

      this.logger.log(`Processing ${pendingEvents.length} pending events`);

      for (const event of pendingEvents) {
        await this.publishEvent(event);
      }
    } catch (error) {
      this.logger.error(`Failed to process pending events: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 定时任务：每分钟重试失败的事件
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async retryFailedEvents(): Promise<void> {
    try {
      const failedEvents = await this.eventRepository.find({
        where: { eventStatus: EventStatus.FAILED },
        order: { updateTime: 'ASC' },
        take: 50,
      });

      if (failedEvents.length === 0) {
        return;
      }

      this.logger.log(`Retrying ${failedEvents.length} failed events`);

      for (const event of failedEvents) {
        if (event.retryCount < event.maxRetries) {
          await this.retryEvent(event);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to retry failed events: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 定时任务：每天清理已处理的旧事件
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldEvents(): Promise<void> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldEvents = await this.eventRepository.find({
        where: {
          eventStatus: EventStatus.PROCESSED,
          processedTime: LessThan(thirtyDaysAgo),
        },
        take: 1000,
      });

      if (oldEvents.length === 0) {
        return;
      }

      this.logger.log(`Cleaning up ${oldEvents.length} old processed events`);

      for (const event of oldEvents) {
        await this.eventRepository.remove(event);
      }

      this.logger.log(`Cleaned up ${oldEvents.length} old processed events`);
    } catch (error) {
      this.logger.error(`Failed to cleanup old events: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 发布单个事件
   */
  async publishEvent(event: Event): Promise<void> {
    try {
      // 根据事件类型发布到事件总线
      const topic = this.getEventTopic(event);
      await this.eventBusService.publish(topic, event.eventData);

      // 更新事件状态为已发布
      event.eventStatus = EventStatus.PUBLISHED;
      await this.eventRepository.save(event);

      this.logger.log(`Event published successfully: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${event.id}: ${(error as Error).message}`, (error as Error).stack);

      // 更新事件状态为失败
      event.eventStatus = EventStatus.FAILED;
      event.retryCount += 1;
      event.errorMessage = (error as Error).message;
      await this.eventRepository.save(event);
    }
  }

  /**
   * 重试失败的事件
   */
  async retryEvent(event: Event): Promise<void> {
    try {
      // 重置事件状态为待发布
      event.eventStatus = EventStatus.PENDING;
      event.retryCount += 1;
      event.errorMessage = null;
      await this.eventRepository.save(event);

      this.logger.log(`Event ${event.id} marked for retry (attempt ${event.retryCount})`);
    } catch (error) {
      this.logger.error(`Failed to retry event ${event.id}: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 标记事件为已处理
   */
  async markEventAsProcessed(eventId: string): Promise<Event> {
    try {
      const event = await this.eventRepository.findOne({ where: { id: eventId } });
      if (!event) {
        throw new Error(`Event with ID ${eventId} not found`);
      }

      event.eventStatus = EventStatus.PROCESSED;
      event.processedTime = new Date();
      return await this.eventRepository.save(event);
    } catch (error) {
      this.logger.error(`Failed to mark event ${eventId} as processed: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * 批量标记事件为已处理
   */
  async markEventsAsProcessed(eventIds: string[]): Promise<void> {
    for (const eventId of eventIds) {
      await this.markEventAsProcessed(eventId);
    }
  }

  /**
   * 根据事件类型获取事件总线主题
   */
  private getEventTopic(event: Event): string {
    const eventType = event.eventType;
    
    switch (eventType) {
      case 'PROCESS_INSTANCE_START':
        return 'process.instance.start';
      case 'PROCESS_INSTANCE_END':
        return 'process.instance.end';
      case 'PROCESS_INSTANCE_SUSPEND':
        return 'process.instance.suspend';
      case 'PROCESS_INSTANCE_ACTIVATE':
        return 'process.instance.activate';
      case 'TASK_CREATED':
        return 'task.created';
      case 'TASK_ASSIGNED':
        return 'task.assigned';
      case 'TASK_COMPLETED':
        return 'task.completed';
      case 'TASK_CANCELLED':
        return 'task.cancelled';
      case 'ACTIVITY_STARTED':
        return 'activity.started';
      case 'ACTIVITY_COMPLETED':
        return 'activity.completed';
      case 'VARIABLE_CREATED':
        return 'variable.created';
      case 'VARIABLE_UPDATED':
        return 'variable.updated';
      case 'VARIABLE_DELETED':
        return 'variable.deleted';
      case 'SIGNAL_THROWN':
        return 'signal.thrown';
      case 'SIGNAL_RECEIVED':
        return 'signal.received';
      case 'MESSAGE_SENT':
        return 'message.sent';
      case 'MESSAGE_RECEIVED':
        return 'message.received';
      case 'ERROR_THROWN':
        return 'error.thrown';
      case 'ERROR_RECEIVED':
        return 'error.received';
      case 'TIMER_FIRED':
        return 'timer.fired';
      case 'COMPENSATION_TRIGGERED':
        return 'compensation.triggered';
      case 'CUSTOM':
        return `custom.${event.eventCode}`;
      default:
        return 'event.unknown';
    }
  }

  /**
   * 获取待发布事件统计
   */
  async getPendingEventCount(): Promise<number> {
    return this.eventRepository.count({ where: { eventStatus: EventStatus.PENDING } });
  }

  /**
   * 获取失败事件统计
   */
  async getFailedEventCount(): Promise<number> {
    return this.eventRepository.count({ where: { eventStatus: EventStatus.FAILED } });
  }

  /**
   * 获取已处理事件统计
   */
  async getProcessedEventCount(): Promise<number> {
    return this.eventRepository.count({ where: { eventStatus: EventStatus.PROCESSED } });
  }

  /**
   * 获取事件统计信息
   */
  async getEventStatistics(): Promise<{
    pending: number;
    published: number;
    processed: number;
    failed: number;
    total: number;
  }> {
    const [pending, published, processed, failed] = await Promise.all([
      this.eventRepository.count({ where: { eventStatus: EventStatus.PENDING } }),
      this.eventRepository.count({ where: { eventStatus: EventStatus.PUBLISHED } }),
      this.eventRepository.count({ where: { eventStatus: EventStatus.PROCESSED } }),
      this.eventRepository.count({ where: { eventStatus: EventStatus.FAILED } }),
    ]);

    return {
      pending,
      published,
      processed,
      failed,
      total: pending + published + processed + failed,
    };
  }
}
