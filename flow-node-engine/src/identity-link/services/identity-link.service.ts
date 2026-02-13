import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import {
  HistoricIdentityLinkEntity,
  CreateHistoricIdentityLinkParams,
  HistoricIdentityLinkInfo,
} from '../entities/historic-identity-link.entity';
import {
  IdentityLinkEntity,
  IdentityLinkType,
  CreateIdentityLinkParams,
  IdentityLinkInfo,
} from '../entities/identity-link.entity';

/**
 * 身份链接查询参数
 */
export interface IdentityLinkQueryParams {
  taskId?: string;
  processInstanceId?: string;
  processDefinitionId?: string;
  userId?: string;
  groupId?: string;
  linkType?: IdentityLinkType | string;
  tenantId?: string;
}

/**
 * 身份链接服务
 * 提供身份链接的创建、查询、删除等功能
 */
@Injectable()
export class IdentityLinkService {
  constructor(
    @InjectRepository(IdentityLinkEntity)
    private readonly identityLinkRepository: Repository<IdentityLinkEntity>,
    @InjectRepository(HistoricIdentityLinkEntity)
    private readonly historicIdentityLinkRepository: Repository<HistoricIdentityLinkEntity>,
  ) {}

  // ==================== 运行时身份链接操作 ====================

  /**
   * 创建身份链接
   */
  async createIdentityLink(params: CreateIdentityLinkParams): Promise<IdentityLinkEntity> {
    const entity = new IdentityLinkEntity();
    entity.id_ = uuidv4();
    entity.type_ = params.type || 'task';
    entity.user_id_ = params.userId || null;
    entity.group_id_ = params.groupId || null;
    entity.task_id_ = params.taskId || null;
    entity.proc_inst_id_ = params.processInstanceId || null;
    entity.proc_def_id_ = params.processDefinitionId || null;
    entity.link_type_ = params.linkType;
    entity.tenant_id_ = params.tenantId || null;
    entity.create_time_ = new Date();

    return await this.identityLinkRepository.save(entity);
  }

  /**
   * 批量创建身份链接
   */
  async createIdentityLinks(paramsList: CreateIdentityLinkParams[]): Promise<IdentityLinkEntity[]> {
    const entities = paramsList.map((params) => {
      const entity = new IdentityLinkEntity();
      entity.id_ = uuidv4();
      entity.type_ = params.type || 'task';
      entity.user_id_ = params.userId || null;
      entity.group_id_ = params.groupId || null;
      entity.task_id_ = params.taskId || null;
      entity.proc_inst_id_ = params.processInstanceId || null;
      entity.proc_def_id_ = params.processDefinitionId || null;
      entity.link_type_ = params.linkType;
      entity.tenant_id_ = params.tenantId || null;
      entity.create_time_ = new Date();
      return entity;
    });

    return await this.identityLinkRepository.save(entities);
  }

  /**
   * 根据ID获取身份链接
   */
  async getIdentityLinkById(id: string): Promise<IdentityLinkEntity | null> {
    return await this.identityLinkRepository.findOne({ where: { id_: id } });
  }

  /**
   * 查询身份链接列表
   */
  async queryIdentityLinks(params: IdentityLinkQueryParams): Promise<IdentityLinkEntity[]> {
    const queryBuilder = this.identityLinkRepository.createQueryBuilder('link');

    if (params.taskId) {
      queryBuilder.andWhere('link.task_id_ = :taskId', { taskId: params.taskId });
    }
    if (params.processInstanceId) {
      queryBuilder.andWhere('link.proc_inst_id_ = :procInstId', {
        procInstId: params.processInstanceId,
      });
    }
    if (params.processDefinitionId) {
      queryBuilder.andWhere('link.proc_def_id_ = :procDefId', {
        procDefId: params.processDefinitionId,
      });
    }
    if (params.userId) {
      queryBuilder.andWhere('link.user_id_ = :userId', { userId: params.userId });
    }
    if (params.groupId) {
      queryBuilder.andWhere('link.group_id_ = :groupId', { groupId: params.groupId });
    }
    if (params.linkType) {
      queryBuilder.andWhere('link.link_type_ = :linkType', { linkType: params.linkType });
    }
    if (params.tenantId) {
      queryBuilder.andWhere('link.tenant_id_ = :tenantId', { tenantId: params.tenantId });
    }

    return await queryBuilder.getMany();
  }

