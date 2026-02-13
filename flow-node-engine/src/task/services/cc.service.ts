import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import {
  CcConfigEntity,
  CreateCcConfigParams,
  CcConfigInfo,
} from '../entities/cc-config.entity';
import {
  CcRecordEntity,
  CcType,
  CcStatus,
  CreateCcRecordParams,
  CcRecordInfo,
} from '../entities/cc-record.entity';

/**
 * 抄送查询参数
 */
export interface CcQueryParams {
  processInstanceId?: string;
  taskId?: string;
  taskDefKey?: string;
  ccFromUserId?: string;
  ccToUserId?: string;
  ccType?: CcType | string;
  status?: CcStatus | string;
  tenantId?: string;
}

/**
 * 批量抄送参数
 */
export interface BatchCcParams {
  processInstanceId: string;
  processDefinitionId?: string;
  taskId?: string;
  taskDefKey?: string;
  ccFromUserId: string;
  ccFromUserName?: string;
  ccToUserIds: string[];
  ccToUserNames?: Record<string, string>;
  ccReason?: string;
  ccType?: CcType | string;
  tenantId?: string;
}

/**
 * 抄送服务
 * 提供抄送记录和抄送配置的管理功能
 */
@Injectable()
export class CcService {
  constructor(
    @InjectRepository(CcRecordEntity)
    private readonly ccRecordRepository: Repository<CcRecordEntity>,
    @InjectRepository(CcConfigEntity)
    private readonly ccConfigRepository: Repository<CcConfigEntity>,
  ) {}

  // ==================== 抄送记录操作 ====================

  /**
   * 创建抄送记录
   */
  async createCcRecord(params: CreateCcRecordParams): Promise<CcRecordEntity> {
    const entity = new CcRecordEntity();
    entity.id_ = uuidv4();
    entity.proc_inst_id_ = params.processInstanceId;
    entity.proc_def_id_ = params.processDefinitionId || null;
    entity.task_id_ = params.taskId || null;
    entity.task_def_key_ = params.taskDefKey || null;
    entity.cc_type_ = params.ccType;
    entity.cc_from_user_id_ = params.ccFromUserId;
    entity.cc_from_user_name_ = params.ccFromUserName || null;
    entity.cc_to_user_id_ = params.ccToUserId;
    entity.cc_to_user_name_ = params.ccToUserName || null;
    entity.cc_reason_ = params.ccReason || null;
    entity.status_ = CcStatus.UNREAD;
    entity.extra_data_ = params.extraData ? JSON.stringify(params.extraData) : null;
    entity.tenant_id_ = params.tenantId || null;
    entity.create_time_ = new Date();

    return await this.ccRecordRepository.save(entity);
  }

  /**
   * 批量创建抄送记录
   */
  async batchCreateCcRecords(params: BatchCcParams): Promise<CcRecordEntity[]> {
    const entities: CcRecordEntity[] = [];
    const ccType = params.ccType || CcType.MANUAL;

    for (const ccToUserId of params.ccToUserIds) {
      const entity = new CcRecordEntity();
      entity.id_ = uuidv4();
      entity.proc_inst_id_ = params.processInstanceId;
      entity.proc_def_id_ = params.processDefinitionId || null;
      entity.task_id_ = params.taskId || null;
      entity.task_def_key_ = params.taskDefKey || null;
      entity.cc_type_ = ccType;
      entity.cc_from_user_id_ = params.ccFromUserId;
      entity.cc_from_user_name_ = params.ccFromUserName || null;
      entity.cc_to_user_id_ = ccToUserId;
      entity.cc_to_user_name_ = params.ccToUserNames?.[ccToUserId] || null;
      entity.cc_reason_ = params.ccReason || null;
      entity.status_ = CcStatus.UNREAD;
      entity.tenant_id_ = params.tenantId || null;
      entity.create_time_ = new Date();
      entities.push(entity);
    }

    return await this.ccRecordRepository.save(entities);
  }

  /**
   * 根据ID获取抄送记录
   */
  async getCcRecordById(id: string): Promise<CcRecordEntity | null> {
    return await this.ccRecordRepository.findOne({ where: { id_: id } });
  }

