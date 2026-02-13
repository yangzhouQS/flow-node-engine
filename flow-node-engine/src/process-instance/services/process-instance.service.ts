import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProcessDefinition } from '../../process-definition/entities/process-definition.entity';
import { Execution } from '../entities/execution.entity';
import { ProcessInstance } from '../entities/process-instance.entity';
import { Variable } from '../entities/variable.entity';

@Injectable()
export class ProcessInstanceService {
  constructor(
    @InjectRepository(ProcessInstance)
    private processInstanceRepository: Repository<ProcessInstance>,
    @InjectRepository(Execution)
    private executionRepository: Repository<Execution>,
    @InjectRepository(Variable)
    private variableRepository: Repository<Variable>,
    @InjectRepository(ProcessDefinition)
    private processDefinitionRepository: Repository<ProcessDefinition>,
  ) {}

  /**
   * 创建流程实例
   */
  async create(
    processDefinitionId: string,
    businessKey?: string,
    startUserId?: string,
    variables?: Record<string, any>,
    tenantId?: string,
  ): Promise<ProcessInstance> {
    // 验证流程定义是否存在
    const processDefinition = await this.processDefinitionRepository.findOne({
      where: { id: processDefinitionId },
    });

    if (!processDefinition) {
      throw new NotFoundException(`流程定义不存在: ${processDefinitionId}`);
    }

    // 创建流程实例
    const processInstance = this.processInstanceRepository.create({
      processDefinitionId,
      processDefinitionKey: processDefinition.key,
      businessKey,
      startUserId,
      variables,
      state: 'active',
      startTime: new Date(),
      tenantId,
      createTime: new Date(),
    });

    const savedInstance = await this.processInstanceRepository.save(processInstance);

    // 创建根执行实例
    const rootExecution = this.executionRepository.create({
      processInstanceId: savedInstance.id,
      activityId: processDefinition.startActivityId || 'start',
      activityName: processDefinition.startActivityName || 'Start',
      activityType: 'startEvent',
      state: 'active',
      businessKey,
      tenantId,
      variables,
      startTime: new Date(),
      createTime: new Date(),
    });

    await this.executionRepository.save(rootExecution);

    return savedInstance;
  }

  /**
   * 根据ID查询流程实例
   */
  async findById(id: string): Promise<ProcessInstance> {
    const processInstance = await this.processInstanceRepository.findOne({
      where: { id },
      relations: ['processDefinition', 'executions', 'variables'],
    });

    if (!processInstance) {
      throw new NotFoundException(`流程实例不存在: ${id}`);
    }

    return processInstance;
  }

  /**
   * 根据业务键查询流程实例
   */
  async findByBusinessKey(businessKey: string, tenantId?: string): Promise<ProcessInstance> {
    const where: any = { businessKey };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const processInstance = await this.processInstanceRepository.findOne({
      where,
      relations: ['processDefinition', 'executions', 'variables'],
    });

    if (!processInstance) {
      throw new NotFoundException(`流程实例不存在: ${businessKey}`);
    }

    return processInstance;
  }

  /**
   * 根据流程定义ID查询流程实例列表
   */
  async findByProcessDefinitionId(
    processDefinitionId: string,
    page = 1,
    pageSize = 10,
  ): Promise<{ data: ProcessInstance[]; total: number }> {
    const [data, total] = await this.processInstanceRepository.findAndCount({
      where: { processDefinitionId },
      relations: ['processDefinition'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createTime: 'DESC' },
    });

    return { data, total };
  }

