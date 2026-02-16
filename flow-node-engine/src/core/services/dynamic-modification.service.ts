/**
 * 动态流程修改服务（与Flowable DynamicBpmnService行为保持一致）
 * 
 * 核心功能：
 * 1. 动态修改流程定义 - 在运行时修改已部署的流程定义
 * 2. 活动添加/删除 - 动态添加或删除流程活动
 * 3. 连线修改 - 动态修改流程连线
 * 4. 属性修改 - 动态修改活动属性
 * 
 * 参考实现：Flowable DynamicBpmnServiceImpl
 */

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  ModificationType,
  IDynamicModification,
  IAddActivityData,
  IRemoveActivityData,
  IAddSequenceFlowData,
  IModifyPropertyData,
  IDynamicModificationContext,
  IModificationResult,
  IBatchModificationRequest,
  IProcessDefinitionDiff,
  IDynamicProcessService,
  IDynamicModificationBuilder,
} from '../interfaces/dynamic-modification.interface';
import { IBpmnActivity, IBpmnSequenceFlow, IBpmnProcess } from '../interfaces/bpmn-process.interface';
import { ProcessDefinitionService } from './process-definition.service';

/**
 * 修改记录实体
 */
interface IModificationRecord {
  id: string;
  processDefinitionId: string;
  newProcessDefinitionId: string;
  modifications: IDynamicModification[];
  context: IDynamicModificationContext;
  createdAt: Date;
  rolledBack: boolean;
}

/**
 * 动态修改构建器实现
 */
class DynamicModificationBuilder implements IDynamicModificationBuilder {
  private modifications: IDynamicModification[] = [];
  private context: IDynamicModificationContext;

  constructor(processDefinitionId: string, tenantId?: string) {
    this.context = {
      processDefinitionId,
      tenantId,
      validate: true,
      immediate: true,
    };
  }

  addUserTask(activityId: string, name: string): this {
    this.modifications.push({
      id: uuidv4(),
      type: ModificationType.ADD_ACTIVITY,
      targetActivityId: activityId,
      data: {
        activityType: 'userTask',
        activityId,
        name,
      },
      createdAt: new Date(),
    });
    return this;
  }

  addServiceTask(activityId: string, name: string, implementation?: string): this {
    this.modifications.push({
      id: uuidv4(),
      type: ModificationType.ADD_ACTIVITY,
      targetActivityId: activityId,
      data: {
        activityType: 'serviceTask',
        activityId,
        name,
        config: { implementation },
      },
      createdAt: new Date(),
    });
    return this;
  }

  addGateway(activityId: string, gatewayType: string): this {
    this.modifications.push({
      id: uuidv4(),
      type: ModificationType.ADD_GATEWAY,
      targetActivityId: activityId,
      data: {
        activityType: gatewayType,
        activityId,
      },
      createdAt: new Date(),
    });
    return this;
  }

  addSequenceFlow(
    sequenceFlowId: string,
    sourceRef: string,
    targetRef: string,
    conditionExpression?: string
  ): this {
    this.modifications.push({
      id: uuidv4(),
      type: ModificationType.ADD_SEQUENCE_FLOW,
      targetSequenceFlowId: sequenceFlowId,
      data: {
        sequenceFlowId,
        sourceRef,
        targetRef,
        conditionExpression,
      },
      createdAt: new Date(),
    });
    return this;
  }

  removeActivity(activityId: string): this {
    this.modifications.push({
      id: uuidv4(),
      type: ModificationType.REMOVE_ACTIVITY,
      targetActivityId: activityId,
      data: {
        activityId,
        removeSequenceFlows: true,
      },
      createdAt: new Date(),
    });
    return this;
  }

  changeActivityProperty(activityId: string, property: string, value: any): this {
    this.modifications.push({
      id: uuidv4(),
      type: ModificationType.MODIFY_PROPERTY,
      targetActivityId: activityId,
      data: {
        propertyPath: property,
        newValue: value,
      },
      createdAt: new Date(),
    });
    return this;
  }

  setSequenceFlowCondition(sequenceFlowId: string, condition: string): this {
    this.modifications.push({
      id: uuidv4(),
      type: ModificationType.UPDATE_SEQUENCE_FLOW,
      targetSequenceFlowId: sequenceFlowId,
      data: {
        propertyPath: 'conditionExpression',
        newValue: condition,
      },
      createdAt: new Date(),
    });
    return this;
  }

  build(): IBatchModificationRequest {
    return {
      context: this.context,
      modifications: this.modifications,
      atomic: true,
    };
  }
}

/**
 * 动态流程修改服务
 */
