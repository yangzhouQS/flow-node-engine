import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  CompensationEventType,
  CompensationState,
  CompensationHandlerConfig,
  CompensationEventConfig,
  CompensationContext,
  CompensationExecutionRecord,
  CompensationResult,
  CompensationHandlerResult,
  CompensationScope,
  CompensationPlan,
  CompensationEventSubscription,
  CompensationServiceConfig,
  CompensationStatistics,
  ICompensationHandler,
  ICompensationEventHandler,
} from '../interfaces/compensation.interface';

/**
 * 补偿服务
 * 管理BPMN补偿事件的执行
 */
@Injectable()
export class CompensationService implements OnModuleInit {
  private readonly logger = new Logger(CompensationService.name);

  /** 服务配置 */
  private readonly config: CompensationServiceConfig;

  /** 补偿处理器注册表 - 按流程实例ID索引 */
  private readonly handlerRegistry: Map<string, Map<string, ICompensationHandler>> = new Map();

  /** 执行记录 - 按流程实例ID索引 */
  private readonly executionRecords: Map<string, CompensationExecutionRecord[]> = new Map();

  /** 补偿作用域 - 按流程实例ID索引 */
  private readonly scopes: Map<string, Map<string, CompensationScope>> = new Map();

  /** 事件订阅 - 按流程实例ID索引 */
  private readonly subscriptions: Map<string, CompensationEventSubscription[]> = new Map();

  /** 补偿计划 - 按流程实例ID索引 */
  private readonly plans: Map<string, CompensationPlan> = new Map();

  /** 统计信息 */
  private readonly statistics: CompensationStatistics = {
    totalCompensations: 0,
    successCount: 0,
    failureCount: 0,
    averageExecutionTime: 0,
    byActivityType: {},
  };

  constructor(@Optional() config?: CompensationServiceConfig) {
    this.config = {
      enableAsync: config?.enableAsync ?? false,
      defaultRetryCount: config?.defaultRetryCount ?? 3,
      defaultRetryInterval: config?.defaultRetryInterval ?? 1000,
      maxCompensationDepth: config?.maxCompensationDepth ?? 10,
      compensationTimeout: config?.compensationTimeout ?? 30000,
      ...config,
    };
  }

  async onModuleInit() {
    this.logger.log('Compensation service initialized');
  }

  /**
   * 注册补偿处理器
   */
  registerHandler(
    processInstanceId: string,
    activityId: string,
    handler: ICompensationHandler,
  ): void {
    if (!this.handlerRegistry.has(processInstanceId)) {
      this.handlerRegistry.set(processInstanceId, new Map());
    }
    this.handlerRegistry.get(processInstanceId)!.set(activityId, handler);
    this.logger.debug(`Registered compensation handler for activity ${activityId}`);
  }

  /**
   * 注销补偿处理器
   */
  unregisterHandler(processInstanceId: string, activityId: string): boolean {
    const handlers = this.handlerRegistry.get(processInstanceId);
    if (handlers) {
      return handlers.delete(activityId);
    }
    return false;
  }

  /**
   * 记录活动执行
   * 在活动成功完成时调用，用于后续可能的补偿
   */
  recordExecution(
    processInstanceId: string,
    executionId: string,
    activityId: string,
    activityType: string,
    activityName?: string,
    variableSnapshot?: Record<string, any>,
    scopeId?: string,
    parentScopeId?: string,
  ): CompensationExecutionRecord {
    if (!this.executionRecords.has(processInstanceId)) {
      this.executionRecords.set(processInstanceId, []);
    }

    const record: CompensationExecutionRecord = {
      id: uuidv4(),
      processInstanceId,
      executionId,
      activityId,
      activityName,
      activityType,
      startTime: new Date(),
      endTime: new Date(),
      state: CompensationState.PENDING,
      variableSnapshot: variableSnapshot ? { ...variableSnapshot } : undefined,
      scopeId,
      parentScopeId,
      depth: this.calculateDepth(scopeId, processInstanceId),
    };

    this.executionRecords.get(processInstanceId)!.push(record);
    this.logger.debug(`Recorded execution for activity ${activityId}`);
    return record;
  }

  /**
   * 创建补偿作用域
   */
  createScope(
    processInstanceId: string,
    scopeId: string,
    activityId?: string,
    parentScopeId?: string,
  ): CompensationScope {
    if (!this.scopes.has(processInstanceId)) {
      this.scopes.set(processInstanceId, new Map());
    }

    const depth = parentScopeId
      ? (this.scopes.get(processInstanceId)?.get(parentScopeId)?.depth ?? 0) + 1
      : 0;

    const scope: CompensationScope = {
      scopeId,
      parentScopeId,
      processInstanceId,
      activityId,
      compensationRecords: [],
      childScopes: [],
      depth,
      createdAt: new Date(),
    };

    // 添加到父作用域的子列表
    if (parentScopeId) {
      const parentScope = this.scopes.get(processInstanceId)?.get(parentScopeId);
      if (parentScope) {
        parentScope.childScopes.push(scope);
      }
    }

    this.scopes.get(processInstanceId)!.set(scopeId, scope);
    this.logger.debug(`Created compensation scope ${scopeId}`);
    return scope;
  }

