import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource , Entity, Column, PrimaryColumn, CreateDateColumn, Index, } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * 变量作用域类型
 */
export enum VariableScope {
  /** 流程实例级别 */
  PROCESS_INSTANCE = 'process_instance',
  /** 执行级别 */
  EXECUTION = 'execution',
  /** 子流程级别 */
  SUBPROCESS = 'subprocess',
  /** 任务级别 */
  TASK = 'task',
  /** 本地级别 */
  LOCAL = 'local',
}

/**
 * 变量作用域实体
 * 用于管理流程变量的作用域层次
 */
@Entity('act_ru_variable_scope')
export class VariableScopeEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

  /**
   * 流程实例ID
   */
  @Column({ length: 64 })
  @Index()
  proc_inst_id_: string;

  /**
   * 父作用域ID
   */
  @Column({ length: 64, nullable: true })
  parent_scope_id_: string;

  /**
   * 作用域类型
   */
  @Column({ length: 30 })
  scope_type_: string;

  /**
   * BPMN元素ID
   */
  @Column({ length: 255, nullable: true })
  @Index()
  element_id_: string;

  /**
   * 作用域名称
   */
  @Column({ length: 255, nullable: true })
  name_: string;

  /**
   * 是否激活
   */
  @Column({ type: 'boolean', default: true })
  is_active_: boolean;

  /**
   * 创建时间
   */
  @CreateDateColumn()
  create_time_: Date;

  /**
   * 租户ID
   */
  @Column({ length: 64, nullable: true })
  tenant_id_: string;
}

/**
 * 变量实体
 */
@Entity('act_ru_variable')
export class VariableEntity {
  @PrimaryColumn({ length: 64 })
  id_: string;

  /**
   * 作用域ID
   */
  @Column({ length: 64 })
  @Index()
  scope_id_: string;

  /**
   * 变量名
   */
  @Column({ length: 255 })
  @Index()
  name_: string;

  /**
   * 变量类型
   */
  @Column({ length: 100, nullable: true })
  type_: string;

  /**
   * 变量值（JSON格式）
   */
  @Column({ type: 'longtext', nullable: true })
  value_: string;

  /**
   * 流程实例ID
   */
  @Column({ length: 64 })
  @Index()
  proc_inst_id_: string;

  /**
   * 创建时间
   */
  @CreateDateColumn()
  create_time_: Date;

  /**
   * 更新时间
   */
  @Column({ type: 'datetime', nullable: true })
  update_time_: Date;
}

/**
 * 创建作用域参数
 */
export interface CreateScopeParams {
  processInstanceId: string;
  parentScopeId?: string;
  scopeType: VariableScope | string;
  elementId?: string;
  name?: string;
  tenantId?: string;
}

/**
 * 变量作用域管理服务
 * 管理流程变量的作用域层次，支持变量继承和隔离
 */
@Injectable()
export class VariableScopeService {
  private readonly logger = new Logger(VariableScopeService.name);

  constructor(
    @InjectRepository(VariableScopeEntity)
    private readonly scopeRepository: Repository<VariableScopeEntity>,
    @InjectRepository(VariableEntity)
    private readonly variableRepository: Repository<VariableEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建作用域
   */
  async createScope(params: CreateScopeParams): Promise<string> {
    const scope = this.scopeRepository.create({
      id_: uuidv4(),
      proc_inst_id_: params.processInstanceId,
      parent_scope_id_: params.parentScopeId,
      scope_type_: params.scopeType,
      element_id_: params.elementId,
      name_: params.name,
      is_active_: true,
      tenant_id_: params.tenantId,
      create_time_: new Date(),
    });

    await this.scopeRepository.save(scope);

    this.logger.debug(
      `Created scope ${scope.id_} for process ${params.processInstanceId}`,
    );

    return scope.id_;
  }

  /**
   * 获取作用域
   */
  async getScope(scopeId: string): Promise<VariableScopeEntity | null> {
    return this.scopeRepository.findOne({
      where: { id_: scopeId },
    });
  }

  /**
   * 获取父作用域
   */
  async getParentScope(scopeId: string): Promise<VariableScopeEntity | null> {
    const scope = await this.getScope(scopeId);
    if (!scope?.parent_scope_id_) {
      return null;
    }
    return this.getScope(scope.parent_scope_id_);
  }

  /**
   * 获取子作用域列表
   */
  async getChildScopes(scopeId: string): Promise<VariableScopeEntity[]> {
    return this.scopeRepository.find({
      where: { parent_scope_id_: scopeId, is_active_: true },
    });
  }

  /**
   * 设置变量
   */
  async setVariable(
    scopeId: string,
    name: string,
    value: any,
    type?: string,
  ): Promise<void> {
    // 检查变量是否已存在
    let variable = await this.variableRepository.findOne({
      where: { scope_id_: scopeId, name_: name },
    });

    const valueJson = JSON.stringify(value);
    const variableType = type || this.detectType(value);

    if (variable) {
      // 更新现有变量
      variable.value_ = valueJson;
      variable.type_ = variableType;
      variable.update_time_ = new Date();
      await this.variableRepository.save(variable);
    } else {
      // 创建新变量
      const scope = await this.getScope(scopeId);
      variable = this.variableRepository.create({
        id_: uuidv4(),
        scope_id_: scopeId,
        name_: name,
        type_: variableType,
        value_: valueJson,
        proc_inst_id_: scope?.proc_inst_id_ || '',
        create_time_: new Date(),
        update_time_: new Date(),
      });
      await this.variableRepository.save(variable);
    }

    this.logger.debug(`Set variable ${name} in scope ${scopeId}`);
  }

  /**
   * 设置多个变量
   */
  async setVariables(scopeId: string, variables: Record<string, any>): Promise<void> {
    for (const [name, value] of Object.entries(variables)) {
      await this.setVariable(scopeId, name, value);
    }
  }

  /**
   * 获取变量
   */
  async getVariable(scopeId: string, name: string): Promise<any> {
    // 首先在当前作用域查找
    const variable = await this.variableRepository.findOne({
      where: { scope_id_: scopeId, name_: name },
    });

    if (variable) {
      return this.parseValue(variable.value_, variable.type_);
    }

    // 如果当前作用域没有，向父作用域查找
    const parentScope = await this.getParentScope(scopeId);
    if (parentScope) {
      return this.getVariable(parentScope.id_, name);
    }

    return undefined;
  }

  /**
   * 获取所有变量（包括继承的变量）
   */
  async getVariables(scopeId: string): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    // 收集所有祖先作用域
    const scopes = await this.getScopeChain(scopeId);

    // 从根到叶依次收集变量（子作用域覆盖父作用域）
    for (const scope of scopes.reverse()) {
      const variables = await this.getScopeVariables(scope.id_);
      Object.assign(result, variables);
    }

    return result;
  }

