import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  MultiInstanceType,
  MultiInstanceState,
  InstanceExecutionState,
  MultiInstanceConfig,
  MultiInstanceExecutionState,
  InstanceExecutionContext,
  MultiInstanceResult,
  CompletionConditionResult,
  MultiInstanceServiceConfig,
  MultiInstanceStatistics,
  TypeStatistics,
  MULTI_INSTANCE_BUILTIN_VARIABLES,
} from '../interfaces/multi-instance.interface';

/**
 * 多实例服务
 * 管理BPMN多实例活动的执行
 */
@Injectable()
export class MultiInstanceService implements OnModuleInit {
  private readonly logger = new Logger(MultiInstanceService.name);

  /** 服务配置 */
  private readonly config: MultiInstanceServiceConfig;

  /** 多实例执行状态 - 按流程实例ID索引 */
  private readonly executionStates: Map<string, MultiInstanceExecutionState> = new Map();

  /** 统计信息 */
  private readonly statistics: MultiInstanceStatistics = {
    totalExecutions: 0,
    successCount: 0,
    failureCount: 0,
    averageInstanceCount: 0,
    averageExecutionTime: 0,
    byType: {
      sequential: { count: 0, successCount: 0, failureCount: 0, averageInstanceCount: 0, averageTime: 0 },
      parallel: { count: 0, successCount: 0, failureCount: 0, averageInstanceCount: 0, averageTime: 0 },
    },
  };

  constructor(config?: MultiInstanceServiceConfig) {
    this.config = {
      maxParallelInstances: config?.maxParallelInstances ?? 0,
      instanceTimeout: config?.instanceTimeout ?? 300000, // 5 minutes
      enableRetry: config?.enableRetry ?? false,
      retryCount: config?.retryCount ?? 3,
      retryInterval: config?.retryInterval ?? 1000,
      ...config,
    };
  }

  async onModuleInit() {
    this.logger.log('Multi-instance service initialized');
  }

  /**
   * 初始化多实例执行
   */
  async initialize(
    processInstanceId: string,
    activityId: string,
    config: MultiInstanceConfig,
    variables: Record<string, any>,
  ): Promise<MultiInstanceExecutionState> {
    this.logger.log(`Initializing multi-instance for activity ${activityId}`);

    // 获取输入集合
    const inputCollection = this.resolveInputCollection(config, variables);
    const totalInstances = config.cardinality ?? inputCollection.length;

    if (totalInstances === 0) {
      this.logger.warn(`No instances to create for activity ${activityId}`);
    }

    // 创建实例执行上下文
    const instances: InstanceExecutionContext[] = [];
    for (let i = 0; i < totalInstances; i++) {
      const instanceContext: InstanceExecutionContext = {
        instanceId: uuidv4(),
        activityId,
        processInstanceId,
        executionId: uuidv4(),
        index: i,
        totalInstances,
        currentElement: inputCollection[i],
        elementVariable: config.elementVariable,
        localVariables: {},
        createdAt: new Date(),
        state: InstanceExecutionState.PENDING,
      };
      instances.push(instanceContext);
    }

    // 创建执行状态
    const state: MultiInstanceExecutionState = {
      id: uuidv4(),
      activityId,
      processInstanceId,
      config,
      state: MultiInstanceState.PENDING,
      totalInstances,
      completedInstances: 0,
      activeInstances: 0,
      failedInstances: 0,
      instances,
      inputCollection,
      outputCollection: [],
      createdAt: new Date(),
    };

    // 存储状态
    this.executionStates.set(state.id, state);

    this.logger.debug(`Created ${totalInstances} instances for activity ${activityId}`);
    return state;
  }