@Injectable()
export class DynamicProcessService implements IDynamicProcessService {
  private readonly logger = new Logger(DynamicProcessService.name);
  private modificationRecords: Map<string, IModificationRecord> = new Map();
  private processDefinitions: Map<string, IBpmnProcess> = new Map();

  constructor() {}

  /**
   * 创建修改构建器
   */
  createBuilder(processDefinitionId: string, tenantId?: string): IDynamicModificationBuilder {
    return new DynamicModificationBuilder(processDefinitionId, tenantId);
  }

  /**
   * 执行动态修改
   */
  async executeModification(request: IBatchModificationRequest): Promise<IModificationResult> {
    const { context, modifications, atomic = true } = request;
    const executedModifications: IDynamicModification[] = [];
    const validationErrors: string[] = [];

    try {
      // 1. 验证修改
      if (context.validate !== false) {
        const validation = await this.validateModifications(modifications, context);
        if (!validation.valid) {
          return {
            success: false,
            executedModifications: [],
            validationErrors: validation.errors,
          };
        }
      }

      // 2. 获取原始流程定义
      const originalProcess = await this.getProcessDefinition(context.processDefinitionId);
      if (!originalProcess) {
        return {
          success: false,
          executedModifications: [],
          errorMessage: `Process definition not found: ${context.processDefinitionId}`,
        };
      }

      // 3. 克隆流程定义用于修改
      const modifiedProcess = this.cloneProcessDefinition(originalProcess);

      // 4. 执行每个修改操作
      for (const modification of modifications) {
        try {
          await this.applyModification(modifiedProcess, modification);
          executedModifications.push(modification);
        } catch (error) {
          if (atomic) {
            // 原子操作，遇到错误回滚
            return {
              success: false,
              executedModifications: [],
              errorMessage: `Atomic modification failed: ${(error as Error).message}`,
            };
          }
          // 非原子操作，记录错误继续
          validationErrors.push(`Modification ${modification.id} failed: ${(error as Error).message}`);
        }
      }

      // 5. 生成新的流程定义ID
      const newProcessDefinitionId = this.generateNewProcessDefinitionId(
        context.processDefinitionId
      );

      // 6. 保存修改后的流程定义
      modifiedProcess.id = newProcessDefinitionId;
      this.processDefinitions.set(newProcessDefinitionId, modifiedProcess);

      // 7. 记录修改历史
      const record: IModificationRecord = {
        id: uuidv4(),
        processDefinitionId: context.processDefinitionId,
        newProcessDefinitionId,
        modifications: executedModifications,
        context,
        createdAt: new Date(),
        rolledBack: false,
      };
      this.modificationRecords.set(record.id, record);

      this.logger.log(
        `Dynamic modification completed: ${context.processDefinitionId} -> ${newProcessDefinitionId}`
      );

      return {
        success: true,
        newProcessDefinitionId,
        executedModifications,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      };
    } catch (error) {
      this.logger.error(`Dynamic modification failed: ${(error as Error).message}`, (error as Error).stack);
      return {
        success: false,
        executedModifications,
        errorMessage: (error as Error).message,
      };
    }
  }

  /**
   * 添加活动
   */
  async addActivity(
    context: IDynamicModificationContext,
    data: IAddActivityData
  ): Promise<IModificationResult> {
    const modification: IDynamicModification = {
      id: uuidv4(),
      type: ModificationType.ADD_ACTIVITY,
      targetActivityId: data.activityId,
      data,
      createdAt: new Date(),
    };

    return this.executeModification({
      context,
      modifications: [modification],
      atomic: true,
    });
  }

  /**
   * 删除活动
   */
  async removeActivity(
    context: IDynamicModificationContext,
    data: IRemoveActivityData
  ): Promise<IModificationResult> {
    const modification: IDynamicModification = {
      id: uuidv4(),
      type: ModificationType.REMOVE_ACTIVITY,
      targetActivityId: data.activityId,
      data,
      createdAt: new Date(),
    };

    return this.executeModification({
      context,
      modifications: [modification],
      atomic: true,
    });
  }

  /**
   * 添加连线
   */
  async addSequenceFlow(
    context: IDynamicModificationContext,
    data: IAddSequenceFlowData
  ): Promise<IModificationResult> {
    const modification: IDynamicModification = {
      id: uuidv4(),
      type: ModificationType.ADD_SEQUENCE_FLOW,
      targetSequenceFlowId: data.sequenceFlowId,
      data,
      createdAt: new Date(),
    };

    return this.executeModification({
      context,
      modifications: [modification],
      atomic: true,
    });
  }

