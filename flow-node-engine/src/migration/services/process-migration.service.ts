/**
 * 流程迁移服务
 * 对应Flowable的ProcessMigrationService
 * 提供流程实例迁移的主要API
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  MigrationPlan,
  MigrationResult,
  MigrationValidationResult,
  MigrationOptions,
  MigrationBatchConfig,
  MigrationEvent,
  MigrationEventType,
  MigrationEventListener,
  MigrationStatus,
} from '../interfaces/migration.interface';
import { MigrationValidatorService } from './migration-validator.service';
import { MigrationExecutorService } from './migration-executor.service';
import { ProcessInstanceRepository } from '../../core/repositories/process-instance.repository';
import { ProcessDefinitionRepository } from '../../core/repositories/process-definition.repository';

/**
 * 流程迁移服务
 * 提供流程实例从一个流程定义迁移到另一个流程定义的能力
 */
@Injectable()
export class ProcessMigrationService {
  private readonly logger = new Logger(ProcessMigrationService.name);

  constructor(
    private readonly validator: MigrationValidatorService,
    private readonly executor: MigrationExecutorService,
    private readonly processInstanceRepository: ProcessInstanceRepository,
    private readonly processDefinitionRepository: ProcessDefinitionRepository
  ) {}

  /**
   * 创建迁移计划构建器
   * @param sourceProcessDefinitionId 源流程定义ID
   * @param targetProcessDefinitionId 目标流程定义ID
   * @returns 迁移计划构建器
   */
  createMigrationPlanBuilder(
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string
  ): MigrationPlanBuilderImpl {
    return new MigrationPlanBuilderImpl(sourceProcessDefinitionId, targetProcessDefinitionId);
  }

  /**
   * 验证迁移计划
   * @param plan 迁移计划
   * @returns 验证结果
   */
  async validateMigrationPlan(plan: MigrationPlan): Promise<MigrationValidationResult> {
    this.logger.debug('验证迁移计划');
    return this.validator.validatePlan(plan);
  }

  /**
   * 执行迁移
   * @param plan 迁移计划
   * @param processInstanceIds 要迁移的流程实例ID列表
   * @param options 迁移选项
   * @returns 迁移结果
   */
  async migrate(
    plan: MigrationPlan,
    processInstanceIds: string[],
    options?: MigrationOptions
  ): Promise<MigrationResult> {
    this.logger.log(
      `开始执行迁移: ${processInstanceIds.length} 个流程实例, ` +
        `从 ${plan.sourceProcessDefinitionId} 到 ${plan.targetProcessDefinitionId}`
    );

    return this.executor.migrate(plan, processInstanceIds, options);
  }

  /**
   * 批量迁移
   * @param plan 迁移计划
   * @param processInstanceIds 要迁移的流程实例ID列表
   * @param config 批量配置
   * @param options 迁移选项
   * @returns 迁移结果
   */
  async migrateBatch(
    plan: MigrationPlan,
    processInstanceIds: string[],
    config?: MigrationBatchConfig,
    options?: MigrationOptions
  ): Promise<MigrationResult> {
    this.logger.log(
      `开始批量迁移: ${processInstanceIds.length} 个流程实例, ` +
        `批大小=${config?.batchSize || 10}, 并行=${config?.parallel || false}`
    );

    return this.executor.migrateBatch(plan, processInstanceIds, config, options);
  }

  /**
   * 迁移指定流程定义的所有流程实例
   * @param sourceProcessDefinitionId 源流程定义ID
   * @param targetProcessDefinitionId 目标流程定义ID
   * @param options 迁移选项
   * @param config 批量配置
   * @returns 迁移结果
   */
  async migrateAllProcessInstances(
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string,
    options?: MigrationOptions,
    config?: MigrationBatchConfig
  ): Promise<MigrationResult> {
    // 获取所有活动流程实例
    const processInstances = await this.processInstanceRepository.findByProcessDefinitionId(
      sourceProcessDefinitionId
    );

    const processInstanceIds = processInstances
      .filter((pi) => pi.status === 'ACTIVE')
      .map((pi) => pi.id);

    if (processInstanceIds.length === 0) {
      this.logger.warn('没有找到需要迁移的流程实例');
      return {
        success: true,
        migratedProcessInstanceIds: [],
        failedProcessInstanceIds: [],
        failures: [],
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
      };
    }

    // 创建自动映射的迁移计划
    const plan = await this.createAutoMappingPlan(
      sourceProcessDefinitionId,
      targetProcessDefinitionId
    );

    return this.migrateBatch(plan, processInstanceIds, config, options);
  }

