import { Injectable, NotFoundException , Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { EventBusService } from '../../core/services/event-bus.service';
import { Event } from '../entities/event.entity';

enum EventType {
  PROCESS_INSTANCE_START = 'PROCESS_INSTANCE_START',
  PROCESS_INSTANCE_END = 'PROCESS_INSTANCE_END',
  PROCESS_INSTANCE_SUSPEND = 'PROCESS_INSTANCE_SUSPEND',
  PROCESS_INSTANCE_ACTIVATE = 'PROCESS_INSTANCE_ACTIVATE',
  TASK_CREATED = 'TASK_CREATED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_CANCELLED = 'TASK_CANCELLED',
  ACTIVITY_STARTED = 'ACTIVITY_STARTED',
  ACTIVITY_COMPLETED = 'ACTIVITY_COMPLETED',
  VARIABLE_CREATED = 'VARIABLE_CREATED',
  VARIABLE_UPDATED = 'VARIABLE_UPDATED',
  VARIABLE_DELETED = 'VARIABLE_DELETED',
  SIGNAL_THROWN = 'SIGNAL_THROWN',
  SIGNAL_RECEIVED = 'SIGNAL_RECEIVED',
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  ERROR_THROWN = 'ERROR_THROWN',
  ERROR_RECEIVED = 'ERROR_RECEIVED',
  TIMER_FIRED = 'TIMER_FIRED',
  COMPENSATION_TRIGGERED = 'COMPENSATION_TRIGGERED',
  CUSTOM = 'CUSTOM',
}

enum EventStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}


@Injectable()
export class EventSubscriptionService {
  private readonly logger = new Logger(EventSubscriptionService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly eventBusService: EventBusService,
  ) {
    this.initializeEventListeners();
  }

  /**
   * 初始化事件监听器
   */
  private initializeEventListeners(): void {
    // 订阅流程实例相关事件
    this.eventBusService.subscribe('process.instance.start', this.handleProcessInstanceStart.bind(this));
    this.eventBusService.subscribe('process.instance.end', this.handleProcessInstanceEnd.bind(this));
    this.eventBusService.subscribe('process.instance.suspend', this.handleProcessInstanceSuspend.bind(this));
    this.eventBusService.subscribe('process.instance.activate', this.handleProcessInstanceActivate.bind(this));

    // 订阅任务相关事件
    this.eventBusService.subscribe('task.created', this.handleTaskCreated.bind(this));
    this.eventBusService.subscribe('task.assigned', this.handleTaskAssigned.bind(this));
    this.eventBusService.subscribe('task.completed', this.handleTaskCompleted.bind(this));
    this.eventBusService.subscribe('task.cancelled', this.handleTaskCancelled.bind(this));

    // 订阅活动相关事件
    this.eventBusService.subscribe('activity.started', this.handleActivityStarted.bind(this));
    this.eventBusService.subscribe('activity.completed', this.handleActivityCompleted.bind(this));

    // 订阅变量相关事件
    this.eventBusService.subscribe('variable.created', this.handleVariableCreated.bind(this));
    this.eventBusService.subscribe('variable.updated', this.handleVariableUpdated.bind(this));
    this.eventBusService.subscribe('variable.deleted', this.handleVariableDeleted.bind(this));

    // 订阅信号相关事件
    this.eventBusService.subscribe('signal.thrown', this.handleSignalThrown.bind(this));
    this.eventBusService.subscribe('signal.received', this.handleSignalReceived.bind(this));

    // 订阅消息相关事件
    this.eventBusService.subscribe('message.sent', this.handleMessageSent.bind(this));
    this.eventBusService.subscribe('message.received', this.handleMessageReceived.bind(this));

    // 订阅错误相关事件
    this.eventBusService.subscribe('error.thrown', this.handleErrorThrown.bind(this));
    this.eventBusService.subscribe('error.received', this.handleErrorReceived.bind(this));

    // 订阅定时器相关事件
    this.eventBusService.subscribe('timer.fired', this.handleTimerFired.bind(this));

    // 订阅补偿相关事件
    this.eventBusService.subscribe('compensation.triggered', this.handleCompensationTriggered.bind(this));

    // 订阅自定义事件
    this.eventBusService.subscribe('custom.event', this.handleCustomEvent.bind(this));

    this.logger.log('Event listeners initialized successfully');
  }

