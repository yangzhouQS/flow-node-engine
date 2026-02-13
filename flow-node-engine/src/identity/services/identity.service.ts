import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { BusinessException } from '../../common/exceptions/business.exception';
import { Group } from '../entities/group.entity';
import { Role } from '../entities/role.entity';
import { UserGroup } from '../entities/user-group.entity';
import { UserRole } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class IdentityService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(UserGroup)
    private readonly userGroupRepository: Repository<UserGroup>,
  ) {}

  // 密码加密
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // 密码验证
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // 查询用户所属的组 ID
  async getUserGroupIds(userId: string): Promise<string[]> {
    const userGroups = await this.userGroupRepository.find({
      where: { userId },
      select: ['groupId'],
    });
    return userGroups.map(ug => ug.groupId);
  }

  // 查询用户拥有的角色
  async getUserRoles(userId: string): Promise<Role[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role'],
    });
    return userRoles.map(ur => ur.role);
  }

  // 查询用户拥有的角色 ID
  async getUserRoleIds(userId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { userId },
      select: ['roleId'],
    });
    return userRoles.map(ur => ur.roleId);
  }

  // 查询组下的所有用户 ID
  async getGroupUserIds(groupId: string): Promise<string[]> {
    const userGroups = await this.userGroupRepository.find({
      where: { groupId },
      select: ['userId'],
    });
    return userGroups.map(ug => ug.userId);
  }

  // 查询角色下的所有用户 ID
  async getRoleUserIds(roleId: string): Promise<string[]> {
    const userRoles = await this.userRoleRepository.find({
      where: { roleId },
      select: ['userId'],
    });
    return userRoles.map(ur => ur.userId);
  }

  // 用户-角色关联
  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const role = await this.roleRepository.findOne({ where: { id: roleId } });

    if (!user) {
      throw new BusinessException('用户不存在');
    }
    if (!role) {
      throw new BusinessException('角色不存在');
    }

    // 检查是否已关联
    const existing = await this.userRoleRepository.findOne({
      where: { userId, roleId },
    });
    if (existing) {
      throw new BusinessException('用户已拥有该角色');
    }

    // 创建关联
    const userRole = this.userRoleRepository.create({
      userId,
      roleId,
    });
    await this.userRoleRepository.save(userRole);
  }

  // 移除用户-角色关联
  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const result = await this.userRoleRepository.delete({
      userId,
      roleId,
    });
    if (result.affected === 0) {
      throw new BusinessException('用户-角色关联不存在');
    }
  }

  // 用户-组关联
  async addUserToGroup(userId: string, groupId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const group = await this.groupRepository.findOne({ where: { id: groupId } });

    if (!user) {
      throw new BusinessException('用户不存在');
    }
    if (!group) {
      throw new BusinessException('组不存在');
    }

    // 检查是否已关联
    const existing = await this.userGroupRepository.findOne({
      where: { userId, groupId },
    });
    if (existing) {
      throw new BusinessException('用户已属于该组');
    }

    // 创建关联
    const userGroup = this.userGroupRepository.create({
      userId,
      groupId,
    });
    await this.userGroupRepository.save(userGroup);
  }

  // 移除用户-组关联
  async removeUserFromGroup(userId: string, groupId: string): Promise<void> {
    const result = await this.userGroupRepository.delete({
      userId,
      groupId,
    });
    if (result.affected === 0) {
      throw new BusinessException('用户-组关联不存在');
    }
  }

  // 批量分配角色给用户
  async assignRolesToUser(userId: string, roleIds: string[]): Promise<void> {
    for (const roleId of roleIds) {
      await this.assignRoleToUser(userId, roleId);
    }
  }

  // 批量移除用户的角色
  async removeRolesFromUser(userId: string, roleIds: string[]): Promise<void> {
    for (const roleId of roleIds) {
      await this.removeRoleFromUser(userId, roleId);
    }
  }

  // 批量添加用户到组
  async addUsersToGroup(userIds: string[], groupId: string): Promise<void> {
    for (const userId of userIds) {
      await this.addUserToGroup(userId, groupId);
    }
  }

  // 批量从组移除用户
  async removeUsersFromGroup(userIds: string[], groupId: string): Promise<void> {
    for (const userId of userIds) {
      await this.removeUserFromGroup(userId, groupId);
    }
  }
}
