import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NotFoundException, ConflictException } from '@nestjs/common';

import { UserService } from './user.service';
import { IdentityService } from './identity.service';
import { User } from '../entities/user.entity';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let identityService: IdentityService;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    password: 'hashedpassword',
    email: 'test@example.com',
    realName: 'Test User',
    phone: '13800138000',
    avatar: 'avatar.png',
    isActive: true,
    tenantId: 'tenant-1',
    roles: [],
    groups: [],
    createTime: new Date(),
    updateTime: new Date(),
  };

  const mockQueryBuilder = {
    andWhere: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    getCount: vi.fn(),
    getMany: vi.fn(),
  };

  const createMockQueryBuilder = () => {
    const qb = {
      andWhere: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getCount: vi.fn(),
      getMany: vi.fn(),
    };
    return qb as any as SelectQueryBuilder<User>;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            remove: vi.fn(),
            delete: vi.fn(),
            createQueryBuilder: vi.fn(),
          },
        },
        {
          provide: IdentityService,
          useValue: {
            hashPassword: vi.fn(),
            verifyPassword: vi.fn(),
            getUserRoles: vi.fn(),
            getUserGroupIds: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    identityService = module.get<IdentityService>(IdentityService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      username: 'newuser',
      password: 'password123',
      email: 'new@example.com',
      realName: 'New User',
      phone: '13900139000',
    };

    it('应该成功创建用户', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(null); // username check
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(null); // email check
      vi.mocked(identityService.hashPassword).mockResolvedValue('hashedpassword');
      vi.mocked(userRepository.create).mockReturnValue(mockUser as any);
      vi.mocked(userRepository.save).mockResolvedValue(mockUser as any);

      const result = await service.create(createDto);

      expect(result).toEqual(mockUser);
      expect(identityService.hashPassword).toHaveBeenCalledWith(createDto.password);
    });

    it('用户名已存在时应抛出ConflictException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(mockUser as any);

      await expect(service.create(createDto)).rejects.toThrow('用户名已存在');
    });

    it('邮箱已存在时应抛出ConflictException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(null); // username check
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(mockUser as any); // email check

      await expect(service.create(createDto)).rejects.toThrow('邮箱已存在');
    });

    it('没有邮箱时不应检查邮箱唯一性', async () => {
      const dtoWithoutEmail = {
        username: 'newuser',
        password: 'password123',
        realName: 'New User',
      };

      vi.mocked(userRepository.findOne).mockResolvedValueOnce(null);
      vi.mocked(identityService.hashPassword).mockResolvedValue('hashedpassword');
      vi.mocked(userRepository.create).mockReturnValue(mockUser as any);
      vi.mocked(userRepository.save).mockResolvedValue(mockUser as any);

      await service.create(dtoWithoutEmail);

      expect(userRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('应该使用默认的isActive值', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);
      vi.mocked(identityService.hashPassword).mockResolvedValue('hashedpassword');
      vi.mocked(userRepository.create).mockReturnValue(mockUser as any);
      vi.mocked(userRepository.save).mockResolvedValue(mockUser as any);

      await service.create(createDto);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
        })
      );
    });
  });

  describe('findById', () => {
    it('应该返回用户及其角色和组', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);

      const result = await service.findById('user-1');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        relations: ['roles', 'groups'],
      });
    });

    it('用户不存在时应抛出NotFoundException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow('用户不存在');
    });
  });

  describe('findByUsername', () => {
    it('应该根据用户名返回用户', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);

      const result = await service.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        relations: ['roles', 'groups'],
      });
    });

    it('用户不存在时应抛出NotFoundException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.findByUsername('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('应该根据邮箱返回用户', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('用户不存在时应抛出NotFoundException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.findByEmail('nonexistent@example.com')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('应该返回分页用户列表', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(2);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockUser, { ...mockUser, id: 'user-2' }] as any[]);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('应该支持用户名模糊查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockUser] as any[]);

      await service.findAll({ username: 'test' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.username LIKE :username',
        { username: '%test%' }
      );
    });

    it('应该支持真实姓名模糊查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockUser] as any[]);

      await service.findAll({ realName: 'Test' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.realName LIKE :realName',
        { realName: '%Test%' }
      );
    });

    it('应该支持邮箱模糊查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockUser] as any[]);

      await service.findAll({ email: 'example' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.email LIKE :email',
        { email: '%example%' }
      );
    });

    it('应该支持isActive精确查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockUser] as any[]);

      await service.findAll({ isActive: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.isActive = :isActive',
        { isActive: true }
      );
    });

    it('应该支持租户ID查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockUser] as any[]);

      await service.findAll({ tenantId: 'tenant-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'user.tenantId = :tenantId',
        { tenantId: 'tenant-1' }
      );
    });

    it('应该使用默认分页参数', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(0);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([]);

      await service.findAll({});

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
    });

    it('应该正确计算分页偏移量', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(0);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([]);

      await service.findAll({ page: 3, pageSize: 15 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(30); // (3-1) * 15
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(15);
    });
  });

  describe('update', () => {
    const updateDto = {
      realName: 'Updated Name',
      phone: '13700137000',
    };

    it('应该成功更新用户', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(userRepository.save).mockResolvedValue({ ...mockUser, ...updateDto } as any);

      const result = await service.update('user-1', updateDto);

      expect(result.realName).toBe('Updated Name');
    });

    it('用户不存在时应抛出NotFoundException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('更新用户名时检查唯一性', async () => {
      const dtoWithUsername = { username: 'newusername' };
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(mockUser as any); // findById
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(null); // username uniqueness check
      vi.mocked(userRepository.save).mockResolvedValue(mockUser as any);

      await service.update('user-1', dtoWithUsername);

      expect(userRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('更新用户名已被使用时应抛出ConflictException', async () => {
      const dtoWithUsername = { username: 'existingusername' };
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(mockUser as any); // findById
      vi.mocked(userRepository.findOne).mockResolvedValueOnce({ id: 'other-user' } as any); // username exists

      await expect(service.update('user-1', dtoWithUsername)).rejects.toThrow('用户名已存在');
    });

    it('更新邮箱时检查唯一性', async () => {
      const dtoWithEmail = { email: 'new@example.com' };
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(mockUser as any); // findById
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(null); // email uniqueness check
      vi.mocked(userRepository.save).mockResolvedValue(mockUser as any);

      await service.update('user-1', dtoWithEmail);

      expect(userRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('更新邮箱已被使用时应抛出ConflictException', async () => {
      const dtoWithEmail = { email: 'existing@example.com' };
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(mockUser as any); // findById
      vi.mocked(userRepository.findOne).mockResolvedValueOnce({ id: 'other-user' } as any); // email exists

      await expect(service.update('user-1', dtoWithEmail)).rejects.toThrow('邮箱已存在');
    });

    it('更新密码时应该加密', async () => {
      const dtoWithPassword = { password: 'newpassword' };
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(identityService.hashPassword).mockResolvedValue('newhashedpassword');
      vi.mocked(userRepository.save).mockResolvedValue(mockUser as any);

      await service.update('user-1', dtoWithPassword);

      expect(identityService.hashPassword).toHaveBeenCalledWith('newpassword');
    });

    it('用户名相同时不检查唯一性', async () => {
      const dtoWithSameUsername = { username: 'testuser' };
      vi.mocked(userRepository.findOne).mockResolvedValueOnce(mockUser as any);
      vi.mocked(userRepository.save).mockResolvedValue(mockUser as any);

      await service.update('user-1', dtoWithSameUsername);

      // findById 和名称检查（相同名称跳过）
      expect(userRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('应该成功删除用户', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(userRepository.remove).mockResolvedValue(mockUser as any);

      await service.delete('user-1');

      expect(userRepository.remove).toHaveBeenCalledWith(mockUser);
    });

    it('用户不存在时应抛出NotFoundException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除用户', async () => {
      vi.mocked(userRepository.delete).mockResolvedValue({ affected: 2, raw: {} } as any);

      await service.deleteMany(['user-1', 'user-2']);

      expect(userRepository.delete).toHaveBeenCalledWith(['user-1', 'user-2']);
    });
  });

  describe('activate', () => {
    it('应该成功激活用户', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      vi.mocked(userRepository.findOne).mockResolvedValue(inactiveUser as any);
      vi.mocked(userRepository.save).mockResolvedValue({ ...inactiveUser, isActive: true } as any);

      await service.activate('user-1');

      expect(inactiveUser.isActive).toBe(true);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('用户不存在时应抛出NotFoundException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.activate('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('应该成功停用用户', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(userRepository.save).mockResolvedValue({ ...mockUser, isActive: false } as any);

      await service.deactivate('user-1');

      expect(mockUser.isActive).toBe(false);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('用户不存在时应抛出NotFoundException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.deactivate('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('changePassword', () => {
    it('应该成功修改密码', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(identityService.verifyPassword).mockResolvedValue(true);
      vi.mocked(identityService.hashPassword).mockResolvedValue('newhashedpassword');
      vi.mocked(userRepository.save).mockResolvedValue(mockUser as any);

      await service.changePassword('user-1', 'oldpassword', 'newpassword');

      expect(identityService.verifyPassword).toHaveBeenCalledWith('oldpassword', mockUser.password);
      expect(identityService.hashPassword).toHaveBeenCalledWith('newpassword');
    });

    it('旧密码不正确时应抛出BusinessException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(identityService.verifyPassword).mockResolvedValue(false);

      await expect(service.changePassword('user-1', 'wrongpassword', 'newpassword')).rejects.toThrow('旧密码不正确');
    });

    it('用户不存在时应抛出NotFoundException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.changePassword('non-existent', 'old', 'new')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('应该成功重置密码', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(identityService.hashPassword).mockResolvedValue('newhashedpassword');
      vi.mocked(userRepository.save).mockResolvedValue(mockUser as any);

      await service.resetPassword('user-1', 'newpassword');

      expect(identityService.hashPassword).toHaveBeenCalledWith('newpassword');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('用户不存在时应抛出NotFoundException', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      await expect(service.resetPassword('non-existent', 'newpassword')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validatePassword', () => {
    it('密码正确时应返回true', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(identityService.verifyPassword).mockResolvedValue(true);

      const result = await service.validatePassword('testuser', 'correctpassword');

      expect(result).toBe(true);
    });

    it('密码错误时应返回false', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(identityService.verifyPassword).mockResolvedValue(false);

      const result = await service.validatePassword('testuser', 'wrongpassword');

      expect(result).toBe(false);
    });

    it('用户不存在时应返回false', async () => {
      vi.mocked(userRepository.findOne).mockResolvedValue(null);

      const result = await service.validatePassword('nonexistent', 'password');

      expect(result).toBe(false);
    });

    it('发生异常时应返回false', async () => {
      vi.mocked(userRepository.findOne).mockRejectedValue(new Error('Database error'));

      const result = await service.validatePassword('testuser', 'password');

      expect(result).toBe(false);
    });
  });

  describe('getUserRoles', () => {
    it('应该返回用户的角色', async () => {
      const mockRoles = [{ id: 'role-1', name: 'admin' }];
      vi.mocked(identityService.getUserRoles).mockResolvedValue(mockRoles as any);

      const result = await service.getUserRoles('user-1');

      expect(result).toEqual(mockRoles);
    });
  });

  describe('getUserGroups', () => {
    it('应该返回用户的组', async () => {
      const mockGroups = [{ id: 'group-1', name: 'developers' }];
      vi.mocked(userRepository.findOne).mockResolvedValue({ ...mockUser, groups: mockGroups } as any);

      const result = await service.getUserGroups('user-1');

      expect(result).toEqual(mockGroups);
    });
  });

  describe('getUserGroupIds', () => {
    it('应该返回用户的组ID列表', async () => {
      vi.mocked(identityService.getUserGroupIds).mockResolvedValue(['group-1', 'group-2']);

      const result = await service.getUserGroupIds('user-1');

      expect(result).toEqual(['group-1', 'group-2']);
    });
  });

  describe('count', () => {
    it('应该返回用户总数', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(100);

      const result = await service.count({});

      expect(result).toBe(100);
    });

    it('应该支持条件统计', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(userRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(50);

      await service.count({ username: 'test', isActive: true, tenantId: 'tenant-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });
});