  /**
   * 解析输入集合
   */
  private resolveInputCollection(
    config: MultiInstanceConfig,
    variables: Record<string, any>,
  ): any[] {
    // 如果指定了基数，创建指定数量的空实例
    if (config.cardinality !== undefined) {
      return new Array(config.cardinality).fill(null);
    }

    // 从变量中获取集合
    const collection = variables[config.collection];
    if (Array.isArray(collection)) {
      return collection;
    }

    // 尝试解析表达式
    if (typeof collection === 'string') {
      try {
        const parsed = JSON.parse(collection);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // 忽略解析错误
      }
    }

    this.logger.warn(`Collection ${config.collection} is not an array, treating as single element`);
    return [collection].filter(c => c !== undefined);
  }

  /**
   * 获取下一个待执行的实例
   */
  getNextInstance(state: MultiInstanceExecutionState): InstanceExecutionContext | null {
    const pendingInstance = state.instances.find(
      i => i.state === InstanceExecutionState.PENDING,
    );
    return pendingInstance || null;
  }

  /**
   * 获取所有待执行的实例（用于并行执行）
   */
  getPendingInstances(state: MultiInstanceExecutionState): InstanceExecutionContext[] {
    return state.instances.filter(i => i.state === InstanceExecutionState.PENDING);
  }