  /**
   * 查询抄送记录列表
   */
  async queryCcRecords(params: CcQueryParams): Promise<CcRecordEntity[]> {
    const queryBuilder = this.ccRecordRepository.createQueryBuilder('cc');

    if (params.processInstanceId) {
      queryBuilder.andWhere('cc.proc_inst_id_ = :procInstId', {
        procInstId: params.processInstanceId,
      });
    }
    if (params.taskId) {
      queryBuilder.andWhere('cc.task_id_ = :taskId', { taskId: params.taskId });
    }
    if (params.taskDefKey) {
      queryBuilder.andWhere('cc.task_def_key_ = :taskDefKey', {
        taskDefKey: params.taskDefKey,
      });
    }
    if (params.ccFromUserId) {
      queryBuilder.andWhere('cc.cc_from_user_id_ = :ccFromUserId', {
        ccFromUserId: params.ccFromUserId,
      });
    }
    if (params.ccToUserId) {
      queryBuilder.andWhere('cc.cc_to_user_id_ = :ccToUserId', {
        ccToUserId: params.ccToUserId,
      });
    }
    if (params.ccType) {
      queryBuilder.andWhere('cc.cc_type_ = :ccType', { ccType: params.ccType });
    }
    if (params.status) {
      queryBuilder.andWhere('cc.status_ = :status', { status: params.status });
    }
    if (params.tenantId) {
      queryBuilder.andWhere('cc.tenant_id_ = :tenantId', { tenantId: params.tenantId });
    }

    queryBuilder.orderBy('cc.create_time_', 'DESC');

    return await queryBuilder.getMany();
  }

  /**
   * 获取用户的抄送列表（收件箱）
   */
  async getCcInboxForUser(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ records: CcRecordEntity[]; total: number }> {
    const queryBuilder = this.ccRecordRepository
      .createQueryBuilder('cc')
      .where('cc.cc_to_user_id_ = :userId', { userId })
      .orderBy('cc.create_time_', 'DESC');

    const total = await queryBuilder.getCount();
    const records = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { records, total };
  }

  /**
   * 获取用户的抄送发送列表（发件箱）
   */
  async getCcOutboxForUser(
    userId: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ records: CcRecordEntity[]; total: number }> {
    const queryBuilder = this.ccRecordRepository
      .createQueryBuilder('cc')
      .where('cc.cc_from_user_id_ = :userId', { userId })
      .orderBy('cc.create_time_', 'DESC');

    const total = await queryBuilder.getCount();
    const records = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { records, total };
  }

  /**
   * 获取流程实例的抄送记录
   */
  async getCcRecordsByProcessInstance(
    processInstanceId: string,
  ): Promise<CcRecordEntity[]> {
    return await this.ccRecordRepository.find({
      where: { proc_inst_id_: processInstanceId },
      order: { create_time_: 'DESC' },
    });
  }

  /**
   * 标记抄送为已读
   */
  async markAsRead(id: string): Promise<CcRecordEntity> {
    const entity = await this.getCcRecordById(id);
    if (!entity) {
      throw new NotFoundException(`抄送记录不存在: ${id}`);
    }

    entity.status_ = CcStatus.READ;
    entity.read_time_ = new Date();

    return await this.ccRecordRepository.save(entity);
  }

  /**
   * 批量标记抄送为已读
   */
  async batchMarkAsRead(ids: string[]): Promise<void> {
    await this.ccRecordRepository.update(
      { id_: In(ids) },
      { status_: CcStatus.READ, read_time_: new Date() },
    );
  }

  /**
   * 标记用户所有抄送为已读
   */
  async markAllAsReadForUser(userId: string): Promise<void> {
    await this.ccRecordRepository.update(
      { cc_to_user_id_: userId, status_: CcStatus.UNREAD },
      { status_: CcStatus.READ, read_time_: new Date() },
    );
  }

  /**
   * 获取用户未读抄送数量
   */
  async getUnreadCountForUser(userId: string): Promise<number> {
    return await this.ccRecordRepository.count({
      where: {
        cc_to_user_id_: userId,
        status_: CcStatus.UNREAD,
      },
    });
  }

  /**
   * 删除抄送记录
   */
  async deleteCcRecord(id: string): Promise<void> {
    await this.ccRecordRepository.delete({ id_: id });
  }

  /**
   * 删除流程实例的所有抄送记录
   */
  async deleteCcRecordsByProcessInstance(processInstanceId: string): Promise<void> {
    await this.ccRecordRepository.delete({ proc_inst_id_: processInstanceId });
  }

  // ==================== 抄送配置操作 ====================

