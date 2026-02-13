import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Form } from '../entities/form.entity';

@Injectable()
export class FormService {
  constructor(
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
  ) {}

  /**
   * 创建表单
   */
  async create(
    formKey: string,
    name: string,
    formDefinition: Record<string, any>,
    description?: string,
    version?: number,
    deploymentId?: string,
    tenantId?: string,
    resourceName?: string,
    isSystem?: boolean,
  ): Promise<Form> {
    // 检查表单键是否已存在
    const existingForm = await this.formRepository.findOne({
      where: { formKey, tenantId: tenantId || null },
    });

    if (existingForm) {
      throw new Error(`表单键已存在: ${formKey}`);
    }

    const form = this.formRepository.create({
      formKey,
      name,
      description,
      version: version || 1,
      formDefinition,
      deploymentId,
      tenantId,
      resourceName,
      isSystem: isSystem || false,
      createTime: new Date(),
    });

    return this.formRepository.save(form);
  }

  /**
   * 根据ID查询表单
   */
  async findById(id: string): Promise<Form> {
    const form = await this.formRepository.findOne({
      where: { id },
    });

    if (!form) {
      throw new NotFoundException(`表单不存在: ${id}`);
    }

    return form;
  }

  /**
   * 根据表单键查询表单
   */
  async findByFormKey(formKey: string, tenantId?: string): Promise<Form> {
    const where: any = { formKey };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const form = await this.formRepository.findOne({
      where,
    });

    if (!form) {
      throw new NotFoundException(`表单不存在: ${formKey}`);
    }

    return form;
  }

  /**
   * 查询所有表单
   */
  async findAll(
    page = 1,
    pageSize = 10,
    formKey?: string,
    tenantId?: string,
  ): Promise<{ data: Form[]; total: number }> {
    const queryBuilder = this.formRepository.createQueryBuilder('f');

    if (formKey) {
      queryBuilder.andWhere('f.formKey = :formKey', { formKey });
    }

    if (tenantId) {
      queryBuilder.andWhere('f.tenantId = :tenantId', { tenantId });
    }

    const [data, total] = await queryBuilder
      .orderBy('f.createTime', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { data, total };
  }

  /**
   * 更新表单
   */
  async update(id: string, updates: Partial<Form>): Promise<Form> {
    const form = await this.findById(id);

    // 如果更新表单键，检查是否已存在
    if (updates.formKey && updates.formKey !== form.formKey) {
      const existingForm = await this.formRepository.findOne({
        where: { formKey: updates.formKey, tenantId: updates.tenantId || form.tenantId },
      });

      if (existingForm) {
        throw new Error(`表单键已存在: ${updates.formKey}`);
      }
    }

    Object.assign(form, updates);
    return this.formRepository.save(form);
  }

  /**
   * 更新表单定义
   */
  async updateFormDefinition(id: string, formDefinition: Record<string, any>): Promise<Form> {
    const form = await this.findById(id);
    form.formDefinition = formDefinition;
    return this.formRepository.save(form);
  }

  /**
   * 删除表单
   */
  async delete(id: string): Promise<void> {
    const form = await this.findById(id);

    // 系统表单不允许删除
    if (form.isSystem) {
      throw new Error('系统表单不允许删除');
    }

    await this.formRepository.remove(form);
  }

  /**
   * 批量删除表单
   */
  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  /**
   * 根据部署ID查询表单列表
   */
  async findByDeploymentId(deploymentId: string): Promise<Form[]> {
    return this.formRepository.find({
      where: { deploymentId },
      order: { createTime: 'ASC' },
    });
  }

  /**
   * 获取表单最新版本
   */
  async getLatestVersion(formKey: string, tenantId?: string): Promise<Form> {
    const where: any = { formKey };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const form = await this.formRepository.findOne({
      where,
      order: { version: 'DESC' },
    });

    if (!form) {
      throw new NotFoundException(`表单不存在: ${formKey}`);
    }

    return form;
  }

  /**
   * 统计表单数量
   */
  async count(formKey?: string, tenantId?: string): Promise<number> {
    const queryBuilder = this.formRepository.createQueryBuilder('f');

    if (formKey) {
      queryBuilder.andWhere('f.formKey = :formKey', { formKey });
    }

    if (tenantId) {
      queryBuilder.andWhere('f.tenantId = :tenantId', { tenantId });
    }

    return queryBuilder.getCount();
  }
}
