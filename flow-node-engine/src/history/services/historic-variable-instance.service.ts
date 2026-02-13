import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { HistoricVariableInstanceEntity, HistoricVariableType } from '../entities/historic-variable-instance.entity';

/**
 * 历史变量查询DTO
 */
export interface QueryHistoricVariableDto {
  processInstanceId?: string;
  executionId?: string;
  taskId?: string;
  activityInstanceId?: string;
  name?: string;
  nameLike?: string;
  type?: HistoricVariableType;
  tenantId?: string;
  createTimeBefore?: Date;
  createTimeAfter?: Date;
  includeDeleted?: boolean;
  orderBy?: 'name' | 'createTime' | 'lastUpdatedTime';
  orderDirection?: 'ASC' | 'DESC';
  page?: number;
  size?: number;
}

/**
 * 创建历史变量DTO
 */
export interface CreateHistoricVariableDto {
  processInstanceId?: string;
  executionId?: string;
  taskId?: string;
  activityInstanceId?: string;
  name: string;
  type: HistoricVariableType;
  value: any;
  textValue?: string;
  textValue2?: string;
  longValue?: number;
  doubleValue?: number;
  byteValue?: Buffer;
  scopeId?: string;
  scopeType?: string;
  tenantId?: string;
}

/**
 * 更新历史变量DTO
 */
export interface UpdateHistoricVariableDto {
  value?: any;
  textValue?: string;
  textValue2?: string;
  longValue?: number;
  doubleValue?: number;
  byteValue?: Buffer;
}

/**
 * 历史变量统计DTO
 */
export interface HistoricVariableStatisticsDto {
  totalCount: number;
  byType: Record<HistoricVariableType, number>;
  byProcessInstance: { processInstanceId: string; count: number }[];
  averageVariablesPerProcess: number;
}

/**
 * 历史变量实例服务
 * 提供历史变量的CRUD操作和查询功能
 */
@Injectable()
export class HistoricVariableInstanceService {
  private readonly logger = new Logger(HistoricVariableInstanceService.name);

  constructor(
    @InjectRepository(HistoricVariableInstanceEntity)
    private readonly variableRepository: Repository<HistoricVariableInstanceEntity>,
  ) {}

  /**
   * 创建历史变量实例
   */
  async create(dto: CreateHistoricVariableDto): Promise<HistoricVariableInstanceEntity> {
    this.logger.debug(`Creating historic variable: ${dto.name}`);

    const variable = this.variableRepository.create({
      id_: uuidv4().replace(/-/g, ''),
      proc_inst_id_: dto.processInstanceId || null,
      execution_id_: dto.executionId || null,
      task_id_: dto.taskId || null,
      act_inst_id_: dto.activityInstanceId || null,
      name_: dto.name,
      var_type_: dto.type,
      text_: dto.textValue || null,
      text2_: dto.textValue2 || null,
      long_: dto.longValue || null,
      double_: dto.doubleValue || null,
      bytes_: dto.byteValue || null,
      scope_id_: dto.scopeId || null,
      scope_type_: dto.scopeType || null,
      tenant_id_: dto.tenantId || null,
      create_time_: new Date(),
      last_updated_time_: new Date(),
      state_: 'CREATED',
    });

    return await this.variableRepository.save(variable);
  }

  /**
   * 根据ID查找历史变量
   */
  async findById(id: string): Promise<HistoricVariableInstanceEntity | null> {
    return await this.variableRepository.findOne({
      where: { id_: id },
    });
  }

  /**
   * 根据ID查找历史变量（不存在则抛出异常）
   */
  async findByIdOrFail(id: string): Promise<HistoricVariableInstanceEntity> {
    const variable = await this.findById(id);
    if (!variable) {
      throw new NotFoundException(`Historic variable with id ${id} not found`);
    }
    return variable;
  }

