/**
 * 事务子流程服务实现（与Flowable TransactionSubProcess行为保持一致）
 * 
 * 核心功能：
 * 1. 事务作用域管理 - 创建、更新、删除事务作用域
 * 2. 补偿事件订阅 - 注册和管理补偿事件订阅
 * 3. 取消事件处理 - 处理取消结束事件和取消边界事件
 * 4. 补偿触发 - 按顺序触发补偿处理器
 */

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  TransactionState,
  ITransactionSubProcessConfig,
  ICompensationEventSubscription,
  ITransactionScope,
  ICancelEventContext,
  ITransactionResult,
  ITransactionSubProcessService,
  ITransactionSubProcessExecutor,
  CancelEventType,
} from '../interfaces/transaction-subprocess.interface';
import { CompensationService } from './compensation.service';

/**
 * 事务子流程服务
 * 管理事务作用域和补偿事件订阅
 */
@Injectable()
export class TransactionSubProcessService implements ITransactionSubProcessService {
  private readonly logger = new Logger(TransactionSubProcessService.name);
  
  /** 事务作用域存储（生产环境应使用数据库） */
  private transactionScopes: Map<string, ITransactionScope> = new Map();
  
  /** 事件作用域执行存储（用于成功完成后保留补偿订阅） */
  private eventScopeExecutions: Map<string, ITransactionScope> = new Map();

  /**
   * 创建事务作用域
   */
  async createTransactionScope(
    config: ITransactionSubProcessConfig,
    processInstanceId: string,
    parentExecutionId?: string,
    variables: Record<string, any> = {}
  ): Promise<ITransactionScope> {
    const transactionId = uuidv4();
    
    const scope: ITransactionScope = {
      transactionId,
      processInstanceId,
      parentExecutionId,
      state: TransactionState.ACTIVE,
      compensationSubscriptions: [],
      variables: { ...variables },
      createdAt: new Date(),
    };
    
    this.transactionScopes.set(transactionId, scope);
    
    this.logger.debug(
      `Created transaction scope: ${transactionId} for process: ${processInstanceId}`
    );
    
    return scope;
  }

  /**
   * 获取事务作用域
   */
  async getTransactionScope(transactionId: string): Promise<ITransactionScope | null> {
    return this.transactionScopes.get(transactionId) || 
           this.eventScopeExecutions.get(transactionId) || 
           null;
  }

  /**
   * 更新事务状态
   */
  async updateTransactionState(
    transactionId: string,
    state: TransactionState
  ): Promise<void> {
    const scope = this.transactionScopes.get(transactionId);
    if (!scope) {
      throw new Error(`Transaction scope not found: ${transactionId}`);
    }
    
    scope.state = state;
    
    if (state === TransactionState.COMPLETED || state === TransactionState.CANCELLED) {
      scope.completedAt = new Date();
    }
    
    this.logger.debug(`Updated transaction ${transactionId} state to: ${state}`);
  }

  /**
   * 添加补偿订阅
   */
  async addCompensationSubscription(
    transactionId: string,
    subscription: ICompensationEventSubscription
  ): Promise<void> {
    const scope = this.transactionScopes.get(transactionId);
    if (!scope) {
      throw new Error(`Transaction scope not found: ${transactionId}`);
    }
    
    const existingIndex = scope.compensationSubscriptions.findIndex(
      s => s.activityId === subscription.activityId
    );
    
    if (existingIndex >= 0) {
      scope.compensationSubscriptions[existingIndex] = subscription;
    } else {
      scope.compensationSubscriptions.push(subscription);
    }
    
    this.logger.debug(
      `Added compensation subscription for activity: ${subscription.activityId}`
    );
  }

  /**
   * 移除补偿订阅
   */
  async removeCompensationSubscription(
    transactionId: string,
    activityId: string
  ): Promise<void> {
    const scope = this.transactionScopes.get(transactionId);
    if (!scope) {
      throw new Error(`Transaction scope not found: ${transactionId}`);
    }
    
    scope.compensationSubscriptions = scope.compensationSubscriptions.filter(
      s => s.activityId !== activityId
    );
  }

