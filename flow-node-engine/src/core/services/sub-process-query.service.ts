import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Entity, Column, PrimaryColumn, CreateDateColumn, Index, } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * 子流程实例实体
 */
@Entity('act_ru_sub_process_instance')
export class SubProcessInstanceEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

  /**
   * 父流程实例ID
   */
  @Column({ length: 64 })
  @Index()
  parent_proc_inst_id_: string;

  /**
   * 父执行ID
   */
  @Column({ length: 64, nullable: true })
  parent_execution_id_: string;

  /**
   * 子流程实例ID
   */
  @Column({ length: 64 })
  @Index()
  sub_proc_inst_id_: string;

  /**
   * 子流程定义Key
   */
  @Column({ length: 255, nullable: true })
  sub_process_def_key_: string;

  /**
   * 调用活动ID
   */
  @Column({ length: 255, nullable: true })
  call_activity_id_: string;

  /**
   * 子流程类型
   */
  @Column({ length: 30 })
  sub_process_type_: 'embedded' | 'event' | 'call_activity' | 'transaction' | 'ad_hoc';

  /**
   * 状态
   */
  @Column({ length: 30, default: 'active' })
  status_: 'active' | 'completed' | 'canceled';

  /**
   * 开始时间
   */
  @CreateDateColumn()
  start_time_: Date;

  /**
   * 结束时间
   */
  @Column({ type: 'datetime', nullable: true })
  end_time_: Date;

  /**
   * 业务Key
   */
  @Column({ length: 255, nullable: true })
  business_key_: string;

  /**
   * 租户ID
   */
  @Column({ length: 64, nullable: true })
  tenant_id_: string;

  /**
   * 名称
   */
  @Column({ length: 255, nullable: true })
  name_: string;
}

/**
 * 子流程查询参数
 */
export interface SubProcessQueryParams {
  /** 父流程实例ID */
  parentProcessInstanceId?: string;
  /** 子流程实例ID */
  subProcessInstanceId?: string;
  /** 子流程定义Key */
  subProcessDefinitionKey?: string;
  /** 调用活动ID */
  callActivityId?: string;
  /** 子流程类型 */
  subProcessType?: 'embedded' | 'event' | 'call_activity' | 'transaction' | 'ad_hoc';
  /** 状态 */
  status?: 'active' | 'completed' | 'canceled';
  /** 业务Key */
  businessKey?: string;
  /** 租户ID */
  tenantId?: string;
  /** 开始时间（起） */
  startTimeAfter?: Date;
  /** 开始时间（止） */
  startTimeBefore?: Date;
  /** 结束时间（起） */
  endTimeAfter?: Date;
  /** 结束时间（止） */
  endTimeBefore?: Date;
  /** 名称（模糊匹配） */
  nameLike?: string;
}

/**
 * 子流程实例信息
 */
export interface SubProcessInstanceInfo {
  id: string;
  parentProcessInstanceId: string;
  parentExecutionId?: string;
  subProcessInstanceId: string;
  subProcessDefinitionKey?: string;
  callActivityId?: string;
  subProcessType: 'embedded' | 'event' | 'call_activity' | 'transaction' | 'ad_hoc';
  status: 'active' | 'completed' | 'canceled';
  startTime: Date;
  endTime?: Date;
  businessKey?: string;
  tenantId?: string;
  name?: string;
  duration?: number;
}

/**
 * 子流程统计信息
 */
export interface SubProcessStatistics {
  /** 总数 */
  total: number;
  /** 活跃数 */
  active: number;
  /** 已完成数 */
  completed: number;
  /** 已取消数 */
  canceled: number;
  /** 按类型统计 */
  byType: Record<string, number>;
  /** 平均持续时间（毫秒） */
  averageDuration?: number;
}

/**
 * 子流程查询服务
 * 提供子流程实例的查询和统计功能
 */
@Injectable()
export class SubProcessQueryService {
  private readonly logger = new Logger(SubProcessQueryService.name);