  /**
   * 创建自动映射的迁移计划
   * 自动映射相同ID的活动
   */
  private async createAutoMappingPlan(
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string
  ): Promise<MigrationPlan> {
    const sourceDefinition = await this.processDefinitionRepository.findById(
      sourceProcessDefinitionId
    );
    const targetDefinition = await this.processDefinitionRepository.findById(
      targetProcessDefinitionId
    );

    if (!sourceDefinition || !targetDefinition) {
      throw new Error('流程定义不存在');
    }

    // 解析BPMN获取活动列表
    const sourceActivities = this.extractActivityIds(sourceDefinition.bpmnXml);
    const targetActivities = this.extractActivityIds(targetDefinition.bpmnXml);

    // 自动映射相同ID的活动
    const activityMappings = sourceActivities
      .filter((id) => targetActivities.includes(id))
      .map((id) => ({
        sourceActivityId: id,
        targetActivityId: id,
        isNewActivity: false,
      }));

    return {
      sourceProcessDefinitionId,
      targetProcessDefinitionId,
      activityMappings,
      options: {
        validate: true,
      },
    };
  }

  /**
   * 从BPMN XML中提取活动ID列表
   */
  private extractActivityIds(bpmnXml: string): string[] {
    const activityIds: string[] = [];
    const activityIdPattern = /id="([^"]+)"/g;
    let match;

    while ((match = activityIdPattern.exec(bpmnXml)) !== null) {
      // 过滤掉非活动ID（如流程ID、消息ID等）
      const id = match[1];
      if (
        !id.startsWith('message_') &&
        !id.startsWith('signal_') &&
        !id.startsWith('error_') &&
        !id.startsWith('escalation_')
      ) {
        activityIds.push(id);
      }
    }

    return activityIds;
  }

  /**
   * 添加迁移事件监听器
   */
  addMigrationEventListener(listener: MigrationEventListener): void {
    this.executor.addEventListener(listener);
  }

  /**
   * 移除迁移事件监听器
   */
  removeMigrationEventListener(listener: MigrationEventListener): void {
    this.executor.removeEventListener(listener);
  }

  /**
   * 获取迁移状态
   */
  getMigrationStatus(migrationId: string): MigrationStatus | undefined {
    return this.executor.getMigrationStatus(migrationId);
  }

  /**
   * 取消迁移
   */
  async cancelMigration(migrationId: string): Promise<boolean> {
    return this.executor.cancelMigration(migrationId);
  }

  /**
   * 预览迁移影响
   * 分析迁移将影响的流程实例数量和相关资源
   */
  async previewMigrationImpact(
    sourceProcessDefinitionId: string,
    targetProcessDefinitionId: string
  ): Promise<MigrationImpactPreview> {
    const processInstances = await this.processInstanceRepository.findByProcessDefinitionId(
      sourceProcessDefinitionId
    );

    const activeInstances = processInstances.filter((pi) => pi.status === 'ACTIVE');
    const suspendedInstances = processInstances.filter((pi) => pi.status === 'SUSPENDED');

    // 统计任务数量
    let totalTasks = 0;
    let totalJobs = 0;
    let totalVariables = 0;

    for (const instance of activeInstances) {
      // 这里可以添加更详细的统计逻辑
      totalTasks += instance.taskCount || 0;
      totalJobs += instance.jobCount || 0;
      totalVariables += instance.variableCount || 0;
    }

    return {
      sourceProcessDefinitionId,
      targetProcessDefinitionId,
      totalProcessInstances: processInstances.length,
      activeProcessInstances: activeInstances.length,
      suspendedProcessInstances: suspendedInstances.length,
      estimatedTasks: totalTasks,
      estimatedJobs: totalJobs,
      estimatedVariables: totalVariables,
      warnings: [],
    };
  }

  /**
   * 回滚迁移
   * 将已迁移的流程实例回滚到原始流程定义
   */
  async rollbackMigration(
    originalPlan: MigrationPlan,
    migratedProcessInstanceIds: string[],
    options?: MigrationOptions
  ): Promise<MigrationResult> {
    this.logger.log(`开始回滚迁移: ${migratedProcessInstanceIds.length} 个流程实例`);

    // 创建反向迁移计划
    const rollbackPlan: MigrationPlan = {
      sourceProcessDefinitionId: originalPlan.targetProcessDefinitionId,
      targetProcessDefinitionId: originalPlan.sourceProcessDefinitionId,
      activityMappings: originalPlan.activityMappings.map((m) => ({
        sourceActivityId: m.targetActivityId,
        targetActivityId: m.sourceActivityId,
      })),
      variableMappings: originalPlan.variableMappings?.map((m) => ({
        sourceVariableName: m.targetVariableName,
        targetVariableName: m.sourceVariableName,
        variableType: m.variableType,
      })),
      options: originalPlan.options,
    };

    return this.migrate(rollbackPlan, migratedProcessInstanceIds, options);
  }
}