  /**
   * 更新历史变量
   */
  async update(id: string, dto: UpdateHistoricVariableDto): Promise<HistoricVariableInstanceEntity> {
    const variable = await this.findByIdOrFail(id);

    if (dto.value !== undefined) {
      this.setVariableValue(variable, dto.value);
    }
    if (dto.textValue !== undefined) {
      variable.text_ = dto.textValue;
    }
    if (dto.textValue2 !== undefined) {
      variable.text2_ = dto.textValue2;
    }
    if (dto.longValue !== undefined) {
      variable.long_ = dto.longValue;
    }
    if (dto.doubleValue !== undefined) {
      variable.double_ = dto.doubleValue;
    }
    if (dto.byteValue !== undefined) {
      variable.bytes_ = dto.byteValue;
    }

    variable.last_updated_time_ = new Date();

    return await this.variableRepository.save(variable);
  }

  /**
   * 删除历史变量（软删除）
   */
  async delete(id: string): Promise<void> {
    const variable = await this.findByIdOrFail(id);
    variable.state_ = 'DELETED';
    variable.delete_time_ = new Date();
    await this.variableRepository.save(variable);
  }

  /**
   * 物理删除历史变量
   */
  async hardDelete(id: string): Promise<void> {
    await this.variableRepository.delete({ id_: id });
  }

  /**
   * 查询历史变量列表
   */
  async query(dto: QueryHistoricVariableDto): Promise<[HistoricVariableInstanceEntity[], number]> {
    const queryBuilder = this.createQueryBuilder();

    this.applyQueryFilters(queryBuilder, dto);

    // 排序
    const orderBy = dto.orderBy || 'createTime';
    const orderDirection = dto.orderDirection || 'DESC';
    const orderColumn = orderBy === 'name' ? 'variable.name_' :
                        orderBy === 'lastUpdatedTime' ? 'variable.last_updated_time_' :
                        'variable.create_time_';
    queryBuilder.orderBy(orderColumn, orderDirection);

    // 分页
    const page = dto.page || 1;
    const size = dto.size || 20;
    queryBuilder.skip((page - 1) * size).take(size);

    return await queryBuilder.getManyAndCount();
  }

  /**
   * 根据流程实例ID查询变量
   */
  async findByProcessInstanceId(
    processInstanceId: string,
    includeDeleted = false,
  ): Promise<HistoricVariableInstanceEntity[]> {
    const queryBuilder = this.createQueryBuilder()
      .where('variable.proc_inst_id_ = :processInstanceId', { processInstanceId });

    if (!includeDeleted) {
      queryBuilder.andWhere('variable.state_ != :deletedState', { deletedState: 'DELETED' });
    }

    return await queryBuilder.getMany();
  }

  /**
   * 根据执行ID查询变量
   */
  async findByExecutionId(
    executionId: string,
    includeDeleted = false,
  ): Promise<HistoricVariableInstanceEntity[]> {
    const queryBuilder = this.createQueryBuilder()
      .where('variable.execution_id_ = :executionId', { executionId });

    if (!includeDeleted) {
      queryBuilder.andWhere('variable.state_ != :deletedState', { deletedState: 'DELETED' });
    }

    return await queryBuilder.getMany();
  }

  /**
   * 根据任务ID查询变量
   */
  async findByTaskId(
    taskId: string,
    includeDeleted = false,
  ): Promise<HistoricVariableInstanceEntity[]> {
    const queryBuilder = this.createQueryBuilder()
      .where('variable.task_id_ = :taskId', { taskId });

    if (!includeDeleted) {
      queryBuilder.andWhere('variable.state_ != :deletedState', { deletedState: 'DELETED' });
    }

    return await queryBuilder.getMany();
  }

  /**
   * 根据名称查询变量
   */
  async findByName(
    name: string,
    processInstanceId?: string,
  ): Promise<HistoricVariableInstanceEntity | null> {
    const queryBuilder = this.createQueryBuilder()
      .where('variable.name_ = :name', { name })
      .andWhere('variable.state_ != :deletedState', { deletedState: 'DELETED' });

    if (processInstanceId) {
      queryBuilder.andWhere('variable.proc_inst_id_ = :processInstanceId', { processInstanceId });
    }

    return await queryBuilder.getOne();
  }