  /**
   * 修改属性
   */
  async modifyProperty(
    context: IDynamicModificationContext,
    activityId: string,
    data: IModifyPropertyData
  ): Promise<IModificationResult> {
    const modification: IDynamicModification = {
      id: uuidv4(),
      type: ModificationType.MODIFY_PROPERTY,
      targetActivityId: activityId,
      data,
      createdAt: new Date(),
    };

    return this.executeModification({
      context,
      modifications: [modification],
      atomic: true,
    });
  }

  /**
   * 计算流程定义差异
   */
  async calculateDiff(
    oldProcessDefinitionId: string,
    newProcessDefinitionId: string
  ): Promise<IProcessDefinitionDiff> {
    const oldProcess = await this.getProcessDefinition(oldProcessDefinitionId);
    const newProcess = await this.getProcessDefinition(newProcessDefinitionId);

    if (!oldProcess || !newProcess) {
      throw new Error('Process definition not found');
    }

    const diff: IProcessDefinitionDiff = {
      addedActivities: [],
      removedActivities: [],
      modifiedActivities: [],
      addedSequenceFlows: [],
      removedSequenceFlows: [],
      modifiedSequenceFlows: [],
    };

    // 计算活动差异
    const oldActivityMap = new Map(oldProcess.activities?.map((a) => [a.id, a]) || []);
    const newActivityMap = new Map(newProcess.activities?.map((a) => [a.id, a]) || []);

    // 新增的活动
    for (const [id, activity] of newActivityMap) {
      if (!oldActivityMap.has(id)) {
        diff.addedActivities.push(activity);
      }
    }

    // 删除的活动
    for (const [id] of oldActivityMap) {
      if (!newActivityMap.has(id)) {
        diff.removedActivities.push(id);
      }
    }

    // 修改的活动
    for (const [id, newActivity] of newActivityMap) {
      const oldActivity = oldActivityMap.get(id);
      if (oldActivity) {
        const changes = this.compareActivities(oldActivity, newActivity);
        if (changes.length > 0) {
          diff.modifiedActivities.push({
            activityId: id,
            changes,
          });
        }
      }
    }

    // 计算连线差异
    const oldFlowMap = new Map(oldProcess.sequenceFlows?.map((f) => [f.id, f]) || []);
    const newFlowMap = new Map(newProcess.sequenceFlows?.map((f) => [f.id, f]) || []);

    // 新增的连线
    for (const [id, flow] of newFlowMap) {
      if (!oldFlowMap.has(id)) {
        diff.addedSequenceFlows.push(flow);
      }
    }

    // 删除的连线
    for (const [id] of oldFlowMap) {
      if (!newFlowMap.has(id)) {
        diff.removedSequenceFlows.push(id);
      }
    }

    // 修改的连线
    for (const [id, newFlow] of newFlowMap) {
      const oldFlow = oldFlowMap.get(id);
      if (oldFlow) {
        const changes = this.compareSequenceFlows(oldFlow, newFlow);
        if (changes.length > 0) {
          diff.modifiedSequenceFlows.push({
            sequenceFlowId: id,
            changes,
          });
        }
      }
    }

    return diff;
  }