  /**
   * 获取任务的候选人用户列表
   */
  async getCandidateUsersForTask(taskId: string): Promise<string[]> {
    const links = await this.identityLinkRepository.find({
      where: {
        task_id_: taskId,
        link_type_: IdentityLinkType.CANDIDATE,
      },
    });

    return links
      .filter((link) => link.user_id_)
      .map((link) => link.user_id_ as string);
  }

  /**
   * 获取任务的候选组列表
   */
  async getCandidateGroupsForTask(taskId: string): Promise<string[]> {
    const links = await this.identityLinkRepository.find({
      where: {
        task_id_: taskId,
        link_type_: IdentityLinkType.CANDIDATE,
      },
    });

    return links
      .filter((link) => link.group_id_)
      .map((link) => link.group_id_ as string);
  }

  /**
   * 获取用户可认领的任务ID列表
   */
  async getTaskIdsForCandidateUser(
    userId: string,
    groupIds?: string[],
  ): Promise<string[]> {
    const queryBuilder = this.identityLinkRepository.createQueryBuilder('link');

    queryBuilder.where('link.link_type_ = :linkType', {
      linkType: IdentityLinkType.CANDIDATE,
    });

    queryBuilder.andWhere(
      '(link.user_id_ = :userId OR link.group_id_ IN (:...groupIds))',
      {
        userId,
        groupIds: groupIds || [],
      },
    );

    const links = await queryBuilder.getMany();
    return links
      .filter((link) => link.task_id_)
      .map((link) => link.task_id_ as string);
  }

  /**
   * 添加任务候选人
   */
  async addCandidateUserToTask(
    taskId: string,
    userId: string,
    processInstanceId?: string,
    tenantId?: string,
  ): Promise<IdentityLinkEntity> {
    return await this.createIdentityLink({
      type: 'task',
      taskId,
      userId,
      processInstanceId,
      linkType: IdentityLinkType.CANDIDATE,
      tenantId,
    });
  }

  /**
   * 添加任务候选组
   */
  async addCandidateGroupToTask(
    taskId: string,
    groupId: string,
    processInstanceId?: string,
    tenantId?: string,
  ): Promise<IdentityLinkEntity> {
    return await this.createIdentityLink({
      type: 'task',
      taskId,
      groupId,
      processInstanceId,
      linkType: IdentityLinkType.CANDIDATE,
      tenantId,
    });
  }

  /**
   * 删除任务候选人
   */
  async deleteCandidateUserFromTask(taskId: string, userId: string): Promise<void> {
    await this.identityLinkRepository.delete({
      task_id_: taskId,
      user_id_: userId,
      link_type_: IdentityLinkType.CANDIDATE,
    });
  }

  /**
   * 删除任务候选组
   */
  async deleteCandidateGroupFromTask(taskId: string, groupId: string): Promise<void> {
    await this.identityLinkRepository.delete({
      task_id_: taskId,
      group_id_: groupId,
      link_type_: IdentityLinkType.CANDIDATE,
    });
  }

  /**
   * 设置任务受让人
   */
  async setTaskAssignee(
    taskId: string,
    userId: string,
    processInstanceId?: string,
    tenantId?: string,
  ): Promise<IdentityLinkEntity> {
    // 先删除现有的受让人
    await this.identityLinkRepository.delete({
      task_id_: taskId,
      link_type_: IdentityLinkType.ASSIGNEE,
    });

    // 创建新的受让人链接
    return await this.createIdentityLink({
      type: 'task',
      taskId,
      userId,
      processInstanceId,
      linkType: IdentityLinkType.ASSIGNEE,
      tenantId,
    });
  }