  constructor(
    @InjectRepository(SubProcessInstanceEntity)
    private readonly subProcessRepository: Repository<SubProcessInstanceEntity>,
  ) {}

  /**
   * 创建子流程实例记录
   */
  async createSubProcessInstance(params: {
    parentProcessInstanceId: string;
    parentExecutionId?: string;
    subProcessInstanceId: string;
    subProcessDefinitionKey?: string;
    callActivityId?: string;
    subProcessType: 'embedded' | 'event' | 'call_activity' | 'transaction' | 'ad_hoc';
    businessKey?: string;
    tenantId?: string;
    name?: string;
  }): Promise<SubProcessInstanceEntity> {
    const entity = this.subProcessRepository.create({
      id_: uuidv4(),
      parent_proc_inst_id_: params.parentProcessInstanceId,
      parent_execution_id_: params.parentExecutionId,
      sub_proc_inst_id_: params.subProcessInstanceId,
      sub_process_def_key_: params.subProcessDefinitionKey,
      call_activity_id_: params.callActivityId,
      sub_process_type_: params.subProcessType,
      status_: 'active',
      business_key_: params.businessKey,
      tenant_id_: params.tenantId,
      name_: params.name,
      start_time_: new Date(),
    });

    await this.subProcessRepository.save(entity);

    this.logger.debug(
      `Created sub-process instance record: ${entity.id_}`,
    );

    return entity;
  }

  /**
   * 完成子流程实例
   */
  async completeSubProcessInstance(subProcessInstanceId: string): Promise<void> {
    await this.subProcessRepository.update(
      { sub_proc_inst_id_: subProcessInstanceId },
      {
        status_: 'completed',
        end_time_: new Date(),
      },
    );

    this.logger.debug(
      `Completed sub-process instance: ${subProcessInstanceId}`,
    );
  }

  /**
   * 取消子流程实例
   */
  async cancelSubProcessInstance(subProcessInstanceId: string): Promise<void> {
    await this.subProcessRepository.update(
      { sub_proc_inst_id_: subProcessInstanceId },
      {
        status_: 'canceled',
        end_time_: new Date(),
      },
    );

    this.logger.debug(
      `Canceled sub-process instance: ${subProcessInstanceId}`,
    );
  }

  /**
   * 查询子流程实例
   */
  async querySubProcessInstances(
    params: SubProcessQueryParams,
  ): Promise<SubProcessInstanceInfo[]> {
    const queryBuilder = this.subProcessRepository.createQueryBuilder('sp');

    // 构建查询条件
    if (params.parentProcessInstanceId) {
      queryBuilder.andWhere('sp.parent_proc_inst_id_ = :parentProcessInstanceId', {
        parentProcessInstanceId: params.parentProcessInstanceId,
      });
    }

    if (params.subProcessInstanceId) {
      queryBuilder.andWhere('sp.sub_proc_inst_id_ = :subProcessInstanceId', {
        subProcessInstanceId: params.subProcessInstanceId,
      });
    }

    if (params.subProcessDefinitionKey) {
      queryBuilder.andWhere('sp.sub_process_def_key_ = :subProcessDefinitionKey', {
        subProcessDefinitionKey: params.subProcessDefinitionKey,
      });
    }

    if (params.callActivityId) {
      queryBuilder.andWhere('sp.call_activity_id_ = :callActivityId', {
        callActivityId: params.callActivityId,
      });
    }

    if (params.subProcessType) {
      queryBuilder.andWhere('sp.sub_process_type_ = :subProcessType', {
        subProcessType: params.subProcessType,
      });
    }

    if (params.status) {
      queryBuilder.andWhere('sp.status_ = :status', { status: params.status });
    }

    if (params.businessKey) {
      queryBuilder.andWhere('sp.business_key_ = :businessKey', {
        businessKey: params.businessKey,
      });
    }

    if (params.tenantId) {
      queryBuilder.andWhere('sp.tenant_id_ = :tenantId', {
        tenantId: params.tenantId,
      });
    }

    if (params.startTimeAfter) {
      queryBuilder.andWhere('sp.start_time_ >= :startTimeAfter', {
        startTimeAfter: params.startTimeAfter,
      });
    }

    if (params.startTimeBefore) {
      queryBuilder.andWhere('sp.start_time_ <= :startTimeBefore', {
        startTimeBefore: params.startTimeBefore,
      });
    }

    if (params.endTimeAfter) {
      queryBuilder.andWhere('sp.end_time_ >= :endTimeAfter', {
        endTimeAfter: params.endTimeAfter,
      });
    }

    if (params.endTimeBefore) {
      queryBuilder.andWhere('sp.end_time_ <= :endTimeBefore', {
        endTimeBefore: params.endTimeBefore,
      });
    }

    if (params.nameLike) {
      queryBuilder.andWhere('sp.name_ LIKE :nameLike', {
        nameLike: `%${params.nameLike}%`,
      });
    }

    // 排序
    queryBuilder.orderBy('sp.start_time_', 'DESC');

    const entities = await queryBuilder.getMany();
    return entities.map((entity) => this.toInfo(entity));
  }

