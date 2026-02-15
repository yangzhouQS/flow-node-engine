/**
 * 迁移验证器服务
 * 对应Flowable的ProcessMigrationValidationService
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  MigrationPlan,
  MigrationValidationResult,
  MigrationValidationError,
  MigrationValidationWarning,
  MigrationErrorType,
  MigrationWarningType,
  MigrationContext,
  ActivityMapping,
} from '../interfaces/migration.interface';
import { ProcessDefinitionRepository } from '../../core/repositories/process-definition.repository';
import { BpmnParserService } from '../../core/services/bpmn-parser.service';

/**
 * 活动类型兼容性映射
 */
const ACTIVITY_TYPE_COMPATIBILITY: Record<string, string[]> = {
  'userTask': ['userTask'],
  'serviceTask': ['serviceTask', 'sendTask', 'scriptTask', 'businessRuleTask'],
  'scriptTask': ['scriptTask', 'serviceTask'],
  'sendTask': ['sendTask', 'serviceTask'],
  'businessRuleTask': ['businessRuleTask', 'serviceTask'],
  'manualTask': ['manualTask'],
  'receiveTask': ['receiveTask'],
  'exclusiveGateway': ['exclusiveGateway'],
  'parallelGateway': ['parallelGateway'],
  'inclusiveGateway': ['inclusiveGateway'],
  'eventBasedGateway': ['eventBasedGateway'],
  'startEvent': ['startEvent'],
  'endEvent': ['endEvent'],
  'intermediateCatchEvent': ['intermediateCatchEvent'],
  'intermediateThrowEvent': ['intermediateThrowEvent'],
  'boundaryEvent': ['boundaryEvent'],
  'subProcess': ['subProcess', 'callActivity'],
  'callActivity': ['callActivity', 'subProcess'],
  'transaction': ['transaction', 'subProcess'],
  'adHocSubProcess': ['adHocSubProcess'],
};

/**
 * 迁移验证器服务
 */
@Injectable()
export class MigrationValidatorService {
  private readonly logger = new Logger(MigrationValidatorService.name);

  constructor(
    private readonly processDefinitionRepository: ProcessDefinitionRepository,
    private readonly bpmnParser: BpmnParserService
  ) {}