  /**
   * 查询所有流程实例
   */
  async findAll(
    page = 1,
    pageSize = 10,
    state?: string,
    tenantId?: string,
  ): Promise<{ data: ProcessInstance[]; total: number }> {
    const queryBuilder = this.processInstanceRepository
      .createQueryBuilder('pi')
      .leftJoinAndSelect('pi.processDefinition', 'pd');

    if (state) {
      queryBuilder.andWhere('pi.state = :state', { state });
    }

    if (tenantId) {
      queryBuilder.andWhere('pi.tenantId = :tenantId', { tenantId });
    }

    const [data, total] = await queryBuilder
      .orderBy('pi.createTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  /**
   * 更新流程实例
   */
  async update(id: string, updates: Partial<ProcessInstance>): Promise<ProcessInstance> {
    const processInstance = await this.findById(id);

    Object.assign(processInstance, updates);
    processInstance.updateTime = new Date();

    return this.processInstanceRepository.save(processInstance);
  }

  /**
   * 更新流程实例变量
   */
  async updateVariables(id: string, variables: Record<string, any>): Promise<ProcessInstance> {
    const processInstance = await this.findById(id);

    // 合并变量
    const mergedVariables = { ...processInstance.variables, ...variables };
    processInstance.variables = mergedVariables;
    processInstance.updateTime = new Date();

    return this.processInstanceRepository.save(processInstance);
  }

  /**
   * 获取流程实例变量
   */
  async getVariables(id: string): Promise<Record<string, any>> {
    const processInstance = await this.findById(id);
    return processInstance.variables || {};
  }

  /**
   * 获取流程实例单个变量
   */
  async getVariable(id: string, name: string): Promise<any> {
    const processInstance = await this.findById(id);
    return processInstance.variables?.[name];
  }

  /**
   * 删除流程实例（软删除）
   */
  async delete(id: string, deleteReason?: string): Promise<void> {
    const processInstance = await this.findById(id);

    processInstance.state = 'deleted';
    processInstance.deleteReason = deleteReason || 'Deleted by user';
    processInstance.endTime = new Date();
    processInstance.updateTime = new Date();

    await this.processInstanceRepository.save(processInstance);

    // 删除关联的执行实例
    await this.executionRepository.update(
      { processInstanceId: id },
      { state: 'deleted', deleteReason: processInstance.deleteReason, endTime: new Date() },
    );
  }

  /**
   * 批量删除流程实例
   */
  async deleteMany(ids: string[], deleteReason?: string): Promise<void> {
    for (const id of ids) {
      await this.delete(id, deleteReason);
    }
  }

  /**
   * 挂起流程实例
   */
  async suspend(id: string): Promise<ProcessInstance> {
    const processInstance = await this.findById(id);

    if (processInstance.state === 'suspended') {
      throw new Error('流程实例已处于挂起状态');
    }

    processInstance.state = 'suspended';
    processInstance.updateTime = new Date();

    return this.processInstanceRepository.save(processInstance);
  }

  /**
   * 激活流程实例
   */
  async activate(id: string): Promise<ProcessInstance> {
    const processInstance = await this.findById(id);

    if (processInstance.state === 'active') {
      throw new Error('流程实例已处于激活状态');
    }

    processInstance.state = 'active';
    processInstance.updateTime = new Date();

    return this.processInstanceRepository.save(processInstance);
  }

  /**
   * 完成流程实例
   */
  async complete(id: string): Promise<ProcessInstance> {
    const processInstance = await this.findById(id);

    if (processInstance.state === 'completed') {
      throw new Error('流程实例已完成');
    }

    processInstance.state = 'completed';
    processInstance.endTime = new Date();
    processInstance.updateTime = new Date();

    // 更新所有执行实例状态
    await this.executionRepository.update(
      { processInstanceId: id },
      { state: 'completed', endTime: new Date() },
    );

    return this.processInstanceRepository.save(processInstance);
  }

  /**
   * 获取流程实例的执行实例列表
   */
  async getExecutions(id: string): Promise<Execution[]> {
    return this.executionRepository.find({
      where: { processInstanceId: id },
      order: { createTime: 'ASC' },
    });
  }

  /**
   * 获取流程实例的变量列表
   */
  async getVariableList(id: string): Promise<Variable[]> {
    return this.variableRepository.find({
      where: { processInstanceId: id },
      order: { createTime: 'ASC' },
    });
  }

  /**
   * 统计流程实例数量
   */
  async count(state?: string, tenantId?: string): Promise<number> {
    const queryBuilder = this.processInstanceRepository.createQueryBuilder('pi');

    if (state) {
      queryBuilder.andWhere('pi.state = :state', { state });
    }

    if (tenantId) {
      queryBuilder.andWhere('pi.tenantId = :tenantId', { tenantId });
    }

    return queryBuilder.getCount();
  }
}
