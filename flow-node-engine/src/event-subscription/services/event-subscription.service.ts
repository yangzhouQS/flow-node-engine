import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import {
  EventSubscription,
  EventSubscriptionType,
  EventSubscriptionConfigType,
} from '../entities/event-subscription.entity';

/**
 * 创建事件订阅选项
 */
export interface CreateEventSubscriptionOptions {
  /** 事件类型 */
  eventType: EventSubscriptionType;
  /** 事件名称 */
  eventName: string;
  /** 流程定义ID */
  processDefinitionId?: string;
  /** 流程定义Key */
  processDefinitionKey?: string;
  /** 流程实例ID */
  processInstanceId?: string;
  /** 执行ID */
  executionId?: string;
  /** 活动ID */
  activityId?: string;
  /** 活动名称 */
  activityName?: string;
  /** 配置类型 */
  configurationType?: EventSubscriptionConfigType;
  /** 配置数据 */
  configuration?: Record<string, any>;
  /** 租户ID */
  tenantId?: string;
  /** 回调ID */
  callbackId?: string;
  /** 优先级 */
  priority?: number;
  /** 扩展数据 */
  extraData?: Record<string, any>;
}

/**
 * 事件触发结果
 */
export interface EventTriggerResult {
  /** 触发的订阅数量 */
  triggeredCount: number;
  /** 触发的订阅列表 */
  subscriptions: EventSubscription[];
}

/**
 * 事件订阅事件
 */
export interface EventSubscriptionEvent {
  type: 'created' | 'triggered' | 'deleted';
  subscription: EventSubscription;
  payload?: Record<string, any>;
  timestamp: Date;
}

/**
 * 事件订阅服务
 * 负责事件订阅的创建、查询、触发和删除
 */
@Injectable()
export class EventSubscriptionService {
  private readonly logger = new Logger(EventSubscriptionService.name);