  /**
   * 设置任务拥有者
   */
  async setTaskOwner(
    taskId: string,
    userId: string,
    processInstanceId?: string,
    tenantId?: string,
  ): Promise<IdentityLinkEntity> {
    // 先删除现有的拥有者
    await this.identityLinkRepository.delete({
      task_id_: taskId,
      link_type_: IdentityLinkType.OWNER,
    });

    // 创建新的拥有者链接
    return await this.createIdentityLink({
      type: 'task',
      taskId,
      userId,
      processInstanceId,
      linkType: IdentityLinkType.OWNER,
      tenantId,
    });
  }

  /**
   * 添加流程参与者
   */
  async addProcessParticipant(
    processInstanceId: string,
    userId: string,
    processDefinitionId?: string,
    tenantId?: string,
  ): Promise<IdentityLinkEntity> {
    return await this.createIdentityLink({
      type: 'process',
      userId,
      processInstanceId,
      processDefinitionId,
      linkType: IdentityLinkType.PARTICIPANT,
      tenantId,
    });
  }

  /**
   * 设置流程发起人
   */
  async setProcessStarter(
    processInstanceId: string,
    userId: string,
    processDefinitionId?: string,
    tenantId?: string,
  ): Promise<IdentityLinkEntity> {
    return await this.createIdentityLink({
      type: 'process',
      userId,
      processInstanceId,
      processDefinitionId,
      linkType: IdentityLinkType.STARTER,
      tenantId,
    });
  }

  /**
   * 删除身份链接
   */
  async deleteIdentityLink(id: string): Promise<void> {
    await this.identityLinkRepository.delete({ id_: id });
  }

  /**
   * 删除任务的所有身份链接
   */
  async deleteIdentityLinksForTask(taskId: string): Promise<void> {
    await this.identityLinkRepository.delete({ task_id_: taskId });
  }

  /**
   * 删除流程实例的所有身份链接
   */
  async deleteIdentityLinksForProcessInstance(processInstanceId: string): Promise<void> {
    await this.identityLinkRepository.delete({ proc_inst_id_: processInstanceId });
  }

  // ==================== 历史身份链接操作 ====================

  /**
   * 创建历史身份链接
   */
  async createHistoricIdentityLink(
    params: CreateHistoricIdentityLinkParams,
  ): Promise<HistoricIdentityLinkEntity> {
    const entity = new HistoricIdentityLinkEntity();
    entity.id_ = uuidv4();
    entity.type_ = params.type || 'task';
    entity.user_id_ = params.userId || null;
    entity.group_id_ = params.groupId || null;
    entity.task_id_ = params.taskId || null;
    entity.historic_task_id_ = params.historicTaskId || null;
    entity.proc_inst_id_ = params.processInstanceId || null;
    entity.proc_def_id_ = params.processDefinitionId || null;
    entity.link_type_ = params.linkType;
    entity.tenant_id_ = params.tenantId || null;
    entity.create_time_ = new Date();

    return await this.historicIdentityLinkRepository.save(entity);
  }

  /**
   * 将运行时身份链接归档到历史
   */
  async archiveIdentityLinkToHistory(
    identityLink: IdentityLinkEntity,
    historicTaskId?: string,
  ): Promise<HistoricIdentityLinkEntity> {
    return await this.createHistoricIdentityLink({
      type: identityLink.type_,
      userId: identityLink.user_id_,
      groupId: identityLink.group_id_,
      taskId: identityLink.task_id_,
      historicTaskId,
      processInstanceId: identityLink.proc_inst_id_,
      processDefinitionId: identityLink.proc_def_id_,
      linkType: identityLink.link_type_,
      tenantId: identityLink.tenant_id_,
    });
  }

