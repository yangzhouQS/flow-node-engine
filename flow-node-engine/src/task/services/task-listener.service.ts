import { Injectable, Logger } from '@nestjs/common';

import { EventBusService } from '../../core/services/event-bus.service';

/**
 * 任务监听器类型
 */
export enum TaskListenerType {
  /** 任务创建 */
  CREATE = 'create',
  /** 任务分配 */
  ASSIGNMENT = 'assignment',
  /** 任务认领 */
  CLAIM = 'claim',
  /** 任务完成 */
  COMPLETE = 'complete',
  /** 任务删除 */
  DELETE = 'delete',
  /** 任务更新 */
  UPDATE = 'update',
  /** 任务超时 */
  TIMEOUT = 'timeout',
}

/**
 * 任务监听器上下文
 */
export interface TaskListenerContext {
  /** 任务ID */
  taskId: string;
  /** 任务定义Key */
  taskDefinitionKey: string;
  /** 任务名称 */
  taskName?: string;
  /** 流程实例ID */
  processInstanceId: string;
  /** 流程定义ID */
  processDefinitionId: string;
  /** 执行ID */
  executionId?: string;
  /** 受让人 */
  assignee?: string;
  /** 候选用户列表 */
  candidateUsers?: string[];
  /** 候选组列表 */
  candidateGroups?: string[];
  /** 任务变量 */
  variables?: Record<string, any>;
  /** 事件类型 */
  eventType: TaskListenerType;
  /** 事件时间 */
  eventTime: Date;
  /** 操作人ID */
  operatorId?: string;
  /** 租户ID */
  tenantId?: string;
  /** 扩展数据 */
  extraData?: Record<string, any>;
}

/**
 * 任务监听器接口
 */
export interface TaskListener {
  /** 监听器名称 */
  name: string;
  /** 监听器类型 */
  type: TaskListenerType | TaskListenerType[];
  /** 是否启用 */
  enabled: boolean;
  /** 执行顺序（数字越小越先执行） */
  order: number;
  /** 处理函数 */
  handle: (context: TaskListenerContext) => Promise<void> | void;
}

/**
 * 任务监听器配置
 */
export interface TaskListenerConfig {
  /** 流程定义ID */
  processDefinitionId: string;
  /** 任务定义Key */
  taskDefinitionKey: string;
  /** 监听器类型 */
  listenerType: TaskListenerType;
  /** 监听器类名或表达式 */
  listenerValue: string;
  /** 监听器类型：class/expression/delegate */
  valueType: 'class' | 'expression' | 'delegate';
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 任务监听器注册表
 */
interface ListenerRegistryEntry {
  listener: TaskListener;
  processDefinitionId?: string;
  taskDefinitionKey?: string;
}

/**
 * 任务监听器服务
 * 负责管理和执行任务相关的监听器
 */
@Injectable()
export class TaskListenerService {
  private readonly logger = new Logger(TaskListenerService.name);
  
  /** 监听器注册表 */
  private listenerRegistry: ListenerRegistryEntry[] = [];

  /** 监听器配置缓存 */
  private configCache: Map<string, TaskListenerConfig[]> = new Map();

  constructor(
    private readonly eventBus: EventBusService,
  ) {
    // 订阅任务事件
    this.subscribeToTaskEvents();
  }