  /**
   * 创建抄送配置
   */
  async createCcConfig(params: CreateCcConfigParams): Promise<CcConfigEntity> {
    const entity = new CcConfigEntity();
    entity.id_ = uuidv4();
    entity.proc_def_id_ = params.processDefinitionId;
    entity.task_def_key_ = params.taskDefKey || null;
    entity.task_name_ = params.taskName || null;
    entity.cc_type_ = params.ccType || CcType.AUTO;
    entity.cc_to_expression_ = params.ccToExpression || null;
    entity.cc_to_users_ = params.ccToUsers ? JSON.stringify(params.ccToUsers) : null;
    entity.cc_to_groups_ = params.ccToGroups ? JSON.stringify(params.ccToGroups) : null;
    entity.enabled_ = params.enabled !== undefined ? params.enabled : true;
    entity.condition_ = params.condition || null;
    entity.description_ = params.description || null;
    entity.extra_config_ = params.extraConfig ? JSON.stringify(params.extraConfig) : null;
    entity.tenant_id_ = params.tenantId || null;
    entity.create_time_ = new Date();
    entity.update_time_ = new Date();

    return await this.ccConfigRepository.save(entity);
  }

  /**
   * 获取抄送配置
   */
  async getCcConfig(
    processDefinitionId: string,
    taskDefKey?: string,
  ): Promise<CcConfigEntity | null> {
    if (taskDefKey) {
      return await this.ccConfigRepository.findOne({
        where: {
          proc_def_id_: processDefinitionId,
          task_def_key_: taskDefKey,
        },
      });
    }
    // 获取流程级别的配置
    return await this.ccConfigRepository.findOne({
      where: {
        proc_def_id_: processDefinitionId,
        task_def_key_: null as any,
      },
    });
  }

  /**
   * 获取流程定义的所有抄送配置
   */
  async getCcConfigsByProcessDefinition(
    processDefinitionId: string,
  ): Promise<CcConfigEntity[]> {
    return await this.ccConfigRepository.find({
      where: { proc_def_id_: processDefinitionId },
    });
  }

  /**
   * 更新抄送配置
   */
  async updateCcConfig(
    id: string,
    params: Partial<CreateCcConfigParams>,
  ): Promise<CcConfigEntity> {
    const entity = await this.ccConfigRepository.findOne({ where: { id_: id } });
    if (!entity) {
      throw new NotFoundException(`抄送配置不存在: ${id}`);
    }

    if (params.taskName !== undefined) {
      entity.task_name_ = params.taskName;
    }
    if (params.ccType !== undefined) {
      entity.cc_type_ = params.ccType;
    }
    if (params.ccToExpression !== undefined) {
      entity.cc_to_expression_ = params.ccToExpression;
    }
    if (params.ccToUsers !== undefined) {
      entity.cc_to_users_ = JSON.stringify(params.ccToUsers);
    }
    if (params.ccToGroups !== undefined) {
      entity.cc_to_groups_ = JSON.stringify(params.ccToGroups);
    }
    if (params.enabled !== undefined) {
      entity.enabled_ = params.enabled;
    }
    if (params.condition !== undefined) {
      entity.condition_ = params.condition;
    }
    if (params.description !== undefined) {
      entity.description_ = params.description;
    }
    if (params.extraConfig !== undefined) {
      entity.extra_config_ = JSON.stringify(params.extraConfig);
    }
    entity.update_time_ = new Date();

    return await this.ccConfigRepository.save(entity);
  }

  /**
   * 删除抄送配置
   */
  async deleteCcConfig(id: string): Promise<void> {
    await this.ccConfigRepository.delete({ id_: id });
  }

  /**
   * 获取启用的抄送配置
   */
  async getEnabledCcConfigs(
    processDefinitionId: string,
    taskDefKey?: string,
  ): Promise<CcConfigEntity[]> {
    const queryBuilder = this.ccConfigRepository
      .createQueryBuilder('config')
      .where('config.proc_def_id_ = :procDefId', { procDefId: processDefinitionId })
      .andWhere('config.enabled_ = :enabled', { enabled: true });

    if (taskDefKey) {
      queryBuilder.andWhere(
        '(config.task_def_key_ = :taskDefKey OR config.task_def_key_ IS NULL)',
        { taskDefKey },
      );
    }

    return await queryBuilder.getMany();
  }

  // ==================== 自动抄送触发 ====================