  /**
   * 获取单个子流程实例
   */
  async getSubProcessInstance(id: string): Promise<SubProcessInstanceInfo | null> {
    const entity = await this.subProcessRepository.findOne({
      where: { id_: id },
    });

    return entity ? this.toInfo(entity) : null;
  }

  /**
   * 根据子流程实例ID获取
   */
  async getBySubProcessInstanceId(
    subProcessInstanceId: string,
  ): Promise<SubProcessInstanceInfo | null> {
    const entity = await this.subProcessRepository.findOne({
      where: { sub_proc_inst_id_: subProcessInstanceId },
    });

    return entity ? this.toInfo(entity) : null;
  }

  /**
   * 获取父流程的所有子流程实例
   */
  async getSubProcessInstancesByParent(
    parentProcessInstanceId: string,
  ): Promise<SubProcessInstanceInfo[]> {
    const entities = await this.subProcessRepository.find({
      where: { parent_proc_inst_id_: parentProcessInstanceId },
      order: { start_time_: 'DESC' },
    });

    return entities.map((entity) => this.toInfo(entity));
  }

  /**
   * 获取活跃的子流程实例
   */
  async getActiveSubProcessInstances(
    parentProcessInstanceId?: string,
  ): Promise<SubProcessInstanceInfo[]> {
    const where: any = { status_: 'active' };
    if (parentProcessInstanceId) {
      where.parent_proc_inst_id_ = parentProcessInstanceId;
    }

    const entities = await this.subProcessRepository.find({
      where,
      order: { start_time_: 'DESC' },
    });

    return entities.map((entity) => this.toInfo(entity));
  }