  /**
   * 获取补偿订阅
   */
  async getCompensationSubscriptions(
    transactionId: string,
    activityId?: string
  ): Promise<ICompensationEventSubscription[]> {
    const scope = await this.getTransactionScope(transactionId);
    if (!scope) {
      return [];
    }
    
    if (activityId) {
      return scope.compensationSubscriptions.filter(s => s.activityId === activityId);
    }
    
    return [...scope.compensationSubscriptions];
  }

  /**
   * 清除所有补偿订阅
   */
  async clearCompensationSubscriptions(transactionId: string): Promise<void> {
    const scope = this.transactionScopes.get(transactionId);
    if (scope) {
      scope.compensationSubscriptions = [];
    }
  }

  /**
   * 删除事务作用域
   */
  async deleteTransactionScope(transactionId: string): Promise<void> {
    this.transactionScopes.delete(transactionId);
    this.eventScopeExecutions.delete(transactionId);
  }

  /**
   * 将事务作用域转换为事件作用域（成功完成后保留补偿订阅）
   */
  async convertToEventScope(transactionId: string): Promise<string> {
    const scope = this.transactionScopes.get(transactionId);
    if (!scope) {
      throw new Error(`Transaction scope not found: ${transactionId}`);
    }
    
    const eventScopeId = uuidv4();
    const eventScope: ITransactionScope = {
      ...scope,
      transactionId: eventScopeId,
      state: TransactionState.COMPLETED,
    };
    
    this.eventScopeExecutions.set(eventScopeId, eventScope);
    this.transactionScopes.delete(transactionId);
    
    this.logger.debug(`Converted transaction ${transactionId} to event scope ${eventScopeId}`);
    
    return eventScopeId;
  }

  /**
   * 根据流程实例ID获取事务作用域
   */
  async getTransactionScopeByProcessInstance(
    processInstanceId: string
  ): Promise<ITransactionScope | null> {
    for (const scope of this.transactionScopes.values()) {
      if (scope.processInstanceId === processInstanceId) {
        return scope;
      }
    }
    return null;
  }

  /**
   * 获取所有活动的事务作用域
   */
  async getActiveTransactionScopes(): Promise<ITransactionScope[]> {
    return Array.from(this.transactionScopes.values())
      .filter(scope => scope.state === TransactionState.ACTIVE);
  }
}

/**
 * 事务子流程执行器
 * 执行事务子流程的核心逻辑
 */
@Injectable()
export class TransactionSubProcessExecutor implements ITransactionSubProcessExecutor {
  private readonly logger = new Logger(TransactionSubProcessExecutor.name);
  
  constructor(
    private readonly transactionService: TransactionSubProcessService,
    private readonly compensationService: CompensationService
  ) {}

  /**
   * 启动事务子流程
   */
  async startTransaction(
    config: ITransactionSubProcessConfig,
    processInstanceId: string,
    parentExecutionId?: string,
    variables: Record<string, any> = {}
  ): Promise<ITransactionScope> {
    this.logger.log(`Starting transaction subprocess: ${config.id}`);
    
    return this.transactionService.createTransactionScope(
      config,
      processInstanceId,
      parentExecutionId,
      variables
    );
  }

  /**
   * 注册补偿事件订阅
   */
  async registerCompensationSubscription(
    transactionId: string,
    subscription: ICompensationEventSubscription
  ): Promise<void> {
    await this.transactionService.addCompensationSubscription(transactionId, subscription);
  }

  /**
   * 取消补偿事件订阅
   */
  async cancelCompensationSubscription(
    transactionId: string,
    activityId: string
  ): Promise<void> {
    await this.transactionService.removeCompensationSubscription(transactionId, activityId);
  }

