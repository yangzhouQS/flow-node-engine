import { Injectable, Logger, Optional } from '@nestjs/common';

import { BpmnProcessDefinition, BpmnElement,  } from './bpmn-parser.service';
import { EventBusService } from './event-bus.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { GatewayExecutorService } from './gateway-executor.service';
import { ListenerRegistryService } from './listener-registry.service';
import {
  ExecutionListenerEvent,
  ListenerContext,
} from '../interfaces/listener.interface';

/**
 * 执行上下文
 */
export interface ExecutionContext {
  processInstanceId: string;
  processDefinition: BpmnProcessDefinition;
  processDefinitionKey?: string;
  currentElementId: string;
  variables: Record<string, any>;
  history: ExecutionHistory[];
}

/**
 * 执行历史记录
 */
export interface ExecutionHistory {
  elementId: string;
  elementType: string;
  elementName?: string;
  startTime: Date;
  endTime?: Date;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SUSPENDED' | 'TERMINATED';
  error?: string;
}

/**
 * 流程执行器服务
 * 负责执行流程实例
 */
@Injectable()
export class ProcessExecutorService {
  private readonly logger = new Logger(ProcessExecutorService.name);
  private readonly executions = new Map<string, ExecutionContext>();

  constructor(
    private readonly eventBusService: EventBusService,
    private readonly expressionEvaluator: ExpressionEvaluatorService,
    private readonly gatewayExecutor: GatewayExecutorService,
    @Optional() private readonly listenerRegistryService?: ListenerRegistryService,
  ) {}

  /**
   * 启动流程实例
   * @param processDefinition 流程定义
   * @param businessKey 业务键
   * @param variables 初始变量
   * @returns 执行上下文
   */
  async start(
    processDefinition: BpmnProcessDefinition,
    businessKey: string,
    variables: Record<string, any> = {},
  ): Promise<ExecutionContext> {
    const processInstanceId = this.generateProcessInstanceId();

    this.logger.log(
      `Starting process instance: ${processInstanceId}, businessKey: ${businessKey}`,
    );
    this.eventBusService.emit('process.start', {
      processInstanceId,
      businessKey,
      processDefinition,
      variables,
    });

    // 创建执行上下文
    const context: ExecutionContext = {
      processInstanceId,
      processDefinition,
      currentElementId: '',
      variables: { ...variables, businessKey },
      history: [],
    };

    // 查找开始事件
    const startEvents = processDefinition.startEvents;
    if (startEvents.length === 0) {
      throw new Error('No start event found in process definition');
    }

    // 从第一个开始事件开始执行
    const startEvent = startEvents[0];
    await this.executeElement(context, startEvent);

    // 保存执行上下文
    this.executions.set(processInstanceId, context);

    this.eventBusService.emit('process.started', {
      processInstanceId,
      context,
    });

    return context;
  }

  /**
   * 继续执行流程实例
   * @param processInstanceId 流程实例 ID
   * @param taskId 任务 ID（如果有）
   * @param variables 更新的变量
   * @returns 执行上下文
   */
  async continue(
    processInstanceId: string,
    taskId?: string,
    variables: Record<string, any> = {},
  ): Promise<ExecutionContext> {
    const context = this.executions.get(processInstanceId);
    if (!context) {
      throw new Error(`Process instance not found: ${processInstanceId}`);
    }

    this.logger.log(
      `Continuing process instance: ${processInstanceId}, task: ${taskId}`,
    );
    this.eventBusService.emit('process.continue', {
      processInstanceId,
      taskId,
      variables,
    });

    // 更新变量
    Object.assign(context.variables, variables);

    // 查找当前元素
    const currentElement = this.findElement(
      context.processDefinition,
      context.currentElementId,
    );

    if (!currentElement) {
      throw new Error(
        `Current element not found: ${context.currentElementId}`,
      );
    }

    // 执行下一个元素
    await this.executeNext(context, currentElement);

    // 保存执行上下文
    this.executions.set(processInstanceId, context);

    this.eventBusService.emit('process.continued', {
      processInstanceId,
      context,
    });

    return context;
  }

  /**
   * 挂起流程实例
   * @param processInstanceId 流程实例 ID
   */
  async suspend(processInstanceId: string): Promise<void> {
    const context = this.executions.get(processInstanceId);
    if (!context) {
      throw new Error(`Process instance not found: ${processInstanceId}`);
    }

    this.logger.log(`Suspending process instance: ${processInstanceId}`);
    this.eventBusService.emit('process.suspend', {
      processInstanceId,
      context,
    });

    // 标记当前正在执行的元素为挂起状态
    const currentHistory = context.history.find(
      (h) => h.elementId === context.currentElementId && h.status === 'RUNNING',
    );
    if (currentHistory) {
      currentHistory.status = 'SUSPENDED';
    }

    this.eventBusService.emit('process.suspended', {
      processInstanceId,
      context,
    });
  }