  /**
   * 获取子流程统计信息
   */
  async getStatistics(params?: {
    parentProcessInstanceId?: string;
    tenantId?: string;
    startTimeAfter?: Date;
    startTimeBefore?: Date;
  }): Promise<SubProcessStatistics> {
    const queryBuilder = this.subProcessRepository.createQueryBuilder('sp');

    // 构建查询条件
    if (params?.parentProcessInstanceId) {
      queryBuilder.andWhere('sp.parent_proc_inst_id_ = :parentProcessInstanceId', {
        parentProcessInstanceId: params.parentProcessInstanceId,
      });
    }

    if (params?.tenantId) {
      queryBuilder.andWhere('sp.tenant_id_ = :tenantId', {
        tenantId: params.tenantId,
      });
    }

    if (params?.startTimeAfter) {
      queryBuilder.andWhere('sp.start_time_ >= :startTimeAfter', {
        startTimeAfter: params.startTimeAfter,
      });
    }

    if (params?.startTimeBefore) {
      queryBuilder.andWhere('sp.start_time_ <= :startTimeBefore', {
        startTimeBefore: params.startTimeBefore,
      });
    }

    // 获取所有符合条件的记录
    const entities = await queryBuilder.getMany();

    // 计算统计数据
    const stats: SubProcessStatistics = {
      total: entities.length,
      active: entities.filter((e) => e.status_ === 'active').length,
      completed: entities.filter((e) => e.status_ === 'completed').length,
      canceled: entities.filter((e) => e.status_ === 'canceled').length,
      byType: {},
    };

    // 按类型统计
    for (const entity of entities) {
      const type = entity.sub_process_type_;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    // 计算平均持续时间（仅针对已完成的）
    const completedEntities = entities.filter(
      (e) => e.status_ === 'completed' && e.end_time_,
    );
    if (completedEntities.length > 0) {
      const totalDuration = completedEntities.reduce((sum, e) => {
        return sum + (e.end_time_!.getTime() - e.start_time_.getTime());
      }, 0);
      stats.averageDuration = Math.round(totalDuration / completedEntities.length);
    }

    return stats;
  }

  /**
   * 检查父流程是否有活跃的子流程
   */
  async hasActiveSubProcessInstances(
    parentProcessInstanceId: string,
  ): Promise<boolean> {
    const count = await this.subProcessRepository.count({
      where: {
        parent_proc_inst_id_: parentProcessInstanceId,
        status_: 'active',
      },
    });

    return count > 0;
  }

  /**
   * 获取子流程层级深度
   */
  async getSubProcessDepth(subProcessInstanceId: string): Promise<number> {
    let depth = 0;
    let currentInstance = await this.getBySubProcessInstanceId(subProcessInstanceId);

    while (currentInstance?.parentProcessInstanceId) {
      depth++;
      currentInstance = await this.getBySubProcessInstanceId(
        currentInstance.parentProcessInstanceId,
      );
    }

    return depth;
  }

  /**
   * 获取子流程树
   */
  async getSubProcessTree(
    processInstanceId: string,
  ): Promise<SubProcessInstanceInfo[]> {
    const result: SubProcessInstanceInfo[] = [];

    // 获取直接子流程
    const children = await this.getSubProcessInstancesByParent(processInstanceId);

    for (const child of children) {
      result.push(child);

      // 递归获取子流程的子流程
      const grandChildren = await this.getSubProcessTree(child.subProcessInstanceId);
      result.push(...grandChildren);
    }

    return result;
  }

  /**
   * 删除子流程实例记录（用于清理历史数据）
   */
  async deleteSubProcessInstance(id: string): Promise<void> {
    await this.subProcessRepository.delete({ id_: id });
    this.logger.debug(`Deleted sub-process instance record: ${id}`);
  }

  /**
   * 批量删除子流程实例记录
   */
  async deleteSubProcessInstances(ids: string[]): Promise<void> {
    await this.subProcessRepository.delete({ id_: In(ids) });
    this.logger.debug(`Deleted ${ids.length} sub-process instance records`);
  }

  /**
   * 实体转信息对象
   */
  private toInfo(entity: SubProcessInstanceEntity): SubProcessInstanceInfo {
    return {
      id: entity.id_,
      parentProcessInstanceId: entity.parent_proc_inst_id_,
      parentExecutionId: entity.parent_execution_id_,
      subProcessInstanceId: entity.sub_proc_inst_id_,
      subProcessDefinitionKey: entity.sub_process_def_key_,
      callActivityId: entity.call_activity_id_,
      subProcessType: entity.sub_process_type_,
      status: entity.status_,
      startTime: entity.start_time_,
      endTime: entity.end_time_,
      businessKey: entity.business_key_,
      tenantId: entity.tenant_id_,
      name: entity.name_,
      duration: entity.end_time_
        ? entity.end_time_.getTime() - entity.start_time_.getTime()
        : undefined,
    };
  }
}
