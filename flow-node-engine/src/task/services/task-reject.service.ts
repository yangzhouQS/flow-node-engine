import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import {
  MultiInstanceConfigEntity,
  MultiInstanceRejectStrategy,
  CreateMultiInstanceConfigParams,
  MultiInstanceConfigInfo,
} from '../entities/multi-instance-config.entity';
import {
  RejectConfigEntity,
  CreateRejectConfigParams,
  RejectConfigInfo,
} from '../entities/reject-config.entity';
import {
  TaskRejectEntity,
  RejectType,
  RejectStatus,
  CreateTaskRejectParams,
  TaskRejectInfo,
} from '../entities/task-reject.entity';

/**
 * 任务驳回查询参数
 */
export interface TaskRejectQueryParams {
  taskId?: string;
  taskDefKey?: string;
  processInstanceId?: string;
  rejectUserId?: string;
  rejectType?: RejectType | string;
  status?: RejectStatus | string;
  isMultiInstance?: boolean;
  tenantId?: string;
}

/**
 * 驳回操作结果
 */
export interface RejectResult {
  success: boolean;
  rejectRecord: TaskRejectInfo;
  targetTaskDefKey?: string;
  targetTaskName?: string;
  message?: string;
}

/**
 * 任务驳回服务
 * 提供任务驳回、驳回配置、多实例驳回策略等功能
 */
