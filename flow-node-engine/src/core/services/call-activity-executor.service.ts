import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { BpmnElement } from './bpmn-parser.service';
import { ExpressionEvaluatorService } from './expression-evaluator.service';
import { ProcessInstanceService } from './process-instance.service';
import { VariableScopeService } from './variable-scope.service';

/**
 * 调用活动执行上下文
 */
export interface CallActivityExecutionContext {
  /** 流程实例ID */
  processInstanceId: string;
  /** 执行ID */
  executionId: string;
  /** 调用活动元素 */
  callActivityElement: BpmnElement;
  /** 变量 */
  variables: Record<string, any>;
  /** 流程定义ID */
  processDefinitionId?: string;
  /** 租户ID */
  tenantId?: string;
}

/**
 * 调用活动执行结果
 */
export interface CallActivityExecutionResult {
  /** 子流程实例ID */
  subProcessInstanceId: string;
  /** 是否完成 */
  isCompleted: boolean;
  /** 是否异步 */
  isAsync: boolean;
  /** 输出变量 */
  outputVariables?: Record<string, any>;
}

/**
 * 参数映射配置
 */
export interface ParameterMapping {
  /** 源变量名 */
  source: string;
  /** 目标变量名 */
  target: string;
  /** 源表达式 */
  sourceExpression?: string;
  /** 是否全部复制 */
  all?: boolean;
}

/**
 * 调用活动执行器服务
 * 负责执行调用活动（Call Activity），包括子流程调用和参数映射
 */
@Injectable()
export class CallActivityExecutorService {
  private readonly logger = new Logger(CallActivityExecutorService.name);

  constructor(
    private readonly expressionEvaluator: ExpressionEvaluatorService,
    private readonly variableScopeService: VariableScopeService,
    private readonly processInstanceService: ProcessInstanceService,
  ) {}

  /**
   * 执行调用活动
   * @param context 调用活动执行上下文
   * @returns 执行结果
   */
  async executeCallActivity(
    context: CallActivityExecutionContext,
  ): Promise<CallActivityExecutionResult> {
    this.logger.debug(
      `Executing call activity: ${context.callActivityElement.id}`,
    );

    const { callActivityElement, variables, processInstanceId, tenantId } = context;

    // 1. 获取被调用的流程定义Key
    const calledElementKey = await this.getCalledElementKey(
      callActivityElement,
      variables,
    );

    if (!calledElementKey) {
      throw new Error(
        `Call activity ${callActivityElement.id} has no called element defined`,
      );
    }

    this.logger.debug(
      `Call activity ${callActivityElement.id} calling process: ${calledElementKey}`,
    );

    // 2. 准备输入参数
    const inputVariables = await this.mapInputParameters(
      callActivityElement,
      variables,
    );

    // 3. 创建子流程实例
    const subProcessInstanceId = uuidv4();

    // 4. 启动子流程实例
    await this.processInstanceService.startProcessInstance({
      processDefinitionKey: calledElementKey,
      businessKey: variables.businessKey,
      variables: inputVariables,
      processInstanceId: subProcessInstanceId,
      tenantId,
      parentProcessInstanceId: processInstanceId,
    });

    this.logger.debug(
      `Started sub-process instance ${subProcessInstanceId} for call activity ${callActivityElement.id}`,
    );

    // 5. 检查是否异步调用
    const isAsync = this.isAsyncCall(callActivityElement);

    return {
      subProcessInstanceId,
      isCompleted: false,
      isAsync,
      outputVariables: {},
    };
  }

  /**
   * 完成调用活动
   * 当子流程完成时调用
   * @param context 执行上下文
   * @param subProcessInstanceId 子流程实例ID
   * @param outputVariables 子流程输出变量
   * @returns 输出变量
   */
  async completeCallActivity(
    context: CallActivityExecutionContext,
    subProcessInstanceId: string,
    outputVariables: Record<string, any>,
  ): Promise<Record<string, any>> {
    this.logger.debug(
      `Completing call activity: ${context.callActivityElement.id}`,
    );

    const { callActivityElement, variables } = context;

    // 1. 映射输出参数
    const mappedOutput = await this.mapOutputParameters(
      callActivityElement,
      outputVariables,
      variables,
    );

    this.logger.debug(
      `Call activity ${callActivityElement.id} completed with output: ${JSON.stringify(mappedOutput)}`,
    );

    return mappedOutput;
  }