  /**
   * 完成事务子流程（成功）
   */
  async completeTransaction(
    transactionId: string,
    variables: Record<string, any> = {}
  ): Promise<ITransactionResult> {
    const scope = await this.transactionService.getTransactionScope(transactionId);
    if (!scope) {
      throw new Error(`Transaction scope not found: ${transactionId}`);
    }
    
    this.logger.log(`Completing transaction: ${transactionId} successfully`);
    
    await this.transactionService.updateTransactionState(
      transactionId,
      TransactionState.COMPLETED
    );
    
    const resultVariables = { ...scope.variables, ...variables };
    const eventScopeId = await this.transactionService.convertToEventScope(transactionId);
    const subscriptions = await this.transactionService.getCompensationSubscriptions(eventScopeId);
    
    return {
      success: true,
      state: TransactionState.COMPLETED,
      compensationSubscriptions: subscriptions,
      executedCompensations: [],
      variables: resultVariables,
    };
  }

  /**
   * 取消事务子流程
   */
  async cancelTransaction(context: ICancelEventContext): Promise<ITransactionResult> {
    const scope = await this.transactionService.getTransactionScope(context.transactionId);
    if (!scope) {
      throw new Error(`Transaction scope not found: ${context.transactionId}`);
    }
    
    this.logger.log(`Cancelling transaction: ${context.transactionId}`);
    
    await this.transactionService.updateTransactionState(
      context.transactionId,
      TransactionState.COMPENSATING
    );
    
    const executedCompensations: string[] = [];
    
    if (context.triggerCompensation) {
      const subscriptions = [...scope.compensationSubscriptions].reverse();
      
      for (const subscription of subscriptions) {
        try {
          if (subscription.handler) {
            await subscription.handler.compensate({
              activityId: subscription.activityId,
              executionId: subscription.executionId,
              processInstanceId: scope.processInstanceId,
              variables: scope.variables,
            });
            
            executedCompensations.push(subscription.activityId);
          }
        } catch (error) {
          this.logger.error(`Compensation failed for: ${subscription.activityId}`, error);
        }
      }
    }
    
    await this.transactionService.updateTransactionState(
      context.transactionId,
      TransactionState.CANCELLED
    );
    
    await this.transactionService.clearCompensationSubscriptions(context.transactionId);
    
    return {
      success: false,
      state: TransactionState.CANCELLED,
      compensationSubscriptions: [],
      executedCompensations,
      variables: scope.variables,
    };
  }

  /**
   * 获取事务作用域
   */
  async getTransactionScope(transactionId: string): Promise<ITransactionScope | null> {
    return this.transactionService.getTransactionScope(transactionId);
  }

  /**
   * 获取补偿订阅
   */
  async getCompensationSubscriptions(
    transactionId: string,
    activityId?: string
  ): Promise<ICompensationEventSubscription[]> {
    return this.transactionService.getCompensationSubscriptions(transactionId, activityId);
  }

  /**
   * 触发补偿
   */
  async triggerCompensation(
    transactionId: string,
    activityIds?: string[]
  ): Promise<string[]> {
    const scope = await this.transactionService.getTransactionScope(transactionId);
    if (!scope) {
      throw new Error(`Transaction scope not found: ${transactionId}`);
    }
    
    const executedCompensations: string[] = [];
    let subscriptions = [...scope.compensationSubscriptions].reverse();
    
    if (activityIds && activityIds.length > 0) {
      subscriptions = subscriptions.filter(s => activityIds.includes(s.activityId));
    }
    
    for (const subscription of subscriptions) {
      try {
        if (subscription.handler) {
          await subscription.handler.compensate({
            activityId: subscription.activityId,
            executionId: subscription.executionId,
            processInstanceId: scope.processInstanceId,
            variables: scope.variables,
          });
          
          executedCompensations.push(subscription.activityId);
        }
      } catch (error) {
        this.logger.error(`Compensation failed for: ${subscription.activityId}`, error);
      }
    }
    
    return executedCompensations;
  }
}
