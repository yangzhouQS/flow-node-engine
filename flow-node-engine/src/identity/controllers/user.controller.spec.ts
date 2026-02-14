import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from '../services/user.service';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUserService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByUsername: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    changePassword: vi.fn(),
    resetPassword: vi.fn(),
    getUserRoles: vi.fn(),
    getUserGroups: vi.fn(),
    getUserGroupIds: vi.fn(),
    count: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
  });

  describe('create', () => {
    it('应该创建用户', async () => {
      const dto = { username: 'testuser', password: 'password123', email: 'test@example.com' };
      const mockUser = { id: 'user-1', ...dto };
      mockUserService.create.mockResolvedValue(mockUser);

      const result = await controller.create(dto);

      expect(mockUserService.create).toHaveBeenCalledWith(dto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('创建成功');
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('应该返回用户列表', async () => {
      const query = { page: 1, pageSize: 10 };
      const mockResult = {
        data: [{ id: 'user-1', username: 'testuser' }],
        total: 1,
      };
      mockUserService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(query);

      expect(mockUserService.findAll).toHaveBeenCalledWith(query);
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('findById', () => {
    it('应该根据ID返回用户', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      mockUserService.findById.mockResolvedValue(mockUser);

      const result = await controller.findById('user-1');

      expect(mockUserService.findById).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockUser);
    });

    it('应该处理用户不存在的情况', async () => {
      mockUserService.findById.mockResolvedValue(null);

      const result = await controller.findById('nonexistent');

      expect(result.data).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('应该根据用户名返回用户', async () => {
      const mockUser = { id: 'user-1', username: 'testuser' };
      mockUserService.findByUsername.mockResolvedValue(mockUser);

      const result = await controller.findByUsername('testuser');

      expect(mockUserService.findByUsername).toHaveBeenCalledWith('testuser');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('update', () => {
    it('应该更新用户', async () => {
      const dto = { email: 'newemail@example.com' };
      const mockUser = { id: 'user-1', email: 'newemail@example.com' };
      mockUserService.update.mockResolvedValue(mockUser);

      const result = await controller.update('user-1', dto);

      expect(mockUserService.update).toHaveBeenCalledWith('user-1', dto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('更新成功');
      expect(result.data).toEqual(mockUser);
    });
  });

  describe('delete', () => {
    it('应该删除用户', async () => {
      mockUserService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('user-1');

      expect(mockUserService.delete).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
      expect(result.data).toBeNull();
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除用户', async () => {
      mockUserService.deleteMany.mockResolvedValue(undefined);

      const result = await controller.deleteMany({ ids: ['user-1', 'user-2'] });

      expect(mockUserService.deleteMany).toHaveBeenCalledWith(['user-1', 'user-2']);
      expect(result.code).toBe(200);
      expect(result.data).toBeNull();
    });
  });

  describe('activate', () => {
    it('应该激活用户', async () => {
      mockUserService.activate.mockResolvedValue(undefined);

      const result = await controller.activate('user-1');

      expect(mockUserService.activate).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('激活成功');
    });
  });

  describe('deactivate', () => {
    it('应该停用用户', async () => {
      mockUserService.deactivate.mockResolvedValue(undefined);

      const result = await controller.deactivate('user-1');

      expect(mockUserService.deactivate).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('停用成功');
    });
  });

  describe('changePassword', () => {
    it('应该修改密码', async () => {
      mockUserService.changePassword.mockResolvedValue(undefined);

      const result = await controller.changePassword('user-1', {
        oldPassword: 'oldpass',
        newPassword: 'newpass',
      });

      expect(mockUserService.changePassword).toHaveBeenCalledWith('user-1', 'oldpass', 'newpass');
      expect(result.code).toBe(200);
      expect(result.message).toBe('修改成功');
    });
  });

  describe('resetPassword', () => {
    it('应该重置密码', async () => {
      mockUserService.resetPassword.mockResolvedValue(undefined);

      const result = await controller.resetPassword('user-1', {
        newPassword: 'newpassword',
      });

      expect(mockUserService.resetPassword).toHaveBeenCalledWith('user-1', 'newpassword');
      expect(result.code).toBe(200);
      expect(result.message).toBe('重置成功');
    });
  });

  describe('getUserRoles', () => {
    it('应该返回用户的角色列表', async () => {
      const mockRoles = [{ id: 'role-1', name: 'admin' }];
      mockUserService.getUserRoles.mockResolvedValue(mockRoles);

      const result = await controller.getUserRoles('user-1');

      expect(mockUserService.getUserRoles).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockRoles);
    });
  });

  describe('getUserGroups', () => {
    it('应该返回用户的组列表', async () => {
      const mockGroups = [{ id: 'group-1', name: 'developers' }];
      mockUserService.getUserGroups.mockResolvedValue(mockGroups);

      const result = await controller.getUserGroups('user-1');

      expect(mockUserService.getUserGroups).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockGroups);
    });
  });

  describe('getUserGroupIds', () => {
    it('应该返回用户所属的组ID列表', async () => {
      const mockGroupIds = ['group-1', 'group-2'];
      mockUserService.getUserGroupIds.mockResolvedValue(mockGroupIds);

      const result = await controller.getUserGroupIds('user-1');

      expect(mockUserService.getUserGroupIds).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockGroupIds);
    });
  });

  describe('count', () => {
    it('应该返回用户数量', async () => {
      mockUserService.count.mockResolvedValue(100);

      const result = await controller.count({ status: 'active' });

      expect(mockUserService.count).toHaveBeenCalledWith({ status: 'active' });
      expect(result.code).toBe(200);
      expect(result.data.count).toBe(100);
    });

    it('应该处理空查询参数', async () => {
      mockUserService.count.mockResolvedValue(50);

      const result = await controller.count({});

      expect(mockUserService.count).toHaveBeenCalledWith({});
      expect(result.data.count).toBe(50);
    });
  });
});