/**
 * 迁移计划构建器实现
 */
class MigrationPlanBuilderImpl {
  private plan: MigrationPlan;

  constructor(sourceProcessDefinitionId: string, targetProcessDefinitionId: string) {
    this.plan = {
      sourceProcessDefinitionId,
      targetProcessDefinitionId,
      activityMappings: [],
      variableMappings: [],
      options: {},
    };
  }

  /**
   * 添加活动映射
   */
  mapActivities(sourceActivityId: string, targetActivityId: string): this {
    this.plan.activityMappings.push({
      sourceActivityId,
      targetActivityId,
    });
    return this;
  }

  /**
   * 批量添加活动映射
   */
  mapActivitiesBatch(mappings: { source: string; target: string }[]): this {
    for (const mapping of mappings) {
      this.plan.activityMappings.push({
        sourceActivityId: mapping.source,
        targetActivityId: mapping.target,
      });
    }
    return this;
  }

  /**
   * 添加变量映射
   */
  mapVariables(sourceVariableName: string, targetVariableName: string): this {
    if (!this.plan.variableMappings) {
      this.plan.variableMappings = [];
    }
    this.plan.variableMappings.push({
      sourceVariableName,
      targetVariableName,
    });
    return this;
  }

  /**
   * 设置保留流程实例ID
   */
  keepProcessInstanceId(keep: boolean): this {
    this.plan.options = { ...this.plan.options, keepProcessInstanceId: keep };
    return this;
  }

  /**
   * 设置保留业务键
   */
  keepBusinessKey(keep: boolean): this {
    this.plan.options = { ...this.plan.options, keepBusinessKey: keep };
    return this;
  }

  /**
   * 设置保留变量
   */
  keepVariables(keep: boolean): this {
    this.plan.options = { ...this.plan.options, keepVariables: keep };
    return this;
  }

  /**
   * 设置保留任务
   */
  keepTasks(keep: boolean): this {
    this.plan.options = { ...this.plan.options, keepTasks: keep };
    return this;
  }

  /**
   * 设置保留作业
   */
  keepJobs(keep: boolean): this {
    this.plan.options = { ...this.plan.options, keepJobs: keep };
    return this;
  }

  /**
   * 设置保留事件订阅
   */
  keepEventSubscriptions(keep: boolean): this {
    this.plan.options = { ...this.plan.options, keepEventSubscriptions: keep };
    return this;
  }

  /**
   * 设置跳过自定义监听器
   */
  skipCustomListeners(skip: boolean): this {
    this.plan.options = { ...this.plan.options, skipCustomListeners: skip };
    return this;
  }

  /**
   * 设置跳过IO映射
   */
  skipIoMappings(skip: boolean): this {
    this.plan.options = { ...this.plan.options, skipIoMappings: skip };
    return this;
  }

  /**
   * 设置验证
   */
  validate(validate: boolean): this {
    this.plan.options = { ...this.plan.options, validate };
    return this;
  }

  /**
   * 设置超时时间
   */
  timeout(timeoutMs: number): this {
    this.plan.options = { ...this.plan.options, timeout: timeoutMs };
    return this;
  }

  /**
   * 构建迁移计划
   */
  build(): MigrationPlan {
    return { ...this.plan };
  }
}

/**
 * 迁移影响预览
 */
export interface MigrationImpactPreview {
  /** 源流程定义ID */
  sourceProcessDefinitionId: string;
  /** 目标流程定义ID */
  targetProcessDefinitionId: string;
  /** 总流程实例数 */
  totalProcessInstances: number;
  /** 活动流程实例数 */
  activeProcessInstances: number;
  /** 挂起流程实例数 */
  suspendedProcessInstances: number;
  /** 预估任务数 */
  estimatedTasks: number;
  /** 预估作业数 */
  estimatedJobs: number;
  /** 预估变量数 */
  estimatedVariables: number;
  /** 警告信息 */
  warnings: string[];
}