  /**
   * 批量创建历史变量
   */
  async createBatch(dtos: CreateHistoricVariableDto[]): Promise<HistoricVariableInstanceEntity[]> {
    const variables = dtos.map(dto => {
      return this.variableRepository.create({
        id_: uuidv4().replace(/-/g, ''),
        proc_inst_id_: dto.processInstanceId || null,
        execution_id_: dto.executionId || null,
        task_id_: dto.taskId || null,
        act_inst_id_: dto.activityInstanceId || null,
        name_: dto.name,
        var_type_: dto.type,
        text_: dto.textValue || null,
        text2_: dto.textValue2 || null,
        long_: dto.longValue || null,
        double_: dto.doubleValue || null,
        bytes_: dto.byteValue || null,
        scope_id_: dto.scopeId || null,
        scope_type_: dto.scopeType || null,
        tenant_id_: dto.tenantId || null,
        create_time_: new Date(),
        last_updated_time_: new Date(),
        state_: 'CREATED',
      });
    });

    return await this.variableRepository.save(variables);
  }

  /**
   * 批量删除历史变量
   */
  async deleteBatch(ids: string[]): Promise<void> {
    await this.variableRepository.update(
      { id_: In(ids) },
      { state_: 'DELETED', delete_time_: new Date() },
    );
  }

  /**
   * 根据流程实例ID删除所有变量
   */
  async deleteByProcessInstanceId(processInstanceId: string): Promise<void> {
    await this.variableRepository.update(
      { proc_inst_id_: processInstanceId },
      { state_: 'DELETED', delete_time_: new Date() },
    );
  }