  /**
   * 订阅补偿事件
   */
  subscribe(
    processInstanceId: string,
    executionId: string,
    activityId: string,
    handlerConfig: CompensationHandlerConfig,
  ): CompensationEventSubscription {
    if (!this.subscriptions.has(processInstanceId)) {
      this.subscriptions.set(processInstanceId, []);
    }

    const subscription: CompensationEventSubscription = {
      subscriptionId: uuidv4(),
      eventType: CompensationEventType.BOUNDARY,
      activityId,
      processInstanceId,
      executionId,
      handlerConfig,
      createdAt: new Date(),
    };

    this.subscriptions.get(processInstanceId)!.push(subscription);
    this.logger.debug(`Created compensation subscription for activity ${activityId}`);
    return subscription;
  }

  /**
   * 触发补偿
   * 从指定活动开始补偿，按逆序执行
   */
  async compensate(
    processInstanceId: string,
    triggerActivityId?: string,
    scopeId?: string,
    variables?: Record<string, any>,
  ): Promise<CompensationResult[]> {
    this.logger.log(`Starting compensation for process ${processInstanceId}`);

    const records = this.getCompensableRecords(processInstanceId, scopeId);
    if (records.length === 0) {
      this.logger.warn(`No compensable records found for process ${processInstanceId}`);
      return [];
    }

    // 过滤出需要补偿的记录（在触发点之后执行的）
    let recordsToCompensate = records;
    if (triggerActivityId) {
      const triggerIndex = records.findIndex(r => r.activityId === triggerActivityId);
      if (triggerIndex >= 0) {
        recordsToCompensate = records.slice(triggerIndex + 1);
      }
    }

    // 逆序执行补偿
    const results: CompensationResult[] = [];
    for (let i = recordsToCompensate.length - 1; i >= 0; i--) {
      const record = recordsToCompensate[i];
      const result = await this.executeCompensation(record, variables);
      results.push(result);

      if (!result.success) {
        this.logger.error(`Compensation failed for activity ${record.activityId}: ${result.error}`);
        // 可以选择继续或停止
      }
    }

    this.statistics.totalCompensations += results.length;
    this.statistics.successCount += results.filter(r => r.success).length;
    this.statistics.failureCount += results.filter(r => !r.success).length;

    return results;
  }

