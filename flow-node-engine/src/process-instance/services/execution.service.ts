import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Execution } from '../entities/execution.entity';
import { ProcessInstance } from '../entities/process-instance.entity';
import { Variable } from '../entities/variable.entity';

@Injectable()
export class ExecutionService {
  constructor(
    @InjectRepository(Execution)
    private executionRepository: Repository<Execution>,
    @InjectRepository(ProcessInstance)
    private processInstanceRepository: Repository<ProcessInstance>,
    @InjectRepository(Variable)
    private variableRepository: Repository<Variable>,
  ) {}

  /**
   * 创建执行实例
   */
  async create(
    processInstanceId: string,
    activityId: string,
    activityName: string,
    activityType: string,
    parentActivityId?: string,
    businessKey?: string,
    variables?: Record<string, any>,
    tenantId?: string,
  ): Promise<Execution> {
    // 验证流程实例是否存在
    const processInstance = await this.processInstanceRepository.findOne({
      where: { id: processInstanceId },
    });

    if (!processInstance) {
      throw new NotFoundException(`流程实例不存在: ${processInstanceId}`);
    }

    const execution = this.executionRepository.create({
      processInstanceId,
      activityId,
      activityName,
      activityType,
      parentActivityId,
      state: 'active',
      businessKey: businessKey || processInstance.businessKey,
      tenantId: tenantId || processInstance.tenantId,
      variables,
      startTime: new Date(),
      createTime: new Date(),
    });

    return this.executionRepository.save(execution);
  }

  /**
   * 根据ID查询执行实例
   */
  async findById(id: string): Promise<Execution> {
    const execution = await this.executionRepository.findOne({
      where: { id },
      relations: ['processInstance', 'variables'],
    });

    if (!execution) {
      throw new NotFoundException(`执行实例不存在: ${id}`);
    }

    return execution;
  }

  /**
   * 根据流程实例ID查询执行实例列表
   */
  async findByProcessInstanceId(
    processInstanceId: string,
    state?: string,
  ): Promise<Execution[]> {
    const where: any = { processInstanceId };
    if (state) {
      where.state = state;
    }

    return this.executionRepository.find({
      where,
      relations: ['variables'],
      order: { createTime: 'ASC' },
    });
  }

  /**
   * 根据活动ID查询执行实例
   */
  async findByActivityId(activityId: string, processInstanceId?: string): Promise<Execution[]> {
    const where: any = { activityId };
    if (processInstanceId) {
      where.processInstanceId = processInstanceId;
    }

    return this.executionRepository.find({
      where,
      relations: ['processInstance'],
      order: { createTime: 'DESC' },
    });
  }

  /**
   * 查询所有执行实例
   */
  async findAll(
    page = 1,
    pageSize = 10,
    state?: string,
    tenantId?: string,
  ): Promise<{ data: Execution[]; total: number }> {
    const queryBuilder = this.executionRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.processInstance', 'pi');

    if (state) {
      queryBuilder.andWhere('e.state = :state', { state });
    }

    if (tenantId) {
      queryBuilder.andWhere('e.tenantId = :tenantId', { tenantId });
    }

    const [data, total] = await queryBuilder
      .orderBy('e.createTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  /**
   * 更新执行实例
   */
  async update(id: string, updates: Partial<Execution>): Promise<Execution> {
    const execution = await this.findById(id);

    Object.assign(execution, updates);
    execution.updateTime = new Date();

    return this.executionRepository.save(execution);
  }

  /**
   * 更新执行实例变量
   */
  async updateVariables(id: string, variables: Record<string, any>): Promise<Execution> {
    const execution = await this.findById(id);

    // 合并变量
    const mergedVariables = { ...execution.variables, ...variables };
    execution.variables = mergedVariables;
    execution.updateTime = new Date();

    return this.executionRepository.save(execution);
  }

  /**
   * 获取执行实例变量
   */
  async getVariables(id: string): Promise<Record<string, any>> {
    const execution = await this.findById(id);
    return execution.variables || {};
  }

  /**
   * 获取执行实例单个变量
   */
  async getVariable(id: string, name: string): Promise<any> {
    const execution = await this.findById(id);
    return execution.variables?.[name];
  }

  /**
   * 删除执行实例（软删除）
   */
  async delete(id: string, deleteReason?: string): Promise<void> {
    const execution = await this.findById(id);

    execution.state = 'deleted';
    execution.deleteReason = deleteReason || 'Deleted by user';
    execution.endTime = new Date();
    execution.updateTime = new Date();

    await this.executionRepository.save(execution);
  }

  /**
   * 批量删除执行实例
   */
  async deleteMany(ids: string[], deleteReason?: string): Promise<void> {
    for (const id of ids) {
      await this.delete(id, deleteReason);
    }
  }

  /**
   * 完成执行实例
   */
  async complete(id: string): Promise<Execution> {
    const execution = await this.findById(id);

    if (execution.state === 'completed') {
      throw new Error('执行实例已完成');
    }

    execution.state = 'completed';
    execution.endTime = new Date();
    execution.updateTime = new Date();

    return this.executionRepository.save(execution);
  }

  /**
   * 挂起执行实例
   */
  async suspend(id: string): Promise<Execution> {
    const execution = await this.findById(id);

    if (execution.state === 'suspended') {
      throw new Error('执行实例已处于挂起状态');
    }

    execution.state = 'suspended';
    execution.updateTime = new Date();

    return this.executionRepository.save(execution);
  }

  /**
   * 激活执行实例
   */
  async activate(id: string): Promise<Execution> {
    const execution = await this.findById(id);

    if (execution.state === 'active') {
      throw new Error('执行实例已处于激活状态');
    }

    execution.state = 'active';
    execution.updateTime = new Date();

    return this.executionRepository.save(execution);
  }

  /**
   * 获取执行实例的变量列表
   */
  async getVariableList(id: string): Promise<Variable[]> {
    return this.variableRepository.find({
      where: { executionId: id },
      order: { createTime: 'ASC' },
    });
  }

  /**
   * 获取子执行实例
   */
  async getChildren(parentActivityId: string, processInstanceId: string): Promise<Execution[]> {
    return this.executionRepository.find({
      where: { parentActivityId, processInstanceId },
      relations: ['variables'],
      order: { createTime: 'ASC' },
    });
  }

  /**
   * 统计执行实例数量
   */
  async count(state?: string, tenantId?: string): Promise<number> {
    const queryBuilder = this.executionRepository.createQueryBuilder('e');

    if (state) {
      queryBuilder.andWhere('e.state = :state', { state });
    }

    if (tenantId) {
      queryBuilder.andWhere('e.tenantId = :tenantId', { tenantId });
    }

    return queryBuilder.getCount();
  }
}
