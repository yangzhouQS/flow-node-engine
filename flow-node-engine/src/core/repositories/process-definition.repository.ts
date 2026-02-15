/**
 * 流程定义仓储接口
 */

import { Injectable } from '@nestjs/common';
import { IBpmnProcessDefinition } from '../interfaces/bpmn-process.interface';

/**
 * 流程定义查询参数
 */
export interface ProcessDefinitionQueryParams {
  /** 流程定义Key */
  processDefinitionKey?: string;
  /** 流程定义名称 */
  name?: string;
  /** 租户ID */
  tenantId?: string;
  /** 版本 */
  version?: number;
  /** 最新版本 */
  latestVersion?: boolean;
  /** 挂起状态 */
  suspensionState?: 'ACTIVE' | 'SUSPENDED';
  /** 分页 */
  page?: number;
  /** 每页数量 */
  size?: number;
}

/**
 * 流程定义仓储接口
 */
export interface IProcessDefinitionRepository {
  /**
   * 根据ID查找流程定义
   */
  findById(id: string): Promise<IBpmnProcessDefinition | null>;

  /**
   * 根据Key查找流程定义
   */
  findByKey(key: string, tenantId?: string): Promise<IBpmnProcessDefinition | null>;

  /**
   * 根据Key查找最新版本的流程定义
   */
  findLatestByKey(key: string, tenantId?: string): Promise<IBpmnProcessDefinition | null>;

  /**
   * 查询流程定义列表
   */
  findAll(params: ProcessDefinitionQueryParams): Promise<IBpmnProcessDefinition[]>;

  /**
   * 统计流程定义数量
   */
  count(params: ProcessDefinitionQueryParams): Promise<number>;

  /**
   * 创建流程定义
   */
  create(data: Partial<IBpmnProcessDefinition>): Promise<IBpmnProcessDefinition>;

  /**
   * 更新流程定义
   */
  update(id: string, data: Partial<IBpmnProcessDefinition>): Promise<IBpmnProcessDefinition>;

  /**
   * 删除流程定义
   */
  delete(id: string): Promise<boolean>;

  /**
   * 挂起流程定义
   */
  suspend(id: string): Promise<boolean>;

  /**
   * 激活流程定义
   */
  activate(id: string): Promise<boolean>;
}

/**
 * 流程定义仓储实现（占位符）
 */
@Injectable()
export class ProcessDefinitionRepository implements IProcessDefinitionRepository {
  async findById(id: string): Promise<IBpmnProcessDefinition | null> {
    return null;
  }

  async findByKey(key: string, tenantId?: string): Promise<IBpmnProcessDefinition | null> {
    return null;
  }

  async findLatestByKey(key: string, tenantId?: string): Promise<IBpmnProcessDefinition | null> {
    return null;
  }

  async findAll(params: ProcessDefinitionQueryParams): Promise<IBpmnProcessDefinition[]> {
    return [];
  }

  async count(params: ProcessDefinitionQueryParams): Promise<number> {
    return 0;
  }

  async create(data: Partial<IBpmnProcessDefinition>): Promise<IBpmnProcessDefinition> {
    throw new Error('Method not implemented.');
  }

  async update(id: string, data: Partial<IBpmnProcessDefinition>): Promise<IBpmnProcessDefinition> {
    throw new Error('Method not implemented.');
  }

  async delete(id: string): Promise<boolean> {
    return false;
  }

  async suspend(id: string): Promise<boolean> {
    return false;
  }

  async activate(id: string): Promise<boolean> {
    return false;
  }
}