  /**
   * 查询历史身份链接
   */
  async queryHistoricIdentityLinks(
    params: IdentityLinkQueryParams,
  ): Promise<HistoricIdentityLinkEntity[]> {
    const queryBuilder = this.historicIdentityLinkRepository.createQueryBuilder('link');

    if (params.taskId) {
      queryBuilder.andWhere('link.task_id_ = :taskId', { taskId: params.taskId });
    }
    if (params.processInstanceId) {
      queryBuilder.andWhere('link.proc_inst_id_ = :procInstId', {
        procInstId: params.processInstanceId,
      });
    }
    if (params.processDefinitionId) {
      queryBuilder.andWhere('link.proc_def_id_ = :procDefId', {
        procDefId: params.processDefinitionId,
      });
    }
    if (params.userId) {
      queryBuilder.andWhere('link.user_id_ = :userId', { userId: params.userId });
    }
    if (params.groupId) {
      queryBuilder.andWhere('link.group_id_ = :groupId', { groupId: params.groupId });
    }
    if (params.linkType) {
      queryBuilder.andWhere('link.link_type_ = :linkType', { linkType: params.linkType });
    }
    if (params.tenantId) {
      queryBuilder.andWhere('link.tenant_id_ = :tenantId', { tenantId: params.tenantId });
    }

    return await queryBuilder.getMany();
  }

  /**
   * 获取流程参与者的用户列表
   */
  async getProcessParticipants(processInstanceId: string): Promise<string[]> {
    const links = await this.historicIdentityLinkRepository.find({
      where: {
        proc_inst_id_: processInstanceId,
        link_type_: IdentityLinkType.PARTICIPANT,
      },
    });

    return links
      .filter((link) => link.user_id_)
      .map((link) => link.user_id_ as string);
  }

  /**
   * 获取流程发起人
   */
  async getProcessStarter(processInstanceId: string): Promise<string | null> {
    const link = await this.historicIdentityLinkRepository.findOne({
      where: {
        proc_inst_id_: processInstanceId,
        link_type_: IdentityLinkType.STARTER,
      },
    });

    return link?.user_id_ || null;
  }

  /**
   * 删除历史身份链接
   */
  async deleteHistoricIdentityLink(id: string): Promise<void> {
    await this.historicIdentityLinkRepository.delete({ id_: id });
  }

  /**
   * 删除流程实例的所有历史身份链接
   */
  async deleteHistoricIdentityLinksForProcessInstance(
    processInstanceId: string,
  ): Promise<void> {
    await this.historicIdentityLinkRepository.delete({ proc_inst_id_: processInstanceId });
  }

  // ==================== 转换方法 ====================

  /**
   * 将实体转换为信息对象
   */
  toIdentityLinkInfo(entity: IdentityLinkEntity): IdentityLinkInfo {
    return {
      id: entity.id_,
      type: entity.type_,
      userId: entity.user_id_,
      groupId: entity.group_id_,
      taskId: entity.task_id_,
      processInstanceId: entity.proc_inst_id_,
      processDefinitionId: entity.proc_def_id_,
      linkType: entity.link_type_,
      tenantId: entity.tenant_id_,
      createTime: entity.create_time_,
    };
  }

  /**
   * 将历史实体转换为信息对象
   */
  toHistoricIdentityLinkInfo(entity: HistoricIdentityLinkEntity): HistoricIdentityLinkInfo {
    return {
      id: entity.id_,
      type: entity.type_,
      userId: entity.user_id_,
      groupId: entity.group_id_,
      taskId: entity.task_id_,
      historicTaskId: entity.historic_task_id_,
      processInstanceId: entity.proc_inst_id_,
      processDefinitionId: entity.proc_def_id_,
      linkType: entity.link_type_,
      tenantId: entity.tenant_id_,
      createTime: entity.create_time_,
    };
  }

  // ==================== Controller兼容方法别名 ====================

  /**
   * 创建身份链接 - Controller兼容方法
   */
  async create(params: CreateIdentityLinkParams): Promise<IdentityLinkEntity> {
    return this.createIdentityLink(params);
  }