  /**
   * 执行单个补偿
   */
  private async executeCompensation(
    record: CompensationExecutionRecord,
    variables?: Record<string, any>,
  ): Promise<CompensationResult> {
    const startTime = Date.now();
    const compensationExecutionId = uuidv4();

    this.logger.debug(`Executing compensation for activity ${record.activityId}`);

    // 更新状态
    record.state = CompensationState.COMPENSATING;

    try {
      // 获取处理器
      const handlers = this.handlerRegistry.get(record.processInstanceId);
      const handler = handlers?.get(record.activityId);

      if (!handler) {
        this.logger.warn(`No compensation handler found for activity ${record.activityId}`);
        record.state = CompensationState.SKIPPED;
        return {
          success: true,
          compensationExecutionId,
          compensatedActivityId: record.activityId,
        };
      }

      // 构建补偿上下文
      const context: CompensationContext = {
        compensationExecutionId,
        processInstanceId: record.processInstanceId,
        executionId: record.executionId,
        scopeId: record.scopeId,
        eventConfig: {
          id: compensationExecutionId,
          eventType: CompensationEventType.BOUNDARY,
          attachedToActivityId: record.activityId,
        },
        variables: {
          ...record.variableSnapshot,
          ...variables,
        },
        timestamp: new Date(),
      };

      // 执行补偿
      const result = await this.executeWithRetry(handler, context);

      // 更新状态
      record.state = result.success ? CompensationState.COMPENSATED : CompensationState.FAILED;

      const executionTime = Date.now() - startTime;
      this.updateStatistics(record.activityType, executionTime, result.success);

      return {
        success: result.success,
        compensationExecutionId,
        compensatedActivityId: record.activityId,
        error: result.error,
        executionTime,
        modifiedVariables: result.modifiedVariables,
      };
    } catch (error) {
      record.state = CompensationState.FAILED;
      const executionTime = Date.now() - startTime;

      this.updateStatistics(record.activityType, executionTime, false);

      return {
        success: false,
        compensationExecutionId,
        compensatedActivityId: record.activityId,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry(
    handler: ICompensationHandler,
    context: CompensationContext,
  ): Promise<CompensationHandlerResult> {
    const retryCount = this.config.defaultRetryCount ?? 3;
    const retryInterval = this.config.defaultRetryInterval ?? 1000;

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await Promise.resolve(handler.compensate(context));
        if (result.success || !result.retry) {
          return result;
        }
        lastError = result.error;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      if (attempt < retryCount) {
        this.logger.debug(`Retrying compensation (attempt ${attempt + 1}/${retryCount})`);
        await this.sleep(retryInterval);
      }
    }

    return {
      success: false,
      error: lastError,
    };
  }

  /**
   * 获取可补偿的执行记录
   */
  private getCompensableRecords(
    processInstanceId: string,
    scopeId?: string,
  ): CompensationExecutionRecord[] {
    const records = this.executionRecords.get(processInstanceId) || [];

    let filteredRecords = records.filter(r => r.state === CompensationState.PENDING);

    if (scopeId) {
      filteredRecords = filteredRecords.filter(r => r.scopeId === scopeId);
    }

    // 按执行时间排序
    return filteredRecords.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());
  }

  /**
   * 计算嵌套深度
   */
  private calculateDepth(scopeId?: string, processInstanceId?: string): number {
    if (!scopeId || !processInstanceId) return 0;
    const scope = this.scopes.get(processInstanceId)?.get(scopeId);
    return scope?.depth ?? 0;
  }

  /**
   * 更新统计信息
   */
  private updateStatistics(activityType: string, executionTime: number, success: boolean): void {
    // 更新平均执行时间
    const totalTime = this.statistics.averageExecutionTime * this.statistics.totalCompensations;
    this.statistics.averageExecutionTime =
      (totalTime + executionTime) / (this.statistics.totalCompensations + 1);

    // 按活动类型统计
    if (!this.statistics.byActivityType[activityType]) {
      this.statistics.byActivityType[activityType] = {
        count: 0,
        successCount: 0,
        failureCount: 0,
        averageTime: 0,
      };
    }

    const typeStats = this.statistics.byActivityType[activityType];
    typeStats.count++;
    if (success) {
      typeStats.successCount++;
    } else {
      typeStats.failureCount++;
    }
    typeStats.averageTime = (typeStats.averageTime * (typeStats.count - 1) + executionTime) / typeStats.count;
  }

  /**
   * 清理流程实例的补偿数据
   */
  cleanup(processInstanceId: string): void {
    this.handlerRegistry.delete(processInstanceId);
    this.executionRecords.delete(processInstanceId);
    this.scopes.delete(processInstanceId);
    this.subscriptions.delete(processInstanceId);
    this.plans.delete(processInstanceId);
    this.logger.debug(`Cleaned up compensation data for process ${processInstanceId}`);
  }

  /**
   * 获取统计信息
   */
  getStatistics(): CompensationStatistics {
    return { ...this.statistics };
  }

  /**
   * 获取执行记录
   */
  getExecutionRecords(processInstanceId: string): CompensationExecutionRecord[] {
    return this.executionRecords.get(processInstanceId) || [];
  }

  /**
   * 获取作用域
   */
  getScope(processInstanceId: string, scopeId: string): CompensationScope | undefined {
    return this.scopes.get(processInstanceId)?.get(scopeId);
  }

  /**
   * 获取订阅
   */
  getSubscriptions(processInstanceId: string): CompensationEventSubscription[] {
    return this.subscriptions.get(processInstanceId) || [];
  }

  /**
   * 创建补偿计划
   */
  createPlan(
    processInstanceId: string,
    triggerSource: string,
    scopeId?: string,
  ): CompensationPlan {
    const records = this.getCompensableRecords(processInstanceId, scopeId);
    
    const plan: CompensationPlan = {
      planId: uuidv4(),
      processInstanceId,
      triggerSource,
      executionOrder: [...records].reverse(), // 逆序
      createdAt: new Date(),
    };

    this.plans.set(processInstanceId, plan);
    return plan;
  }

  /**
   * 执行补偿计划
   */
  async executePlan(plan: CompensationPlan): Promise<CompensationResult[]> {
    const results: CompensationResult[] = [];

    for (const record of plan.executionOrder) {
      const result = await this.executeCompensation(record);
      results.push(result);

      if (!result.success && !plan.parallel) {
        // 顺序执行时，如果失败则停止
        break;
      }
    }

    return results;
  }

  /**
   * 检查活动是否有补偿处理器
   */
  hasHandler(processInstanceId: string, activityId: string): boolean {
    return this.handlerRegistry.get(processInstanceId)?.has(activityId) ?? false;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
