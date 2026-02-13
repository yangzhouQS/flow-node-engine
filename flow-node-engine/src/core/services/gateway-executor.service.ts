import { Injectable, Logger } from '@nestjs/common';

import { BpmnElement, BpmnSequenceFlow } from './bpmn-parser.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { InclusiveGatewayStateService } from './inclusive-gateway-state.service';

/**
 * 网关执行结果
 */
export interface GatewayExecutionResult {
  /** 下一个元素ID列表（对于分叉网关可能有多个） */
  nextElementIds: string[];
  /** 是否需要等待（对于汇聚网关） */
  needsWait: boolean;
  /** 是否为分叉操作 */
  isFork: boolean;
  /** 是否为汇聚操作 */
  isJoin: boolean;
  /** 网关ID */
  gatewayId: string;
  /** 激活的分支数量 */
  activeBranches?: number;
}

/**
 * 网关类型
 */
export enum GatewayType {
  EXCLUSIVE = 'bpmn:ExclusiveGateway',
  PARALLEL = 'bpmn:ParallelGateway',
  INCLUSIVE = 'bpmn:InclusiveGateway',
  EVENT_BASED = 'bpmn:EventBasedGateway',
}

/**
 * 网关执行器服务
 * 负责执行各种类型的网关
 */
@Injectable()
export class GatewayExecutorService {
  private readonly logger = new Logger(GatewayExecutorService.name);

  constructor(
    private readonly expressionEvaluator: ExpressionEvaluatorService,
    private readonly inclusiveGatewayStateService: InclusiveGatewayStateService,
  ) {}

  /**
   * 执行网关
   * @param gateway 网关元素
   * @param outgoingFlows 输出序列流
   * @param variables 变量上下文
   * @param processInstanceId 流程实例ID（用于包容网关状态管理）
   * @param executionId 执行ID
   * @returns 网关执行结果
   */
  async execute(
    gateway: BpmnElement,
    outgoingFlows: BpmnSequenceFlow[],
    variables: Record<string, any>,
    processInstanceId?: string,
    executionId?: string,
  ): Promise<GatewayExecutionResult> {
    this.logger.debug(
      `Executing gateway: ${gateway.id} (${gateway.type})`,
    );

    switch (gateway.type) {
      case GatewayType.EXCLUSIVE:
        return this.executeExclusiveGateway(gateway, outgoingFlows, variables);
      case GatewayType.PARALLEL:
        return this.executeParallelGateway(gateway, outgoingFlows, variables);
      case GatewayType.INCLUSIVE:
        return this.executeInclusiveGateway(
          gateway,
          outgoingFlows,
          variables,
          processInstanceId,
          executionId,
        );
      case GatewayType.EVENT_BASED:
        return this.executeEventBasedGateway(gateway, outgoingFlows, variables);
      default:
        throw new Error(`Unsupported gateway type: ${gateway.type}`);
    }
  }

  /**
   * 执行排他网关
   * 只选择第一个满足条件的序列流
   */
  private executeExclusiveGateway(
    gateway: BpmnElement,
    outgoingFlows: BpmnSequenceFlow[],
    variables: Record<string, any>,
  ): GatewayExecutionResult {
    this.logger.debug(`Executing exclusive gateway: ${gateway.id}`);

    // 查找有条件的序列流
    const conditionalFlows = outgoingFlows.filter(
      (flow) => flow.conditionExpression,
    );

    // 查找默认序列流（没有条件的序列流）
    const defaultFlow = outgoingFlows.find(
      (flow) => !flow.conditionExpression,
    );

    // 评估每个条件，选择第一个满足条件的
    for (const flow of conditionalFlows) {
      try {
        const conditionMet = this.expressionEvaluator.evaluateCondition(
          flow.conditionExpression!,
          variables,
        );

        this.logger.debug(
          `Flow ${flow.id} condition: ${flow.conditionExpression}, result: ${conditionMet}`,
        );

        if (conditionMet) {
          return {
            nextElementIds: [flow.targetRef],
            needsWait: false,
            isFork: false,
            isJoin: false,
            gatewayId: gateway.id,
          };
        }
      } catch (error) {
        this.logger.error(
          `Failed to evaluate condition for flow ${flow.id}: ${error}`,
        );
      }
    }

    // 如果没有条件满足，使用默认序列流
    if (defaultFlow) {
      this.logger.debug(`Using default flow: ${defaultFlow.id}`);
      return {
        nextElementIds: [defaultFlow.targetRef],
        needsWait: false,
        isFork: false,
        isJoin: false,
        gatewayId: gateway.id,
      };
    }

    // 如果没有默认序列流，抛出异常
    throw new Error(
      `No outgoing flow satisfied the condition for exclusive gateway ${gateway.id}`,
    );
  }

