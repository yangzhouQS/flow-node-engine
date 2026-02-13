import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BusinessException } from '../../common/exceptions/business.exception';
import { Role } from '../entities/role.entity';

import { IdentityService } from './identity.service';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    private readonly identityService: IdentityService,
  ) {}

  // 创建角色
  async create(dto: any): Promise<Role> {
    // 检查角色名是否已存在
    const existingRole = await this.roleRepository.findOne({
      where: { name: dto.name },
    });
    if (existingRole) {
      throw new ConflictException('角色名已存在');
    }

    // 检查角色代码是否已存在
    if (dto.code) {
      const existingCode = await this.roleRepository.findOne({
        where: { code: dto.code },
      });
      if (existingCode) {
        throw new ConflictException('角色代码已存在');
      }
    }

    // 创建角色
    const role = this.roleRepository.create({
      name: dto.name,
      description: dto.description,
      code: dto.code,
      isSystem: dto.isSystem ?? false,
      sort: dto.sort ?? 0,
      tenantId: dto.tenantId,
    });

    return this.roleRepository.save(role);
  }

  // 根据 ID 查询角色
  async findById(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['users'],
    });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    return role;
  }

  // 根据名称查询角色
  async findByName(name: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { name },
    });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    return role;
  }

  // 根据代码查询角色
  async findByCode(code: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { code },
    });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    return role;
  }

  // 查询所有角色
  async findAll(query: any): Promise<{ items: Role[]; total: number }> {
    const { page = 1, pageSize = 20, name, code, isSystem, tenantId } = query;

    const queryBuilder = this.roleRepository.createQueryBuilder('role');

    // 添加查询条件
    if (name) {
      queryBuilder.andWhere('role.name LIKE :name', {
        name: `%${name}%`,
      });
    }
    if (code) {
      queryBuilder.andWhere('role.code LIKE :code', {
        code: `%${code}%`,
      });
    }
    if (isSystem !== undefined) {
      queryBuilder.andWhere('role.isSystem = :isSystem', { isSystem });
    }
    if (tenantId) {
      queryBuilder.andWhere('role.tenantId = :tenantId', { tenantId });
    }

    // 查询总数
    const total = await queryBuilder.getCount();

    // 分页查询
    const items = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('role.sort', 'ASC')
      .addOrderBy('role.createTime', 'DESC')
      .getMany();

    return { items, total };
  }

  // 更新角色
  async update(id: string, dto: any): Promise<Role> {
    const role = await this.findById(id);

    // 系统角色不允许修改关键信息
    if (role.isSystem) {
      throw new BusinessException('系统角色不允许修改');
    }

    // 检查角色名是否已被其他角色使用
    if (dto.name && dto.name !== role.name) {
      const existingRole = await this.roleRepository.findOne({
        where: { name: dto.name },
      });
      if (existingRole) {
        throw new ConflictException('角色名已存在');
      }
    }

    // 检查角色代码是否已被其他角色使用
    if (dto.code && dto.code !== role.code) {
      const existingCode = await this.roleRepository.findOne({
        where: { code: dto.code },
      });
      if (existingCode) {
        throw new ConflictException('角色代码已存在');
      }
    }

    // 更新角色
    Object.assign(role, dto);
    return this.roleRepository.save(role);
  }

  // 删除角色
  async delete(id: string): Promise<void> {
    const role = await this.findById(id);

    // 系统角色不允许删除
    if (role.isSystem) {
      throw new BusinessException('系统角色不允许删除');
    }

    await this.roleRepository.remove(role);
  }

  // 批量删除角色
  async deleteMany(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.delete(id);
    }
  }

  // 查询角色下的所有用户 ID
  async getRoleUserIds(roleId: string): Promise<string[]> {
    return this.identityService.getRoleUserIds(roleId);
  }

  // 查询角色下的所有用户
  async getRoleUsers(roleId: string) {
    const role = await this.findById(roleId);
    return role.users;
  }

  // 统计角色数量
  async count(query: any): Promise<number> {
    const queryBuilder = this.roleRepository.createQueryBuilder('role');

    if (query.name) {
      queryBuilder.andWhere('role.name LIKE :name', {
        name: `%${query.name}%`,
      });
    }
    if (query.isSystem !== undefined) {
      queryBuilder.andWhere('role.isSystem = :isSystem', {
        isSystem: query.isSystem,
      });
    }
    if (query.tenantId) {
      queryBuilder.andWhere('role.tenantId = :tenantId', {
        tenantId: query.tenantId,
      });
    }

    return queryBuilder.getCount();
  }
}