  /**
   * 获取被调用的流程定义Key
   */
  private async getCalledElementKey(
    callActivity: BpmnElement,
    variables: Record<string, any>,
  ): Promise<string | null> {
    // 首先检查是否有calledElementBinding（表达式）
    if (callActivity.calledElementBinding) {
      try {
        const result = await this.expressionEvaluator.evaluate(
          callActivity.calledElementBinding,
          variables,
        );
        if (result) {
          return String(result);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to evaluate calledElementBinding: ${error}`,
        );
      }
    }

    // 使用静态的calledElement
    return callActivity.calledElement || null;
  }

  /**
   * 映射输入参数
   */
  private async mapInputParameters(
    callActivity: BpmnElement,
    parentVariables: Record<string, any>,
  ): Promise<Record<string, any>> {
    const inputVariables: Record<string, any> = {};

    // 获取输入参数映射
    const ioSpecification = callActivity.ioSpecification;
    const dataInputAssociations = callActivity.dataInputAssociations || [];

    if (ioSpecification?.dataInputs) {
      // 使用IO规范映射
      for (const dataInput of ioSpecification.dataInputs) {
        const name = dataInput.name;
        if (name && parentVariables[name] !== undefined) {
          inputVariables[name] = parentVariables[name];
        }
      }
    }

    // 使用数据输入关联映射
    for (const association of dataInputAssociations) {
      if (association.sourceRef && association.targetRef) {
        // 检查是否是全部复制
        if (association.all) {
          Object.assign(inputVariables, parentVariables);
          break;
        }

        // 单个变量映射
        const sourceValue = await this.getSourceValue(
          association,
          parentVariables,
        );
        const targetName = this.getTargetName(association);
        if (targetName && sourceValue !== undefined) {
          inputVariables[targetName] = sourceValue;
        }
      }
    }

    // 如果没有定义任何映射，默认复制所有变量
    if (
      (!ioSpecification?.dataInputs) &&
      dataInputAssociations.length === 0
    ) {
      Object.assign(inputVariables, parentVariables);
    }

    return inputVariables;
  }

  /**
   * 映射输出参数
   */
  private async mapOutputParameters(
    callActivity: BpmnElement,
    subProcessVariables: Record<string, any>,
    parentVariables: Record<string, any>,
  ): Promise<Record<string, any>> {
    const outputVariables: Record<string, any> = {};

    // 获取输出参数映射
    const ioSpecification = callActivity.ioSpecification;
    const dataOutputAssociations = callActivity.dataOutputAssociations || [];

    if (ioSpecification?.dataOutputs) {
      // 使用IO规范映射
      for (const dataOutput of ioSpecification.dataOutputs) {
        const name = dataOutput.name;
        if (name && subProcessVariables[name] !== undefined) {
          outputVariables[name] = subProcessVariables[name];
        }
      }
    }

    // 使用数据输出关联映射
    for (const association of dataOutputAssociations) {
      if (association.sourceRef && association.targetRef) {
        // 检查是否是全部复制
        if (association.all) {
          Object.assign(outputVariables, subProcessVariables);
          break;
        }

        // 单个变量映射
        const sourceName = association.sourceRef;
        const targetName = association.targetRef;
        if (subProcessVariables[sourceName] !== undefined) {
          outputVariables[targetName] = subProcessVariables[sourceName];
        }
      }
    }

    return outputVariables;
  }

  /**
   * 获取源值
   */
  private async getSourceValue(
    association: ParameterMapping,
    variables: Record<string, any>,
  ): Promise<any> {
    // 如果有表达式，先计算表达式
    if (association.sourceExpression) {
      try {
        return await this.expressionEvaluator.evaluate(
          association.sourceExpression,
          variables,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to evaluate source expression: ${error}`,
        );
        return undefined;
      }
    }

    // 否则直接获取变量值
    return variables[association.source];
  }

  /**
   * 获取目标名称
   */
  private getTargetName(association: ParameterMapping): string | null {
    return association.target || null;
  }

  /**
   * 检查是否异步调用
   */
  private isAsyncCall(callActivity: BpmnElement): boolean {
    // 检查async属性
    return callActivity.async === true || callActivity.asyncBefore === true;
  }

  /**
   * 获取调用活动的流程定义版本
   */
  private async getCalledProcessVersion(
    callActivity: BpmnElement,
    variables: Record<string, any>,
  ): Promise<string | null> {
    // 检查是否有版本标签表达式
    if (callActivity.calledElementVersionTag) {
      try {
        const result = await this.expressionEvaluator.evaluate(
          callActivity.calledElementVersionTag,
          variables,
        );
        return result ? String(result) : null;
      } catch (error) {
        this.logger.warn(
          `Failed to evaluate calledElementVersionTag: ${error}`,
        );
      }
    }

    return null;
  }

  /**
   * 验证调用活动配置
   */
  validateCallActivity(callActivity: BpmnElement): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否有被调用的元素
    if (!callActivity.calledElement && !callActivity.calledElementBinding) {
      errors.push(
        `Call activity ${callActivity.id} has no called element defined`,
      );
    }

    // 检查IO规范是否完整
    const ioSpecification = callActivity.ioSpecification;
    if (ioSpecification) {
      // 检查数据输入是否有效
      if (ioSpecification.dataInputs) {
        for (const input of ioSpecification.dataInputs) {
          if (!input.name) {
            errors.push(
              `Data input in call activity ${callActivity.id} has no name`,
            );
          }
        }
      }

      // 检查数据输出是否有效
      if (ioSpecification.dataOutputs) {
        for (const output of ioSpecification.dataOutputs) {
          if (!output.name) {
            errors.push(
              `Data output in call activity ${callActivity.id} has no name`,
            );
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 判断元素是否为调用活动
   */
  isCallActivity(element: BpmnElement): boolean {
    return element.type === 'bpmn:CallActivity';
  }
}
