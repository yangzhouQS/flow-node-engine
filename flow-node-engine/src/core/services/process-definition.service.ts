/**
 * 流程定义服务
 */

import { Injectable } from '@nestjs/common';
import { 
  ProcessDefinitionRepository,
  ProcessDefinitionQueryParams
} from '../repositories/process-definition.repository';
import { IBpmnProcessDefinition } from '../interfaces/bpmn-process.interface';

/**
 * 流程定义服务接口
 */
export interface IProcessDefinitionService {
  /**
   * 根据ID获取流程定义
   */
  getById(id: string): Promise<IBpmnProcessDefinition | null>;

  /**
   * 根据Key获取流程定义
   */
  getByKey(key: string, tenantId?: string): Promise<IBpmnProcessDefinition | null>;

  /**
   * 获取最新版本的流程定义
   */
  getLatestByKey(key: string, tenantId?: string): Promise<IBpmnProcessDefinition | null>;

  /**
   * 查询流程定义列表
   */
  findAll(params: ProcessDefinitionQueryParams): Promise<IBpmnProcessDefinition[]>;

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
 * 流程定义服务实现
 */
@Injectable()
export class ProcessDefinitionService implements IProcessDefinitionService {
  constructor(
    private readonly processDefinitionRepository: ProcessDefinitionRepository
  ) {}

  async getById(id: string): Promise<IBpmnProcessDefinition | null> {
    return this.processDefinitionRepository.findById(id);
  }

  async getByKey(key: string, tenantId?: string): Promise<IBpmnProcessDefinition | null> {
    return this.processDefinitionRepository.findByKey(key, tenantId);
  }

  async getLatestByKey(key: string, tenantId?: string): Promise<IBpmnProcessDefinition | null> {
    return this.processDefinitionRepository.findLatestByKey(key, tenantId);
  }

  async findAll(params: ProcessDefinitionQueryParams): Promise<IBpmnProcessDefinition[]> {
    return this.processDefinitionRepository.findAll(params);
  }

  async suspend(id: string): Promise<boolean> {
    return this.processDefinitionRepository.suspend(id);
  }

  async activate(id: string): Promise<boolean> {
    return this.processDefinitionRepository.activate(id);
  }
}