  /**
   * 订阅任务事件
   */
  private subscribeToTaskEvents(): void {
    // 任务创建事件
    this.eventBus.on('task.created', async (data) => {
      await this.executeListeners({
        ...data,
        eventType: TaskListenerType.CREATE,
        eventTime: new Date(),
      });
    });

    // 任务分配事件
    this.eventBus.on('task.assigned', async (data) => {
      await this.executeListeners({
        ...data,
        eventType: TaskListenerType.ASSIGNMENT,
        eventTime: new Date(),
      });
    });

    // 任务认领事件
    this.eventBus.on('task.claimed', async (data) => {
      await this.executeListeners({
        ...data,
        eventType: TaskListenerType.CLAIM,
        eventTime: new Date(),
      });
    });

    // 任务完成事件
    this.eventBus.on('task.completed', async (data) => {
      await this.executeListeners({
        ...data,
        eventType: TaskListenerType.COMPLETE,
        eventTime: new Date(),
      });
    });

    // 任务删除事件
    this.eventBus.on('task.deleted', async (data) => {
      await this.executeListeners({
        ...data,
        eventType: TaskListenerType.DELETE,
        eventTime: new Date(),
      });
    });

    // 任务更新事件
    this.eventBus.on('task.updated', async (data) => {
      await this.executeListeners({
        ...data,
        eventType: TaskListenerType.UPDATE,
        eventTime: new Date(),
      });
    });

    // 任务超时事件
    this.eventBus.on('task.timeout', async (data) => {
      await this.executeListeners({
        ...data,
        eventType: TaskListenerType.TIMEOUT,
        eventTime: new Date(),
      });
    });
  }

  /**
   * 注册监听器
   * @param listener 监听器实例
   * @param processDefinitionId 流程定义ID（可选，不指定则全局生效）
   * @param taskDefinitionKey 任务定义Key（可选，不指定则对所有任务生效）
   */
  registerListener(
    listener: TaskListener,
    processDefinitionId?: string,
    taskDefinitionKey?: string,
  ): void {
    this.listenerRegistry.push({
      listener,
      processDefinitionId,
      taskDefinitionKey,
    });
    
    this.logger.log(
      `Registered task listener: ${listener.name} for ` +
      `process: ${processDefinitionId || 'all'}, task: ${taskDefinitionKey || 'all'}`
    );
  }

  /**
   * 注销监听器
   * @param listenerName 监听器名称
   */
  unregisterListener(listenerName: string): boolean {
    const index = this.listenerRegistry.findIndex(
      entry => entry.listener.name === listenerName
    );
    
    if (index !== -1) {
      this.listenerRegistry.splice(index, 1);
      this.logger.log(`Unregistered task listener: ${listenerName}`);
      return true;
    }
    
    return false;
  }

