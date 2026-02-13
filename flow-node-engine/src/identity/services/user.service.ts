import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BusinessException } from '../../common/exceptions/business.exception';
import { User } from '../entities/user.entity';

import { IdentityService } from './identity.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly identityService: IdentityService,
  ) {}

  // 创建用户
  async create(dto: any): Promise<User> {
    // 检查用户名是否已存在
    const existingUser = await this.userRepository.findOne({
      where: { username: dto.username },
    });
    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    // 检查邮箱是否已存在
    if (dto.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('邮箱已存在');
      }
    }

    // 加密密码
    const hashedPassword = await this.identityService.hashPassword(dto.password);

    // 创建用户
    const user = this.userRepository.create({
      username: dto.username,
      password: hashedPassword,
      realName: dto.realName,
      email: dto.email,
      phone: dto.phone,
      avatar: dto.avatar,
      isActive: dto.isActive ?? true,
      tenantId: dto.tenantId,
    });

    return this.userRepository.save(user);
  }

  // 根据 ID 查询用户
  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['roles', 'groups'],
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  // 根据用户名查询用户
  async findByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: ['roles', 'groups'],
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  // 根据邮箱查询用户
  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  // 查询所有用户
  async findAll(query: any): Promise<{ items: User[]; total: number }> {
    const { page = 1, pageSize = 20, username, realName, email, isActive, tenantId } = query;

    const queryBuilder = this.userRepository.createQueryBuilder('user');

    // 添加查询条件
    if (username) {
      queryBuilder.andWhere('user.username LIKE :username', {
        username: `%${username}%`,
      });
    }
    if (realName) {
      queryBuilder.andWhere('user.realName LIKE :realName', {
        realName: `%${realName}%`,
      });
    }
    if (email) {
      queryBuilder.andWhere('user.email LIKE :email', {
        email: `%${email}%`,
      });
    }
    if (isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }
    if (tenantId) {
      queryBuilder.andWhere('user.tenantId = :tenantId', { tenantId });
    }

    // 查询总数
    const total = await queryBuilder.getCount();

    // 分页查询
    const items = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .orderBy('user.createTime', 'DESC')
      .getMany();

    return { items, total };
  }

  // 更新用户
  async update(id: string, dto: any): Promise<User> {
    const user = await this.findById(id);

    // 检查用户名是否已被其他用户使用
    if (dto.username && dto.username !== user.username) {
      const existingUser = await this.userRepository.findOne({
        where: { username: dto.username },
      });
      if (existingUser) {
        throw new ConflictException('用户名已存在');
      }
    }

    // 检查邮箱是否已被其他用户使用
    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('邮箱已存在');
      }
    }

    // 如果需要更新密码，则加密密码
    if (dto.password) {
      dto.password = await this.identityService.hashPassword(dto.password);
    }

    // 更新用户
    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  // 删除用户
  async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.userRepository.remove(user);
  }

  // 批量删除用户
  async deleteMany(ids: string[]): Promise<void> {
    await this.userRepository.delete(ids);
  }

  // 激活用户
  async activate(id: string): Promise<void> {
    const user = await this.findById(id);
    user.isActive = true;
    await this.userRepository.save(user);
  }

  // 停用用户
  async deactivate(id: string): Promise<void> {
    const user = await this.findById(id);
    user.isActive = false;
    await this.userRepository.save(user);
  }

  // 修改密码
  async changePassword(id: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.findById(id);

    // 验证旧密码
    const isPasswordValid = await this.identityService.verifyPassword(
      oldPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BusinessException('旧密码不正确');
    }

    // 更新密码
    user.password = await this.identityService.hashPassword(newPassword);
    await this.userRepository.save(user);
  }

  // 重置密码
  async resetPassword(id: string, newPassword: string): Promise<void> {
    const user = await this.findById(id);
    user.password = await this.identityService.hashPassword(newPassword);
    await this.userRepository.save(user);
  }

  // 验证用户密码
  async validatePassword(username: string, password: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findOne({
        where: { username },
      });
      if (!user) {
        return false;
      }

      return this.identityService.verifyPassword(password, user.password);
    } catch (error) {
      return false;
    }
  }

  // 查询用户的角色
  async getUserRoles(userId: string) {
    return this.identityService.getUserRoles(userId);
  }

  // 查询用户的组
  async getUserGroups(userId: string) {
    const user = await this.findById(userId);
    return user.groups;
  }

  // 查询用户所属的组 ID
  async getUserGroupIds(userId: string): Promise<string[]> {
    return this.identityService.getUserGroupIds(userId);
  }

  // 统计用户数量
  async count(query: any): Promise<number> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (query.username) {
      queryBuilder.andWhere('user.username LIKE :username', {
        username: `%${query.username}%`,
      });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('user.isActive = :isActive', {
        isActive: query.isActive,
      });
    }
    if (query.tenantId) {
      queryBuilder.andWhere('user.tenantId = :tenantId', {
        tenantId: query.tenantId,
      });
    }

    return queryBuilder.getCount();
  }
}