  /**
   * 恢复流程实例
   * @param processInstanceId 流程实例 ID
   */
  async resume(processInstanceId: string): Promise<void> {
    const context = this.executions.get(processInstanceId);
    if (!context) {
      throw new Error(`Process instance not found: ${processInstanceId}`);
    }

    this.logger.log(`Resuming process instance: ${processInstanceId}`);
    this.eventBusService.emit('process.resume', {
      processInstanceId,
      context,
    });

    // 查找挂起的元素
    const suspendedHistory = context.history.find(
      (h) => h.status === 'SUSPENDED',
    );
    if (!suspendedHistory) {
      throw new Error('No suspended element found');
    }

    // 恢复执行
    suspendedHistory.status = 'RUNNING';
    context.currentElementId = suspendedHistory.elementId;

    await this.continue(processInstanceId);

    this.eventBusService.emit('process.resumed', {
      processInstanceId,
      context,
    });
  }

  /**
   * 终止流程实例
   * @param processInstanceId 流程实例 ID
   * @param reason 终止原因
   */
  async terminate(processInstanceId: string, reason?: string): Promise<void> {
    const context = this.executions.get(processInstanceId);
    if (!context) {
      throw new Error(`Process instance not found: ${processInstanceId}`);
    }

    this.logger.log(
      `Terminating process instance: ${processInstanceId}, reason: ${reason}`,
    );
    this.eventBusService.emit('process.terminate', {
      processInstanceId,
      reason,
      context,
    });

    // 标记当前正在执行的元素为终止状态
    const currentHistory = context.history.find(
      (h) => h.elementId === context.currentElementId && h.status === 'RUNNING',
    );
    if (currentHistory) {
      currentHistory.status = 'TERMINATED';
      currentHistory.endTime = new Date();
      currentHistory.error = reason || 'Process terminated';
    }

    // 移除执行上下文
    this.executions.delete(processInstanceId);

    this.eventBusService.emit('process.terminated', {
      processInstanceId,
      reason,
      context,
    });
  }

  /**
   * 获取执行上下文
   * @param processInstanceId 流程实例 ID
   * @returns 执行上下文
   */
  getExecutionContext(processInstanceId: string): ExecutionContext | undefined {
    return this.executions.get(processInstanceId);
  }

  /**
   * 执行元素
   * @param context 执行上下文
   * @param element 要执行的元素
   */
  private async executeElement(
    context: ExecutionContext,
    element: BpmnElement,
  ): Promise<void> {
    this.logger.debug(
      `Executing element: ${element.id} (${element.type})`,
    );
    this.eventBusService.emit('element.execute.start', {
      processInstanceId: context.processInstanceId,
      element,
      context,
    });

    // 添加到执行历史
    const history: ExecutionHistory = {
      elementId: element.id,
      elementType: element.type,
      elementName: element.name,
      startTime: new Date(),
      status: 'RUNNING',
    };
    context.history.push(history);
    context.currentElementId = element.id;

    try {
      // 调度START事件监听器
      await this.dispatchListeners(context, element, ExecutionListenerEvent.START);

      // 根据元素类型执行不同的逻辑
      switch (element.type) {
        case 'bpmn:StartEvent':
          await this.executeStartEvent(context, element);
          break;
        case 'bpmn:UserTask':
          await this.executeUserTask(context, element);
          break;
        case 'bpmn:ServiceTask':
          await this.executeServiceTask(context, element);
          break;
        case 'bpmn:EndEvent':
          await this.executeEndEvent(context, element);
          break;
        default:
          // 网关等其他元素在 executeNext 中处理
          await this.executeNext(context, element);
          break;
      }

      // 调度END事件监听器
      await this.dispatchListeners(context, element, ExecutionListenerEvent.END);

      // 更新历史记录
      history.status = 'COMPLETED';
      history.endTime = new Date();

      this.eventBusService.emit('element.execute.end', {
        processInstanceId: context.processInstanceId,
        element,
        context,
      });
    } catch (error) {
      history.status = 'FAILED';
      history.endTime = new Date();
      history.error = error.message;

      this.logger.error(
        `Failed to execute element: ${element.id}`,
        error.stack,
      );
      this.eventBusService.emit('element.execute.error', {
        processInstanceId: context.processInstanceId,
        element,
        error: error.message,
        context,
      });

      throw error;
    }
  }

  /**
   * 执行开始事件
   * @param context 执行上下文
   * @param element 开始事件元素
   */
  private async executeStartEvent(
    context: ExecutionContext,
    element: BpmnElement,
  ): Promise<void> {
    this.logger.debug(`Executing start event: ${element.id}`);
    await this.executeNext(context, element);
  }