  /**
   * 标记实例开始执行
   */
  async startInstance(
    state: MultiInstanceExecutionState,
    instanceId: string,
  ): Promise<void> {
    const instance = state.instances.find(i => i.instanceId === instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    instance.state = InstanceExecutionState.RUNNING;
    state.activeInstances++;
    state.state = MultiInstanceState.IN_PROGRESS;

    if (!state.startedAt) {
      state.startedAt = new Date();
    }

    this.logger.debug(`Started instance ${instanceId} (index: ${instance.index})`);
  }

  /**
   * 标记实例完成
   */
  async completeInstance(
    state: MultiInstanceExecutionState,
    instanceId: string,
    output?: any,
  ): Promise<MultiInstanceResult> {
    const instance = state.instances.find(i => i.instanceId === instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    instance.state = InstanceExecutionState.COMPLETED;
    instance.output = output;
    state.activeInstances--;
    state.completedInstances++;

    // 收集输出
    if (output !== undefined) {
      state.outputCollection.push(output);
    }

    this.logger.debug(`Completed instance ${instanceId} (${state.completedInstances}/${state.totalInstances})`);

    // 检查是否全部完成
    return this.checkCompletion(state);
  }

  /**
   * 标记实例失败
   */
  async failInstance(
    state: MultiInstanceExecutionState,
    instanceId: string,
    error: string,
  ): Promise<MultiInstanceResult> {
    const instance = state.instances.find(i => i.instanceId === instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    instance.state = InstanceExecutionState.FAILED;
    instance.error = error;
    state.activeInstances--;
    state.failedInstances++;

    this.logger.error(`Instance ${instanceId} failed: ${error}`);

    // 检查是否需要停止执行
    return this.checkCompletion(state);
  }

  /**
   * 评估完成条件
   */
  async evaluateCompletionCondition(
    state: MultiInstanceExecutionState,
    variables: Record<string, any>,
  ): Promise<CompletionConditionResult> {
    if (!state.config.completionCondition) {
      return { isComplete: false };
    }

    try {
      // 构建评估上下文
      const context = this.buildEvaluationContext(state, variables);

      // 简单表达式评估（实际应使用ExpressionEvaluator）
      const result = this.evaluateSimpleExpression(state.config.completionCondition, context);

      return {
        isComplete: !!result,
        expression: state.config.completionCondition,
        evaluationDetails: { context, result },
      };
    } catch (error) {
      this.logger.error(`Failed to evaluate completion condition: ${error}`);
      return { isComplete: false };
    }
  }

  /**
   * 构建评估上下文
   */
  private buildEvaluationContext(
    state: MultiInstanceExecutionState,
    variables: Record<string, any>,
  ): Record<string, any> {
    return {
      ...variables,
      [MULTI_INSTANCE_BUILTIN_VARIABLES.NR_OF_INSTANCES]: state.totalInstances,
      [MULTI_INSTANCE_BUILTIN_VARIABLES.NR_OF_COMPLETED_INSTANCES]: state.completedInstances,
      [MULTI_INSTANCE_BUILTIN_VARIABLES.NR_OF_ACTIVE_INSTANCES]: state.activeInstances,
    };
  }

  /**
   * 简单表达式评估
   */
  private evaluateSimpleExpression(expression: string, context: Record<string, any>): any {
    // 提取 ${...} 内的表达式
    let evalExpression = expression;
    const templateMatch = expression.match(/^\$\{(.+)\}$/);
    if (templateMatch) {
      evalExpression = templateMatch[1].trim();
    }

    // 替换变量引用
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      evalExpression = evalExpression.replace(regex, JSON.stringify(value));
    }

    // 安全评估（实际应使用专门的表达式评估器）
    try {
      // 只支持简单的比较表达式
      if (evalExpression.includes('>=')) {
        const [left, right] = evalExpression.split('>=').map(s => JSON.parse(s.trim()));
        return left >= right;
      }
      if (evalExpression.includes('<=')) {
        const [left, right] = evalExpression.split('<=').map(s => JSON.parse(s.trim()));
        return left <= right;
      }
      if (evalExpression.includes('>')) {
        const [left, right] = evalExpression.split('>').map(s => JSON.parse(s.trim()));
        return left > right;
      }
      if (evalExpression.includes('<')) {
        const [left, right] = evalExpression.split('<').map(s => JSON.parse(s.trim()));
        return left < right;
      }
      if (evalExpression.includes('==')) {
        const [left, right] = evalExpression.split('==').map(s => JSON.parse(s.trim()));
        return left === right;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 检查是否所有实例都已完成
   */
  isAllCompleted(state: MultiInstanceExecutionState): boolean {
    return state.completedInstances + state.failedInstances === state.totalInstances;
  }

  /**
   * 获取输出集合
   */
  getOutputCollection(state: MultiInstanceExecutionState): any[] {
    return [...state.outputCollection];
  }

  /**
   * 检查完成状态
   */
  private checkCompletion(state: MultiInstanceExecutionState): MultiInstanceResult {
    const allCompleted = this.isAllCompleted(state);
    const hasFailures = state.failedInstances > 0;

    let success = allCompleted && !hasFailures;
    let completionReason: string | undefined;

    if (allCompleted) {
      state.state = hasFailures ? MultiInstanceState.FAILED : MultiInstanceState.COMPLETED;
      state.completedAt = new Date();
      completionReason = hasFailures ? 'completed_with_failures' : 'all_completed';

      // 更新统计
      this.updateStatistics(state);

      success = !hasFailures;
    }

    return {
      success,
      multiInstanceId: state.id,
      activityId: state.activityId,
      completedCount: state.completedInstances,
      totalCount: state.totalInstances,
      outputs: state.outputCollection,
      failedInstances: state.instances.filter(i => i.state === InstanceExecutionState.FAILED),
      completionReason,
    };
  }

  /**
   * 获取实例执行上下文变量
   */
  getInstanceVariables(
    state: MultiInstanceExecutionState,
    instance: InstanceExecutionContext,
  ): Record<string, any> {
    return {
      [instance.elementVariable]: instance.currentElement,
      [MULTI_INSTANCE_BUILTIN_VARIABLES.LOOP_COUNTER]: instance.index,
      [MULTI_INSTANCE_BUILTIN_VARIABLES.NR_OF_INSTANCES]: state.totalInstances,
      [MULTI_INSTANCE_BUILTIN_VARIABLES.NR_OF_COMPLETED_INSTANCES]: state.completedInstances,
      [MULTI_INSTANCE_BUILTIN_VARIABLES.NR_OF_ACTIVE_INSTANCES]: state.activeInstances,
    };
  }

  /**
   * 取消所有实例
   */
  async cancel(state: MultiInstanceExecutionState): Promise<void> {
    state.state = MultiInstanceState.CANCELLED;
    state.completedAt = new Date();

    for (const instance of state.instances) {
      if (instance.state === InstanceExecutionState.PENDING || 
          instance.state === InstanceExecutionState.RUNNING) {
        instance.state = InstanceExecutionState.SKIPPED;
      }
    }

    state.activeInstances = 0;
    this.logger.log(`Cancelled multi-instance ${state.id}`);
  }

  /**
   * 获取执行状态
   */
  getState(multiInstanceId: string): MultiInstanceExecutionState | undefined {
    return this.executionStates.get(multiInstanceId);
  }

  /**
   * 获取流程实例的所有多实例状态
   */
  getStatesByProcessInstance(processInstanceId: string): MultiInstanceExecutionState[] {
    return Array.from(this.executionStates.values())
      .filter(s => s.processInstanceId === processInstanceId);
  }

  /**
   * 清理执行状态
   */
  cleanup(multiInstanceId: string): void {
    this.executionStates.delete(multiInstanceId);
    this.logger.debug(`Cleaned up multi-instance state ${multiInstanceId}`);
  }

  /**
   * 清理流程实例的所有状态
   */
  cleanupByProcessInstance(processInstanceId: string): void {
    for (const [id, state] of this.executionStates.entries()) {
      if (state.processInstanceId === processInstanceId) {
        this.executionStates.delete(id);
      }
    }
    this.logger.debug(`Cleaned up multi-instance states for process ${processInstanceId}`);
  }

  /**
   * 更新统计信息
   */
  private updateStatistics(state: MultiInstanceExecutionState): void {
    const executionTime = state.completedAt!.getTime() - state.startedAt!.getTime();
    const isSuccess = state.state === MultiInstanceState.COMPLETED;

    // 更新总体统计
    this.statistics.totalExecutions++;
    if (isSuccess) {
      this.statistics.successCount++;
    } else {
      this.statistics.failureCount++;
    }

    // 更新平均实例数
    const totalInstances = this.statistics.totalExecutions;
    const prevAvg = this.statistics.averageInstanceCount;
    this.statistics.averageInstanceCount = 
      (prevAvg * (totalInstances - 1) + state.totalInstances) / totalInstances;

    // 更新平均执行时间
    const prevAvgTime = this.statistics.averageExecutionTime;
    this.statistics.averageExecutionTime = 
      (prevAvgTime * (totalInstances - 1) + executionTime) / totalInstances;

    // 按类型更新
    const typeStats = state.config.type === MultiInstanceType.SEQUENTIAL
      ? this.statistics.byType.sequential
      : this.statistics.byType.parallel;

    typeStats.count++;
    if (isSuccess) {
      typeStats.successCount++;
    } else {
      typeStats.failureCount++;
    }

    const typeTotal = typeStats.count;
    typeStats.averageInstanceCount = 
      (typeStats.averageInstanceCount * (typeTotal - 1) + state.totalInstances) / typeTotal;
    typeStats.averageTime = 
      (typeStats.averageTime * (typeTotal - 1) + executionTime) / typeTotal;
  }

  /**
   * 获取统计信息
   */
  getStatistics(): MultiInstanceStatistics {
    return {
      ...this.statistics,
      byType: {
        sequential: { ...this.statistics.byType.sequential },
        parallel: { ...this.statistics.byType.parallel },
      },
    };
  }

  /**
   * 获取最大并行实例数
   */
  getMaxParallelInstances(): number {
    return this.config.maxParallelInstances ?? 0;
  }

  /**
   * 检查是否可以启动更多并行实例
   */
  canStartMoreInstances(
    state: MultiInstanceExecutionState,
    maxInstances?: number,
  ): boolean {
    const limit = maxInstances ?? this.config.maxParallelInstances ?? 0;
    if (limit === 0) {
      return true; // 无限制
    }
    return state.activeInstances < limit;
  }
}
