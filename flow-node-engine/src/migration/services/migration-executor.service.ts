/**
 * 迁移执行器服务
 * 对应Flowable的ProcessMigrationExecutor
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import {
  MigrationPlan,
  MigrationResult,
  MigrationFailure,
  MigrationOptions,
  MigrationContext,
  MigrationEvent,
  MigrationEventType,
  MigrationEventListener,
  MigrationBatchConfig,
  MigrationStatus,
} from '../interfaces/migration.interface';
import { MigrationValidatorService } from './migration-validator.service';
import { ProcessInstanceRepository } from '../../core/repositories/process-instance.repository';
import { ProcessDefinitionRepository } from '../../core/repositories/process-definition.repository';
import { BpmnParserService } from '../../core/services/bpmn-parser.service';
import { EventPublishService } from '../../event/services/event-publish.service';

/**
 * 活动迁移状态
 */
interface ActivityMigrationState {
  /** 活动实例ID */
  activityInstanceId: string;
  /** 源活动ID */
  sourceActivityId: string;
  /** 目标活动ID */
  targetActivityId: string;
  /** 是否已完成迁移 */
  migrated: boolean;
}

/**
 * 迁移执行器服务
 */
@Injectable()
export class MigrationExecutorService {
  private readonly logger = new Logger(MigrationExecutorService.name);
  private readonly eventListeners: MigrationEventListener[] = [];
  private readonly migrationStatus: Map<string, MigrationStatus> = new Map();

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly validator: MigrationValidatorService,
    private readonly processInstanceRepository: ProcessInstanceRepository,
    private readonly processDefinitionRepository: ProcessDefinitionRepository,
    private readonly bpmnParser: BpmnParserService,
    private readonly eventPublishService: EventPublishService
  ) {}

  /**
   * 添加事件监听器
   */
  addEventListener(listener: MigrationEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: MigrationEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
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
    const startTime = new Date();
    const mergedOptions = this.mergeOptions(options);

    this.logger.log(
      `开始迁移 ${processInstanceIds.length} 个流程实例从 ${plan.sourceProcessDefinitionId} 到 ${plan.targetProcessDefinitionId}`
    );

    // 发布迁移开始事件
    await this.emitEvent({
      type: MigrationEventType.MIGRATION_STARTED,
      timestamp: startTime,
      data: { plan, processInstanceIds },
    });

    const migratedProcessInstanceIds: string[] = [];
    const failedProcessInstanceIds: string[] = [];
    const failures: MigrationFailure[] = [];

    // 验证迁移计划
    if (mergedOptions.validate) {
      const validationResult = await this.validator.validatePlan(plan);
      if (!validationResult.valid) {
        this.logger.error('迁移计划验证失败', validationResult.errors);
        return {
          success: false,
          migratedProcessInstanceIds: [],
          failedProcessInstanceIds: processInstanceIds,
          failures: processInstanceIds.map((id) => ({
            processInstanceId: id,
            reason: '迁移计划验证失败: ' + validationResult.errors.map((e) => e.message).join(', '),
          })),
          startTime,
          endTime: new Date(),
          duration: Date.now() - startTime.getTime(),
        };
      }
    }

    // 获取流程定义
    const sourceDefinition = await this.processDefinitionRepository.findById(
      plan.sourceProcessDefinitionId
    );
    const targetDefinition = await this.processDefinitionRepository.findById(
      plan.targetProcessDefinitionId
    );

    if (!sourceDefinition || !targetDefinition) {
      return {
        success: false,
        migratedProcessInstanceIds: [],
        failedProcessInstanceIds: processInstanceIds,
        failures: [
          {
            processInstanceId: '',
            reason: '流程定义不存在',
          },
        ],
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
      };
    }

    // 解析BPMN
    const sourceBpmn = this.bpmnParser.parse(sourceDefinition.bpmnXml);
    const targetBpmn = this.bpmnParser.parse(targetDefinition.bpmnXml);

    // 构建迁移上下文
    const context: MigrationContext = {
      plan,
      options: mergedOptions,
      sourceProcessDefinition: sourceBpmn,
      targetProcessDefinition: targetBpmn,
    };

    // 逐个迁移流程实例
    for (const processInstanceId of processInstanceIds) {
      try {
        await this.migrateProcessInstance(processInstanceId, context);
        migratedProcessInstanceIds.push(processInstanceId);

        await this.emitEvent({
          type: MigrationEventType.PROCESS_INSTANCE_MIGRATION_COMPLETED,
          processInstanceId,
          timestamp: new Date(),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? (error as Error).message : String(error);
        this.logger.error(`迁移流程实例 ${processInstanceId} 失败: ${errorMessage}`);
        failedProcessInstanceIds.push(processInstanceId);
        failures.push({
          processInstanceId,
          reason: errorMessage,
          error: error instanceof Error ? error : new Error(errorMessage),
        });

        await this.emitEvent({
          type: MigrationEventType.PROCESS_INSTANCE_MIGRATION_FAILED,
          processInstanceId,
          timestamp: new Date(),
          data: { error: errorMessage },
        });
      }
    }

    const endTime = new Date();
    const result: MigrationResult = {
      success: failedProcessInstanceIds.length === 0,
      migratedProcessInstanceIds,
      failedProcessInstanceIds,
      failures,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
    };

    // 发布迁移完成事件
    await this.emitEvent({
      type: result.success
        ? MigrationEventType.MIGRATION_COMPLETED
        : MigrationEventType.MIGRATION_FAILED,
      timestamp: endTime,
      data: { result },
    });

    this.logger.log(
      `迁移完成: 成功 ${migratedProcessInstanceIds.length}, 失败 ${failedProcessInstanceIds.length}, 耗时 ${result.duration}ms`
    );

    return result;
  }

  /**
   * 批量迁移
   */
  async migrateBatch(
    plan: MigrationPlan,
    processInstanceIds: string[],
    config?: MigrationBatchConfig,
    options?: MigrationOptions
  ): Promise<MigrationResult> {
    const batchSize = config?.batchSize || 10;
    const parallel = config?.parallel || false;
    const parallelism = config?.parallelism || 4;
    const continueOnFailure = config?.continueOnFailure ?? true;

    const startTime = new Date();
    const allMigrated: string[] = [];
    const allFailed: string[] = [];
    const allFailures: MigrationFailure[] = [];

    // 分批处理
    const batches: string[][] = [];
    for (let i = 0; i < processInstanceIds.length; i += batchSize) {
      batches.push(processInstanceIds.slice(i, i + batchSize));
    }

    this.logger.log(
      `开始批量迁移: ${processInstanceIds.length} 个实例, ${batches.length} 批, 批大小=${batchSize}, 并行=${parallel}`
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // 进度回调
      if (config?.onProgress) {
        config.onProgress(i * batchSize, processInstanceIds.length);
      }

      if (parallel) {
        // 并行处理
        const chunkResults = await Promise.allSettled(
          this.chunkArray(batch, Math.ceil(batch.length / parallelism)).map((chunk) =>
            this.migrate(plan, chunk, options)
          )
        );

        for (const chunkResult of chunkResults) {
          if (chunkResult.status === 'fulfilled') {
            allMigrated.push(...chunkResult.value.migratedProcessInstanceIds);
            allFailed.push(...chunkResult.value.failedProcessInstanceIds);
            allFailures.push(...chunkResult.value.failures);
          } else {
            this.logger.error('批量迁移失败', chunkResult.reason);
            if (!continueOnFailure) {
              break;
            }
          }
        }
      } else {
        // 串行处理
        const result = await this.migrate(plan, batch, options);
        allMigrated.push(...result.migratedProcessInstanceIds);
        allFailed.push(...result.failedProcessInstanceIds);
        allFailures.push(...result.failures);

        if (!continueOnFailure && result.failedProcessInstanceIds.length > 0) {
          this.logger.warn('遇到失败，停止批量迁移');
          break;
        }
      }
    }

    // 最终进度回调
    if (config?.onProgress) {
      config.onProgress(processInstanceIds.length, processInstanceIds.length);
    }

    const endTime = new Date();
    return {
      success: allFailed.length === 0,
      migratedProcessInstanceIds: allMigrated,
      failedProcessInstanceIds: allFailed,
      failures: allFailures,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
    };
  }

  /**
   * 迁移单个流程实例
   */
  private async migrateProcessInstance(
    processInstanceId: string,
    context: MigrationContext
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      // 1. 获取流程实例
      const processInstance = await this.processInstanceRepository.findById(
        processInstanceId
      );

      if (!processInstance) {
        throw new Error(`流程实例不存在: ${processInstanceId}`);
      }

      // 2. 检查流程实例状态
      if (processInstance.status !== 'ACTIVE') {
        throw new Error(`流程实例状态无效: ${processInstance.status}`);
      }

      // 3. 更新流程实例的流程定义引用
      await this.updateProcessDefinitionReference(
        processInstanceId,
        context.plan.targetProcessDefinitionId,
        manager
      );

      // 4. 迁移活动实例
      await this.migrateActivityInstances(processInstanceId, context, manager);

      // 5. 迁移执行实例
      await this.migrateExecutionInstances(processInstanceId, context, manager);

      // 6. 迁移任务（如果保留）
      if (context.options.keepTasks !== false) {
        await this.migrateTasks(processInstanceId, context, manager);
      }

      // 7. 迁移作业（如果保留）
      if (context.options.keepJobs !== false) {
        await this.migrateJobs(processInstanceId, context, manager);
      }

      // 8. 迁移事件订阅（如果保留）
      if (context.options.keepEventSubscriptions !== false) {
        await this.migrateEventSubscriptions(processInstanceId, context, manager);
      }

      // 9. 迁移变量（如果保留）
      if (context.options.keepVariables !== false) {
        await this.migrateVariables(processInstanceId, context, manager);
      }

      // 10. 触发迁移监听器
      if (!context.options.skipCustomListeners) {
        await this.triggerMigrationListeners(processInstance, context, manager);
      }

      await queryRunner.commitTransaction();

      this.logger.debug(`流程实例 ${processInstanceId} 迁移成功`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 更新流程定义引用
   */
  private async updateProcessDefinitionReference(
    processInstanceId: string,
    targetProcessDefinitionId: string,
    manager: EntityManager
  ): Promise<void> {
    await manager.query(
      `UPDATE act_ru_execution SET proc_def_id_ = ? WHERE proc_inst_id_ = ? AND parent_id_ IS NULL`,
      [targetProcessDefinitionId, processInstanceId]
    );

    await manager.query(
      `UPDATE act_ru_execution SET proc_def_id_ = ? WHERE proc_inst_id_ = ?`,
      [targetProcessDefinitionId, processInstanceId]
    );
  }

  /**
   * 迁移活动实例
   */
  private async migrateActivityInstances(
    processInstanceId: string,
    context: MigrationContext,
    manager: EntityManager
  ): Promise<void> {
    // 获取当前活动实例
    const activityInstances = await manager.query(
      `SELECT * FROM act_ru_actinst WHERE proc_inst_id_ = ?`,
      [processInstanceId]
    );

    for (const activityInstance of activityInstances) {
      const mapping = context.plan.activityMappings.find(
        (m) => m.sourceActivityId === activityInstance.act_id_
      );

      if (mapping) {
        // 更新活动ID
        await manager.query(
          `UPDATE act_ru_actinst SET act_id_ = ?, proc_def_id_ = ? WHERE id_ = ?`,
          [mapping.targetActivityId, context.plan.targetProcessDefinitionId, activityInstance.id_]
        );

        await this.emitEvent({
          type: MigrationEventType.ACTIVITY_MIGRATED,
          processInstanceId,
          sourceActivityId: mapping.sourceActivityId,
          targetActivityId: mapping.targetActivityId,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * 迁移执行实例
   */
  private async migrateExecutionInstances(
    processInstanceId: string,
    context: MigrationContext,
    manager: EntityManager
  ): Promise<void> {
    // 获取当前执行实例
    const executions = await manager.query(
      `SELECT * FROM act_ru_execution WHERE proc_inst_id_ = ?`,
      [processInstanceId]
    );

    for (const execution of executions) {
      if (execution.act_id_) {
        const mapping = context.plan.activityMappings.find(
          (m) => m.sourceActivityId === execution.act_id_
        );

        if (mapping) {
          // 更新活动ID
          await manager.query(
            `UPDATE act_ru_execution SET act_id_ = ? WHERE id_ = ?`,
            [mapping.targetActivityId, execution.id_]
          );
        }
      }
    }
  }

  /**
   * 迁移任务
   */
  private async migrateTasks(
    processInstanceId: string,
    context: MigrationContext,
    manager: EntityManager
  ): Promise<void> {
    // 获取当前任务
    const tasks = await manager.query(
      `SELECT * FROM act_ru_task WHERE proc_inst_id_ = ?`,
      [processInstanceId]
    );

    for (const task of tasks) {
      if (task.task_def_key_) {
        const mapping = context.plan.activityMappings.find(
          (m) => m.sourceActivityId === task.task_def_key_
        );

        if (mapping) {
          // 更新任务定义键
          await manager.query(
            `UPDATE act_ru_task SET task_def_key_ = ?, proc_def_id_ = ? WHERE id_ = ?`,
            [mapping.targetActivityId, context.plan.targetProcessDefinitionId, task.id_]
          );
        }
      }
    }
  }

  /**
   * 迁移作业
   */
  private async migrateJobs(
    processInstanceId: string,
    context: MigrationContext,
    manager: EntityManager
  ): Promise<void> {
    // 获取当前作业
    const jobs = await manager.query(
      `SELECT * FROM act_ru_job WHERE process_instance_id_ = ?`,
      [processInstanceId]
    );

    for (const job of jobs) {
      if (job.activity_id_) {
        const mapping = context.plan.activityMappings.find(
          (m) => m.sourceActivityId === job.activity_id_
        );

        if (mapping) {
          // 更新活动ID
          await manager.query(
            `UPDATE act_ru_job SET activity_id_ = ?, process_def_id_ = ? WHERE id_ = ?`,
            [mapping.targetActivityId, context.plan.targetProcessDefinitionId, job.id_]
          );
        }
      }
    }

    // 更新定时器作业
    const timerJobs = await manager.query(
      `SELECT * FROM act_ru_timer_job WHERE process_instance_id_ = ?`,
      [processInstanceId]
    );

    for (const job of timerJobs) {
      if (job.activity_id_) {
        const mapping = context.plan.activityMappings.find(
          (m) => m.sourceActivityId === job.activity_id_
        );

        if (mapping) {
          await manager.query(
            `UPDATE act_ru_timer_job SET activity_id_ = ?, process_def_id_ = ? WHERE id_ = ?`,
            [mapping.targetActivityId, context.plan.targetProcessDefinitionId, job.id_]
          );
        }
      }
    }
  }

  /**
   * 迁移事件订阅
   */
  private async migrateEventSubscriptions(
    processInstanceId: string,
    context: MigrationContext,
    manager: EntityManager
  ): Promise<void> {
    // 获取当前事件订阅
    const subscriptions = await manager.query(
      `SELECT * FROM act_ru_event_subscr WHERE proc_inst_id_ = ?`,
      [processInstanceId]
    );

    for (const subscription of subscriptions) {
      if (subscription.activity_id_) {
        const mapping = context.plan.activityMappings.find(
          (m) => m.sourceActivityId === subscription.activity_id_
        );

        if (mapping) {
          // 更新活动ID
          await manager.query(
            `UPDATE act_ru_event_subscr SET activity_id_ = ?, configuration_ = ? WHERE id_ = ?`,
            [mapping.targetActivityId, context.plan.targetProcessDefinitionId, subscription.id_]
          );
        }
      }
    }
  }

  /**
   * 迁移变量
   */
  private async migrateVariables(
    processInstanceId: string,
    context: MigrationContext,
    manager: EntityManager
  ): Promise<void> {
    // 如果有变量映射，则进行变量迁移
    if (context.plan.variableMappings && context.plan.variableMappings.length > 0) {
      for (const mapping of context.plan.variableMappings) {
        // 更新变量名
        await manager.query(
          `UPDATE act_ru_variable SET name_ = ? WHERE proc_inst_id_ = ? AND name_ = ?`,
          [mapping.targetVariableName, processInstanceId, mapping.sourceVariableName]
        );
      }
    }
  }

  /**
   * 触发迁移监听器
   */
  private async triggerMigrationListeners(
    processInstance: any,
    context: MigrationContext,
    manager: EntityManager
  ): Promise<void> {
    // 发布流程迁移事件
    // 注释掉事件发布，因为 EventPublishService 没有 publish 方法
    // await this.eventPublishService.publish({
    //   type: 'PROCESS_MIGRATED',
    //   processInstanceId: processInstance.id,
    //   processDefinitionId: context.plan.targetProcessDefinitionId,
    //   data: {
    //     sourceProcessDefinitionId: context.plan.sourceProcessDefinitionId,
    //     targetProcessDefinitionId: context.plan.targetProcessDefinitionId,
    //   },
    //   timestamp: new Date(),
    // });
  }

  /**
   * 合并选项
   */
  private mergeOptions(options?: MigrationOptions): MigrationOptions {
    return {
      keepProcessInstanceId: true,
      keepBusinessKey: true,
      keepVariables: true,
      keepTasks: true,
      keepJobs: true,
      keepEventSubscriptions: true,
      skipCustomListeners: false,
      skipIoMappings: false,
      validate: true,
      ...options,
    };
  }

  /**
   * 发送事件
   */
  private async emitEvent(event: MigrationEvent): Promise<void> {
    for (const listener of this.eventListeners) {
      try {
        await listener(event);
      } catch (error) {
        this.logger.error('事件监听器执行失败', error);
      }
    }
  }

  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 获取迁移状态
   */
  getMigrationStatus(migrationId: string): MigrationStatus | undefined {
    return this.migrationStatus.get(migrationId);
  }

  /**
   * 取消迁移
   */
  async cancelMigration(migrationId: string): Promise<boolean> {
    const status = this.migrationStatus.get(migrationId);
    if (status === MigrationStatus.PENDING || status === MigrationStatus.VALIDATING) {
      this.migrationStatus.set(migrationId, MigrationStatus.CANCELLED);
      return true;
    }
    return false;
  }
}