  /**
   * 执行监听器
   * @param context 监听器上下文
   */
  async executeListeners(context: TaskListenerContext): Promise<void> {
    // 获取匹配的监听器
    const matchedListeners = this.getMatchedListeners(context);

    // 按顺序排序
    matchedListeners.sort((a, b) => a.listener.order - b.listener.order);

    // 执行监听器
    for (const entry of matchedListeners) {
      const { listener } = entry;
      
      if (!listener.enabled) {
        continue;
      }

      try {
        this.logger.debug(`Executing task listener: ${listener.name}`);
        await Promise.resolve(listener.handle(context));
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Error executing task listener ${listener.name}: ${errorMessage}`,
          errorStack
        );
        
        // 根据配置决定是否继续执行后续监听器
        // 这里默认继续执行
      }
    }
  }

  /**
   * 获取匹配的监听器
   * @param context 监听器上下文
   */
  private getMatchedListeners(context: TaskListenerContext): ListenerRegistryEntry[] {
    return this.listenerRegistry.filter(entry => {
      const { listener, processDefinitionId, taskDefinitionKey } = entry;

      // 检查监听器类型是否匹配
      const typeMatch = Array.isArray(listener.type)
        ? listener.type.includes(context.eventType)
        : listener.type === context.eventType;

      if (!typeMatch) {
        return false;
      }

      // 检查流程定义ID是否匹配
      if (processDefinitionId && processDefinitionId !== context.processDefinitionId) {
        return false;
      }

      // 检查任务定义Key是否匹配
      if (taskDefinitionKey && taskDefinitionKey !== context.taskDefinitionKey) {
        return false;
      }

      return true;
    });
  }

  /**
   * 触发任务事件
   * @param eventType 事件类型
   * @param context 上下文数据
   */
  async triggerEvent(
    eventType: TaskListenerType,
    context: Partial<TaskListenerContext>,
  ): Promise<void> {
    const fullContext: TaskListenerContext = {
      taskId: context.taskId!,
      taskDefinitionKey: context.taskDefinitionKey!,
      processInstanceId: context.processInstanceId!,
      processDefinitionId: context.processDefinitionId!,
      eventType,
      eventTime: new Date(),
      ...context,
    };

    // 发布到事件总线
    const eventName = this.getEventName(eventType);
    this.eventBus.emit(eventName, fullContext);

    // 直接执行监听器
    await this.executeListeners(fullContext);
  }

  /**
   * 获取事件名称
   * @param eventType 事件类型
   */
  private getEventName(eventType: TaskListenerType): string {
    const eventMap: Record<TaskListenerType, string> = {
      [TaskListenerType.CREATE]: 'task.created',
      [TaskListenerType.ASSIGNMENT]: 'task.assigned',
      [TaskListenerType.CLAIM]: 'task.claimed',
      [TaskListenerType.COMPLETE]: 'task.completed',
      [TaskListenerType.DELETE]: 'task.deleted',
      [TaskListenerType.UPDATE]: 'task.updated',
      [TaskListenerType.TIMEOUT]: 'task.timeout',
    };
    
    return eventMap[eventType] || 'task.unknown';
  }

  /**
   * 获取所有已注册的监听器
   */
  getAllListeners(): TaskListener[] {
    return this.listenerRegistry.map(entry => entry.listener);
  }

  /**
   * 获取指定流程的监听器配置
   * @param processDefinitionId 流程定义ID
   */
  async getListenerConfigs(processDefinitionId: string): Promise<TaskListenerConfig[]> {
    // 先从缓存获取
    if (this.configCache.has(processDefinitionId)) {
      return this.configCache.get(processDefinitionId)!;
    }

    // TODO: 从数据库加载配置
    const configs: TaskListenerConfig[] = [];
    
    // 缓存配置
    this.configCache.set(processDefinitionId, configs);
    
    return configs;
  }

  /**
   * 清除监听器配置缓存
   * @param processDefinitionId 流程定义ID（可选，不指定则清除所有）
   */
  clearConfigCache(processDefinitionId?: string): void {
    if (processDefinitionId) {
      this.configCache.delete(processDefinitionId);
    } else {
      this.configCache.clear();
    }
  }

  /**
   * 创建内置监听器
   */
  static createBuiltInListeners(): TaskListener[] {
    return [
      // 日志记录监听器
      {
        name: 'logging-listener',
        type: [
          TaskListenerType.CREATE,
          TaskListenerType.ASSIGNMENT,
          TaskListenerType.CLAIM,
          TaskListenerType.COMPLETE,
          TaskListenerType.DELETE,
        ],
        enabled: true,
        order: 0,
        handle: (context) => {
          console.log(`[TaskListener] ${context.eventType}: Task ${context.taskId} - ${context.taskName}`);
        },
      },

      // 通知监听器
      {
        name: 'notification-listener',
        type: [TaskListenerType.ASSIGNMENT, TaskListenerType.CLAIM],
        enabled: true,
        order: 100,
        handle: async (context) => {
          // TODO: 发送通知给受让人
          if (context.assignee) {
            console.log(`[Notification] Task assigned to: ${context.assignee}`);
          }
        },
      },

      // 超时检查监听器
      {
        name: 'timeout-check-listener',
        type: TaskListenerType.CREATE,
        enabled: true,
        order: 50,
        handle: (context) => {
          // TODO: 设置超时检查定时器
          console.log(`[TimeoutCheck] Task ${context.taskId} created, setting timeout check`);
        },
      },
    ];
  }
}

// 导出类型和枚举
export { TaskListenerType as TaskEventType };