  /**
   * 执行并行网关
   * 同时执行所有输出序列流
   */
  private executeParallelGateway(
    gateway: BpmnElement,
    outgoingFlows: BpmnSequenceFlow[],
    variables: Record<string, any>,
  ): GatewayExecutionResult {
    this.logger.debug(`Executing parallel gateway: ${gateway.id}`);

    if (outgoingFlows.length === 0) {
      throw new Error(`No outgoing flows for parallel gateway ${gateway.id}`);
    }

    // 并行网关执行所有输出流
    const nextElementIds = outgoingFlows.map((flow) => flow.targetRef);

    this.logger.debug(
      `Parallel gateway will execute ${nextElementIds.length} flows in parallel`,
    );

    return {
      nextElementIds,
      needsWait: false,
      isFork: nextElementIds.length > 1,
      isJoin: false,
      gatewayId: gateway.id,
      activeBranches: nextElementIds.length,
    };
  }

  /**
   * 执行包容网关
   * 选择所有满足条件的序列流，支持分叉和汇聚
   */
  private async executeInclusiveGateway(
    gateway: BpmnElement,
    outgoingFlows: BpmnSequenceFlow[],
    variables: Record<string, any>,
    processInstanceId?: string,
    executionId?: string,
  ): Promise<GatewayExecutionResult> {
    this.logger.debug(`Executing inclusive gateway: ${gateway.id}`);

    if (!processInstanceId) {
      throw new Error(
        `Process instance ID is required for inclusive gateway ${gateway.id}`,
      );
    }

    // 判断是分叉还是汇聚
    const isIncomingFork = this.isForkGateway(gateway, outgoingFlows);

    if (isIncomingFork) {
      // 分叉逻辑：选择所有满足条件的分支
      return this.executeInclusiveFork(
        gateway,
        outgoingFlows,
        variables,
        processInstanceId,
        executionId,
      );
    } else {
      // 汇聚逻辑：等待所有激活的分支完成
      return this.executeInclusiveJoin(
        gateway,
        processInstanceId,
        executionId,
      );
    }
  }

  /**
   * 判断是否为分叉网关
   */
  private isForkGateway(
    gateway: BpmnElement,
    outgoingFlows: BpmnSequenceFlow[],
  ): boolean {
    // 如果有多个输出流或者输出流有条件，则为分叉
    if (outgoingFlows.length > 1) {
      return true;
    }
    // 如果输出流有条件表达式，也视为分叉
    if (outgoingFlows.length === 1 && outgoingFlows[0].conditionExpression) {
      return true;
    }
    return false;
  }