  /**
   * 批量创建身份链接 - Controller兼容方法
   */
  async batchCreate(paramsList: CreateIdentityLinkParams[]): Promise<IdentityLinkEntity[]> {
    return this.createIdentityLinks(paramsList);
  }

  /**
   * 查询身份链接 - Controller兼容方法
   */
  async query(params: IdentityLinkQueryParams): Promise<IdentityLinkEntity[]> {
    return this.queryIdentityLinks(params);
  }

  /**
   * 获取任务候选人（用户和组）- Controller兼容方法
   */
  async getTaskCandidates(taskId: string): Promise<{ users: string[]; groups: string[] }> {
    const [users, groups] = await Promise.all([
      this.getCandidateUsersForTask(taskId),
      this.getCandidateGroupsForTask(taskId),
    ]);
    return { users, groups };
  }

  /**
   * 添加候选人用户 - Controller兼容方法
   */
  async addCandidateUser(taskId: string, userId: string, processInstanceId?: string, tenantId?: string): Promise<IdentityLinkEntity> {
    return this.addCandidateUserToTask(taskId, userId, processInstanceId, tenantId);
  }

  /**
   * 删除候选人用户 - Controller兼容方法
   */
  async deleteCandidateUser(taskId: string, userId: string): Promise<void> {
    return this.deleteCandidateUserFromTask(taskId, userId);
  }

  /**
   * 添加候选组 - Controller兼容方法
   */
  async addCandidateGroup(taskId: string, groupId: string, processInstanceId?: string, tenantId?: string): Promise<IdentityLinkEntity> {
    return this.addCandidateGroupToTask(taskId, groupId, processInstanceId, tenantId);
  }

  /**
   * 删除候选组 - Controller兼容方法
   */
  async deleteCandidateGroup(taskId: string, groupId: string): Promise<void> {
    return this.deleteCandidateGroupFromTask(taskId, groupId);
  }

  /**
   * 设置受让人 - Controller兼容方法
   */
  async setAssignee(taskId: string, userId: string, processInstanceId?: string, tenantId?: string): Promise<IdentityLinkEntity> {
    return this.setTaskAssignee(taskId, userId, processInstanceId, tenantId);
  }

  /**
   * 设置拥有者 - Controller兼容方法
   */
  async setOwner(taskId: string, userId: string, processInstanceId?: string, tenantId?: string): Promise<IdentityLinkEntity> {
    return this.setTaskOwner(taskId, userId, processInstanceId, tenantId);
  }

  /**
   * 删除身份链接 - Controller兼容方法
   */
  async delete(id: string): Promise<void> {
    return this.deleteIdentityLink(id);
  }

  /**
   * 检查用户任务访问权限
   */
  async checkTaskAccess(taskId: string, userId: string, groupIds?: string[]): Promise<boolean> {
    // 检查是否是受让人
    const assigneeLink = await this.identityLinkRepository.findOne({
      where: { task_id_: taskId, user_id_: userId, link_type_: IdentityLinkType.ASSIGNEE },
    });
    if (assigneeLink) return true;

    // 检查是否是拥有者
    const ownerLink = await this.identityLinkRepository.findOne({
      where: { task_id_: taskId, user_id_: userId, link_type_: IdentityLinkType.OWNER },
    });
    if (ownerLink) return true;

    // 检查是否是候选人用户
    const candidateUserLink = await this.identityLinkRepository.findOne({
      where: { task_id_: taskId, user_id_: userId, link_type_: IdentityLinkType.CANDIDATE },
    });
    if (candidateUserLink) return true;

    // 检查是否是候选组成员
    if (groupIds && groupIds.length > 0) {
      const candidateGroupLink = await this.identityLinkRepository.findOne({
        where: { task_id_: taskId, group_id_: In(groupIds), link_type_: IdentityLinkType.CANDIDATE },
      });
      if (candidateGroupLink) return true;
    }

    return false;
  }
}
