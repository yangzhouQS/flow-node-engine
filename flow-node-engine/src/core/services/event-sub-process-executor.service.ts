import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { EventSubscriptionService, EventSubscriptionType, EventSubscriptionConfigType  } from '../../event-subscription';
import { BpmnElement } from './bpmn-parser.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { VariableScopeService, VariableScope } from './variable-scope.service';

/**
 * 事件子流程执行上下文
 */
export interface EventSubProcessExecutionContext {
  /** 流程实例ID */
  processInstanceId: string;
  /** 执行ID */
  executionId: string;
  /** 事件子流程元素 */
  eventSubProcessElement: BpmnElement;
  /** 变量 */
  variables: Record<string, any>;
  /** 触发事件 */
  triggerEvent?: EventTriggerInfo;
  /** 租户ID */
  tenantId?: string;
}

/**
 * 事件触发信息
 */
export interface EventTriggerInfo {
  /** 事件类型 */
  eventType: EventType;
  /** 事件名称（信号/消息） */
  eventName?: string;
  /** 事件数据 */
  eventData?: any;
  /** 触发时间 */
  timestamp: Date;
}

/**
 * 事件类型
 */
export enum EventType {
  /** 信号事件 */
  SIGNAL = 'signal',
  /** 消息事件 */
  MESSAGE = 'message',
  /** 定时器事件 */
  TIMER = 'timer',
  /** 错误事件 */
  ERROR = 'error',
  /** 升级事件 */
  ESCALATION = 'escalation',
  /** 补偿事件 */
  COMPENSATION = 'compensation',
  /** 条件事件 */
  CONDITIONAL = 'conditional',
}

/**
 * 事件子流程执行结果
 */
export interface EventSubProcessExecutionResult {
  /** 子执行ID */
  executionId: string;
  /** 是否触发 */
  isTriggered: boolean;
  /** 下一个元素ID列表 */
  nextElementIds: string[];
  /** 是否中断主流程 */
  isInterrupting: boolean;
  /** 输出变量 */
  outputVariables?: Record<string, any>;
}

/**
 * 事件订阅信息
 */
export interface EventSubscriptionInfo {
  /** 订阅ID */
  id: string;
  /** 事件类型 */
  eventType: EventType;
  /** 事件名称 */
  eventName: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 子流程元素ID */
  subProcessElementId: string;
  /** 是否中断 */
  isInterrupting: boolean;
  /** 条件表达式 */
  conditionExpression?: string;
}

/**
 * 将 EventType 转换为 EventSubscriptionType
 */
function mapEventTypeToSubscriptionType(eventType: EventType): EventSubscriptionType {
  const mapping: Record<EventType, EventSubscriptionType> = {
    [EventType.SIGNAL]: EventSubscriptionType.SIGNAL,
    [EventType.MESSAGE]: EventSubscriptionType.MESSAGE,
    [EventType.TIMER]: EventSubscriptionType.TIMER,
    [EventType.ERROR]: EventSubscriptionType.ERROR,
    [EventType.ESCALATION]: EventSubscriptionType.ESCALATION,
    [EventType.COMPENSATION]: EventSubscriptionType.COMPENSATION,
    [EventType.CONDITIONAL]: EventSubscriptionType.CONDITIONAL,
  };
  return mapping[eventType];
}

/**
 * 事件子流程执行器服务
 * 负责执行事件子流程，包括事件订阅和触发
 */
@Injectable()
export class EventSubProcessExecutorService {
  private readonly logger = new Logger(EventSubProcessExecutorService.name);

  constructor(
    private readonly expressionEvaluator: ExpressionEvaluatorService,
    private readonly variableScopeService: VariableScopeService,
    private readonly eventSubscriptionService: EventSubscriptionService,
  ) {}

