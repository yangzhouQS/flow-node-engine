import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ListenerRegistration,
  ListenerType,
  ExecutionListenerConfig,
  TaskListenerConfig,
  IExecutionListener,
  ITaskListener,
  ListenerContext,
  TaskListenerContext,
  ListenerResult,
  ListenerStatistics,
  ExecutionListenerEvent,
  TaskListenerEvent,
  ListenerImplementationType,
} from '../interfaces/listener.interface';

/**
 * 监听器工厂接口
 */
export interface IListenerFactory {
  /**
   * 创建执行监听器
   */
  createExecutionListener(config: ExecutionListenerConfig): IExecutionListener | null;
  
  /**
   * 创建任务监听器
   */
  createTaskListener(config: TaskListenerConfig): ITaskListener | null;
  
  /**
   * 是否支持该实现类型
   */
  supports(implementationType: ListenerImplementationType, implementation: string): boolean;
}

/**
 * 监听器注册选项
 */
export interface ListenerRegistrationOptions {
  /** 目标元素ID */
  targetElementId?: string;
  /** 流程定义Key */
  processDefinitionKey?: string;
  /** 是否启用 */
  enabled?: boolean;
  /** 覆盖已存在的监听器 */
  overwrite?: boolean;
}

/**
 * 监听器调度结果
 */
export interface ListenerDispatchResult {
  /** 总调用次数 */
  totalInvocations: number;
  /** 成功次数 */
  successCount: number;
  /** 失败次数 */
  failureCount: number;
  /** 所有结果 */
  results: Array<{
    registrationId: string;
    listenerName?: string;
    success: boolean;
    error?: string;
    executionTime: number;
  }>;
  /** 修改的变量汇总 */
  modifiedVariables: Record<string, any>;
  /** 是否有终止流程的请求 */
  shouldTerminate: boolean;
  /** BPMN错误（如果有） */
  bpmnError?: { errorCode: string; errorMessage?: string };
}

/**
 * 监听器注册表服务
 * 管理所有监听器的注册、查找和调度
 */
