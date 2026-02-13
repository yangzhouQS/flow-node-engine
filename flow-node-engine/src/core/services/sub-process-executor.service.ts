import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { BpmnElement, BpmnSequenceFlow, BpmnParserService } from './bpmn-parser.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { VariableScopeService, VariableScope } from './variable-scope.service';

/**
 * 子流程执行上下文
 */
export interface SubProcessExecutionContext {
  /** 流程实例ID */
  processInstanceId: string;
  /** 父执行ID */
  parentExecutionId: string;
  /** 子流程元素 */
  subProcessElement: BpmnElement;
  /** 变量 */
  variables: Record<string, any>;
  /** 流程定义ID */
  processDefinitionId?: string;
  /** 租户ID */
  tenantId?: string;
}

/**
 * 子流程执行结果
 */
export interface SubProcessExecutionResult {
  /** 子执行ID */
  executionId: string;
  /** 子流程实例ID（对于调用活动） */
  subProcessInstanceId?: string;
  /** 是否完成 */
  isCompleted: boolean;
  /** 下一个元素ID列表 */
  nextElementIds: string[];
  /** 输出变量 */
  outputVariables?: Record<string, any>;
}

/**
 * 子流程类型
 */
export enum SubProcessType {
  /** 内嵌子流程 */
  EMBEDDED = 'bpmn:SubProcess',
  /** 事件子流程 */
  EVENT = 'bpmn:EventSubProcess',
  /** 调用活动（调用外部流程） */
  CALL_ACTIVITY = 'bpmn:CallActivity',
  /** 事务子流程 */
  TRANSACTION = 'bpmn:Transaction',
  /** 特指子流程 */
  AD_HOC = 'bpmn:AdHocSubProcess',
}

/**
 * 子流程执行器服务
 * 负责执行各种类型的子流程
 */
@Injectable()
export class SubProcessExecutorService {
  private readonly logger = new Logger(SubProcessExecutorService.name);

  constructor(
    private readonly bpmnParser: BpmnParserService,
    private readonly expressionEvaluator: ExpressionEvaluatorService,
    private readonly variableScopeService: VariableScopeService,
  ) {}

  /**
   * 执行内嵌子流程
   * @param context 子流程执行上下文
   * @returns 执行结果
   */
  async executeEmbeddedSubProcess(
    context: SubProcessExecutionContext,
  ): Promise<SubProcessExecutionResult> {
    this.logger.debug(
      `Executing embedded sub-process: ${context.subProcessElement.id}`,
    );

    const { subProcessElement, processInstanceId, parentExecutionId, variables } = context;

    // 1. 创建子流程作用域
    const scopeId = await this.variableScopeService.createScope({
      processInstanceId,
      parentScopeId: parentExecutionId,
      scopeType: VariableScope.SUBPROCESS,
      elementId: subProcessElement.id,
      name: subProcessElement.name || subProcessElement.id,
    });

    // 2. 复制变量到子流程作用域
    await this.variableScopeService.setVariables(scopeId, variables);

    // 3. 查找子流程内的开始事件
    const startEvent = this.findSubProcessStartEvent(subProcessElement);

    if (!startEvent) {
      throw new Error(
        `No start event found in sub-process ${subProcessElement.id}`,
      );
    }

    // 4. 创建子执行实例
    const subExecutionId = uuidv4();

    this.logger.debug(
      `Created sub-execution ${subExecutionId} for sub-process ${subProcessElement.id}`,
    );

    // 5. 返回执行结果（子流程需要继续执行内部流程）
    return {
      executionId: subExecutionId,
      isCompleted: false,
      nextElementIds: [startEvent.id],
      outputVariables: variables,
    };
  }

  /**
   * 完成内嵌子流程
   * @param processInstanceId 流程实例ID
   * @param subProcessElement 子流程元素
   * @param scopeId 作用域ID
   * @returns 下一个元素ID列表
   */
  async completeEmbeddedSubProcess(
    processInstanceId: string,
    subProcessElement: BpmnElement,
    scopeId: string,
  ): Promise<{ nextElementIds: string[]; outputVariables: Record<string, any> }> {
    this.logger.debug(
      `Completing embedded sub-process: ${subProcessElement.id}`,
    );

    // 1. 获取子流程作用域的变量
    const outputVariables = await this.variableScopeService.getVariables(scopeId);

    // 2. 将变量提升到父作用域（根据BPMN配置）
    const parentScope = await this.variableScopeService.getParentScope(scopeId);
    if (parentScope) {
      await this.propagateVariablesToParent(scopeId, parentScope.id_, subProcessElement);
    }

    // 3. 销毁子流程作用域
    await this.variableScopeService.destroyScope(scopeId);

    // 4. 获取子流程的输出流
    const outgoingFlows = this.getSubProcessOutgoingFlows(subProcessElement);
    const nextElementIds = outgoingFlows.map((flow) => flow.targetRef);

    this.logger.debug(
      `Sub-process ${subProcessElement.id} completed, continuing to: ${nextElementIds.join(', ')}`,
    );

    return { nextElementIds, outputVariables };
  }