  /**
   * 执行包容网关分叉逻辑
   * 选择所有满足条件的分支
   */
  private async executeInclusiveFork(
    gateway: BpmnElement,
    outgoingFlows: BpmnSequenceFlow[],
    variables: Record<string, any>,
    processInstanceId: string,
    executionId?: string,
  ): Promise<GatewayExecutionResult> {
    this.logger.debug(`Executing inclusive fork gateway: ${gateway.id}`);

    // 查找有条件的序列流
    const conditionalFlows = outgoingFlows.filter(
      (flow) => flow.conditionExpression,
    );

    // 查找默认序列流
    const defaultFlow = outgoingFlows.find(
      (flow) => !flow.conditionExpression,
    );

    // 评估所有条件，收集满足条件的序列流
    const satisfiedFlows: BpmnSequenceFlow[] = [];

    for (const flow of conditionalFlows) {
      try {
        const conditionMet = this.expressionEvaluator.evaluateCondition(
          flow.conditionExpression!,
          variables,
        );

        this.logger.debug(
          `Flow ${flow.id} condition: ${flow.conditionExpression}, result: ${conditionMet}`,
        );

        if (conditionMet) {
          satisfiedFlows.push(flow);
        }
      } catch (error) {
        this.logger.error(
          `Failed to evaluate condition for flow ${flow.id}: ${error}`,
        );
      }
    }

    // 如果有满足条件的序列流
    if (satisfiedFlows.length > 0) {
      const nextElementIds = satisfiedFlows.map((flow) => flow.targetRef);

      // 创建分叉状态
      await this.inclusiveGatewayStateService.createForkState(
        processInstanceId,
        gateway.id,
        nextElementIds,
        executionId,
      );

      this.logger.debug(
        `Inclusive fork gateway found ${satisfiedFlows.length} satisfied flows`,
      );

      return {
        nextElementIds,
        needsWait: false,
        isFork: true,
        isJoin: false,
        gatewayId: gateway.id,
        activeBranches: nextElementIds.length,
      };
    }

    // 如果没有条件满足，使用默认序列流
    if (defaultFlow) {
      this.logger.debug(`Using default flow: ${defaultFlow.id}`);

      // 创建单分支状态
      await this.inclusiveGatewayStateService.createForkState(
        processInstanceId,
        gateway.id,
        [defaultFlow.targetRef],
        executionId,
      );

      return {
        nextElementIds: [defaultFlow.targetRef],
        needsWait: false,
        isFork: false,
        isJoin: false,
        gatewayId: gateway.id,
        activeBranches: 1,
      };
    }

    // 如果没有默认序列流，抛出异常
    throw new Error(
      `No outgoing flow satisfied the condition for inclusive gateway ${gateway.id}`,
    );
  }

  /**
   * 执行包容网关汇聚逻辑
   * 等待所有激活的分支完成
   */
  private async executeInclusiveJoin(
    gateway: BpmnElement,
    processInstanceId: string,
    executionId?: string,
  ): Promise<GatewayExecutionResult> {
    this.logger.debug(`Executing inclusive join gateway: ${gateway.id}`);

    // 获取或创建汇聚状态
    let joinState = await this.inclusiveGatewayStateService.getJoinState(
      processInstanceId,
      gateway.id,
    );

    if (!joinState) {
      // 第一次到达汇聚点，需要确定等待的分支数
      // 这里需要从分叉状态获取分支数
      const forkStates = await this.inclusiveGatewayStateService.getActiveStates(
        processInstanceId,
      );

      // 找到对应的分叉状态（简化处理，假设只有一个分叉）
      const forkState = forkStates.find((s) => s.gateway_type_ === 'fork');

      if (forkState) {
        const branchTargets = this.inclusiveGatewayStateService.getBranchTargets(forkState);
        joinState = await this.inclusiveGatewayStateService.createJoinState(
          processInstanceId,
          gateway.id,
          branchTargets.length,
          executionId,
        );
      } else {
        // 如果没有分叉状态，假设只有一个分支
        joinState = await this.inclusiveGatewayStateService.createJoinState(
          processInstanceId,
          gateway.id,
          1,
          executionId,
        );
      }
    }

    // 增加已完成分支数
    const { allCompleted } = await this.inclusiveGatewayStateService.incrementCompletedBranches(
      processInstanceId,
      gateway.id,
    );

    if (allCompleted) {
      // 所有分支都已完成，继续执行
      this.logger.debug(
        `Inclusive join gateway ${gateway.id}: all branches completed, continuing`,
      );

      // 完成汇聚状态
      await this.inclusiveGatewayStateService.completeState(
        processInstanceId,
        gateway.id,
      );

      return {
        nextElementIds: [], // 下一个元素由调用者确定
        needsWait: false,
        isFork: false,
        isJoin: true,
        gatewayId: gateway.id,
      };
    } else {
      // 还需要等待其他分支
      this.logger.debug(
        `Inclusive join gateway ${gateway.id}: waiting for more branches`,
      );

      return {
        nextElementIds: [],
        needsWait: true,
        isFork: false,
        isJoin: true,
        gatewayId: gateway.id,
      };
    }
  }

