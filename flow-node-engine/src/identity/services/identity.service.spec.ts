import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BusinessException } from '../../common/exceptions/business.exception';
import { Group } from '../entities/group.entity';
import { Role } from '../entities/role.entity';
import { UserGroup } from '../entities/user-group.entity';
import { UserRole } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';
import { IdentityService } from './identity.service';

describe('IdentityService', () => {
  let service: IdentityService;
  let userRepository: Repository<User>;
  let roleRepository: Repository<Role>;
  let groupRepository: Repository<Group>;
  let userRoleRepository: Repository<UserRole>;
  let userGroupRepository: Repository<UserGroup>;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    password: 'hashedpassword',
    email: 'test@example.com',
    realName: 'Test User',
    isActive: true,
  };

  const mockRole = {
    id: 'role-1',
    name: 'admin',
    code: 'ADMIN',
    description: 'Administrator role',
  };

  const mockGroup = {
    id: 'group-1',
    name: 'developers',
    code: 'DEV',
    description: 'Developers group',
  };

  const mockRepositories = () => ({
    userRepository: {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    },
    roleRepository: {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    },
    groupRepository: {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    },
    userRoleRepository: {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    },
    userGroupRepository: {
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    },
  });

  beforeEach(async () => {
    const mocks = mockRepositories();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityService,
        {
          provide: getRepositoryToken(User),
          useValue: mocks.userRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mocks.roleRepository,
        },
        {
          provide: getRepositoryToken(Group),
          useValue: mocks.groupRepository,
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: mocks.userRoleRepository,
        },
        {
          provide: getRepositoryToken(UserGroup),
          useValue: mocks.userGroupRepository,
        },
      ],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    groupRepository = module.get<Repository<Group>>(getRepositoryToken(Group));
    userRoleRepository = module.get<Repository<UserRole>>(getRepositoryToken(UserRole));
    userGroupRepository = module.get<Repository<UserGroup>>(getRepositoryToken(UserGroup));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('应该成功加密密码', async () => {
      const password = 'testpassword123';
      const hashedPassword = await service.hashPassword(password);

      // 验证加密后的密码不等于原密码
      expect(hashedPassword).not.toBe(password);
      // 验证是有效的bcrypt哈希
      expect(hashedPassword.startsWith('$2b$')).toBe(true);
    });

    it('应该为相同密码生成不同的哈希值（因为有盐）', async () => {
      const password = 'testpassword123';
      const hash1 = await service.hashPassword(password);
      const hash2 = await service.hashPassword(password);

      // 两次哈希应该不同
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('应该正确验证匹配的密码', async () => {
      const password = 'testpassword123';
      const hash = await service.hashPassword(password);

      const result = await service.verifyPassword(password, hash);

      expect(result).toBe(true);
    });

    it('应该拒绝不匹配的密码', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hash = await service.hashPassword(password);

      const result = await service.verifyPassword(wrongPassword, hash);

      expect(result).toBe(false);
    });

    it('应该拒绝空密码', async () => {
      const password = 'testpassword123';
      const hash = await service.hashPassword(password);

      const result = await service.verifyPassword('', hash);

      expect(result).toBe(false);
    });
  });

  describe('getUserGroupIds', () => {
    it('应该返回用户所属的所有组ID', async () => {
      const userId = 'user-1';
      const mockUserGroups = [
        { userId, groupId: 'group-1' },
        { userId, groupId: 'group-2' },
      ];

      vi.mocked(userGroupRepository.find).mockResolvedValue(mockUserGroups as any);

      const result = await service.getUserGroupIds(userId);

      expect(result).toEqual(['group-1', 'group-2']);
      expect(userGroupRepository.find).toHaveBeenCalledWith({
        where: { userId },
        select: ['groupId'],
      });
    });

    it('用户不属于任何组时应返回空数组', async () => {
      const userId = 'user-1';

      vi.mocked(userGroupRepository.find).mockResolvedValue([]);

      const result = await service.getUserGroupIds(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getUserRoles', () => {
    it('应该返回用户的所有角色', async () => {
      const userId = 'user-1';
      const mockUserRoles = [
        { userId, roleId: 'role-1', role: mockRole },
        { userId, roleId: 'role-2', role: { ...mockRole, id: 'role-2', name: 'user' } },
      ];

      vi.mocked(userRoleRepository.find).mockResolvedValue(mockUserRoles as any);

      const result = await service.getUserRoles(userId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('admin');
      expect(result[1].name).toBe('user');
      expect(userRoleRepository.find).toHaveBeenCalledWith({
        where: { userId },
        relations: ['role'],
      });
    });

    it('用户没有角色时应返回空数组', async () => {
      const userId = 'user-1';

      vi.mocked(userRoleRepository.find).mockResolvedValue([]);

      const result = await service.getUserRoles(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getUserRoleIds', () => {
    it('应该返回用户的所有角色ID', async () => {
      const userId = 'user-1';
      const mockUserRoles = [
        { userId, roleId: 'role-1' },
        { userId, roleId: 'role-2' },
      ];

      vi.mocked(userRoleRepository.find).mockResolvedValue(mockUserRoles as any);

      const result = await service.getUserRoleIds(userId);

      expect(result).toEqual(['role-1', 'role-2']);
    });
  });

  describe('getGroupUserIds', () => {
    it('应该返回组内所有用户ID', async () => {
      const groupId = 'group-1';
      const mockUserGroups = [
        { userId: 'user-1', groupId },
        { userId: 'user-2', groupId },
      ];

      vi.mocked(userGroupRepository.find).mockResolvedValue(mockUserGroups as any);

      const result = await service.getGroupUserIds(groupId);

      expect(result).toEqual(['user-1', 'user-2']);
      expect(userGroupRepository.find).toHaveBeenCalledWith({
        where: { groupId },
        select: ['userId'],
      });
    });
  });

  describe('getRoleUserIds', () => {
    it('应该返回角色下所有用户ID', async () => {
      const roleId = 'role-1';
      const mockUserRoles = [
        { userId: 'user-1', roleId },
        { userId: 'user-2', roleId },
      ];

      vi.mocked(userRoleRepository.find).mockResolvedValue(mockUserRoles as any);

      const result = await service.getRoleUserIds(roleId);

      expect(result).toEqual(['user-1', 'user-2']);
      expect(userRoleRepository.find).toHaveBeenCalledWith({
        where: { roleId },
        select: ['userId'],
      });
    });
  });

  describe('assignRoleToUser', () => {
    it('应该成功为用户分配角色', async () => {
      const userId = 'user-1';
      const roleId = 'role-1';

      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockRole as any);
      vi.mocked(userRoleRepository.findOne).mockResolvedValue(null);
      vi.mocked(userRoleRepository.create).mockReturnValue({ userId, roleId } as any);
      vi.mocked(userRoleRepository.save).mockResolvedValue({ userId, roleId } as any);

      await service.assignRoleToUser(userId, roleId);

      expect(userRoleRepository.create).toHaveBeenCalledWith({ userId, roleId });
      expect(userRoleRepository.save).toHaveBeenCalled();
    });

    it('用户不存在时应抛出BusinessException', async () => {
      const userId = 'non-existent';
      const roleId = 'role-1';

      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.assignRoleToUser(userId, roleId)).rejects.toThrow(BusinessException);
      await expect(service.assignRoleToUser(userId, roleId)).rejects.toThrow('用户不存在');
    });

    it('角色不存在时应抛出BusinessException', async () => {
      const userId = 'user-1';
      const roleId = 'non-existent';

      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(roleRepository.findOne).mockResolvedValue(null);

      await expect(service.assignRoleToUser(userId, roleId)).rejects.toThrow(BusinessException);
      await expect(service.assignRoleToUser(userId, roleId)).rejects.toThrow('角色不存在');
    });

    it('用户已有该角色时应抛出BusinessException', async () => {
      const userId = 'user-1';
      const roleId = 'role-1';

      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockRole as any);
      vi.mocked(userRoleRepository.findOne).mockResolvedValue({ userId, roleId } as any);

      await expect(service.assignRoleToUser(userId, roleId)).rejects.toThrow(BusinessException);
      await expect(service.assignRoleToUser(userId, roleId)).rejects.toThrow('用户已拥有该角色');
    });
  });

  describe('removeRoleFromUser', () => {
    it('应该成功移除用户的角色', async () => {
      const userId = 'user-1';
      const roleId = 'role-1';

      vi.mocked(userRoleRepository.delete).mockResolvedValue({ affected: 1, raw: {} } as any);

      await service.removeRoleFromUser(userId, roleId);

      expect(userRoleRepository.delete).toHaveBeenCalledWith({ userId, roleId });
    });

    it('关联不存在时应抛出BusinessException', async () => {
      const userId = 'user-1';
      const roleId = 'role-1';

      vi.mocked(userRoleRepository.delete).mockResolvedValue({ affected: 0, raw: {} } as any);

      await expect(service.removeRoleFromUser(userId, roleId)).rejects.toThrow(BusinessException);
      await expect(service.removeRoleFromUser(userId, roleId)).rejects.toThrow('用户-角色关联不存在');
    });
  });

  describe('addUserToGroup', () => {
    it('应该成功将用户添加到组', async () => {
      const userId = 'user-1';
      const groupId = 'group-1';

      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);
      vi.mocked(userGroupRepository.findOne).mockResolvedValue(null);
      vi.mocked(userGroupRepository.create).mockReturnValue({ userId, groupId } as any);
      vi.mocked(userGroupRepository.save).mockResolvedValue({ userId, groupId } as any);

      await service.addUserToGroup(userId, groupId);

      expect(userGroupRepository.create).toHaveBeenCalledWith({ userId, groupId });
      expect(userGroupRepository.save).toHaveBeenCalled();
    });

    it('用户不存在时应抛出BusinessException', async () => {
      const userId = 'non-existent';
      const groupId = 'group-1';

      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.addUserToGroup(userId, groupId)).rejects.toThrow(BusinessException);
      await expect(service.addUserToGroup(userId, groupId)).rejects.toThrow('用户不存在');
    });

    it('组不存在时应抛出BusinessException', async () => {
      const userId = 'user-1';
      const groupId = 'non-existent';

      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(groupRepository.findOne).mockResolvedValue(null);

      await expect(service.addUserToGroup(userId, groupId)).rejects.toThrow(BusinessException);
      await expect(service.addUserToGroup(userId, groupId)).rejects.toThrow('组不存在');
    });

    it('用户已在组中时应抛出BusinessException', async () => {
      const userId = 'user-1';
      const groupId = 'group-1';

      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);
      vi.mocked(userGroupRepository.findOne).mockResolvedValue({ userId, groupId } as any);

      await expect(service.addUserToGroup(userId, groupId)).rejects.toThrow(BusinessException);
      await expect(service.addUserToGroup(userId, groupId)).rejects.toThrow('用户已属于该组');
    });
  });

  describe('removeUserFromGroup', () => {
    it('应该成功将用户从组中移除', async () => {
      const userId = 'user-1';
      const groupId = 'group-1';

      vi.mocked(userGroupRepository.delete).mockResolvedValue({ affected: 1, raw: {} } as any);

      await service.removeUserFromGroup(userId, groupId);

      expect(userGroupRepository.delete).toHaveBeenCalledWith({ userId, groupId });
    });

    it('关联不存在时应抛出BusinessException', async () => {
      const userId = 'user-1';
      const groupId = 'group-1';

      vi.mocked(userGroupRepository.delete).mockResolvedValue({ affected: 0, raw: {} } as any);

      await expect(service.removeUserFromGroup(userId, groupId)).rejects.toThrow(BusinessException);
      await expect(service.removeUserFromGroup(userId, groupId)).rejects.toThrow('用户-组关联不存在');
    });
  });

  describe('assignRolesToUser', () => {
    it('应该批量分配多个角色给用户', async () => {
      const userId = 'user-1';
      const roleIds = ['role-1', 'role-2'];

      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockRole as any);
      vi.mocked(userRoleRepository.findOne).mockResolvedValue(null);
      vi.mocked(userRoleRepository.create).mockReturnValue({} as any);
      vi.mocked(userRoleRepository.save).mockResolvedValue({} as any);

      await service.assignRolesToUser(userId, roleIds);

      expect(userRoleRepository.save).toHaveBeenCalledTimes(2);
    });

    it('空数组时不应执行任何操作', async () => {
      const userId = 'user-1';
      const roleIds: string[] = [];

      await service.assignRolesToUser(userId, roleIds);

      expect(userRoleRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('removeRolesFromUser', () => {
    it('应该批量移除用户的多个角色', async () => {
      const userId = 'user-1';
      const roleIds = ['role-1', 'role-2'];

      vi.mocked(userRoleRepository.delete).mockResolvedValue({ affected: 1, raw: {} } as any);

      await service.removeRolesFromUser(userId, roleIds);

      expect(userRoleRepository.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('addUsersToGroup', () => {
    it('应该批量添加多个用户到组', async () => {
      const groupId = 'group-1';
      const userIds = ['user-1', 'user-2'];

      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);
      vi.mocked(userGroupRepository.findOne).mockResolvedValue(null);
      vi.mocked(userGroupRepository.create).mockReturnValue({} as any);
      vi.mocked(userGroupRepository.save).mockResolvedValue({} as any);

      await service.addUsersToGroup(userIds, groupId);

      expect(userGroupRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('removeUsersFromGroup', () => {
    it('应该批量从组中移除多个用户', async () => {
      const groupId = 'group-1';
      const userIds = ['user-1', 'user-2'];

      vi.mocked(userGroupRepository.delete).mockResolvedValue({ affected: 1, raw: {} } as any);

      await service.removeUsersFromGroup(userIds, groupId);

      expect(userGroupRepository.delete).toHaveBeenCalledTimes(2);
    });
  });
});