  /**
   * 处理流程实例启动事件
   */
  private async handleProcessInstanceStart(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.PROCESS_INSTANCE_START,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        processDefinitionId: data.processDefinitionId,
        processDefinitionKey: data.processDefinitionKey,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Process instance start event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle process instance start event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理流程实例结束事件
   */
  private async handleProcessInstanceEnd(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.PROCESS_INSTANCE_END,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        processDefinitionId: data.processDefinitionId,
        processDefinitionKey: data.processDefinitionKey,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Process instance end event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle process instance end event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理流程实例暂停事件
   */
  private async handleProcessInstanceSuspend(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.PROCESS_INSTANCE_SUSPEND,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        processDefinitionId: data.processDefinitionId,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Process instance suspend event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle process instance suspend event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理流程实例激活事件
   */
  private async handleProcessInstanceActivate(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.PROCESS_INSTANCE_ACTIVATE,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        processDefinitionId: data.processDefinitionId,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Process instance activate event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle process instance activate event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理任务创建事件
   */
  private async handleTaskCreated(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.TASK_CREATED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        taskId: data.taskId,
        taskName: data.taskName,
        assignee: data.assignee,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Task created event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle task created event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理任务分配事件
   */
  private async handleTaskAssigned(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.TASK_ASSIGNED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        taskId: data.taskId,
        taskName: data.taskName,
        assignee: data.assignee,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Task assigned event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle task assigned event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理任务完成事件
   */
  private async handleTaskCompleted(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.TASK_COMPLETED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        taskId: data.taskId,
        taskName: data.taskName,
        assignee: data.assignee,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Task completed event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle task completed event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理任务取消事件
   */
  private async handleTaskCancelled(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.TASK_CANCELLED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        taskId: data.taskId,
        taskName: data.taskName,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Task cancelled event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle task cancelled event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理活动启动事件
   */
  private async handleActivityStarted(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.ACTIVITY_STARTED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        executionId: data.executionId,
        activityId: data.activityId,
        activityName: data.activityName,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Activity started event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle activity started event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理活动完成事件
   */
  private async handleActivityCompleted(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.ACTIVITY_COMPLETED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        executionId: data.executionId,
        activityId: data.activityId,
        activityName: data.activityName,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Activity completed event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle activity completed event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理变量创建事件
   */
  private async handleVariableCreated(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.VARIABLE_CREATED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        executionId: data.executionId,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Variable created event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle variable created event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理变量更新事件
   */
  private async handleVariableUpdated(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.VARIABLE_UPDATED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        executionId: data.executionId,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Variable updated event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle variable updated event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理变量删除事件
   */
  private async handleVariableDeleted(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.VARIABLE_DELETED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        executionId: data.executionId,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Variable deleted event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle variable deleted event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理信号抛出事件
   */
  private async handleSignalThrown(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.SIGNAL_THROWN,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        eventName: data.signalName,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Signal thrown event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle signal thrown event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理信号接收事件
   */
  private async handleSignalReceived(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.SIGNAL_RECEIVED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        eventName: data.signalName,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Signal received event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle signal received event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理消息发送事件
   */
  private async handleMessageSent(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.MESSAGE_SENT,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        eventName: data.messageName,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Message sent event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle message sent event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理消息接收事件
   */
  private async handleMessageReceived(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.MESSAGE_RECEIVED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        eventName: data.messageName,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Message received event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle message received event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理错误抛出事件
   */
  private async handleErrorThrown(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.ERROR_THROWN,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        eventName: data.errorCode,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Error thrown event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle error thrown event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理错误接收事件
   */
  private async handleErrorReceived(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.ERROR_RECEIVED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        eventName: data.errorCode,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Error received event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle error received event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理定时器触发事件
   */
  private async handleTimerFired(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.TIMER_FIRED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        executionId: data.executionId,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Timer fired event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle timer fired event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理补偿触发事件
   */
  private async handleCompensationTriggered(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.COMPENSATION_TRIGGERED,
        eventStatus: EventStatus.PENDING,
        processInstanceId: data.processInstanceId,
        executionId: data.executionId,
        activityId: data.activityId,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Compensation triggered event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle compensation triggered event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 处理自定义事件
   */
  private async handleCustomEvent(data: any): Promise<void> {
    try {
      const event = this.eventRepository.create({
        eventType: EventType.CUSTOM,
        eventStatus: EventStatus.PENDING,
        eventName: data.eventName,
        eventCode: data.eventCode,
        processInstanceId: data.processInstanceId,
        eventData: data,
      });
      await this.eventRepository.save(event);
      this.logger.log(`Custom event created: ${event.id}`);
    } catch (error) {
      this.logger.error(`Failed to handle custom event: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * 查询事件
   */
  async findById(id: string): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { id } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }

  /**
   * 根据流程实例ID查询事件
   */
  async findByProcessInstanceId(processInstanceId: string): Promise<Event[]> {
    return this.eventRepository.find({
      where: { processInstanceId },
      order: { createTime: 'DESC' },
    });
  }

  /**
   * 根据任务ID查询事件
   */
  async findByTaskId(taskId: string): Promise<Event[]> {
    return this.eventRepository.find({
      where: { taskId },
      order: { createTime: 'DESC' },
    });
  }

  /**
   * 根据事件类型查询事件
   */
  async findByEventType(eventType: EventType): Promise<Event[]> {
    return this.eventRepository.find({
      where: { eventType },
      order: { createTime: 'DESC' },
    });
  }

  /**
   * 根据事件状态查询事件
   */
  async findByEventStatus(eventStatus: EventStatus): Promise<Event[]> {
    return this.eventRepository.find({
      where: { eventStatus },
      order: { createTime: 'DESC' },
    });
  }

  /**
   * 查询所有事件（分页）
   */
  async findAll(page = 1, pageSize = 10): Promise<{ events: Event[]; total: number }> {
    const [events, total] = await this.eventRepository.findAndCount({
      order: { createTime: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { events, total };
  }

  /**
   * 更新事件状态
   */
  async updateEventStatus(id: string, status: EventStatus, errorMessage?: string): Promise<Event> {
    const event = await this.findById(id);
    event.eventStatus = status;
    if (errorMessage) {
      event.errorMessage = errorMessage;
    }
    if (status === EventStatus.PROCESSED) {
      event.processedTime = new Date();
    }
    return this.eventRepository.save(event);
  }

  /**
   * 重试失败的事件
   */
  async retryFailedEvent(id: string): Promise<Event> {
    const event = await this.findById(id);
    if (event.eventStatus !== EventStatus.FAILED) {
      throw new Error(`Event with ID ${id} is not in FAILED status`);
    }
    if (event.retryCount >= event.maxRetries) {
      throw new Error(`Event with ID ${id} has reached maximum retry count`);
    }
    event.eventStatus = EventStatus.PENDING;
    event.retryCount += 1;
    event.errorMessage = null;
    return this.eventRepository.save(event);
  }

  /**
   * 删除事件
   */
  async delete(id: string): Promise<void> {
    const event = await this.findById(id);
    await this.eventRepository.remove(event);
  }

  /**
   * 批量删除事件
   */
  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  /**
   * 统计事件数量
   */
  async count(): Promise<number> {
    return this.eventRepository.count();
  }

  /**
   * 根据状态统计事件数量
   */
  async countByStatus(eventStatus: EventStatus): Promise<number> {
    return this.eventRepository.count({ where: { eventStatus } });
  }
}
