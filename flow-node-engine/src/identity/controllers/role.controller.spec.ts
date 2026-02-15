 import { Test, TestingModule } from '@nestjs/testing';
 import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoleService } from '../services/role.service';
import { RoleController } from './role.controller';

describe('RoleController', () => {
  let controller: RoleController;
  let roleService: RoleService;

  const mockRoleService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    findByCode: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    getRoleUsers: vi.fn(),
    getRoleUserIds: vi.fn(),
    count: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoleController],
      providers: [{ provide: RoleService, useValue: mockRoleService }],
    }).compile();

    controller = module.get<RoleController>(RoleController);
    roleService = module.get<RoleService>(RoleService);
  });

  describe('create', () => {
    it('应该创建角色', async () => {
      const dto = { name: '管理员', code: 'admin', description: '系统管理员' };
      const mockRole = { id: 'role-1', ...dto };
      mockRoleService.create.mockResolvedValue(mockRole);

      const result = await controller.create(dto);

      expect(mockRoleService.create).toHaveBeenCalledWith(dto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('创建成功');
      expect(result.data).toEqual(mockRole);
    });
  });

  describe('findAll', () => {
    it('应该返回角色列表', async () => {
      const query = { page: 1, pageSize: 10 };
      const mockResult = {
        data: [{ id: 'role-1', name: '管理员' }],
        total: 1,
      };
      mockRoleService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(query);

      expect(mockRoleService.findAll).toHaveBeenCalledWith(query);
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('findById', () => {
    it('应该根据ID返回角色', async () => {
      const mockRole = { id: 'role-1', name: '管理员' };
      mockRoleService.findById.mockResolvedValue(mockRole);

      const result = await controller.findById('role-1');

      expect(mockRoleService.findById).toHaveBeenCalledWith('role-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockRole);
    });

    it('应该处理角色不存在的情况', async () => {
      mockRoleService.findById.mockResolvedValue(null);

      const result = await controller.findById('nonexistent');

      expect(result.data).toBeNull();
    });
  });

  describe('findByName', () => {
    it('应该根据名称返回角色', async () => {
      const mockRole = { id: 'role-1', name: '管理员' };
      mockRoleService.findByName.mockResolvedValue(mockRole);

      const result = await controller.findByName('管理员');

      expect(mockRoleService.findByName).toHaveBeenCalledWith('管理员');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockRole);
    });
  });

  describe('findByCode', () => {
    it('应该根据代码返回角色', async () => {
      const mockRole = { id: 'role-1', code: 'admin' };
      mockRoleService.findByCode.mockResolvedValue(mockRole);

      const result = await controller.findByCode('admin');

      expect(mockRoleService.findByCode).toHaveBeenCalledWith('admin');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockRole);
    });
  });

  describe('update', () => {
    it('应该更新角色', async () => {
      const dto = { description: '新的描述' };
      const mockRole = { id: 'role-1', description: '新的描述' };
      mockRoleService.update.mockResolvedValue(mockRole);

      const result = await controller.update('role-1', dto);

      expect(mockRoleService.update).toHaveBeenCalledWith('role-1', dto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('更新成功');
      expect(result.data).toEqual(mockRole);
    });
  });

  describe('delete', () => {
    it('应该删除角色', async () => {
      mockRoleService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('role-1');

      expect(mockRoleService.delete).toHaveBeenCalledWith('role-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
      expect(result.data).toBeNull();
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除角色', async () => {
      mockRoleService.deleteMany.mockResolvedValue(undefined);

      const result = await controller.deleteMany({ ids: ['role-1', 'role-2'] });

      expect(mockRoleService.deleteMany).toHaveBeenCalledWith(['role-1', 'role-2']);
      expect(result.code).toBe(200);
      expect(result.data).toBeNull();
    });
  });

  describe('getRoleUsers', () => {
    it('应该返回角色下的所有用户', async () => {
      const mockUsers = [{ id: 'user-1', username: 'testuser' }];
      mockRoleService.getRoleUsers.mockResolvedValue(mockUsers);

      const result = await controller.getRoleUsers('role-1');

      expect(mockRoleService.getRoleUsers).toHaveBeenCalledWith('role-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockUsers);
    });
  });

  describe('getRoleUserIds', () => {
    it('应该返回角色下的所有用户ID', async () => {
      const mockUserIds = ['user-1', 'user-2'];
      mockRoleService.getRoleUserIds.mockResolvedValue(mockUserIds);

      const result = await controller.getRoleUserIds('role-1');

      expect(mockRoleService.getRoleUserIds).toHaveBeenCalledWith('role-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockUserIds);
    });
  });

  describe('count', () => {
    it('应该返回角色数量', async () => {
      mockRoleService.count.mockResolvedValue(10);

      const result = await controller.count({ status: 'active' });

      expect(mockRoleService.count).toHaveBeenCalledWith({ status: 'active' });
      expect(result.code).toBe(200);
      expect(result.data.count).toBe(10);
    });

    it('应该处理空查询参数', async () => {
      mockRoleService.count.mockResolvedValue(5);

      const result = await controller.count({});

      expect(mockRoleService.count).toHaveBeenCalledWith({});
      expect(result.data.count).toBe(5);
    });
  });
});