  /**
   * 获取当前作用域的变量（不包括继承的）
   */
  async getScopeVariables(scopeId: string): Promise<Record<string, any>> {
    const variables = await this.variableRepository.find({
      where: { scope_id_: scopeId },
    });

    const result: Record<string, any> = {};
    for (const variable of variables) {
      result[variable.name_] = this.parseValue(variable.value_, variable.type_);
    }

    return result;
  }

  /**
   * 删除变量
   */
  async deleteVariable(scopeId: string, name: string): Promise<void> {
    await this.variableRepository.delete({
      scope_id_: scopeId,
      name_: name,
    });

    this.logger.debug(`Deleted variable ${name} from scope ${scopeId}`);
  }

  /**
   * 删除作用域的所有变量
   */
  async deleteScopeVariables(scopeId: string): Promise<void> {
    await this.variableRepository.delete({
      scope_id_: scopeId,
    });

    this.logger.debug(`Deleted all variables from scope ${scopeId}`);
  }

  /**
   * 销毁作用域（包括所有变量和子作用域）
   */
  async destroyScope(scopeId: string): Promise<void> {
    // 递归销毁子作用域
    const childScopes = await this.getChildScopes(scopeId);
    for (const child of childScopes) {
      await this.destroyScope(child.id_);
    }

    // 删除作用域的变量
    await this.deleteScopeVariables(scopeId);

    // 标记作用域为非激活
    await this.scopeRepository.update(scopeId, { is_active_: false });

    this.logger.debug(`Destroyed scope ${scopeId}`);
  }

  /**
   * 获取作用域链（从当前作用域到根作用域）
   */
  private async getScopeChain(scopeId: string): Promise<VariableScopeEntity[]> {
    const chain: VariableScopeEntity[] = [];
    let currentScope = await this.getScope(scopeId);

    while (currentScope) {
      chain.push(currentScope);
      if (currentScope.parent_scope_id_) {
        currentScope = await this.getScope(currentScope.parent_scope_id_);
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * 检测变量类型
   */
  private detectType(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  /**
   * 解析变量值
   */
  private parseValue(valueJson: string | null, type?: string): any {
    if (!valueJson) return null;

    try {
      const parsed = JSON.parse(valueJson);

      // 根据类型转换
      if (type === 'date' && typeof parsed === 'string') {
        return new Date(parsed);
      }

      return parsed;
    } catch {
      return valueJson;
    }
  }

  /**
   * 获取流程实例的根作用域
   */
  async getProcessInstanceScope(processInstanceId: string): Promise<VariableScopeEntity | null> {
    return this.scopeRepository.findOne({
      where: {
        proc_inst_id_: processInstanceId,
        scope_type_: VariableScope.PROCESS_INSTANCE,
        is_active_: true,
      },
    });
  }

  /**
   * 创建流程实例作用域
   */
  async createProcessInstanceScope(
    processInstanceId: string,
    tenantId?: string,
  ): Promise<string> {
    return this.createScope({
      processInstanceId,
      scopeType: VariableScope.PROCESS_INSTANCE,
      name: `Process Instance: ${processInstanceId}`,
      tenantId,
    });
  }

  /**
   * 复制变量到另一个作用域
   */
  async copyVariables(
    sourceScopeId: string,
    targetScopeId: string,
    variableNames?: string[],
  ): Promise<void> {
    const sourceVariables = await this.getScopeVariables(sourceScopeId);

    const variablesToCopy = variableNames
      ? Object.fromEntries(
          Object.entries(sourceVariables).filter(([name]) =>
            variableNames.includes(name),
          ),
        )
      : sourceVariables;

    await this.setVariables(targetScopeId, variablesToCopy);

    this.logger.debug(
      `Copied ${Object.keys(variablesToCopy).length} variables from scope ${sourceScopeId} to ${targetScopeId}`,
    );
  }

  /**
   * 检查变量是否存在
   */
  async hasVariable(scopeId: string, name: string): Promise<boolean> {
    const variable = await this.variableRepository.findOne({
      where: { scope_id_: scopeId, name_: name },
    });
    return !!variable;
  }

  /**
   * 获取变量名列表
   */
  async getVariableNames(scopeId: string): Promise<string[]> {
    const variables = await this.variableRepository.find({
      where: { scope_id_: scopeId },
      select: ['name_'],
    });
    return variables.map((v) => v.name_);
  }
}