  /**
   * 触发自动抄送
   * 在任务创建或完成时调用
   */
  async triggerAutoCc(
    processDefinitionId: string,
    processInstanceId: string,
    taskDefKey: string,
    taskId: string,
    variables: Record<string, any>,
    tenantId?: string,
  ): Promise<CcRecordEntity[]> {
    // 获取启用的抄送配置
    const configs = await this.getEnabledCcConfigs(processDefinitionId, taskDefKey);

    if (configs.length === 0) {
      return [];
    }

    const ccRecords: CcRecordEntity[] = [];

    for (const config of configs) {
      // 检查触发条件
      if (config.condition_) {
        // TODO: 使用表达式引擎评估条件
        // const conditionMet = await this.expressionService.evaluate(config.condition_, variables);
        // if (!conditionMet) continue;
      }

      // 解析抄送目标用户
      const ccToUserIds: string[] = [];

      // 从配置的用户列表获取
      if (config.cc_to_users_) {
        const users = JSON.parse(config.cc_to_users_);
        ccToUserIds.push(...users);
      }

      // 从表达式获取
      if (config.cc_to_expression_) {
        // TODO: 使用表达式引擎解析
        // const evaluatedUsers = await this.expressionService.evaluate(config.cc_to_expression_, variables);
        // if (Array.isArray(evaluatedUsers)) {
        //   ccToUserIds.push(...evaluatedUsers);
        // }
      }

      // 从组获取（需要用户服务支持）
      if (config.cc_to_groups_) {
        // TODO: 查询组成员
        // const groups = JSON.parse(config.cc_to_groups_);
        // for (const groupId of groups) {
        //   const groupUsers = await this.userService.getUsersByGroup(groupId);
        //   ccToUserIds.push(...groupUsers);
        // }
      }

      // 去重
      const uniqueUserIds = [...new Set(ccToUserIds)];

      if (uniqueUserIds.length > 0) {
        // 批量创建抄送记录
        const records = await this.batchCreateCcRecords({
          processInstanceId,
          processDefinitionId,
          taskId,
          taskDefKey,
          ccFromUserId: 'SYSTEM',
          ccFromUserName: '系统',
          ccToUserIds: uniqueUserIds,
          ccReason: config.description_ || '自动抄送',
          ccType: CcType.AUTO,
          tenantId,
        });

        ccRecords.push(...records);
      }
    }

    return ccRecords;
  }

  // ==================== 转换方法 ====================

  /**
   * 将抄送记录实体转换为信息对象
   */
  toCcRecordInfo(entity: CcRecordEntity): CcRecordInfo {
    return {
      id: entity.id_,
      processInstanceId: entity.proc_inst_id_,
      processDefinitionId: entity.proc_def_id_,
      taskId: entity.task_id_,
      taskDefKey: entity.task_def_key_,
      ccType: entity.cc_type_,
      ccFromUserId: entity.cc_from_user_id_,
      ccFromUserName: entity.cc_from_user_name_,
      ccToUserId: entity.cc_to_user_id_,
      ccToUserName: entity.cc_to_user_name_,
      ccReason: entity.cc_reason_,
      status: entity.status_,
      readTime: entity.read_time_,
      extraData: entity.extra_data_ ? JSON.parse(entity.extra_data_) : undefined,
      tenantId: entity.tenant_id_,
      createTime: entity.create_time_,
    };
  }

  /**
   * 将抄送配置实体转换为信息对象
   */
  toCcConfigInfo(entity: CcConfigEntity): CcConfigInfo {
    return {
      id: entity.id_,
      processDefinitionId: entity.proc_def_id_,
      taskDefKey: entity.task_def_key_,
      taskName: entity.task_name_,
      ccType: entity.cc_type_,
      ccToExpression: entity.cc_to_expression_,
      ccToUsers: entity.cc_to_users_ ? JSON.parse(entity.cc_to_users_) : undefined,
      ccToGroups: entity.cc_to_groups_ ? JSON.parse(entity.cc_to_groups_) : undefined,
      enabled: entity.enabled_,
      condition: entity.condition_,
      description: entity.description_,
      extraConfig: entity.extra_config_ ? JSON.parse(entity.extra_config_) : undefined,
      tenantId: entity.tenant_id_,
      createTime: entity.create_time_,
      updateTime: entity.update_time_,
    };
  }

  // ==================== Controller 所需方法 ====================

  /**
   * 创建抄送（Controller接口）
   */
  async create(params: {
    taskId?: string;
    processInstanceId: string;
    userIds: string[];
    groupIds?: string[];
    reason?: string;
    type?: string;
    fromUserId: string;
  }): Promise<CcRecordEntity[]> {
    return this.batchCreateCcRecords({
      processInstanceId: params.processInstanceId,
      taskId: params.taskId,
      ccFromUserId: params.fromUserId,
      ccToUserIds: params.userIds,
      ccReason: params.reason,
      ccType: params.type as CcType,
    });
  }