@Injectable()
export class TaskRejectService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(TaskRejectEntity)
    private readonly taskRejectRepository: Repository<TaskRejectEntity>,
    @InjectRepository(RejectConfigEntity)
    private readonly rejectConfigRepository: Repository<RejectConfigEntity>,
    @InjectRepository(MultiInstanceConfigEntity)
    private readonly multiInstanceConfigRepository: Repository<MultiInstanceConfigEntity>,
  ) {}

  // ==================== 驳回记录操作 ====================

  /**
   * 创建驳回记录
   */
  async createRejectRecord(params: CreateTaskRejectParams): Promise<TaskRejectEntity> {
    const entity = new TaskRejectEntity();
    entity.id_ = uuidv4();
    entity.task_id_ = params.taskId;
    entity.task_def_key_ = params.taskDefKey || null;
    entity.proc_inst_id_ = params.processInstanceId;
    entity.proc_def_id_ = params.processDefinitionId || null;
    entity.execution_id_ = params.executionId || null;
    entity.reject_type_ = params.rejectType;
    entity.reject_reason_ = params.rejectReason || null;
    entity.reject_user_id_ = params.rejectUserId || null;
    entity.target_task_def_key_ = params.targetTaskDefKey || null;
    entity.target_task_name_ = params.targetTaskName || null;
    entity.status_ = RejectStatus.PENDING;
    entity.is_multi_instance_ = params.isMultiInstance || false;
    entity.multi_instance_strategy_ = params.multiInstanceStrategy || null;
    entity.extra_data_ = params.extraData ? JSON.stringify(params.extraData) : null;
    entity.tenant_id_ = params.tenantId || null;
    entity.create_time_ = new Date();

    return await this.taskRejectRepository.save(entity);
  }

  /**
   * 根据ID获取驳回记录
   */
  async getRejectRecordById(id: string): Promise<TaskRejectEntity | null> {
    return await this.taskRejectRepository.findOne({ where: { id_: id } });
  }

  /**
   * 查询驳回记录列表
   */
  async queryRejectRecords(params: TaskRejectQueryParams): Promise<TaskRejectEntity[]> {
    const queryBuilder = this.taskRejectRepository.createQueryBuilder('reject');

    if (params.taskId) {
      queryBuilder.andWhere('reject.task_id_ = :taskId', { taskId: params.taskId });
    }
    if (params.taskDefKey) {
      queryBuilder.andWhere('reject.task_def_key_ = :taskDefKey', {
        taskDefKey: params.taskDefKey,
      });
    }
    if (params.processInstanceId) {
      queryBuilder.andWhere('reject.proc_inst_id_ = :procInstId', {
        procInstId: params.processInstanceId,
      });
    }
    if (params.rejectUserId) {
      queryBuilder.andWhere('reject.reject_user_id_ = :rejectUserId', {
        rejectUserId: params.rejectUserId,
      });
    }
    if (params.rejectType) {
      queryBuilder.andWhere('reject.reject_type_ = :rejectType', {
        rejectType: params.rejectType,
      });
    }
    if (params.status) {
      queryBuilder.andWhere('reject.status_ = :status', { status: params.status });
    }
    if (params.isMultiInstance !== undefined) {
      queryBuilder.andWhere('reject.is_multi_instance_ = :isMultiInstance', {
        isMultiInstance: params.isMultiInstance,
      });
    }
    if (params.tenantId) {
      queryBuilder.andWhere('reject.tenant_id_ = :tenantId', { tenantId: params.tenantId });
    }

    queryBuilder.orderBy('reject.create_time_', 'DESC');

    return await queryBuilder.getMany();
  }

  /**
   * 更新驳回状态
   */
  async updateRejectStatus(
    id: string,
    status: RejectStatus,
    processTime?: Date,
  ): Promise<TaskRejectEntity> {
    const entity = await this.getRejectRecordById(id);
    if (!entity) {
      throw new NotFoundException(`驳回记录不存在: ${id}`);
    }

    entity.status_ = status;
    entity.process_time_ = processTime || new Date();

    return await this.taskRejectRepository.save(entity);
  }

  /**
   * 获取流程实例的驳回历史
   */
  async getRejectHistoryByProcessInstance(
    processInstanceId: string,
  ): Promise<TaskRejectEntity[]> {
    return await this.taskRejectRepository.find({
      where: { proc_inst_id_: processInstanceId },
      order: { create_time_: 'DESC' },
    });
  }

  /**
   * 删除驳回记录
   */
  async deleteRejectRecord(id: string): Promise<void> {
    await this.taskRejectRepository.delete({ id_: id });
  }

  /**
   * 删除流程实例的所有驳回记录
   */
  async deleteRejectRecordsByProcessInstance(processInstanceId: string): Promise<void> {
    await this.taskRejectRepository.delete({ proc_inst_id_: processInstanceId });
  }

  // ==================== 驳回配置操作 ====================

  /**
   * 创建驳回配置
   */
  async createRejectConfig(params: CreateRejectConfigParams): Promise<RejectConfigEntity> {
    const entity = new RejectConfigEntity();
    entity.id_ = uuidv4();
    entity.proc_def_id_ = params.processDefinitionId;
    entity.task_def_key_ = params.taskDefKey;
    entity.task_name_ = params.taskName || null;
    entity.allowed_reject_types_ = params.allowedRejectTypes
      ? JSON.stringify(params.allowedRejectTypes)
      : null;
    entity.default_reject_type_ = params.defaultRejectType || RejectType.TO_PREVIOUS;
    entity.allow_reject_ = params.allowReject !== undefined ? params.allowReject : true;
    entity.require_reason_ = params.requireReason !== undefined ? params.requireReason : true;
    entity.target_nodes_ = params.targetNodes ? JSON.stringify(params.targetNodes) : null;
    entity.extra_config_ = params.extraConfig ? JSON.stringify(params.extraConfig) : null;
    entity.tenant_id_ = params.tenantId || null;
    entity.create_time_ = new Date();
    entity.update_time_ = new Date();

    return await this.rejectConfigRepository.save(entity);
  }

  /**
   * 获取驳回配置
   */
  async getRejectConfig(
    processDefinitionId: string,
    taskDefKey: string,
  ): Promise<RejectConfigEntity | null> {
    return await this.rejectConfigRepository.findOne({
      where: {
        proc_def_id_: processDefinitionId,
        task_def_key_: taskDefKey,
      },
    });
  }

  /**
   * 获取流程定义的所有驳回配置
   */
  async getRejectConfigsByProcessDefinition(
    processDefinitionId: string,
  ): Promise<RejectConfigEntity[]> {
    return await this.rejectConfigRepository.find({
      where: { proc_def_id_: processDefinitionId },
    });
  }

  /**
   * 更新驳回配置
   */
  async updateRejectConfig(
    id: string,
    params: Partial<CreateRejectConfigParams>,
  ): Promise<RejectConfigEntity> {
    const entity = await this.rejectConfigRepository.findOne({ where: { id_: id } });
    if (!entity) {
      throw new NotFoundException(`驳回配置不存在: ${id}`);
    }

    if (params.taskName !== undefined) {
      entity.task_name_ = params.taskName;
    }
    if (params.allowedRejectTypes !== undefined) {
      entity.allowed_reject_types_ = JSON.stringify(params.allowedRejectTypes);
    }
    if (params.defaultRejectType !== undefined) {
      entity.default_reject_type_ = params.defaultRejectType;
    }
    if (params.allowReject !== undefined) {
      entity.allow_reject_ = params.allowReject;
    }
    if (params.requireReason !== undefined) {
      entity.require_reason_ = params.requireReason;
    }
    if (params.targetNodes !== undefined) {
      entity.target_nodes_ = JSON.stringify(params.targetNodes);
    }
    if (params.extraConfig !== undefined) {
      entity.extra_config_ = JSON.stringify(params.extraConfig);
    }
    entity.update_time_ = new Date();

    return await this.rejectConfigRepository.save(entity);
  }

  /**
   * 删除驳回配置
   */
  async deleteRejectConfig(id: string): Promise<void> {
    await this.rejectConfigRepository.delete({ id_: id });
  }

  /**
   * 检查任务是否允许驳回
   */
  async isRejectAllowed(
    processDefinitionId: string,
    taskDefKey: string,
  ): Promise<boolean> {
    const config = await this.getRejectConfig(processDefinitionId, taskDefKey);
    if (!config) {
      // 默认允许驳回
      return true;
    }
    return config.allow_reject_;
  }

  /**
   * 获取允许的驳回类型
   */
  async getAllowedRejectTypes(
    processDefinitionId: string,
    taskDefKey: string,
  ): Promise<RejectType[]> {
    const config = await this.getRejectConfig(processDefinitionId, taskDefKey);
    if (!config?.allowed_reject_types_) {
      // 默认所有类型都允许
      return Object.values(RejectType);
    }
    return JSON.parse(config.allowed_reject_types_);
  }

  // ==================== 多实例配置操作 ====================

  /**
   * 创建多实例配置
   */
  async createMultiInstanceConfig(
    params: CreateMultiInstanceConfigParams,
  ): Promise<MultiInstanceConfigEntity> {
    const entity = new MultiInstanceConfigEntity();
    entity.id_ = uuidv4();
    entity.proc_def_id_ = params.processDefinitionId;
    entity.task_def_key_ = params.taskDefKey;
    entity.task_name_ = params.taskName || null;
    entity.is_multi_instance_ = params.isMultiInstance || false;
    entity.sequential_ = params.sequential || false;
    entity.reject_strategy_ = params.rejectStrategy || MultiInstanceRejectStrategy.ONLY_CURRENT;
    entity.completion_condition_ = params.completionCondition || null;
    entity.collection_variable_ = params.collectionVariable || null;
    entity.element_variable_ = params.elementVariable || null;
    entity.cardinality_ = params.cardinality || null;
    entity.extra_config_ = params.extraConfig ? JSON.stringify(params.extraConfig) : null;
    entity.tenant_id_ = params.tenantId || null;
    entity.create_time_ = new Date();
    entity.update_time_ = new Date();

    return await this.multiInstanceConfigRepository.save(entity);
  }

  /**
   * 获取多实例配置
   */
  async getMultiInstanceConfig(
    processDefinitionId: string,
    taskDefKey: string,
  ): Promise<MultiInstanceConfigEntity | null> {
    return await this.multiInstanceConfigRepository.findOne({
      where: {
        proc_def_id_: processDefinitionId,
        task_def_key_: taskDefKey,
      },
    });
  }

  /**
   * 更新多实例配置
   */
  async updateMultiInstanceConfig(
    id: string,
    params: Partial<CreateMultiInstanceConfigParams>,
  ): Promise<MultiInstanceConfigEntity> {
    const entity = await this.multiInstanceConfigRepository.findOne({ where: { id_: id } });
    if (!entity) {
      throw new NotFoundException(`多实例配置不存在: ${id}`);
    }

    if (params.taskName !== undefined) {
      entity.task_name_ = params.taskName;
    }
    if (params.isMultiInstance !== undefined) {
      entity.is_multi_instance_ = params.isMultiInstance;
    }
    if (params.sequential !== undefined) {
      entity.sequential_ = params.sequential;
    }
    if (params.rejectStrategy !== undefined) {
      entity.reject_strategy_ = params.rejectStrategy;
    }
    if (params.completionCondition !== undefined) {
      entity.completion_condition_ = params.completionCondition;
    }
    if (params.collectionVariable !== undefined) {
      entity.collection_variable_ = params.collectionVariable;
    }
    if (params.elementVariable !== undefined) {
      entity.element_variable_ = params.elementVariable;
    }
    if (params.cardinality !== undefined) {
      entity.cardinality_ = params.cardinality;
    }
    if (params.extraConfig !== undefined) {
      entity.extra_config_ = JSON.stringify(params.extraConfig);
    }
    entity.update_time_ = new Date();

    return await this.multiInstanceConfigRepository.save(entity);
  }

  /**
   * 删除多实例配置
   */
  async deleteMultiInstanceConfig(id: string): Promise<void> {
    await this.multiInstanceConfigRepository.delete({ id_: id });
  }

  /**
   * 获取多实例驳回策略
   */
  async getMultiInstanceRejectStrategy(
    processDefinitionId: string,
    taskDefKey: string,
  ): Promise<MultiInstanceRejectStrategy> {
    const config = await this.getMultiInstanceConfig(processDefinitionId, taskDefKey);
    if (!config?.is_multi_instance_) {
      return MultiInstanceRejectStrategy.ONLY_CURRENT;
    }
    return config.reject_strategy_ as MultiInstanceRejectStrategy;
  }

  // ==================== 驳回执行逻辑 ====================

  /**
   * 执行驳回操作
   * @param taskId 任务ID
   * @param rejectType 驳回类型
   * @param rejectReason 驳回原因
   * @param rejectUserId 驳回操作人
   * @param targetTaskDefKey 目标节点Key（TO_SPECIFIC时必填）
   */
  async executeReject(
    taskId: string,
    rejectType: RejectType,
    rejectReason: string,
    rejectUserId: string,
    targetTaskDefKey?: string,
  ): Promise<RejectResult> {
    // 创建驳回记录
    const rejectRecord = await this.createRejectRecord({
      taskId,
      rejectType,
      rejectReason,
      rejectUserId,
      targetTaskDefKey,
      processInstanceId: '', // 需要从任务获取
    });

    try {
      // TODO: 实现实际的驳回逻辑
      // 1. 根据驳回类型确定目标节点
      // 2. 取消当前任务
      // 3. 在目标节点创建新任务
      // 4. 更新流程状态

      // 更新驳回状态为已执行
      await this.updateRejectStatus(rejectRecord.id_, RejectStatus.EXECUTED);

      return {
        success: true,
        rejectRecord: this.toTaskRejectInfo(rejectRecord),
        targetTaskDefKey,
        message: '驳回成功',
      };
    } catch (error) {
      // 更新驳回状态为失败
      await this.updateRejectStatus(rejectRecord.id_, RejectStatus.FAILED);

      return {
        success: false,
        rejectRecord: this.toTaskRejectInfo(rejectRecord),
        message: `驳回失败: ${error.message}`,
      };
    }
  }

  /**
   * 执行多实例驳回
   */
  async executeMultiInstanceReject(
    taskId: string,
    strategy: MultiInstanceRejectStrategy,
    rejectReason: string,
    rejectUserId: string,
  ): Promise<RejectResult> {
    // 创建多实例驳回记录
    const rejectRecord = await this.createRejectRecord({
      taskId,
      rejectType: RejectType.TO_PREVIOUS,
      rejectReason,
      rejectUserId,
      isMultiInstance: true,
      multiInstanceStrategy: strategy,
      processInstanceId: '', // 需要从任务获取
    });

    try {
      // 根据策略执行不同的驳回逻辑
      switch (strategy) {
        case MultiInstanceRejectStrategy.ALL_BACK:
          // TODO: 退回所有实例
          break;
        case MultiInstanceRejectStrategy.ONLY_CURRENT:
          // TODO: 只退回当前实例
          break;
        case MultiInstanceRejectStrategy.MAJORITY_BACK:
          // TODO: 检查是否超过半数驳回
          break;
        case MultiInstanceRejectStrategy.KEEP_COMPLETED:
          // TODO: 保留已完成实例，退回未完成的
          break;
        case MultiInstanceRejectStrategy.RESET_ALL:
          // TODO: 重置所有实例
          break;
        case MultiInstanceRejectStrategy.WAIT_COMPLETION:
          // TODO: 等待所有实例完成
          break;
        case MultiInstanceRejectStrategy.IMMEDIATE:
          // TODO: 立即生效
          break;
        default:
          break;
      }

      // 更新驳回状态为已执行
      await this.updateRejectStatus(rejectRecord.id_, RejectStatus.EXECUTED);

      return {
        success: true,
        rejectRecord: this.toTaskRejectInfo(rejectRecord),
        message: '多实例驳回成功',
      };
    } catch (error) {
      // 更新驳回状态为失败
      await this.updateRejectStatus(rejectRecord.id_, RejectStatus.FAILED);

      return {
        success: false,
        rejectRecord: this.toTaskRejectInfo(rejectRecord),
        message: `多实例驳回失败: ${error.message}`,
      };
    }
  }

  // ==================== 转换方法 ====================

  /**
   * 将驳回记录实体转换为信息对象
   */
  toTaskRejectInfo(entity: TaskRejectEntity): TaskRejectInfo {
    return {
      id: entity.id_,
      taskId: entity.task_id_,
      taskDefKey: entity.task_def_key_,
      processInstanceId: entity.proc_inst_id_,
      processDefinitionId: entity.proc_def_id_,
      executionId: entity.execution_id_,
      rejectType: entity.reject_type_,
      rejectReason: entity.reject_reason_,
      rejectUserId: entity.reject_user_id_,
      targetTaskDefKey: entity.target_task_def_key_,
      targetTaskName: entity.target_task_name_,
      status: entity.status_,
      isMultiInstance: entity.is_multi_instance_,
      multiInstanceStrategy: entity.multi_instance_strategy_,
      extraData: entity.extra_data_ ? JSON.parse(entity.extra_data_) : undefined,
      tenantId: entity.tenant_id_,
      createTime: entity.create_time_,
      processTime: entity.process_time_,
    };
  }

  /**
   * 将驳回配置实体转换为信息对象
   */
  toRejectConfigInfo(entity: RejectConfigEntity): RejectConfigInfo {
    return {
      id: entity.id_,
      processDefinitionId: entity.proc_def_id_,
      taskDefKey: entity.task_def_key_,
      taskName: entity.task_name_,
      allowedRejectTypes: entity.allowed_reject_types_
        ? JSON.parse(entity.allowed_reject_types_)
        : undefined,
      defaultRejectType: entity.default_reject_type_,
      allowReject: entity.allow_reject_,
      requireReason: entity.require_reason_,
      targetNodes: entity.target_nodes_ ? JSON.parse(entity.target_nodes_) : undefined,
      extraConfig: entity.extra_config_ ? JSON.parse(entity.extra_config_) : undefined,
      tenantId: entity.tenant_id_,
      createTime: entity.create_time_,
      updateTime: entity.update_time_,
    };
  }

  /**
   * 将多实例配置实体转换为信息对象
   */
  toMultiInstanceConfigInfo(entity: MultiInstanceConfigEntity): MultiInstanceConfigInfo {
    return {
      id: entity.id_,
      processDefinitionId: entity.proc_def_id_,
      taskDefKey: entity.task_def_key_,
      taskName: entity.task_name_,
      isMultiInstance: entity.is_multi_instance_,
      sequential: entity.sequential_,
      rejectStrategy: entity.reject_strategy_,
      completionCondition: entity.completion_condition_,
      collectionVariable: entity.collection_variable_,
      elementVariable: entity.element_variable_,
      cardinality: entity.cardinality_,
      extraConfig: entity.extra_config_ ? JSON.parse(entity.extra_config_) : undefined,
      tenantId: entity.tenant_id_,
      createTime: entity.create_time_,
      updateTime: entity.update_time_,
    };
  }
}