@Injectable()
export class ListenerRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ListenerRegistryService.name);
  
  /** 监听器注册表 */
  private readonly registrations: Map<string, ListenerRegistration> = new Map();
  
  /** 按流程定义Key索引的执行监听器 */
  private readonly executionListenersByProcess: Map<string, Set<string>> = new Map();
  
  /** 按流程定义Key索引的任务监听器 */
  private readonly taskListenersByProcess: Map<string, Set<string>> = new Map();
  
  /** 全局执行监听器 */
  private readonly globalExecutionListeners: Set<string> = new Set();
  
  /** 全局任务监听器 */
  private readonly globalTaskListeners: Set<string> = new Set();
  
  /** 监听器工厂列表 */
  private readonly factories: IListenerFactory[] = [];
  
  /** 监听器统计信息 */
  private readonly statistics: Map<string, ListenerStatistics> = new Map();

  constructor(
    @Optional() @Inject('LISTENER_FACTORIES') private readonly injectedFactories: IListenerFactory[],
  ) {}

  async onModuleInit() {
    if (this.injectedFactories) {
      this.factories.push(...this.injectedFactories);
    }
    this.logger.log(`Listener registry initialized with ${this.factories.length} factories`);
  }

  /**
   * 注册监听器工厂
   */
  registerFactory(factory: IListenerFactory): void {
    this.factories.push(factory);
    this.logger.log(`Registered listener factory: ${factory.constructor.name}`);
  }

  /**
   * 注册执行监听器
   */
  registerExecutionListener(
    config: ExecutionListenerConfig,
    listener: IExecutionListener,
    options?: ListenerRegistrationOptions,
  ): string {
    const registrationId = config.id || uuidv4();
    
    // 检查是否已存在
    if (this.registrations.has(registrationId) && !options?.overwrite) {
      throw new Error(`Execution listener with ID ${registrationId} already exists`);
    }

    const registration: ListenerRegistration = {
      registrationId,
      listenerType: ListenerType.EXECUTION_LISTENER,
      config,
      listener,
      targetElementId: options?.targetElementId,
      processDefinitionKey: options?.processDefinitionKey,
      registeredAt: new Date(),
      enabled: options?.enabled ?? true,
    };

    this.registrations.set(registrationId, registration);
    
    // 建立索引
    if (options?.processDefinitionKey) {
      const key = options.processDefinitionKey;
      if (!this.executionListenersByProcess.has(key)) {
        this.executionListenersByProcess.set(key, new Set());
      }
      this.executionListenersByProcess.get(key)!.add(registrationId);
    } else {
      this.globalExecutionListeners.add(registrationId);
    }

    // 初始化统计信息
    this.statistics.set(registrationId, {
      listenerId: registrationId,
      listenerName: config.name,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
    });

    this.logger.debug(`Registered execution listener: ${config.name || registrationId}`);
    return registrationId;
  }

  /**
   * 注册任务监听器
   */
  registerTaskListener(
    config: TaskListenerConfig,
    listener: ITaskListener,
    options?: ListenerRegistrationOptions,
  ): string {
    const registrationId = config.id || uuidv4();
    
    if (this.registrations.has(registrationId) && !options?.overwrite) {
      throw new Error(`Task listener with ID ${registrationId} already exists`);
    }

    const registration: ListenerRegistration = {
      registrationId,
      listenerType: ListenerType.TASK_LISTENER,
      config,
      listener,
      targetElementId: options?.targetElementId,
      processDefinitionKey: options?.processDefinitionKey,
      registeredAt: new Date(),
      enabled: options?.enabled ?? true,
    };

    this.registrations.set(registrationId, registration);
    
    if (options?.processDefinitionKey) {
      const key = options.processDefinitionKey;
      if (!this.taskListenersByProcess.has(key)) {
        this.taskListenersByProcess.set(key, new Set());
      }
      this.taskListenersByProcess.get(key)!.add(registrationId);
    } else {
      this.globalTaskListeners.add(registrationId);
    }

    this.statistics.set(registrationId, {
      listenerId: registrationId,
      listenerName: config.name,
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
    });

    this.logger.debug(`Registered task listener: ${config.name || registrationId}`);
    return registrationId;
  }

  /**
   * 注销监听器
   */
  unregisterListener(registrationId: string): boolean {
    const registration = this.registrations.get(registrationId);
    if (!registration) {
      return false;
    }

    // 从索引中移除
    if (registration.processDefinitionKey) {
      if (registration.listenerType === ListenerType.EXECUTION_LISTENER) {
        this.executionListenersByProcess.get(registration.processDefinitionKey)?.delete(registrationId);
      } else {
        this.taskListenersByProcess.get(registration.processDefinitionKey)?.delete(registrationId);
      }
    } else {
      if (registration.listenerType === ListenerType.EXECUTION_LISTENER) {
        this.globalExecutionListeners.delete(registrationId);
      } else {
        this.globalTaskListeners.delete(registrationId);
      }
    }

    this.registrations.delete(registrationId);
    this.statistics.delete(registrationId);
    
    this.logger.debug(`Unregistered listener: ${registrationId}`);
    return true;
  }

  /**
   * 获取执行监听器
   */
  getExecutionListeners(
    processDefinitionKey?: string,
    activityId?: string,
    event?: ExecutionListenerEvent,
  ): ListenerRegistration[] {
    const listeners: ListenerRegistration[] = [];

    // 添加全局监听器
    for (const id of this.globalExecutionListeners) {
      const registration = this.registrations.get(id);
      if (registration && registration.enabled && this.matchesEvent(registration.config as ExecutionListenerConfig, event)) {
        listeners.push(registration);
      }
    }

    // 添加流程特定监听器
    if (processDefinitionKey) {
      const processListeners = this.executionListenersByProcess.get(processDefinitionKey);
      if (processListeners) {
        for (const id of processListeners) {
          const registration = this.registrations.get(id);
          if (registration && registration.enabled && this.matchesEvent(registration.config as ExecutionListenerConfig, event)) {
            // 检查是否匹配目标元素
            if (!registration.targetElementId || registration.targetElementId === activityId) {
              listeners.push(registration);
            }
          }
        }
      }
    }

    // 按order排序
    return listeners.sort((a, b) => {
      const orderA = (a.config as ExecutionListenerConfig).order || 0;
      const orderB = (b.config as ExecutionListenerConfig).order || 0;
      return orderA - orderB;
    });
  }

  /**
   * 获取任务监听器
   */
  getTaskListeners(
    processDefinitionKey?: string,
    taskId?: string,
    event?: TaskListenerEvent,
  ): ListenerRegistration[] {
    const listeners: ListenerRegistration[] = [];

    // 添加全局监听器
    for (const id of this.globalTaskListeners) {
      const registration = this.registrations.get(id);
      if (registration && registration.enabled && this.matchesTaskEvent(registration.config as TaskListenerConfig, event)) {
        listeners.push(registration);
      }
    }

    // 添加流程特定监听器
    if (processDefinitionKey) {
      const processListeners = this.taskListenersByProcess.get(processDefinitionKey);
      if (processListeners) {
        for (const id of processListeners) {
          const registration = this.registrations.get(id);
          if (registration && registration.enabled && this.matchesTaskEvent(registration.config as TaskListenerConfig, event)) {
            if (!registration.targetElementId || registration.targetElementId === taskId) {
              listeners.push(registration);
            }
          }
        }
      }
    }

    return listeners.sort((a, b) => {
      const orderA = (a.config as TaskListenerConfig).order || 0;
      const orderB = (b.config as TaskListenerConfig).order || 0;
      return orderA - orderB;
    });
  }

  /**
   * 调度执行监听器
   */
  async dispatchExecutionListeners(
    context: ListenerContext,
    processDefinitionKey?: string,
    activityId?: string,
  ): Promise<ListenerDispatchResult> {
    const listeners = this.getExecutionListeners(
      processDefinitionKey,
      activityId,
      context.event as ExecutionListenerEvent,
    );

    return this.executeListeners(listeners, context);
  }

  /**
   * 调度任务监听器
   */
  async dispatchTaskListeners(
    context: TaskListenerContext,
    processDefinitionKey?: string,
    taskId?: string,
  ): Promise<ListenerDispatchResult> {
    const listeners = this.getTaskListeners(
      processDefinitionKey,
      taskId,
      context.event as TaskListenerEvent,
    );

    return this.executeTaskListeners(listeners, context);
  }

  /**
   * 执行监听器列表
   */
  private async executeListeners(
    listeners: ListenerRegistration[],
    context: ListenerContext,
  ): Promise<ListenerDispatchResult> {
    const result: ListenerDispatchResult = {
      totalInvocations: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      modifiedVariables: {},
      shouldTerminate: false,
    };

    for (const registration of listeners) {
      const startTime = Date.now();
      const listenerResult = await this.executeListener(registration, context);
      const executionTime = Date.now() - startTime;

      result.totalInvocations++;
      result.results.push({
        registrationId: registration.registrationId,
        listenerName: (registration.config as ExecutionListenerConfig).name,
        success: listenerResult.success,
        error: listenerResult.error,
        executionTime,
      });

      if (listenerResult.success) {
        result.successCount++;
        if (listenerResult.modifiedVariables) {
          Object.assign(result.modifiedVariables, listenerResult.modifiedVariables);
        }
        if (listenerResult.terminateProcess) {
          result.shouldTerminate = true;
        }
        if (listenerResult.bpmnError) {
          result.bpmnError = listenerResult.bpmnError;
        }
      } else {
        result.failureCount++;
      }
    }

    return result;
  }

  /**
   * 执行任务监听器列表
   */
  private async executeTaskListeners(
    listeners: ListenerRegistration[],
    context: TaskListenerContext,
  ): Promise<ListenerDispatchResult> {
    const result: ListenerDispatchResult = {
      totalInvocations: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      modifiedVariables: {},
      shouldTerminate: false,
    };

    for (const registration of listeners) {
      const startTime = Date.now();
      const listenerResult = await this.executeTaskListener(registration, context);
      const executionTime = Date.now() - startTime;

      result.totalInvocations++;
      result.results.push({
        registrationId: registration.registrationId,
        listenerName: (registration.config as TaskListenerConfig).name,
        success: listenerResult.success,
        error: listenerResult.error,
        executionTime,
      });

      if (listenerResult.success) {
        result.successCount++;
        if (listenerResult.modifiedVariables) {
          Object.assign(result.modifiedVariables, listenerResult.modifiedVariables);
        }
        if (listenerResult.terminateProcess) {
          result.shouldTerminate = true;
        }
        if (listenerResult.bpmnError) {
          result.bpmnError = listenerResult.bpmnError;
        }
      } else {
        result.failureCount++;
      }
    }

    return result;
  }

  /**
   * 执行单个监听器
   */
  private async executeListener(
    registration: ListenerRegistration,
    context: ListenerContext,
  ): Promise<ListenerResult> {
    const stats = this.statistics.get(registration.registrationId)!;
    stats.executionCount++;
    stats.lastExecutionTime = new Date();

    try {
      const listener = registration.listener as IExecutionListener;
      const result = await Promise.resolve(listener.notify(context));

      if (result.success) {
        stats.successCount++;
      } else {
        stats.failureCount++;
        stats.lastError = result.error;
      }

      // 更新平均执行时间
      this.updateAverageExecutionTime(stats, result.success ? 1 : 0);

      return result;
    } catch (error) {
      stats.failureCount++;
      stats.lastError = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: stats.lastError,
      };
    }
  }

  /**
   * 执行单个任务监听器
   */
  private async executeTaskListener(
    registration: ListenerRegistration,
    context: TaskListenerContext,
  ): Promise<ListenerResult> {
    const stats = this.statistics.get(registration.registrationId)!;
    stats.executionCount++;
    stats.lastExecutionTime = new Date();

    try {
      const listener = registration.listener as ITaskListener;
      const result = await Promise.resolve(listener.notify(context));

      if (result.success) {
        stats.successCount++;
      } else {
        stats.failureCount++;
        stats.lastError = result.error;
      }

      this.updateAverageExecutionTime(stats, result.success ? 1 : 0);

      return result;
    } catch (error) {
      stats.failureCount++;
      stats.lastError = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: stats.lastError,
      };
    }
  }

  /**
   * 更新平均执行时间
   */
  private updateAverageExecutionTime(stats: ListenerStatistics, _sampleCount: number): void {
    // 简化的平均值计算，实际可以使用更复杂的算法
    stats.averageExecutionTime = stats.executionCount > 0 
      ? (stats.averageExecutionTime * (stats.executionCount - 1) + 1) / stats.executionCount
      : 0;
  }

  /**
   * 检查事件是否匹配
   */
  private matchesEvent(config: ExecutionListenerConfig, event?: ExecutionListenerEvent): boolean {
    if (!event) return true;
    return config.event === event;
  }

  /**
   * 检查任务事件是否匹配
   */
  private matchesTaskEvent(config: TaskListenerConfig, event?: TaskListenerEvent): boolean {
    if (!event) return true;
    return config.event === event;
  }

  /**
   * 从配置创建监听器
   */
  createListenerFromConfig(config: ExecutionListenerConfig | TaskListenerConfig): IExecutionListener | ITaskListener | null {
    for (const factory of this.factories) {
      if (factory.supports(config.implementationType, config.implementation)) {
        if ('event' in config && Object.values(ExecutionListenerEvent).includes(config.event as ExecutionListenerEvent)) {
          return factory.createExecutionListener(config as ExecutionListenerConfig);
        } else {
          return factory.createTaskListener(config as TaskListenerConfig);
        }
      }
    }
    
    this.logger.warn(`No factory found for listener: ${config.implementationType}:${config.implementation}`);
    return null;
  }

  /**
   * 获取监听器统计信息
   */
  getStatistics(registrationId?: string): ListenerStatistics | ListenerStatistics[] {
    if (registrationId) {
      return this.statistics.get(registrationId) || null;
    }
    return Array.from(this.statistics.values());
  }

  /**
   * 获取所有注册信息
   */
  getAllRegistrations(): ListenerRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * 清除所有监听器
   */
  clearAll(): void {
    this.registrations.clear();
    this.executionListenersByProcess.clear();
    this.taskListenersByProcess.clear();
    this.globalExecutionListeners.clear();
    this.globalTaskListeners.clear();
    this.statistics.clear();
    
    this.logger.log('All listeners cleared');
  }

  /**
   * 启用/禁用监听器
   */
  setListenerEnabled(registrationId: string, enabled: boolean): boolean {
    const registration = this.registrations.get(registrationId);
    if (registration) {
      registration.enabled = enabled;
      return true;
    }
    return false;
  }
}