  /**
   * 验证修改
   */
  async validateModifications(
    modifications: IDynamicModification[],
    context: IDynamicModificationContext
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 获取流程定义
    const process = await this.getProcessDefinition(context.processDefinitionId);
    if (!process) {
      errors.push(`Process definition not found: ${context.processDefinitionId}`);
      return { valid: false, errors };
    }

    // 验证每个修改操作
    for (const modification of modifications) {
      const validationError = await this.validateModification(modification, process);
      if (validationError) {
        errors.push(validationError);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 回滚修改
   */
  async rollbackModification(modificationId: string): Promise<boolean> {
    const record = this.modificationRecords.get(modificationId);
    if (!record) {
      this.logger.warn(`Modification record not found: ${modificationId}`);
      return false;
    }

    if (record.rolledBack) {
      this.logger.warn(`Modification already rolled back: ${modificationId}`);
      return false;
    }

    // 删除新创建的流程定义
    this.processDefinitions.delete(record.newProcessDefinitionId);

    // 标记为已回滚
    record.rolledBack = true;

    this.logger.log(
      `Modification rolled back: ${record.processDefinitionId} <- ${record.newProcessDefinitionId}`
    );

    return true;
  }

  /**
   * 注册流程定义（用于测试和初始化）
   */
  registerProcessDefinition(processDefinitionId: string, process: IBpmnProcess): void {
    this.processDefinitions.set(processDefinitionId, process);
  }

  /**
   * 获取流程定义
   */
  private async getProcessDefinition(processDefinitionId: string): Promise<IBpmnProcess | null> {
    return this.processDefinitions.get(processDefinitionId) || null;
  }

  /**
   * 克隆流程定义
   */
  private cloneProcessDefinition(process: IBpmnProcess): IBpmnProcess {
    return JSON.parse(JSON.stringify(process));
  }

  /**
   * 生成新的流程定义ID
   */
  private generateNewProcessDefinitionId(originalId: string): string {
    const timestamp = Date.now();
    return `${originalId}:dynamic:${timestamp}`;
  }

  /**
   * 应用单个修改操作
   */
  private async applyModification(
    process: IBpmnProcess,
    modification: IDynamicModification
  ): Promise<void> {
    switch (modification.type) {
      case ModificationType.ADD_ACTIVITY:
        this.applyAddActivity(process, modification.data as IAddActivityData);
        break;
      case ModificationType.REMOVE_ACTIVITY:
        this.applyRemoveActivity(process, modification.data as IRemoveActivityData);
        break;
      case ModificationType.ADD_SEQUENCE_FLOW:
        this.applyAddSequenceFlow(process, modification.data as IAddSequenceFlowData);
        break;
      case ModificationType.UPDATE_SEQUENCE_FLOW:
        this.applyUpdateSequenceFlow(
          process,
          modification.targetSequenceFlowId!,
          modification.data
        );
        break;
      case ModificationType.MODIFY_PROPERTY:
        this.applyModifyProperty(
          process,
          modification.targetActivityId!,
          modification.data as IModifyPropertyData
        );
        break;
      case ModificationType.ADD_GATEWAY:
        this.applyAddGateway(process, modification.data);
        break;
      default:
        throw new Error(`Unknown modification type: ${modification.type}`);
    }
  }

  /**
   * 应用添加活动操作
   */
  private applyAddActivity(process: IBpmnProcess, data: IAddActivityData): void {
    if (!process.activities) {
      process.activities = [];
    }

    const newActivity: IBpmnActivity = {
      id: data.activityId,
      name: data.name || data.activityId,
      type: data.activityType,
      ...data.config,
    };

    process.activities.push(newActivity);

    // 如果指定了前置/后置活动，自动添加连线
    if (data.previousActivityId) {
      this.addSequenceFlowInternal(
        process,
        `flow_${data.previousActivityId}_${data.activityId}`,
        data.previousActivityId,
        data.activityId
      );
    }

    if (data.nextActivityId) {
      this.addSequenceFlowInternal(
        process,
        `flow_${data.activityId}_${data.nextActivityId}`,
        data.activityId,
        data.nextActivityId
      );
    }
  }

  /**
   * 应用删除活动操作
   */
  private applyRemoveActivity(process: IBpmnProcess, data: IRemoveActivityData): void {
    if (!process.activities) {
      return;
    }

    const activityIndex = process.activities.findIndex((a) => a.id === data.activityId);
    if (activityIndex === -1) {
      throw new Error(`Activity not found: ${data.activityId}`);
    }

    // 删除活动
    process.activities.splice(activityIndex, 1);

    // 删除相关连线
    if (data.removeSequenceFlows !== false && process.sequenceFlows) {
      process.sequenceFlows = process.sequenceFlows.filter(
        (f) => f.sourceRef !== data.activityId && f.targetRef !== data.activityId
      );
    }

    // 添加替代连线
    if (data.replacementFlow) {
      this.addSequenceFlowInternal(
        process,
        `flow_${data.replacementFlow.sourceId}_${data.replacementFlow.targetId}_replacement`,
        data.replacementFlow.sourceId,
        data.replacementFlow.targetId
      );
    }
  }

  /**
   * 应用添加连线操作
   */
  private applyAddSequenceFlow(process: IBpmnProcess, data: IAddSequenceFlowData): void {
    this.addSequenceFlowInternal(
      process,
      data.sequenceFlowId,
      data.sourceRef,
      data.targetRef,
      data.name,
      data.conditionExpression
    );
  }

  /**
   * 内部添加连线方法
   */
  private addSequenceFlowInternal(
    process: IBpmnProcess,
    id: string,
    sourceRef: string,
    targetRef: string,
    name?: string,
    conditionExpression?: string
  ): void {
    if (!process.sequenceFlows) {
      process.sequenceFlows = [];
    }

    const newFlow: IBpmnSequenceFlow = {
      id,
      sourceRef,
      targetRef,
      name,
    };

    if (conditionExpression) {
      (newFlow as any).conditionExpression = conditionExpression;
    }

    process.sequenceFlows.push(newFlow);
  }

  /**
   * 应用更新连线操作
   */
  private applyUpdateSequenceFlow(
    process: IBpmnProcess,
    sequenceFlowId: string,
    data: Record<string, any>
  ): void {
    if (!process.sequenceFlows) {
      throw new Error('No sequence flows in process');
    }

    const flow = process.sequenceFlows.find((f) => f.id === sequenceFlowId);
    if (!flow) {
      throw new Error(`Sequence flow not found: ${sequenceFlowId}`);
    }

    if (data.propertyPath && 'newValue' in data) {
      (flow as any)[data.propertyPath] = data.newValue;
    }
  }

  /**
   * 应用修改属性操作
   */
  private applyModifyProperty(
    process: IBpmnProcess,
    activityId: string,
    data: IModifyPropertyData
  ): void {
    if (!process.activities) {
      throw new Error('No activities in process');
    }

    const activity = process.activities.find((a) => a.id === activityId);
    if (!activity) {
      throw new Error(`Activity not found: ${activityId}`);
    }

    (activity as any)[data.propertyPath] = data.newValue;
  }

  /**
   * 应用添加网关操作
   */
  private applyAddGateway(process: IBpmnProcess, data: Record<string, any>): void {
    if (!process.activities) {
      process.activities = [];
    }

    const gateway: IBpmnActivity = {
      id: data.activityId,
      name: data.name || data.activityId,
      type: data.activityType,
    };

    process.activities.push(gateway);
  }

  /**
   * 验证单个修改操作
   */
  private async validateModification(
    modification: IDynamicModification,
    process: IBpmnProcess
  ): Promise<string | null> {
    switch (modification.type) {
      case ModificationType.ADD_ACTIVITY: {
        const data = modification.data as IAddActivityData;
        if (!data.activityId) {
          return 'Activity ID is required for ADD_ACTIVITY';
        }
        if (process.activities?.some((a) => a.id === data.activityId)) {
          return `Activity already exists: ${data.activityId}`;
        }
        break;
      }
      case ModificationType.REMOVE_ACTIVITY: {
        const data = modification.data as IRemoveActivityData;
        if (!data.activityId) {
          return 'Activity ID is required for REMOVE_ACTIVITY';
        }
        if (!process.activities?.some((a) => a.id === data.activityId)) {
          return `Activity not found: ${data.activityId}`;
        }
        break;
      }
      case ModificationType.ADD_SEQUENCE_FLOW: {
        const data = modification.data as IAddSequenceFlowData;
        if (!data.sourceRef || !data.targetRef) {
          return 'Source and target are required for ADD_SEQUENCE_FLOW';
        }
        if (!process.activities?.some((a) => a.id === data.sourceRef)) {
          return `Source activity not found: ${data.sourceRef}`;
        }
        if (!process.activities?.some((a) => a.id === data.targetRef)) {
          return `Target activity not found: ${data.targetRef}`;
        }
        break;
      }
      case ModificationType.MODIFY_PROPERTY: {
        if (!modification.targetActivityId) {
          return 'Target activity ID is required for MODIFY_PROPERTY';
        }
        if (!process.activities?.some((a) => a.id === modification.targetActivityId)) {
          return `Activity not found: ${modification.targetActivityId}`;
        }
        break;
      }
    }
    return null;
  }

  /**
   * 比较活动差异
   */
  private compareActivities(
    oldActivity: IBpmnActivity,
    newActivity: IBpmnActivity
  ): Array<{ property: string; oldValue: any; newValue: any }> {
    const changes: Array<{ property: string; oldValue: any; newValue: any }> = [];
    const allKeys = new Set([...Object.keys(oldActivity), ...Object.keys(newActivity)]);

    for (const key of allKeys) {
      const oldValue = (oldActivity as any)[key];
      const newValue = (newActivity as any)[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          property: key,
          oldValue,
          newValue,
        });
      }
    }

    return changes;
  }

  /**
   * 比较连线差异
   */
  private compareSequenceFlows(
    oldFlow: IBpmnSequenceFlow,
    newFlow: IBpmnSequenceFlow
  ): Array<{ property: string; oldValue: any; newValue: any }> {
    const changes: Array<{ property: string; oldValue: any; newValue: any }> = [];
    const allKeys = new Set([...Object.keys(oldFlow), ...Object.keys(newFlow)]);

    for (const key of allKeys) {
      const oldValue = (oldFlow as any)[key];
      const newValue = (newFlow as any)[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          property: key,
          oldValue,
          newValue,
        });
      }
    }

    return changes;
  }
}
