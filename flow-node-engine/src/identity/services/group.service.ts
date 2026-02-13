import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BusinessException } from '../../common/exceptions/business.exception';
import { Group } from '../entities/group.entity';

import { IdentityService } from './identity.service';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    private readonly identityService: IdentityService,
  ) {}

  // 创建组
  async create(dto: any): Promise<Group> {
    // 检查组名是否已存在
    const existingGroup = await this.groupRepository.findOne({
      where: { name: dto.name },
    });
    if (existingGroup) {
      throw new ConflictException('组名已存在');
    }

    // 检查组代码是否已存在
    if (dto.code) {
      const existingCode = await this.groupRepository.findOne({
        where: { code: dto.code },
      });
      if (existingCode) {
        throw new ConflictException('组代码已存在');
      }
    }

    // 检查父组是否存在
    if (dto.parentId) {
      const parentGroup = await this.groupRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parentGroup) {
        throw new NotFoundException('父组不存在');
      }
    }

    // 创建组
    const group = this.groupRepository.create({
      name: dto.name,
      description: dto.description,
      code: dto.code,
      parentId: dto.parentId,
      type: dto.type,
      isSystem: dto.isSystem ?? false,
      sort: dto.sort ?? 0,
      tenantId: dto.tenantId,
    });

    return this.groupRepository.save(group);
  }

  // 根据 ID 查询组
  async findById(id: string): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: { id },
      relations: ['users'],
    });
    if (!group) {
      throw new NotFoundException('组不存在');
    }
    return group;
  }

  // 根据名称查询组
  async findByName(name: string): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: { name },
    });
    if (!group) {
      throw new NotFoundException('组不存在');
    }
    return group;
  }

  // 根据代码查询组
  async findByCode(code: string): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: { code },
    });
    if (!group) {
      throw new NotFoundException('组不存在');
    }
    return group;
  }

  // 查询所有组
  async findAll(query: any): Promise<{ items: Group[]; total: number }> {
    const { page = 1, pageSize = 20, name, code, type, parentId, isSystem, tenantId } = query;

    const queryBuilder = this.groupRepository.createQueryBuilder('group');

    // 添加查询条件
    if (name) {
      queryBuilder.andWhere('group.name LIKE :name', {
        name: `%${name}%`,
      });
    }
    if (code) {
      queryBuilder.andWhere('group.code LIKE :code', {
        code: `%${code}%`,
      });
    }
    if (type) {
      queryBuilder.andWhere('group.type = :type', { type });
    }
    if (parentId) {
      queryBuilder.andWhere('group.parentId = :parentId', { parentId });
    }
    if (isSystem !== undefined) {
      queryBuilder.andWhere('group.isSystem = :isSystem', { isSystem });
    }
    if (tenantId) {
      queryBuilder.andWhere('group.tenantId = :tenantId', { tenantId });
    }

    // 查询总数
    const total = await queryBuilder.getCount();

    // 分页查询
    const items = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('group.sort', 'ASC')
      .addOrderBy('group.createTime', 'DESC')
      .getMany();

    return { items, total };
  }

  // 查询子组
  async findChildren(parentId: string): Promise<Group[]> {
    return this.groupRepository.find({
      where: { parentId },
      order: { sort: 'ASC', createTime: 'DESC' },
    });
  }

  // 查询组树
  async findTree(parentId?: string): Promise<Group[]> {
    if (parentId) {
      const children = await this.findChildren(parentId);
      const result: Group[] = [];
      for (const child of children) {
        result.push(child);
        const grandchildren = await this.findTree(child.id);
        result.push(...grandchildren);
      }
      return result;
    } else {
      // 查询所有顶级组
      return this.groupRepository.find({
        where: { parentId: null as any },
        order: { sort: 'ASC', createTime: 'DESC' },
      });
    }
  }

  // 更新组
  async update(id: string, dto: any): Promise<Group> {
    const group = await this.findById(id);

    // 系统组不允许修改关键信息
    if (group.isSystem) {
      throw new BusinessException('系统组不允许修改');
    }

    // 检查组名是否已被其他组使用
    if (dto.name && dto.name !== group.name) {
      const existingGroup = await this.groupRepository.findOne({
        where: { name: dto.name },
      });
      if (existingGroup) {
        throw new ConflictException('组名已存在');
      }
    }

    // 检查组代码是否已被其他组使用
    if (dto.code && dto.code !== group.code) {
      const existingCode = await this.groupRepository.findOne({
        where: { code: dto.code },
      });
      if (existingCode) {
        throw new ConflictException('组代码已存在');
      }
    }

    // 检查父组是否存在
    if (dto.parentId && dto.parentId !== group.parentId) {
      const parentGroup = await this.groupRepository.findOne({
        where: { id: dto.parentId },
      });
      if (!parentGroup) {
        throw new NotFoundException('父组不存在');
      }
    }

    // 检查是否将组设置为自己的子组（防止循环引用）
    if (dto.parentId === group.id) {
      throw new BusinessException('不能将组设置为自己的子组');
    }

    // 更新组
    Object.assign(group, dto);
    return this.groupRepository.save(group);
  }

  // 删除组
  async delete(id: string): Promise<void> {
    const group = await this.findById(id);

    // 系统组不允许删除
    if (group.isSystem) {
      throw new BusinessException('系统组不允许删除');
    }

    // 检查是否有子组
    const children = await this.findChildren(id);
    if (children.length > 0) {
      throw new BusinessException('该组下有子组，无法删除');
    }

    await this.groupRepository.remove(group);
  }

  // 批量删除组
  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  // 查询组下的所有用户 ID
  async getGroupUserIds(groupId: string): Promise<string[]> {
    return this.identityService.getGroupUserIds(groupId);
  }

  // 查询组下的所有用户
  async getGroupUsers(groupId: string) {
    const group = await this.findById(groupId);
    return group.users;
  }

  // 统计组数量
  async count(query: any): Promise<number> {
    const queryBuilder = this.groupRepository.createQueryBuilder('group');

    if (query.name) {
      queryBuilder.andWhere('group.name LIKE :name', {
        name: `%${query.name}%`,
      });
    }
    if (query.type) {
      queryBuilder.andWhere('group.type = :type', { type: query.type });
    }
    if (query.parentId) {
      queryBuilder.andWhere('group.parentId = :parentId', {
        parentId: query.parentId,
      });
    }
    if (query.isSystem !== undefined) {
      queryBuilder.andWhere('group.isSystem = :isSystem', {
        isSystem: query.isSystem,
      });
    }
    if (query.tenantId) {
      queryBuilder.andWhere('group.tenantId = :tenantId', {
        tenantId: query.tenantId,
      });
    }

    return queryBuilder.getCount();
  }
}
