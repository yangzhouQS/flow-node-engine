import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BusinessException } from '../../common/exceptions/business.exception';
import { Role } from '../entities/role.entity';
import { IdentityService } from './identity.service';
import { RoleService } from './role.service';

describe('RoleService', () => {
  let service: RoleService;
  let roleRepository: Repository<Role>;
  let identityService: IdentityService;

  const mockRole = {
    id: 'role-1',
    name: 'admin',
    code: 'ADMIN',
    description: 'Administrator role',
    isSystem: false,
    sort: 0,
    tenantId: 'tenant-1',
    users: [],
    createTime: new Date(),
    updateTime: new Date(),
  };

  const mockSystemRole = {
    ...mockRole,
    id: 'role-system',
    name: 'superadmin',
    isSystem: true,
  };

  const createMockQueryBuilder = () => {
    const qb = {
      andWhere: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      getCount: vi.fn(),
      getMany: vi.fn(),
    };
    return qb as any as SelectQueryBuilder<Role>;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: getRepositoryToken(Role),
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
            getRoleUserIds: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    identityService = module.get<IdentityService>(IdentityService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'manager',
      code: 'MANAGER',
      description: 'Manager role',
      sort: 1,
    };

    it('应该成功创建角色', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(null); // name check
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(null); // code check
      vi.mocked(roleRepository.create).mockReturnValue(mockRole as any);
      vi.mocked(roleRepository.save).mockResolvedValue(mockRole as any);

      const result = await service.create(createDto);

      expect(result).toEqual(mockRole);
    });

    it('角色名已存在时应抛出ConflictException', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(mockRole as any);

      await expect(service.create(createDto)).rejects.toThrow('角色名已存在');
    });

    it('角色代码已存在时应抛出ConflictException', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(null); // name check
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(mockRole as any); // code check

      await expect(service.create(createDto)).rejects.toThrow('角色代码已存在');
    });

    it('没有代码时不应检查代码唯一性', async () => {
      const dtoWithoutCode = {
        name: 'manager',
        description: 'Manager role',
      };

      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(null);
      vi.mocked(roleRepository.create).mockReturnValue(mockRole as any);
      vi.mocked(roleRepository.save).mockResolvedValue(mockRole as any);

      await service.create(dtoWithoutCode);

      expect(roleRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('应该使用默认值', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(null);
      vi.mocked(roleRepository.create).mockReturnValue(mockRole as any);
      vi.mocked(roleRepository.save).mockResolvedValue(mockRole as any);

      await service.create(createDto);

      expect(roleRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystem: false,
          sort: 1,
        })
      );
    });
  });

  describe('findById', () => {
    it('应该返回角色及其用户', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockRole as any);

      const result = await service.findById('role-1');

      expect(result).toEqual(mockRole);
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'role-1' },
        relations: ['users'],
      });
    });

    it('角色不存在时应抛出NotFoundException', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent')).rejects.toThrow('角色不存在');
    });
  });

  describe('findByName', () => {
    it('应该根据名称返回角色', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockRole as any);

      const result = await service.findByName('admin');

      expect(result).toEqual(mockRole);
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'admin' },
      });
    });

    it('角色不存在时应抛出NotFoundException', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(null);

      await expect(service.findByName('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('应该根据代码返回角色', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockRole as any);

      const result = await service.findByCode('ADMIN');

      expect(result).toEqual(mockRole);
      expect(roleRepository.findOne).toHaveBeenCalledWith({
        where: { code: 'ADMIN' },
      });
    });

    it('角色不存在时应抛出NotFoundException', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(null);

      await expect(service.findByCode('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('应该返回分页角色列表', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(roleRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(2);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockRole, { ...mockRole, id: 'role-2' }] as any[]);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('应该支持名称模糊查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(roleRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockRole] as any[]);

      await service.findAll({ name: 'admin' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'role.name LIKE :name',
        { name: '%admin%' }
      );
    });

    it('应该支持代码模糊查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(roleRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockRole] as any[]);

      await service.findAll({ code: 'ADMIN' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'role.code LIKE :code',
        { code: '%ADMIN%' }
      );
    });

    it('应该支持isSystem精确查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(roleRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockRole] as any[]);

      await service.findAll({ isSystem: false });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'role.isSystem = :isSystem',
        { isSystem: false }
      );
    });

    it('应该支持租户ID查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(roleRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockRole] as any[]);

      await service.findAll({ tenantId: 'tenant-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'role.tenantId = :tenantId',
        { tenantId: 'tenant-1' }
      );
    });

    it('应该正确排序', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(roleRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(0);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([]);

      await service.findAll({});

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('role.sort', 'ASC');
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('role.createTime', 'DESC');
    });
  });

  describe('update', () => {
    const updateDto = {
      description: 'Updated description',
    };

    it('应该成功更新角色', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockRole as any);
      vi.mocked(roleRepository.save).mockResolvedValue({ ...mockRole, ...updateDto } as any);

      const result = await service.update('role-1', updateDto);

      expect(result.description).toBe('Updated description');
    });

    it('角色不存在时应抛出NotFoundException', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('系统角色不允许修改', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockSystemRole as any);

      await expect(service.update('role-system', updateDto)).rejects.toThrow(BusinessException);
      await expect(service.update('role-system', updateDto)).rejects.toThrow('系统角色不允许修改');
    });

    it('更新名称时检查唯一性', async () => {
      const dtoWithName = { name: 'newname' };
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(mockRole as any); // findById
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(null); // name uniqueness check
      vi.mocked(roleRepository.save).mockResolvedValue(mockRole as any);

      await service.update('role-1', dtoWithName);

      expect(roleRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('更新名称已被使用时应抛出ConflictException', async () => {
      const dtoWithName = { name: 'existingname' };
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(mockRole as any); // findById
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce({ id: 'other-role' } as any); // name exists

      await expect(service.update('role-1', dtoWithName)).rejects.toThrow('角色名已存在');
    });

    it('更新代码时检查唯一性', async () => {
      const dtoWithCode = { code: 'NEWCODE' };
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(mockRole as any); // findById
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(null); // code uniqueness check
      vi.mocked(roleRepository.save).mockResolvedValue(mockRole as any);

      await service.update('role-1', dtoWithCode);

      expect(roleRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('更新代码已被使用时应抛出ConflictException', async () => {
      const dtoWithCode = { code: 'EXISTING' };
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(mockRole as any); // findById
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce({ id: 'other-role' } as any); // code exists

      await expect(service.update('role-1', dtoWithCode)).rejects.toThrow('角色代码已存在');
    });

    it('名称相同时不检查唯一性', async () => {
      const dtoWithSameName = { name: 'admin' };
      vi.mocked(roleRepository.findOne).mockResolvedValueOnce(mockRole as any);
      vi.mocked(roleRepository.save).mockResolvedValue(mockRole as any);

      await service.update('role-1', dtoWithSameName);

      expect(roleRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('应该成功删除角色', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockRole as any);
      vi.mocked(roleRepository.remove).mockResolvedValue(mockRole as any);

      await service.delete('role-1');

      expect(roleRepository.remove).toHaveBeenCalledWith(mockRole);
    });

    it('角色不存在时应抛出NotFoundException', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('系统角色不允许删除', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockSystemRole as any);

      await expect(service.delete('role-system')).rejects.toThrow(BusinessException);
      await expect(service.delete('role-system')).rejects.toThrow('系统角色不允许删除');
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除角色', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockRole as any);
      vi.mocked(roleRepository.remove).mockResolvedValue(mockRole as any);

      await service.deleteMany(['role-1', 'role-2']);

      expect(roleRepository.remove).toHaveBeenCalledTimes(2);
    });

    it('删除系统角色时应抛出异常', async () => {
      vi.mocked(roleRepository.findOne).mockResolvedValue(mockSystemRole as any);

      await expect(service.deleteMany(['role-system'])).rejects.toThrow(BusinessException);
    });
  });

  describe('getRoleUserIds', () => {
    it('应该返回角色下的用户ID列表', async () => {
      vi.mocked(identityService.getRoleUserIds).mockResolvedValue(['user-1', 'user-2']);

      const result = await service.getRoleUserIds('role-1');

      expect(result).toEqual(['user-1', 'user-2']);
    });
  });

  describe('getRoleUsers', () => {
    it('应该返回角色下的用户列表', async () => {
      const mockUsers = [{ id: 'user-1', username: 'user1' }];
      vi.mocked(roleRepository.findOne).mockResolvedValue({ ...mockRole, users: mockUsers } as any);

      const result = await service.getRoleUsers('role-1');

      expect(result).toEqual(mockUsers);
    });
  });

  describe('count', () => {
    it('应该返回角色总数', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(roleRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(50);

      const result = await service.count({});

      expect(result).toBe(50);
    });

    it('应该支持条件统计', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(roleRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(25);

      await service.count({ name: 'admin', isSystem: false, tenantId: 'tenant-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });
});