  /**
   * 批量创建抄送（Controller接口）
   */
  async batchCreate(params: {
    taskId?: string;
    processInstanceId: string;
    userIds: string[];
    reason?: string;
    fromUserId: string;
  }): Promise<CcRecordEntity[]> {
    return this.batchCreateCcRecords({
      processInstanceId: params.processInstanceId,
      taskId: params.taskId,
      ccFromUserId: params.fromUserId,
      ccToUserIds: params.userIds,
      ccReason: params.reason,
    });
  }

  /**
   * 获取我的抄送列表（Controller接口）
   */
  async getMyCCList(params: {
    userId: string;
    status?: string;
    type?: string;
    startTimeAfter?: Date;
    startTimeBefore?: Date;
    page: number;
    pageSize: number;
  }): Promise<{ total: number; unreadCount: number; list: CcRecordEntity[] }> {
    const queryBuilder = this.ccRecordRepository
      .createQueryBuilder('cc')
      .where('cc.cc_to_user_id_ = :userId', { userId: params.userId });

    if (params.status) {
      queryBuilder.andWhere('cc.status_ = :status', { status: params.status });
    }
    if (params.type) {
      queryBuilder.andWhere('cc.cc_type_ = :type', { type: params.type });
    }
    if (params.startTimeAfter) {
      queryBuilder.andWhere('cc.create_time_ >= :startTimeAfter', {
        startTimeAfter: params.startTimeAfter,
      });
    }
    if (params.startTimeBefore) {
      queryBuilder.andWhere('cc.create_time_ <= :startTimeBefore', {
        startTimeBefore: params.startTimeBefore,
      });
    }

    const total = await queryBuilder.getCount();
    const list = await queryBuilder
      .orderBy('cc.create_time_', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    const unreadCount = await this.getUnreadCountForUser(params.userId);

    return { total, unreadCount, list };
  }

  /**
   * 获取抄送统计信息（Controller接口）
   */
  async getStatistics(userId: string): Promise<{
    total: number;
    unread: number;
    read: number;
    archived: number;
  }> {
    const total = await this.ccRecordRepository.count({
      where: { cc_to_user_id_: userId },
    });
    const unread = await this.ccRecordRepository.count({
      where: { cc_to_user_id_: userId, status_: CcStatus.UNREAD },
    });
    const read = await this.ccRecordRepository.count({
      where: { cc_to_user_id_: userId, status_: CcStatus.READ },
    });
    const archived = await this.ccRecordRepository.count({
      where: { cc_to_user_id_: userId, status_: CcStatus.ARCHIVED },
    });

    return { total, unread, read, archived };
  }

  /**
   * 获取抄送详情（Controller接口）
   */
  async getDetail(id: string, userId: string): Promise<any> {
    const record = await this.ccRecordRepository.findOne({
      where: { id_: id },
    });
    if (!record) {
      throw new NotFoundException(`抄送记录不存在: ${id}`);
    }
    // 返回扩展的详情信息
    return {
      ...record,
      task_name_: null,
      task_description_: null,
      proc_def_key_: null,
      proc_def_name_: null,
      proc_start_time_: null,
      starter_id_: null,
      starter_name_: null,
      user_name_: null,
      user_email_: null,
      from_user_name_: record.cc_from_user_name_,
      type_: record.cc_type_,
      reason_: record.cc_reason_,
      comment_: null,
      handle_time_: null,
      task_variables_: null,
      process_variables_: null,
    };
  }

  /**
   * 标记已读（带用户验证）
   */
  async markAsReadWithUser(id: string, userId: string): Promise<CcRecordEntity> {
    const record = await this.ccRecordRepository.findOne({
      where: { id_: id },
    });
    if (!record) {
      throw new NotFoundException(`抄送记录不存在: ${id}`);
    }
    if (record.cc_to_user_id_ !== userId) {
      throw new NotFoundException(`无权操作此抄送记录`);
    }
    record.status_ = CcStatus.READ;
    record.read_time_ = new Date();
    return this.ccRecordRepository.save(record);
  }

  /**
   * 批量标记已读（带用户验证）
   */
  async batchMarkAsReadWithUser(ids: string[], userId: string): Promise<number> {
    const result = await this.ccRecordRepository.update(
      { id_: In(ids), cc_to_user_id_: userId },
      { status_: CcStatus.READ, read_time_: new Date() },
    );
    return result.affected || 0;
  }

  /**
   * 更新状态（Controller接口）
   */
  async updateStatus(params: {
    id: string;
    status: string;
    comment?: string;
    userId: string;
  }): Promise<CcRecordEntity> {
    const record = await this.ccRecordRepository.findOne({
      where: { id_: params.id },
    });
    if (!record) {
      throw new NotFoundException(`抄送记录不存在: ${params.id}`);
    }
    if (record.cc_to_user_id_ !== params.userId) {
      throw new NotFoundException(`无权操作此抄送记录`);
    }
    record.status_ = params.status as CcStatus;
    return this.ccRecordRepository.save(record);
  }

  /**
   * 归档（Controller接口）
   */
  async archive(id: string, userId: string): Promise<CcRecordEntity> {
    const record = await this.ccRecordRepository.findOne({
      where: { id_: id },
    });
    if (!record) {
      throw new NotFoundException(`抄送记录不存在: ${id}`);
    }
    if (record.cc_to_user_id_ !== userId) {
      throw new NotFoundException(`无权操作此抄送记录`);
    }
    record.status_ = CcStatus.ARCHIVED;
    return this.ccRecordRepository.save(record);
  }

  /**
   * 删除（Controller接口）
   */
  async deleteWithUser(id: string, userId: string): Promise<void> {
    const record = await this.ccRecordRepository.findOne({
      where: { id_: id },
    });
    if (!record) {
      throw new NotFoundException(`抄送记录不存在: ${id}`);
    }
    if (record.cc_to_user_id_ !== userId) {
      throw new NotFoundException(`无权操作此抄送记录`);
    }
    await this.ccRecordRepository.delete({ id_: id });
  }

  /**
   * 查询（Controller接口）
   */
  async query(params: {
    taskId?: string;
    processInstanceId?: string;
    status?: string;
    type?: string;
    page: number;
    pageSize: number;
  }): Promise<{ total: number; list: CcRecordEntity[] }> {
    const queryBuilder = this.ccRecordRepository.createQueryBuilder('cc');

    if (params.taskId) {
      queryBuilder.andWhere('cc.task_id_ = :taskId', { taskId: params.taskId });
    }
    if (params.processInstanceId) {
      queryBuilder.andWhere('cc.proc_inst_id_ = :processInstanceId', {
        processInstanceId: params.processInstanceId,
      });
    }
    if (params.status) {
      queryBuilder.andWhere('cc.status_ = :status', { status: params.status });
    }
    if (params.type) {
      queryBuilder.andWhere('cc.cc_type_ = :type', { type: params.type });
    }

    const total = await queryBuilder.getCount();
    const list = await queryBuilder
      .orderBy('cc.create_time_', 'DESC')
      .skip((params.page - 1) * params.pageSize)
      .take(params.pageSize)
      .getMany();

    return { total, list };
  }

  /**
   * 创建配置（Controller接口）
   */
  async createConfig(params: {
    processDefinitionKey: string;
    activityId?: string;
    userIds?: string[];
    groupIds?: string[];
    enabled?: boolean;
    type?: string;
  }): Promise<CcConfigEntity> {
    return this.createCcConfig({
      processDefinitionId: params.processDefinitionKey,
      taskDefKey: params.activityId,
      ccToUsers: params.userIds,
      ccToGroups: params.groupIds,
      enabled: params.enabled,
      ccType: params.type as CcType,
    });
  }

  /**
   * 获取配置（Controller接口）
   */
  async getConfig(processDefinitionKey: string, activityId?: string): Promise<any[]> {
    const configs = await this.getCcConfigsByProcessDefinition(processDefinitionKey);
    if (activityId) {
      return configs.filter((c) => c.task_def_key_ === activityId);
    }
    return configs.map((c) => this.toCcConfigInfo(c));
  }

  /**
   * 更新配置（Controller接口）
   */
  async updateConfig(id: string, params: Partial<{
    processDefinitionKey: string;
    activityId: string;
    userIds: string[];
    groupIds: string[];
    enabled: boolean;
    type: string;
  }>): Promise<void> {
    await this.updateCcConfig(id, {
      processDefinitionId: params.processDefinitionKey,
      taskDefKey: params.activityId,
      ccToUsers: params.userIds,
      ccToGroups: params.groupIds,
      enabled: params.enabled,
      ccType: params.type as CcType,
    });
  }

  /**
   * 删除配置（Controller接口）
   */
  async deleteConfig(id: string): Promise<void> {
    await this.deleteCcConfig(id);
  }
}