  /**
   * 查找子流程内的开始事件
   */
  private findSubProcessStartEvent(subProcess: BpmnElement): BpmnElement | null {
    const children = subProcess.children || subProcess.flowElements || [];

    // 查找普通的开始事件
    const startEvent = children.find(
      (child: BpmnElement) => child.type === 'bpmn:StartEvent',
    );

    if (startEvent) {
      return startEvent;
    }

    // 如果没有普通开始事件，查找其他类型的开始事件
    return children.find((child: BpmnElement) =>
      child.type.startsWith('bpmn:StartEvent'),
    );
  }

  /**
   * 获取子流程的输出流
   */
  private getSubProcessOutgoingFlows(subProcess: BpmnElement): BpmnSequenceFlow[] {
    // 子流程的输出流在主流程中定义
    return subProcess.outgoing || [];
  }

  /**
   * 将变量传播到父作用域
   */
  private async propagateVariablesToParent(
    childScopeId: string,
    parentScopeId: string,
    subProcessElement: BpmnElement,
  ): Promise<void> {
    // 获取子流程的所有变量
    const childVariables = await this.variableScopeService.getVariables(childScopeId);

    // 检查是否有数据输出关联
    const dataOutputAssociations = subProcessElement.dataOutputAssociations || [];

    if (dataOutputAssociations.length > 0) {
      // 按照数据输出关联映射变量
      for (const association of dataOutputAssociations) {
        const sourceRef = association.sourceRef;
        const targetRef = association.targetRef;

        if (childVariables[sourceRef] !== undefined) {
          await this.variableScopeService.setVariable(
            parentScopeId,
            targetRef,
            childVariables[sourceRef],
          );
        }
      }
    } else {
      // 如果没有数据输出关联，将所有变量传播到父作用域
      await this.variableScopeService.setVariables(parentScopeId, childVariables);
    }
  }

  /**
   * 判断元素是否为子流程
   */
  isSubProcess(element: BpmnElement): boolean {
    return (
      element.type === SubProcessType.EMBEDDED ||
      element.type === SubProcessType.EVENT ||
      element.type === SubProcessType.CALL_ACTIVITY ||
      element.type === SubProcessType.TRANSACTION ||
      element.type === SubProcessType.AD_HOC
    );
  }

  /**
   * 获取子流程类型
   */
  getSubProcessType(element: BpmnElement): SubProcessType | null {
    switch (element.type) {
      case 'bpmn:SubProcess':
        // 检查是否为事件子流程
        if (element.triggeredByEvent) {
          return SubProcessType.EVENT;
        }
        return SubProcessType.EMBEDDED;
      case 'bpmn:CallActivity':
        return SubProcessType.CALL_ACTIVITY;
      case 'bpmn:Transaction':
        return SubProcessType.TRANSACTION;
      case 'bpmn:AdHocSubProcess':
        return SubProcessType.AD_HOC;
      default:
        return null;
    }
  }

  /**
   * 获取子流程的子元素
   */
  getSubProcessChildren(subProcess: BpmnElement): BpmnElement[] {
    return subProcess.children || subProcess.flowElements || [];
  }

  /**
   * 验证子流程配置
   */
  validateSubProcess(subProcess: BpmnElement): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否有子元素
    const children = this.getSubProcessChildren(subProcess);
    if (children.length === 0) {
      errors.push(`Sub-process ${subProcess.id} has no child elements`);
    }

    // 检查是否有开始事件
    const startEvent = this.findSubProcessStartEvent(subProcess);
    if (!startEvent) {
      errors.push(`Sub-process ${subProcess.id} has no start event`);
    }

    // 检查是否有结束事件
    const endEvents = children.filter(
      (child: BpmnElement) => child.type === 'bpmn:EndEvent',
    );
    if (endEvents.length === 0) {
      this.logger.warn(
        `Sub-process ${subProcess.id} has no end event, may cause execution issues`,
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