  /**
   * 执行用户任务
   * @param context 执行上下文
   * @param element 用户任务元素
   */
  private async executeUserTask(
    context: ExecutionContext,
    element: BpmnElement,
  ): Promise<void> {
    this.logger.debug(`Executing user task: ${element.id}`);
    // 用户任务需要等待用户操作，不自动执行下一步
    // 发布任务创建事件
    this.eventBusService.emit('task.created', {
      processInstanceId: context.processInstanceId,
      taskId: element.id,
      taskName: element.name,
      context,
    });
  }

  /**
   * 执行服务任务
   * @param context 执行上下文
   * @param element 服务任务元素
   */
  private async executeServiceTask(
    context: ExecutionContext,
    element: BpmnElement,
  ): Promise<void> {
    this.logger.debug(`Executing service task: ${element.id}`);
    // 执行服务任务逻辑
    // 这里可以根据配置执行不同的服务
    await this.executeNext(context, element);
  }

  /**
   * 执行结束事件
   * @param context 执行上下文
   * @param element 结束事件元素
   */
  private async executeEndEvent(
    context: ExecutionContext,
    element: BpmnElement,
  ): Promise<void> {
    this.logger.debug(`Executing end event: ${element.id}`);
    this.eventBusService.emit('process.end', {
      processInstanceId: context.processInstanceId,
      context,
    });
    // 移除执行上下文
    this.executions.delete(context.processInstanceId);
  }

  /**
   * 执行下一个元素
   * @param context 执行上下文
   * @param currentElement 当前元素
   */
  private async executeNext(
    context: ExecutionContext,
    currentElement: BpmnElement,
  ): Promise<void> {
    // 查找从当前元素出发的序列流
    const outgoingFlows = context.processDefinition.sequenceFlows.filter(
      (flow) => flow.sourceRef === currentElement.id,
    );

    if (outgoingFlows.length === 0) {
      this.logger.debug(
        `No outgoing flows from element: ${currentElement.id}`,
      );
      return;
    }

    // 如果是网关，使用网关执行器
    if (currentElement.type.includes('Gateway')) {
      const result = await this.gatewayExecutor.execute(
        currentElement,
        outgoingFlows,
        context.variables,
      );
      // 处理所有下一个元素ID
      for (const nextElementId of result.nextElementIds) {
        const nextElement = this.findElement(
          context.processDefinition,
          nextElementId,
        );
        if (nextElement) {
          await this.executeElement(context, nextElement);
        }
      }
      return;
    }

    // 如果只有一个输出流，直接执行
    if (outgoingFlows.length === 1) {
      const nextElement = this.findElement(
        context.processDefinition,
        outgoingFlows[0].targetRef,
      );
      if (nextElement) {
        await this.executeElement(context, nextElement);
      }
      return;
    }

    // 如果有多个输出流，使用第一个
    const nextElement = this.findElement(
      context.processDefinition,
      outgoingFlows[0].targetRef,
    );
    if (nextElement) {
      await this.executeElement(context, nextElement);
    }
  }

  /**
   * 查找元素
   * @param processDefinition 流程定义
   * @param elementId 元素 ID
   * @returns 元素
   */
  private findElement(
    processDefinition: BpmnProcessDefinition,
    elementId: string,
  ): BpmnElement | undefined {
    const allElements = [
      ...processDefinition.startEvents,
      ...processDefinition.userTasks,
      ...processDefinition.serviceTasks,
      ...processDefinition.gateways,
      ...processDefinition.endEvents,
    ];

    return allElements.find((el) => el.id === elementId);
  }

  /**
   * 生成流程实例 ID
   * @returns 流程实例 ID
   */
  private generateProcessInstanceId(): string {
    return `pi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 调度执行监听器
   * @param context 执行上下文
   * @param element 当前元素
   * @param event 事件类型
   */
  private async dispatchListeners(
    context: ExecutionContext,
    element: BpmnElement,
    event: ExecutionListenerEvent,
  ): Promise<void> {
    if (!this.listenerRegistryService) {
      return;
    }

    const listenerContext: ListenerContext = {
      processInstanceId: context.processInstanceId,
      executionId: context.processInstanceId, // 简化处理，使用流程实例ID
      processDefinitionKey: context.processDefinitionKey,
      activityId: element.id,
      activityName: element.name,
      event,
      timestamp: new Date(),
      variables: context.variables,
    };

    const result = await this.listenerRegistryService.dispatchExecutionListeners(
      listenerContext,
      context.processDefinitionKey,
      element.id,
    );

    // 应用监听器修改的变量
    if (result.modifiedVariables && Object.keys(result.modifiedVariables).length > 0) {
      Object.assign(context.variables, result.modifiedVariables);
    }

    // 处理终止请求
    if (result.shouldTerminate) {
      await this.terminate(context.processInstanceId, 'Listener requested termination');
    }

    // 处理BPMN错误
    if (result.bpmnError) {
      throw new Error(`BPMN Error: ${result.bpmnError.errorCode} - ${result.bpmnError.errorMessage || ''}`);
    }
  }
}