  /**
   * 验证迁移计划
   * @param plan 迁移计划
   * @returns 验证结果
   */
  async validatePlan(plan: MigrationPlan): Promise<MigrationValidationResult> {
    const errors: MigrationValidationError[] = [];
    const warnings: MigrationValidationWarning[] = [];

    // 1. 验证流程定义存在性
    const definitionErrors = await this.validateProcessDefinitions(plan);
    errors.push(...definitionErrors);

    if (errors.length > 0) {
      return { valid: false, errors, warnings };
    }

    // 2. 获取流程定义
    const sourceDefinition = await this.processDefinitionRepository.findById(
      plan.sourceProcessDefinitionId
    );
    const targetDefinition = await this.processDefinitionRepository.findById(
      plan.targetProcessDefinitionId
    );

    if (!sourceDefinition || !targetDefinition) {
      return {
        valid: false,
        errors: [
          {
            type: MigrationErrorType.PROCESS_DEFINITION_NOT_FOUND,
            message: '流程定义不存在',
          },
        ],
        warnings,
      };
    }

    // 3. 解析BPMN
    const sourceBpmn = this.bpmnParser.parse(sourceDefinition.bpmnXml);
    const targetBpmn = this.bpmnParser.parse(targetDefinition.bpmnXml);

    // 4. 构建迁移上下文
    const context: MigrationContext = {
      plan,
      options: plan.options || {},
      sourceProcessDefinition: sourceBpmn,
      targetProcessDefinition: targetBpmn,
    };

    // 5. 验证活动映射
    const mappingResults = await this.validateActivityMappings(
      plan.activityMappings,
      context
    );
    errors.push(...mappingResults.errors);
    warnings.push(...mappingResults.warnings);

    // 6. 验证变量映射
    if (plan.variableMappings && plan.variableMappings.length > 0) {
      const variableErrors = this.validateVariableMappings(plan.variableMappings);
      errors.push(...variableErrors);
    }

    // 7. 验证流程结构兼容性
    const structureResults = await this.validateStructureCompatibility(context);
    errors.push(...structureResults.errors);
    warnings.push(...structureResults.warnings);

    // 8. 检测潜在问题
    const potentialIssues = await this.detectPotentialIssues(context);
    warnings.push(...potentialIssues);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 验证流程定义存在性
   */
  private async validateProcessDefinitions(
    plan: MigrationPlan
  ): Promise<MigrationValidationError[]> {
    const errors: MigrationValidationError[] = [];

    if (!plan.sourceProcessDefinitionId) {
      errors.push({
        type: MigrationErrorType.PROCESS_DEFINITION_NOT_FOUND,
        message: '源流程定义ID不能为空',
      });
    }

    if (!plan.targetProcessDefinitionId) {
      errors.push({
        type: MigrationErrorType.PROCESS_DEFINITION_NOT_FOUND,
        message: '目标流程定义ID不能为空',
      });
    }

    if (plan.sourceProcessDefinitionId === plan.targetProcessDefinitionId) {
      errors.push({
        type: MigrationErrorType.PROCESS_DEFINITION_NOT_FOUND,
        message: '源流程定义和目标流程定义不能相同',
      });
    }

    return errors;
  }

  /**
   * 验证活动映射
   */
  private async validateActivityMappings(
    mappings: ActivityMapping[],
    context: MigrationContext
  ): Promise<{ errors: MigrationValidationError[]; warnings: MigrationValidationWarning[] }> {
    const errors: MigrationValidationError[] = [];
    const warnings: MigrationValidationWarning[] = [];

    const sourceActivities = this.getAllActivities(context.sourceProcessDefinition);
    const targetActivities = this.getAllActivities(context.targetProcessDefinition);

    const sourceActivityMap = new Map(sourceActivities.map((a) => [a.id, a]));
    const targetActivityMap = new Map(targetActivities.map((a) => [a.id, a]));

    for (const mapping of mappings) {
      // 验证源活动存在
      const sourceActivity = sourceActivityMap.get(mapping.sourceActivityId);
      if (!sourceActivity) {
        errors.push({
          type: MigrationErrorType.SOURCE_ACTIVITY_NOT_FOUND,
          message: `源活动不存在: ${mapping.sourceActivityId}`,
          sourceActivityId: mapping.sourceActivityId,
        });
        continue;
      }

      // 验证目标活动存在
      const targetActivity = targetActivityMap.get(mapping.targetActivityId);
      if (!targetActivity) {
        errors.push({
          type: MigrationErrorType.TARGET_ACTIVITY_NOT_FOUND,
          message: `目标活动不存在: ${mapping.targetActivityId}`,
          targetActivityId: mapping.targetActivityId,
        });
        continue;
      }

      // 验证活动类型兼容性
      const typeError = this.validateActivityTypeCompatibility(
        sourceActivity,
        targetActivity
      );
      if (typeError) {
        errors.push(typeError);
      }

      // 验证多实例配置
      const miError = this.validateMultiInstanceCompatibility(
        sourceActivity,
        targetActivity
      );
      if (miError) {
        errors.push(miError);
      }
    }

    // 检查未映射的活动
    const mappedSourceIds = new Set(mappings.map((m) => m.sourceActivityId));
    const mappedTargetIds = new Set(mappings.map((m) => m.targetActivityId));

    for (const activity of sourceActivities) {
      if (!mappedSourceIds.has(activity.id) && !this.isAutoMappable(activity)) {
        warnings.push({
          type: MigrationWarningType.ACTIVITY_WILL_BE_SKIPPED,
          message: `源活动未映射，迁移时将被跳过: ${activity.id}`,
          sourceActivityId: activity.id,
        });
      }
    }

    for (const activity of targetActivities) {
      if (!mappedTargetIds.has(activity.id)) {
        warnings.push({
          type: MigrationWarningType.ACTIVITY_WILL_BE_SKIPPED,
          message: `目标活动未映射，这是新增的活动: ${activity.id}`,
          targetActivityId: activity.id,
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * 验证活动类型兼容性
   */
  private validateActivityTypeCompatibility(
    sourceActivity: any,
    targetActivity: any
  ): MigrationValidationError | null {
    const sourceType = sourceActivity.$type;
    const targetType = targetActivity.$type;

    // 相同类型总是兼容
    if (sourceType === targetType) {
      return null;
    }

    // 检查兼容性映射
    const compatibleTypes = ACTIVITY_TYPE_COMPATIBILITY[sourceType] || [];
    if (!compatibleTypes.includes(targetType)) {
      return {
        type: MigrationErrorType.ACTIVITY_TYPE_MISMATCH,
        message: `活动类型不兼容: ${sourceType} -> ${targetType}`,
        sourceActivityId: sourceActivity.id,
        targetActivityId: targetActivity.id,
      };
    }

    return null;
  }

  /**
   * 验证多实例配置兼容性
   */
  private validateMultiInstanceCompatibility(
    sourceActivity: any,
    targetActivity: any
  ): MigrationValidationError | null {
    const sourceMi = sourceActivity.multiInstanceLoopCharacteristics;
    const targetMi = targetActivity.multiInstanceLoopCharacteristics;

    // 两者都没有多实例配置，兼容
    if (!sourceMi && !targetMi) {
      return null;
    }

    // 一个有多实例配置，一个没有，不兼容
    if ((sourceMi && !targetMi) || (!sourceMi && targetMi)) {
      return {
        type: MigrationErrorType.MULTI_INSTANCE_INCOMPATIBLE,
        message: '多实例配置不兼容：一个活动有多实例配置，另一个没有',
        sourceActivityId: sourceActivity.id,
        targetActivityId: targetActivity.id,
      };
    }

    // 都有多实例配置，检查是否兼容
    if (sourceMi && targetMi) {
      // 检查是否都是并行或都是串行
      if (sourceMi.isSequential !== targetMi.isSequential) {
        return {
          type: MigrationErrorType.MULTI_INSTANCE_INCOMPATIBLE,
          message: '多实例配置不兼容：并行/串行模式不匹配',
          sourceActivityId: sourceActivity.id,
          targetActivityId: targetActivity.id,
        };
      }
    }

    return null;
  }

  /**
   * 验证变量映射
   */
  private validateVariableMappings(
    mappings: { sourceVariableName: string; targetVariableName: string }[]
  ): MigrationValidationError[] {
    const errors: MigrationValidationError[] = [];

    for (const mapping of mappings) {
      if (!mapping.sourceVariableName) {
        errors.push({
          type: MigrationErrorType.VARIABLE_TYPE_MISMATCH,
          message: '源变量名不能为空',
        });
      }

      if (!mapping.targetVariableName) {
        errors.push({
          type: MigrationErrorType.VARIABLE_TYPE_MISMATCH,
          message: '目标变量名不能为空',
        });
      }
    }

    return errors;
  }

  /**
   * 验证流程结构兼容性
   */
  private async validateStructureCompatibility(
    context: MigrationContext
  ): Promise<{ errors: MigrationValidationError[]; warnings: MigrationValidationWarning[] }> {
    const errors: MigrationValidationError[] = [];
    const warnings: MigrationValidationWarning[] = [];

    // 验证并行网关
    const parallelGatewayErrors = this.validateParallelGateways(context);
    errors.push(...parallelGatewayErrors);

    // 验证子流程
    const subProcessResults = this.validateSubProcesses(context);
    errors.push(...subProcessResults.errors);
    warnings.push(...subProcessResults.warnings);

    return { errors, warnings };
  }

  /**
   * 验证并行网关兼容性
   */
  private validateParallelGateways(context: MigrationContext): MigrationValidationError[] {
    const errors: MigrationValidationError[] = [];

    const sourceGateways = this.getParallelGateways(context.sourceProcessDefinition);
    const targetGateways = this.getParallelGateways(context.targetProcessDefinition);

    // 检查并行网关数量是否匹配
    if (sourceGateways.length !== targetGateways.length) {
      // 这可能只是一个警告，而不是错误
      this.logger.warn(
        `并行网关数量不匹配: 源=${sourceGateways.length}, 目标=${targetGateways.length}`
      );
    }

    return errors;
  }

  /**
   * 验证子流程兼容性
   */
  private validateSubProcesses(
    context: MigrationContext
  ): { errors: MigrationValidationError[]; warnings: MigrationValidationWarning[] } {
    const errors: MigrationValidationError[] = [];
    const warnings: MigrationValidationWarning[] = [];

    const sourceSubProcesses = this.getSubProcesses(context.sourceProcessDefinition);
    const targetSubProcesses = this.getSubProcesses(context.targetProcessDefinition);

    // 检查子流程映射
    const mappedSubProcesses = context.plan.activityMappings.filter((m) =>
      sourceSubProcesses.some((s) => s.id === m.sourceActivityId)
    );

    for (const mapping of mappedSubProcesses) {
      const sourceSubProcess = sourceSubProcesses.find(
        (s) => s.id === mapping.sourceActivityId
      );
      const targetSubProcess = targetSubProcesses.find(
        (s) => s.id === mapping.targetActivityId
      );

      if (!targetSubProcess) {
        errors.push({
          type: MigrationErrorType.SUB_PROCESS_INCOMPATIBLE,
          message: `子流程映射目标不存在: ${mapping.targetActivityId}`,
          sourceActivityId: mapping.sourceActivityId,
          targetActivityId: mapping.targetActivityId,
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * 检测潜在问题
   */
  private async detectPotentialIssues(
    context: MigrationContext
  ): Promise<MigrationValidationWarning[]> {
    const warnings: MigrationValidationWarning[] = [];

    // 检测可能丢失的变量
    const sourceVariables = this.getProcessVariables(context.sourceProcessDefinition);
    const targetVariables = this.getProcessVariables(context.targetProcessDefinition);

    const mappedVariableNames = new Set(
      context.plan.variableMappings?.map((m) => m.sourceVariableName) || []
    );

    for (const variable of sourceVariables) {
      if (!targetVariables.includes(variable) && !mappedVariableNames.has(variable)) {
        warnings.push({
          type: MigrationWarningType.VARIABLE_WILL_BE_LOST,
          message: `变量可能丢失: ${variable}`,
        });
      }
    }

    // 检测监听器问题
    const sourceListeners = this.getAllListeners(context.sourceProcessDefinition);
    if (sourceListeners.length > 0 && context.options.skipCustomListeners) {
      warnings.push({
        type: MigrationWarningType.LISTENER_NOT_TRIGGERED,
        message: '自定义监听器将被跳过',
      });
    }

    return warnings;
  }

  /**
   * 获取所有活动
   */
  private getAllActivities(definition: any): any[] {
    const activities: any[] = [];
    const process = definition.rootElements?.find((e: any) => e.$type === 'process');
    if (!process) return activities;

    const traverse = (elements: any[]) => {
      for (const element of elements) {
        if (this.isActivity(element)) {
          activities.push(element);
        }
        if (element.flowElements) {
          traverse(element.flowElements);
        }
      }
    };

    traverse(process.flowElements || []);
    return activities;
  }

  /**
   * 判断是否为活动节点
   */
  private isActivity(element: any): boolean {
    const activityTypes = [
      'userTask',
      'serviceTask',
      'scriptTask',
      'sendTask',
      'businessRuleTask',
      'manualTask',
      'receiveTask',
      'exclusiveGateway',
      'parallelGateway',
      'inclusiveGateway',
      'eventBasedGateway',
      'startEvent',
      'endEvent',
      'intermediateCatchEvent',
      'intermediateThrowEvent',
      'boundaryEvent',
      'subProcess',
      'callActivity',
      'transaction',
      'adHocSubProcess',
    ];
    return activityTypes.some((type) => element.$type?.includes(type));
  }

  /**
   * 判断活动是否可自动映射
   */
  private isAutoMappable(activity: any): boolean {
    // 相同ID的活动可以自动映射
    return true;
  }

  /**
   * 获取并行网关
   */
  private getParallelGateways(definition: any): any[] {
    return this.getAllActivities(definition).filter(
      (a) => a.$type === 'parallelGateway'
    );
  }

  /**
   * 获取子流程
   */
  private getSubProcesses(definition: any): any[] {
    return this.getAllActivities(definition).filter(
      (a) => a.$type === 'subProcess' || a.$type === 'callActivity'
    );
  }

  /**
   * 获取流程变量
   */
  private getProcessVariables(definition: any): string[] {
    const variables: Set<string> = new Set();
    const process = definition.rootElements?.find((e: any) => e.$type === 'process');
    if (!process) return [];

    const extractVariables = (element: any) => {
      // 从IO映射中提取变量
      if (element.extensionElements?.values) {
        for (const ext of element.extensionElements.values) {
          if (ext.$type === 'flowable:inputOutput') {
            for (const param of ext.inputParameters || []) {
              if (param.name) variables.add(param.name);
            }
            for (const param of ext.outputParameters || []) {
              if (param.name) variables.add(param.name);
            }
          }
        }
      }

      // 从表单属性中提取变量
      if (element.formProperties) {
        for (const prop of element.formProperties) {
          if (prop.id) variables.add(prop.id);
        }
      }

      // 递归处理子元素
      if (element.flowElements) {
        for (const child of element.flowElements) {
          extractVariables(child);
        }
      }
    };

    extractVariables(process);
    return Array.from(variables);
  }

  /**
   * 获取所有监听器
   */
  private getAllListeners(definition: any): any[] {
    const listeners: any[] = [];
    const process = definition.rootElements?.find((e: any) => e.$type === 'process');
    if (!process) return listeners;

    const extractListeners = (element: any) => {
      if (element.extensionElements?.values) {
        for (const ext of element.extensionElements.values) {
          if (
            ext.$type === 'flowable:executionListener' ||
            ext.$type === 'flowable:taskListener'
          ) {
            listeners.push(ext);
          }
        }
      }

      if (element.flowElements) {
        for (const child of element.flowElements) {
          extractListeners(child);
        }
      }
    };

    extractListeners(process);
    return listeners;
  }

  /**
   * 验证单个流程实例迁移
   */
  async validateProcessInstance(
    plan: MigrationPlan,
    processInstanceId: string
  ): Promise<MigrationValidationResult> {
    // 首先验证计划
    const planResult = await this.validatePlan(plan);
    if (!planResult.valid) {
      return planResult;
    }

    const errors: MigrationValidationError[] = [];
    const warnings: MigrationValidationWarning[] = [...planResult.warnings];

    // 这里可以添加针对特定流程实例的验证逻辑
    // 例如：检查流程实例当前状态是否可迁移

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