  /**
   * 执行基于事件的网关
   * 等待特定事件触发
   */
  private executeEventBasedGateway(
    gateway: BpmnElement,
    outgoingFlows: BpmnSequenceFlow[],
    variables: Record<string, any>,
  ): GatewayExecutionResult {
    this.logger.debug(`Executing event-based gateway: ${gateway.id}`);

    // 基于事件的网关需要等待事件触发
    // 返回所有可能的下一个元素，等待事件触发
    const nextElementIds = outgoingFlows.map((flow) => flow.targetRef);

    this.logger.debug(
      `Event-based gateway is waiting for events on ${nextElementIds.length} flows`,
    );

    return {
      nextElementIds,
      needsWait: true,
      isFork: false,
      isJoin: false,
      gatewayId: gateway.id,
    };
  }

  /**
   * 验证网关配置
   */
  validateGateway(
    gateway: BpmnElement,
    outgoingFlows: BpmnSequenceFlow[],
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否有输出流
    if (outgoingFlows.length === 0) {
      errors.push(`Gateway ${gateway.id} has no outgoing flows`);
    }

    // 检查排他网关
    if (gateway.type === GatewayType.EXCLUSIVE) {
      const conditionalFlows = outgoingFlows.filter(
        (flow) => flow.conditionExpression,
      );
      const defaultFlow = outgoingFlows.find(
        (flow) => !flow.conditionExpression,
      );

      // 排他网关应该有默认流或者所有流都有条件
      if (conditionalFlows.length === outgoingFlows.length && !defaultFlow) {
        errors.push(
          `Exclusive gateway ${gateway.id} has no default flow`,
        );
      }
    }

    // 检查并行网关
    if (gateway.type === GatewayType.PARALLEL) {
      // 并行网关的所有输出流都不应该有条件
      const conditionalFlows = outgoingFlows.filter(
        (flow) => flow.conditionExpression,
      );
      if (conditionalFlows.length > 0) {
        errors.push(
          `Parallel gateway ${gateway.id} should not have conditional flows`,
        );
      }
    }

    // 检查包容网关
    if (gateway.type === GatewayType.INCLUSIVE) {
      const conditionalFlows = outgoingFlows.filter(
        (flow) => flow.conditionExpression,
      );
      const defaultFlow = outgoingFlows.find(
        (flow) => !flow.conditionExpression,
      );

      // 包容网关应该有默认流
      if (conditionalFlows.length > 0 && !defaultFlow) {
        this.logger.warn(
          `Inclusive gateway ${gateway.id} has no default flow, may cause execution to fail`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 获取满足条件的分支（用于包容网关）
   */
  async getSatisfiedBranches(
    gateway: BpmnElement,
    outgoingFlows: BpmnSequenceFlow[],
    variables: Record<string, any>,
  ): Promise<BpmnSequenceFlow[]> {
    const satisfiedFlows: BpmnSequenceFlow[] = [];

    for (const flow of outgoingFlows) {
      if (flow.conditionExpression) {
        try {
          const conditionMet = this.expressionEvaluator.evaluateCondition(
            flow.conditionExpression,
            variables,
          );
          if (conditionMet) {
            satisfiedFlows.push(flow);
          }
        } catch (error) {
          this.logger.error(
            `Failed to evaluate condition for flow ${flow.id}: ${error}`,
          );
        }
      } else {
        // 没有条件的流作为默认流
        satisfiedFlows.push(flow);
      }
    }

    return satisfiedFlows;
  }
}
