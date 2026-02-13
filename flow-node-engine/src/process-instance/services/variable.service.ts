import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Execution } from '../entities/execution.entity';
import { ProcessInstance } from '../entities/process-instance.entity';
import { Variable } from '../entities/variable.entity';

@Injectable()
export class VariableService {
  constructor(
    @InjectRepository(Variable)
    private variableRepository: Repository<Variable>,
    @InjectRepository(ProcessInstance)
    private processInstanceRepository: Repository<ProcessInstance>,
    @InjectRepository(Execution)
    private executionRepository: Repository<Execution>,
  ) {}

  /**
   * 创建变量
   */
  async create(
    processInstanceId: string,
    name: string,
    value: any,
    type = 'string',
    executionId?: string,
    isLocal = true,
    scope = 'execution',
    tenantId?: string,
  ): Promise<Variable> {
    // 验证流程实例是否存在
    const processInstance = await this.processInstanceRepository.findOne({
      where: { id: processInstanceId },
    });

    if (!processInstance) {
      throw new NotFoundException(`流程实例不存在: ${processInstanceId}`);
    }

    // 如果指定了执行实例ID，验证执行实例是否存在
    if (executionId) {
      const execution = await this.executionRepository.findOne({
        where: { id: executionId },
      });

      if (!execution) {
        throw new NotFoundException(`执行实例不存在: ${executionId}`);
      }
    }

    // 序列化值为字符串
    const serializedValue = JSON.stringify(value);

    const variable = this.variableRepository.create({
      processInstanceId,
      executionId,
      name,
      type,
      value: serializedValue,
      isLocal,
      scope,
      createTime: new Date(),
    });

    return this.variableRepository.save(variable);
  }

  /**
   * 根据ID查询变量
   */
  async findById(id: string): Promise<Variable> {
    const variable = await this.variableRepository.findOne({
      where: { id },
      relations: ['processInstance', 'execution'],
    });

    if (!variable) {
      throw new NotFoundException(`变量不存在: ${id}`);
    }

    return variable;
  }

  /**
   * 根据流程实例ID查询变量列表
   */
  async findByProcessInstanceId(
    processInstanceId: string,
    scope?: string,
  ): Promise<Variable[]> {
    const where: any = { processInstanceId };
    if (scope) {
      where.scope = scope;
    }

    return this.variableRepository.find({
      where,
      relations: ['execution'],
      order: { createTime: 'ASC' },
    });
  }

  /**
   * 根据执行实例ID查询变量列表
   */
  async findByExecutionId(executionId: string): Promise<Variable[]> {
    return this.variableRepository.find({
      where: { executionId },
      relations: ['processInstance'],
      order: { createTime: 'ASC' },
    });
  }

  /**
   * 根据变量名查询变量
   */
  async findByName(
    name: string,
    processInstanceId?: string,
    executionId?: string,
  ): Promise<Variable[]> {
    const where: any = { name };
    if (processInstanceId) {
      where.processInstanceId = processInstanceId;
    }
    if (executionId) {
      where.executionId = executionId;
    }

    return this.variableRepository.find({
      where,
      relations: ['processInstance', 'execution'],
      order: { createTime: 'DESC' },
    });
  }

  /**
   * 查询所有变量
   */
  async findAll(
    page = 1,
    pageSize = 10,
    scope?: string,
  ): Promise<{ data: Variable[]; total: number }> {
    const queryBuilder = this.variableRepository
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.processInstance', 'pi')
      .leftJoinAndSelect('v.execution', 'e');

    if (scope) {
      queryBuilder.andWhere('v.scope = :scope', { scope });
    }

    const [data, total] = await queryBuilder
      .orderBy('v.createTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  /**
   * 更新变量
   */
  async update(id: string, updates: Partial<Variable>): Promise<Variable> {
    const variable = await this.findById(id);

    // 如果更新值，需要序列化
    if (updates.value !== undefined) {
      updates.value = JSON.stringify(updates.value);
    }

    Object.assign(variable, updates);
    variable.updateTime = new Date();

    return this.variableRepository.save(variable);
  }

  /**
   * 删除变量
   */
  async delete(id: string): Promise<void> {
    const variable = await this.findById(id);
    await this.variableRepository.remove(variable);
  }

  /**
   * 批量删除变量
   */
  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  /**
   * 根据流程实例ID删除所有变量
   */
  async deleteByProcessInstanceId(processInstanceId: string): Promise<void> {
    await this.variableRepository.delete({ processInstanceId });
  }

  /**
   * 根据执行实例ID删除所有变量
   */
  async deleteByExecutionId(executionId: string): Promise<void> {
    await this.variableRepository.delete({ executionId });
  }

  /**
   * 获取流程实例的所有变量（合并为键值对）
   */
  async getProcessInstanceVariables(
    processInstanceId: string,
    scope?: string,
  ): Promise<Record<string, any>> {
    const variables = await this.findByProcessInstanceId(processInstanceId, scope);

    const result: Record<string, any> = {};
    for (const variable of variables) {
      try {
        result[variable.name] = JSON.parse(variable.value);
      } catch (e) {
        result[variable.name] = variable.value;
      }
    }

    return result;
  }

  /**
   * 获取执行实例的所有变量（合并为键值对）
   */
  async getExecutionVariables(executionId: string): Promise<Record<string, any>> {
    const variables = await this.findByExecutionId(executionId);

    const result: Record<string, any> = {};
    for (const variable of variables) {
      try {
        result[variable.name] = JSON.parse(variable.value);
      } catch (e) {
        result[variable.name] = variable.value;
      }
    }

    return result;
  }

  /**
   * 批量创建变量
   */
  async createMany(
    processInstanceId: string,
    variables: Record<string, any>,
    executionId?: string,
    isLocal = true,
    scope = 'execution',
    tenantId?: string,
  ): Promise<Variable[]> {
    const createdVariables: Variable[] = [];

    for (const [name, value] of Object.entries(variables)) {
      const variable = await this.create(
        processInstanceId,
        name,
        value,
        typeof value,
        executionId,
        isLocal,
        scope,
        tenantId,
      );
      createdVariables.push(variable);
    }

    return createdVariables;
  }

  /**
   * 批量更新变量
   */
  async updateMany(
    processInstanceId: string,
    variables: Record<string, any>,
    executionId?: string,
  ): Promise<Variable[]> {
    const updatedVariables: Variable[] = [];

    for (const [name, value] of Object.entries(variables)) {
      // 查找现有变量
      const where: any = { processInstanceId, name };
      if (executionId) {
        where.executionId = executionId;
      }

      const existingVariable = await this.variableRepository.findOne({
        where,
      });

      if (existingVariable) {
        const updated = await this.update(existingVariable.id, { value });
        updatedVariables.push(updated);
      } else {
        // 如果不存在，创建新变量
        const created = await this.create(
          processInstanceId,
          name,
          value,
          typeof value,
          executionId,
        );
        updatedVariables.push(created);
      }
    }

    return updatedVariables;
  }

  /**
   * 统计变量数量
   */
  async count(scope?: string): Promise<number> {
    const queryBuilder = this.variableRepository.createQueryBuilder('v');

    if (scope) {
      queryBuilder.andWhere('v.scope = :scope', { scope });
    }

    return queryBuilder.getCount();
  }
}