  /**
   * 注册事件子流程
   * 当流程启动时，为事件子流程创建事件订阅
   */
  async registerEventSubProcess(
    context: EventSubProcessExecutionContext,
  ): Promise<EventSubscriptionInfo[]> {
    this.logger.debug(
      `Registering event sub-process: ${context.eventSubProcessElement.id}`,
    );

    const { eventSubProcessElement, processInstanceId, variables, tenantId } = context;
    const subscriptions: EventSubscriptionInfo[] = [];

    // 获取事件子流程中的开始事件
    const startEvents = this.findEventSubProcessStartEvents(eventSubProcessElement);

    for (const startEvent of startEvents) {
      // 获取事件定义
      const eventDefinition = this.getEventDefinition(startEvent);
      if (!eventDefinition) {
        continue;
      }

      // 检查条件
      if (eventDefinition.conditionExpression) {
        try {
          const conditionMet = await this.expressionEvaluator.evaluate(
            eventDefinition.conditionExpression,
            variables,
          );
          if (!conditionMet) {
            this.logger.debug(
              `Condition not met for event sub-process ${eventSubProcessElement.id}`,
            );
            continue;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to evaluate condition for event sub-process: ${error}`,
          );
          continue;
        }
      }

      // 创建事件订阅
      const subscription: EventSubscriptionInfo = {
        id: uuidv4(),
        eventType: eventDefinition.eventType,
        eventName: eventDefinition.eventName,
        processInstanceId,
        subProcessElementId: eventSubProcessElement.id,
        isInterrupting: startEvent.isInterrupting || false,
        conditionExpression: eventDefinition.conditionExpression,
      };

      // 保存订阅
      await this.eventSubscriptionService.createSubscription({
        eventType: mapEventTypeToSubscriptionType(subscription.eventType),
        eventName: subscription.eventName,
        processInstanceId: subscription.processInstanceId,
        activityId: subscription.subProcessElementId,
        configurationType: EventSubscriptionConfigType.EVENT_SUBPROCESS,
        configuration: {
          isInterrupting: subscription.isInterrupting,
          conditionExpression: subscription.conditionExpression,
        },
        tenantId,
      });

      subscriptions.push(subscription);

      this.logger.debug(
        `Created event subscription ${subscription.id} for ${subscription.eventType}:${subscription.eventName}`,
      );
    }

    return subscriptions;
  }

  /**
   * 触发事件子流程
   * 当事件发生时调用
   */
  async triggerEventSubProcess(
    context: EventSubProcessExecutionContext,
  ): Promise<EventSubProcessExecutionResult> {
    this.logger.debug(
      `Triggering event sub-process: ${context.eventSubProcessElement.id}`,
    );

    const { eventSubProcessElement, processInstanceId, executionId, variables, triggerEvent } = context;

    if (!triggerEvent) {
      throw new Error('Trigger event is required');
    }

    // 1. 创建子流程作用域
    const scopeId = await this.variableScopeService.createScope({
      processInstanceId,
      parentScopeId: executionId,
      scopeType: VariableScope.SUBPROCESS,
      elementId: eventSubProcessElement.id,
      name: eventSubProcessElement.name || eventSubProcessElement.id,
    });

    // 2. 复制变量到子流程作用域
    await this.variableScopeService.setVariables(scopeId, variables);

    // 3. 添加事件数据到变量
    if (triggerEvent.eventData) {
      await this.variableScopeService.setVariable(
        scopeId,
        'eventData',
        triggerEvent.eventData,
      );
    }

    // 4. 查找开始事件
    const startEvent = this.findMatchingStartEvent(
      eventSubProcessElement,
      triggerEvent,
    );

    if (!startEvent) {
      throw new Error(
        `No matching start event found for trigger ${triggerEvent.eventType}:${triggerEvent.eventName}`,
      );
    }

    // 5. 创建子执行实例
    const subExecutionId = uuidv4();

    this.logger.debug(
      `Created sub-execution ${subExecutionId} for event sub-process ${eventSubProcessElement.id}`,
    );

    return {
      executionId: subExecutionId,
      isTriggered: true,
      nextElementIds: [startEvent.id],
      isInterrupting: startEvent.isInterrupting || false,
      outputVariables: variables,
    };
  }

  /**
   * 完成事件子流程
   */
  async completeEventSubProcess(
    processInstanceId: string,
    eventSubProcessElement: BpmnElement,
    scopeId: string,
  ): Promise<{ isInterrupting: boolean; outputVariables: Record<string, any> }> {
    this.logger.debug(
      `Completing event sub-process: ${eventSubProcessElement.id}`,
    );

    // 1. 获取子流程作用域的变量
    const outputVariables = await this.variableScopeService.getVariables(scopeId);

    // 2. 销毁子流程作用域
    await this.variableScopeService.destroyScope(scopeId);

    // 3. 获取是否中断标记
    const isInterrupting = this.isInterruptingSubProcess(eventSubProcessElement);

    this.logger.debug(
      `Event sub-process ${eventSubProcessElement.id} completed, isInterrupting: ${isInterrupting}`,
    );

    return { isInterrupting, outputVariables };
  }

  /**
   * 取消事件子流程
   */
  async cancelEventSubProcess(
    processInstanceId: string,
    eventSubProcessElement: BpmnElement,
  ): Promise<void> {
    this.logger.debug(
      `Canceling event sub-process: ${eventSubProcessElement.id}`,
    );

    // 取消相关的事件订阅 - 使用 deleteSubscriptionsByProcessInstance
    // 注意：这会删除该流程实例的所有事件订阅，如果需要更精确的控制，需要在 EventSubscriptionService 中添加新方法
    await this.eventSubscriptionService.deleteSubscriptionsByProcessInstance(
      processInstanceId,
    );
  }

  /**
   * 查找事件子流程中的开始事件
   */
  private findEventSubProcessStartEvents(
    eventSubProcess: BpmnElement,
  ): BpmnElement[] {
    const children = eventSubProcess.children || eventSubProcess.flowElements || [];

    // 查找所有事件类型的开始事件
    const startEvents = children.filter((child: BpmnElement) =>
      child.type.startsWith('bpmn:StartEvent'),
    );

    return startEvents;
  }

  /**
   * 查找匹配的开始事件
   */
  private findMatchingStartEvent(
    eventSubProcess: BpmnElement,
    triggerEvent: EventTriggerInfo,
  ): BpmnElement | null {
    const startEvents = this.findEventSubProcessStartEvents(eventSubProcess);

    for (const startEvent of startEvents) {
      const eventDefinition = this.getEventDefinition(startEvent);
      if (!eventDefinition) {
        continue;
      }

      // 检查事件类型和名称是否匹配
      if (
        eventDefinition.eventType === triggerEvent.eventType &&
        (!eventDefinition.eventName ||
          eventDefinition.eventName === triggerEvent.eventName)
      ) {
        return startEvent;
      }
    }

    return null;
  }

  /**
   * 获取事件定义
   */
  private getEventDefinition(
    startEvent: BpmnElement,
  ): { eventType: EventType; eventName: string; conditionExpression?: string } | null {
    // 检查信号事件
    if (startEvent.signalRef || startEvent.signalEventDefinition) {
      return {
        eventType: EventType.SIGNAL,
        eventName: startEvent.signalRef || startEvent.signalEventDefinition?.signalRef,
      };
    }

    // 检查消息事件
    if (startEvent.messageRef || startEvent.messageEventDefinition) {
      return {
        eventType: EventType.MESSAGE,
        eventName: startEvent.messageRef || startEvent.messageEventDefinition?.messageRef,
      };
    }

    // 检查定时器事件
    if (startEvent.timerEventDefinition) {
      return {
        eventType: EventType.TIMER,
        eventName: startEvent.id,
      };
    }

    // 检查错误事件
    if (startEvent.errorRef || startEvent.errorEventDefinition) {
      return {
        eventType: EventType.ERROR,
        eventName: startEvent.errorRef || startEvent.errorEventDefinition?.errorRef,
      };
    }

    // 检查升级事件
    if (startEvent.escalationRef || startEvent.escalationEventDefinition) {
      return {
        eventType: EventType.ESCALATION,
        eventName: startEvent.escalationRef || startEvent.escalationEventDefinition?.escalationRef,
      };
    }

    // 检查条件事件
    if (startEvent.conditionExpression || startEvent.conditionalEventDefinition) {
      return {
        eventType: EventType.CONDITIONAL,
        eventName: startEvent.id,
        conditionExpression:
          startEvent.conditionExpression ||
          startEvent.conditionalEventDefinition?.condition,
      };
    }

    // 检查补偿事件
    if (startEvent.compensationEventDefinition) {
      return {
        eventType: EventType.COMPENSATION,
        eventName: startEvent.compensationEventDefinition?.activityRef || startEvent.id,
      };
    }

    return null;
  }

  /**
   * 检查是否为中断型事件子流程
   */
  private isInterruptingSubProcess(eventSubProcess: BpmnElement): boolean {
    const startEvents = this.findEventSubProcessStartEvents(eventSubProcess);
    for (const startEvent of startEvents) {
      if (startEvent.isInterrupting === true) {
        return true;
      }
    }
    return false;
  }

  /**
   * 判断元素是否为事件子流程
   */
  isEventSubProcess(element: BpmnElement): boolean {
    return element.type === 'bpmn:SubProcess' && element.triggeredByEvent === true;
  }

  /**
   * 获取事件子流程的事件类型
   */
  getEventSubProcessEventType(
    eventSubProcess: BpmnElement,
  ): EventType | null {
    const startEvents = this.findEventSubProcessStartEvents(eventSubProcess);
    if (startEvents.length === 0) {
      return null;
    }

    const eventDefinition = this.getEventDefinition(startEvents[0]);
    return eventDefinition?.eventType || null;
  }

  /**
   * 验证事件子流程配置
   */
  validateEventSubProcess(
    eventSubProcess: BpmnElement,
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否标记为事件子流程
    if (!eventSubProcess.triggeredByEvent) {
      errors.push(
        `Event sub-process ${eventSubProcess.id} is not marked as triggeredByEvent`,
      );
    }

    // 检查是否有开始事件
    const startEvents = this.findEventSubProcessStartEvents(eventSubProcess);
    if (startEvents.length === 0) {
      errors.push(`Event sub-process ${eventSubProcess.id} has no start event`);
    }

    // 检查开始事件是否有事件定义
    for (const startEvent of startEvents) {
      const eventDefinition = this.getEventDefinition(startEvent);
      if (!eventDefinition) {
        errors.push(
          `Start event ${startEvent.id} in event sub-process ${eventSubProcess.id} has no event definition`,
        );
      }
    }

    // 检查是否有结束事件
    const children = eventSubProcess.children || eventSubProcess.flowElements || [];
    const endEvents = children.filter(
      (child: BpmnElement) => child.type === 'bpmn:EndEvent',
    );
    if (endEvents.length === 0) {
      this.logger.warn(
        `Event sub-process ${eventSubProcess.id} has no end event`,
      );
    }

    // 检查是否有入口流（事件子流程不应该有入口流）
    if (eventSubProcess.incoming && eventSubProcess.incoming.length > 0) {
      errors.push(
        `Event sub-process ${eventSubProcess.id} should not have incoming flows`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