  /**
   * 获取变量统计信息
   */
  async getStatistics(processInstanceId?: string): Promise<HistoricVariableStatisticsDto> {
    const queryBuilder = this.createQueryBuilder()
      .where('variable.state_ != :deletedState', { deletedState: 'DELETED' });

    if (processInstanceId) {
      queryBuilder.andWhere('variable.proc_inst_id_ = :processInstanceId', { processInstanceId });
    }

    const variables = await queryBuilder.getMany();

    // 按类型统计
    const byType: Record<HistoricVariableType, number> = {
      [HistoricVariableType.STRING]: 0,
      [HistoricVariableType.INTEGER]: 0,
      [HistoricVariableType.LONG]: 0,
      [HistoricVariableType.DOUBLE]: 0,
      [HistoricVariableType.BOOLEAN]: 0,
      [HistoricVariableType.DATE]: 0,
      [HistoricVariableType.JSON]: 0,
      [HistoricVariableType.BINARY]: 0,
      [HistoricVariableType.SERIALIZABLE]: 0,
    };

    variables.forEach(v => {
      byType[v.var_type_]++;
    });

    // 按流程实例统计
    const processInstanceCounts: Record<string, number> = {};
    variables.forEach(v => {
      if (v.proc_inst_id_) {
        processInstanceCounts[v.proc_inst_id_] = (processInstanceCounts[v.proc_inst_id_] || 0) + 1;
      }
    });

    const byProcessInstance = Object.entries(processInstanceCounts)
      .map(([processInstanceId, count]) => ({ processInstanceId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 计算平均值
    const uniqueProcessInstances = new Set(variables.map(v => v.proc_inst_id_).filter(Boolean));
    const averageVariablesPerProcess = uniqueProcessInstances.size > 0
      ? variables.length / uniqueProcessInstances.size
      : 0;

    return {
      totalCount: variables.length,
      byType,
      byProcessInstance,
      averageVariablesPerProcess,
    };
  }

  /**
   * 获取变量值（根据类型解析）
   */
  getValue(variable: HistoricVariableInstanceEntity): any {
    switch (variable.var_type_) {
      case HistoricVariableType.STRING:
        return variable.text_;
      case HistoricVariableType.INTEGER:
      case HistoricVariableType.LONG:
        return variable.long_;
      case HistoricVariableType.DOUBLE:
        return variable.double_;
      case HistoricVariableType.BOOLEAN:
        return variable.text_ === 'true';
      case HistoricVariableType.DATE:
        return variable.text_ ? new Date(variable.text_) : null;
      case HistoricVariableType.JSON:
        return variable.text_ ? JSON.parse(variable.text_) : null;
      case HistoricVariableType.BINARY:
      case HistoricVariableType.SERIALIZABLE:
        return variable.bytes_;
      default:
        return variable.text_;
    }
  }

  /**
   * 创建查询构建器
   */
  private createQueryBuilder(): SelectQueryBuilder<HistoricVariableInstanceEntity> {
    return this.variableRepository.createQueryBuilder('variable');
  }

  /**
   * 应用查询过滤条件
   */
  private applyQueryFilters(
    queryBuilder: SelectQueryBuilder<HistoricVariableInstanceEntity>,
    dto: QueryHistoricVariableDto,
  ): void {
    if (dto.processInstanceId) {
      queryBuilder.andWhere('variable.proc_inst_id_ = :processInstanceId', {
        processInstanceId: dto.processInstanceId,
      });
    }

    if (dto.executionId) {
      queryBuilder.andWhere('variable.execution_id_ = :executionId', {
        executionId: dto.executionId,
      });
    }

    if (dto.taskId) {
      queryBuilder.andWhere('variable.task_id_ = :taskId', {
        taskId: dto.taskId,
      });
    }

    if (dto.activityInstanceId) {
      queryBuilder.andWhere('variable.act_inst_id_ = :activityInstanceId', {
        activityInstanceId: dto.activityInstanceId,
      });
    }

    if (dto.name) {
      queryBuilder.andWhere('variable.name_ = :name', { name: dto.name });
    }

    if (dto.nameLike) {
      queryBuilder.andWhere('variable.name_ LIKE :nameLike', {
        nameLike: `%${dto.nameLike}%`,
      });
    }

    if (dto.type) {
      queryBuilder.andWhere('variable.var_type_ = :type', { type: dto.type });
    }

    if (dto.tenantId) {
      queryBuilder.andWhere('variable.tenant_id_ = :tenantId', {
        tenantId: dto.tenantId,
      });
    }

    if (dto.createTimeBefore) {
      queryBuilder.andWhere('variable.create_time_ < :createTimeBefore', {
        createTimeBefore: dto.createTimeBefore,
      });
    }

    if (dto.createTimeAfter) {
      queryBuilder.andWhere('variable.create_time_ > :createTimeAfter', {
        createTimeAfter: dto.createTimeAfter,
      });
    }

    if (!dto.includeDeleted) {
      queryBuilder.andWhere('variable.state_ != :deletedState', {
        deletedState: 'DELETED',
      });
    }
  }

  /**
   * 设置变量值（根据类型）
   */
  private setVariableValue(variable: HistoricVariableInstanceEntity, value: any): void {
    switch (variable.var_type_) {
      case HistoricVariableType.STRING:
        variable.text_ = String(value);
        break;
      case HistoricVariableType.INTEGER:
      case HistoricVariableType.LONG:
        variable.long_ = Number(value);
        break;
      case HistoricVariableType.DOUBLE:
        variable.double_ = Number(value);
        break;
      case HistoricVariableType.BOOLEAN:
        variable.text_ = value ? 'true' : 'false';
        break;
      case HistoricVariableType.DATE:
        variable.text_ = value instanceof Date ? value.toISOString() : String(value);
        break;
      case HistoricVariableType.JSON:
        variable.text_ = JSON.stringify(value);
        break;
      case HistoricVariableType.BINARY:
      case HistoricVariableType.SERIALIZABLE:
        variable.bytes_ = value;
        break;
      default:
        variable.text_ = String(value);
    }
  }
}