  constructor(
    @InjectRepository(EventSubscription)
    private readonly subscriptionRepository: Repository<EventSubscription>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 创建事件订阅
   * @param options 订阅选项
   */
  async createSubscription(
    options: CreateEventSubscriptionOptions,
  ): Promise<EventSubscription> {
    const subscription = new EventSubscription();
    subscription.id_ = uuidv4();
    subscription.event_type_ = options.eventType;
    subscription.event_name_ = options.eventName;
    subscription.process_def_id_ = options.processDefinitionId || null;
    subscription.process_def_key_ = options.processDefinitionKey || null;
    subscription.process_inst_id_ = options.processInstanceId || null;
    subscription.execution_id_ = options.executionId || null;
    subscription.activity_id_ = options.activityId || null;
    subscription.activity_name_ = options.activityName || null;
    subscription.configuration_type_ = options.configurationType || null;
    subscription.configuration_ = options.configuration
      ? JSON.stringify(options.configuration)
      : null;
    subscription.tenant_id_ = options.tenantId || null;
    subscription.callback_id_ = options.callbackId || null;
    subscription.priority_ = options.priority || 0;
    subscription.extra_data_ = options.extraData
      ? JSON.stringify(options.extraData)
      : null;
    subscription.is_processed_ = false;
    subscription.processed_time_ = null;
    subscription.create_time_ = new Date();

    const savedSubscription = await this.subscriptionRepository.save(subscription);

    // 发送订阅创建事件
    await this.emitEvent('created', savedSubscription);

    this.logger.debug(
      `创建事件订阅: ${savedSubscription.id_}, 类型: ${savedSubscription.event_type_}, 名称: ${savedSubscription.event_name_}`,
    );

    return savedSubscription;
  }

  /**
   * 删除事件订阅
   * @param subscriptionId 订阅ID
   */
  async deleteSubscription(subscriptionId: string): Promise<boolean> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id_: subscriptionId },
    });

    if (!subscription) {
      return false;
    }

    await this.subscriptionRepository.remove(subscription);

    // 发送订阅删除事件
    await this.emitEvent('deleted', subscription);

    this.logger.debug(`删除事件订阅: ${subscriptionId}`);
    return true;
  }

  /**
   * 删除流程实例的所有事件订阅
   * @param processInstanceId 流程实例ID
   */
  async deleteSubscriptionsByProcessInstance(
    processInstanceId: string,
  ): Promise<number> {
    const result = await this.subscriptionRepository.delete({
      process_inst_id_: processInstanceId,
    });

    const count = result.affected || 0;
    this.logger.debug(
      `删除流程实例 ${processInstanceId} 的 ${count} 个事件订阅`,
    );
    return count;
  }

  /**
   * 删除执行的所有事件订阅
   * @param executionId 执行ID
   */
  async deleteSubscriptionsByExecution(executionId: string): Promise<number> {
    const result = await this.subscriptionRepository.delete({
      execution_id_: executionId,
    });

    const count = result.affected || 0;
    this.logger.debug(`删除执行 ${executionId} 的 ${count} 个事件订阅`);
    return count;
  }

  /**
   * 获取事件订阅
   * @param subscriptionId 订阅ID
   */
  async getSubscription(subscriptionId: string): Promise<EventSubscription | null> {
    return this.subscriptionRepository.findOne({
      where: { id_: subscriptionId },
    });
  }

  /**
   * 获取流程实例的事件订阅
   * @param processInstanceId 流程实例ID
   */
  async getSubscriptionsByProcessInstance(
    processInstanceId: string,
  ): Promise<EventSubscription[]> {
    return this.subscriptionRepository.find({
      where: { process_inst_id_: processInstanceId },
      order: { create_time_: 'ASC' },
    });
  }

  /**
   * 根据事件类型和名称获取订阅
   * @param eventType 事件类型
   * @param eventName 事件名称
   */
  async getSubscriptionsByEvent(
    eventType: EventSubscriptionType,
    eventName: string,
  ): Promise<EventSubscription[]> {
    return this.subscriptionRepository.find({
      where: {
        event_type_: eventType,
        event_name_: eventName,
        is_processed_: false,
      },
      order: { priority_: 'DESC', create_time_: 'ASC' },
    });
  }

  /**
   * 获取消息事件订阅
   * @param messageName 消息名称
   * @param processInstanceId 可选的流程实例ID
   */
  async getMessageEventSubscriptions(
    messageName: string,
    processInstanceId?: string,
  ): Promise<EventSubscription[]> {
    const query = this.subscriptionRepository
      .createQueryBuilder('sub')
      .where('sub.event_type_ = :eventType', { eventType: EventSubscriptionType.MESSAGE })
      .andWhere('sub.event_name_ = :eventName', { eventName: messageName })
      .andWhere('sub.is_processed_ = :isProcessed', { isProcessed: false });

    if (processInstanceId) {
      query.andWhere('sub.process_inst_id_ = :processInstanceId', { processInstanceId });
    }

    query.orderBy('sub.priority_', 'DESC').addOrderBy('sub.create_time_', 'ASC');

    return query.getMany();
  }

  /**
   * 获取信号事件订阅
   * @param signalName 信号名称
   */
  async getSignalEventSubscriptions(signalName: string): Promise<EventSubscription[]> {
    return this.subscriptionRepository.find({
      where: {
        event_type_: EventSubscriptionType.SIGNAL,
        event_name_: signalName,
        is_processed_: false,
      },
      order: { priority_: 'DESC', create_time_: 'ASC' },
    });
  }

  /**
   * 触发消息事件
   * @param messageName 消息名称
   * @param payload 消息载荷
   * @param processInstanceId 可选的流程实例ID
   */
  async triggerMessageEvent(
    messageName: string,
    payload?: Record<string, any>,
    processInstanceId?: string,
  ): Promise<EventTriggerResult> {
    this.logger.debug(
      `触发消息事件: ${messageName}, 流程实例: ${processInstanceId || '全局'}`,
    );

    const subscriptions = await this.getMessageEventSubscriptions(
      messageName,
      processInstanceId,
    );

    const triggeredSubscriptions: EventSubscription[] = [];

    for (const subscription of subscriptions) {
      try {
        await this.triggerSubscription(subscription, payload);
        triggeredSubscriptions.push(subscription);
      } catch (error) {
        this.logger.error(
          `触发消息订阅 ${subscription.id_} 失败:`,
          error,
        );
      }
    }

    return {
      triggeredCount: triggeredSubscriptions.length,
      subscriptions: triggeredSubscriptions,
    };
  }

  /**
   * 触发信号事件
   * @param signalName 信号名称
   * @param payload 信号载荷
   * @param tenantId 可选的租户ID
   */
  async triggerSignalEvent(
    signalName: string,
    payload?: Record<string, any>,
    tenantId?: string,
  ): Promise<EventTriggerResult> {
    this.logger.debug(`触发信号事件: ${signalName}`);

    let subscriptions = await this.getSignalEventSubscriptions(signalName);

    // 按租户过滤
    if (tenantId) {
      subscriptions = subscriptions.filter(
        (sub) => !sub.tenant_id_ || sub.tenant_id_ === tenantId,
      );
    }

    const triggeredSubscriptions: EventSubscription[] = [];

    for (const subscription of subscriptions) {
      try {
        await this.triggerSubscription(subscription, payload);
        triggeredSubscriptions.push(subscription);
      } catch (error) {
        this.logger.error(
          `触发信号订阅 ${subscription.id_} 失败:`,
          error,
        );
      }
    }

    return {
      triggeredCount: triggeredSubscriptions.length,
      subscriptions: triggeredSubscriptions,
    };
  }

  /**
   * 触发单个订阅
   * @param subscription 订阅
   * @param payload 载荷
   */
  async triggerSubscription(
    subscription: EventSubscription,
    payload?: Record<string, any>,
  ): Promise<void> {
    // 标记为已处理
    subscription.is_processed_ = true;
    subscription.processed_time_ = new Date();
    await this.subscriptionRepository.save(subscription);

    // 发送触发事件
    await this.emitEvent('triggered', subscription, payload);

    this.logger.debug(
      `触发订阅: ${subscription.id_}, 类型: ${subscription.event_type_}`,
    );

    // 发送内部事件供其他服务处理
    await this.eventEmitter.emit(`eventSubscription.triggered`, {
      subscription,
      payload,
      timestamp: new Date(),
    });
  }

  /**
   * 检查是否存在消息事件订阅
   * @param messageName 消息名称
   * @param processInstanceId 可选的流程实例ID
   */
  async hasMessageEventSubscription(
    messageName: string,
    processInstanceId?: string,
  ): Promise<boolean> {
    const count = await this.subscriptionRepository.count({
      where: {
        event_type_: EventSubscriptionType.MESSAGE,
        event_name_: messageName,
        process_inst_id_: processInstanceId || undefined,
        is_processed_: false,
      },
    });

    return count > 0;
  }

  /**
   * 检查是否存在信号事件订阅
   * @param signalName 信号名称
   */
  async hasSignalEventSubscription(signalName: string): Promise<boolean> {
    const count = await this.subscriptionRepository.count({
      where: {
        event_type_: EventSubscriptionType.SIGNAL,
        event_name_: signalName,
        is_processed_: false,
      },
    });

    return count > 0;
  }

  /**
   * 获取所有未处理的事件订阅
   * @param limit 限制数量
   */
  async getPendingSubscriptions(limit = 100): Promise<EventSubscription[]> {
    return this.subscriptionRepository.find({
      where: { is_processed_: false },
      take: limit,
      order: { create_time_: 'ASC' },
    });
  }

  /**
   * 获取事件订阅统计信息
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    processed: number;
    byType: Record<EventSubscriptionType, number>;
  }> {
    const [total, pending, processed] = await Promise.all([
      this.subscriptionRepository.count(),
      this.subscriptionRepository.count({ where: { is_processed_: false } }),
      this.subscriptionRepository.count({ where: { is_processed_: true } }),
    ]);

    // 按类型统计
    const byType: Record<EventSubscriptionType, number> = {
      [EventSubscriptionType.MESSAGE]: 0,
      [EventSubscriptionType.SIGNAL]: 0,
      [EventSubscriptionType.CONDITIONAL]: 0,
      [EventSubscriptionType.COMPENSATION]: 0,
      [EventSubscriptionType.ERROR]: 0,
      [EventSubscriptionType.TIMER]: 0,
      [EventSubscriptionType.ESCALATION]: 0,
    };

    const typeCounts = await this.subscriptionRepository
      .createQueryBuilder('sub')
      .select('sub.event_type_', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sub.event_type_')
      .getRawMany();

    for (const item of typeCounts) {
      byType[item.type as EventSubscriptionType] = parseInt(item.count, 10);
    }

    return { total, pending, processed, byType };
  }

  /**
   * 清理已处理的订阅
   * @param daysOld 保留天数
   */
  async cleanupProcessedSubscriptions(daysOld = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await this.subscriptionRepository
      .createQueryBuilder()
      .delete()
      .where('is_processed_ = :isProcessed', { isProcessed: true })
      .andWhere('processed_time_ < :cutoff', { cutoff: cutoffDate })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`清理了 ${result.affected} 个已处理的事件订阅`);
    }

    return result.affected || 0;
  }

  /**
   * 发送事件订阅事件
   */
  private async emitEvent(
    type: 'created' | 'triggered' | 'deleted',
    subscription: EventSubscription,
    payload?: Record<string, any>,
  ): Promise<void> {
    const event: EventSubscriptionEvent = {
      type,
      subscription,
      payload,
      timestamp: new Date(),
    };

    await this.eventEmitter.emit(`eventSubscription.${type}`, event);
  }
}
