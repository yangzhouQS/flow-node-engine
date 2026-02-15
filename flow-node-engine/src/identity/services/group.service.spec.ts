import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { BusinessException } from '../../common/exceptions/business.exception';
import { Group } from '../entities/group.entity';
import { GroupService } from './group.service';
import { IdentityService } from './identity.service';

describe('GroupService', () => {
  let service: GroupService;
  let groupRepository: Repository<Group>;
  let identityService: IdentityService;

  const mockGroup = {
    id: 'group-1',
    name: 'developers',
    code: 'DEV',
    description: 'Developers group',
    parentId: null,
    type: 'department',
    isSystem: false,
    sort: 0,
    tenantId: 'tenant-1',
    users: [],
    createTime: new Date(),
    updateTime: new Date(),
  };

  const mockChildGroup = {
    id: 'group-2',
    name: 'frontend',
    code: 'FE',
    description: 'Frontend team',
    parentId: 'group-1',
    type: 'team',
    isSystem: false,
    sort: 1,
    tenantId: 'tenant-1',
    users: [],
    createTime: new Date(),
    updateTime: new Date(),
  };

  const mockSystemGroup = {
    ...mockGroup,
    id: 'group-system',
    name: 'administrators',
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
    return qb as any as SelectQueryBuilder<Group>;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        {
          provide: getRepositoryToken(Group),
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
            getGroupUserIds: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
    groupRepository = module.get<Repository<Group>>(getRepositoryToken(Group));
    identityService = module.get<IdentityService>(IdentityService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const createDto = {
      name: 'developers',
      code: 'DEV',
      description: 'Developers group',
      type: 'department',
    };

    it('应该成功创建组', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // name check
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // code check
      vi.mocked(groupRepository.create).mockReturnValue(mockGroup as any);
      vi.mocked(groupRepository.save).mockResolvedValue(mockGroup as any);

      const result = await service.create(createDto);

      expect(result).toEqual(mockGroup);
    });

    it('组名已存在时应抛出ConflictException', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any);

      await expect(service.create(createDto)).rejects.toThrow('组名已存在');
    });

    it('组代码已存在时应抛出ConflictException', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // name check
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any); // code check

      await expect(service.create(createDto)).rejects.toThrow('组代码已存在');
    });

    it('没有代码时不应检查代码唯一性', async () => {
      const dtoWithoutCode = {
        name: 'developers',
        description: 'Developers group',
      };

      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null);
      vi.mocked(groupRepository.create).mockReturnValue(mockGroup as any);
      vi.mocked(groupRepository.save).mockResolvedValue(mockGroup as any);

      await service.create(dtoWithoutCode);

      expect(groupRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('指定父组时应验证父组存在', async () => {
      const dtoWithParent = { ...createDto, parentId: 'parent-1' };
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // name check
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // code check
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any); // parent check
      vi.mocked(groupRepository.create).mockReturnValue(mockGroup as any);
      vi.mocked(groupRepository.save).mockResolvedValue(mockGroup as any);

      await service.create(dtoWithParent);

      expect(groupRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'parent-1' },
      });
    });

    it('父组不存在时应抛出NotFoundException', async () => {
      const dtoWithParent = { ...createDto, parentId: 'non-existent' };
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // name check
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // code check
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // parent check

      await expect(service.create(dtoWithParent)).rejects.toThrow(NotFoundException);
      await expect(service.create(dtoWithParent)).rejects.toThrow('父组不存在');
    });

    it('应该使用默认值', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(null);
      vi.mocked(groupRepository.create).mockReturnValue(mockGroup as any);
      vi.mocked(groupRepository.save).mockResolvedValue(mockGroup as any);

      await service.create(createDto);

      expect(groupRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isSystem: false,
          sort: 0,
        })
      );
    });
  });

  describe('findById', () => {
    it('应该返回组及其用户', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);

      const result = await service.findById('group-1');

      expect(result).toEqual(mockGroup);
      expect(groupRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        relations: ['users'],
      });
    });

    it('组不存在时应抛出NotFoundException', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findById('non-existent')).rejects.toThrow('组不存在');
    });
  });

  describe('findByName', () => {
    it('应该根据名称返回组', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);

      const result = await service.findByName('developers');

      expect(result).toEqual(mockGroup);
      expect(groupRepository.findOne).toHaveBeenCalledWith({
        where: { name: 'developers' },
      });
    });

    it('组不存在时应抛出NotFoundException', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(null);

      await expect(service.findByName('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('应该根据代码返回组', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);

      const result = await service.findByCode('DEV');

      expect(result).toEqual(mockGroup);
      expect(groupRepository.findOne).toHaveBeenCalledWith({
        where: { code: 'DEV' },
      });
    });

    it('组不存在时应抛出NotFoundException', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(null);

      await expect(service.findByCode('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('应该返回分页组列表', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(2);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockGroup, mockChildGroup] as any[]);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('应该支持名称模糊查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockGroup] as any[]);

      await service.findAll({ name: 'dev' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'group.name LIKE :name',
        { name: '%dev%' }
      );
    });

    it('应该支持代码模糊查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockGroup] as any[]);

      await service.findAll({ code: 'DEV' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'group.code LIKE :code',
        { code: '%DEV%' }
      );
    });

    it('应该支持type精确查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockGroup] as any[]);

      await service.findAll({ type: 'department' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'group.type = :type',
        { type: 'department' }
      );
    });

    it('应该支持parentId查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockChildGroup] as any[]);

      await service.findAll({ parentId: 'group-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'group.parentId = :parentId',
        { parentId: 'group-1' }
      );
    });

    it('应该支持isSystem精确查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockGroup] as any[]);

      await service.findAll({ isSystem: false });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'group.isSystem = :isSystem',
        { isSystem: false }
      );
    });

    it('应该支持租户ID查询', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(1);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([mockGroup] as any[]);

      await service.findAll({ tenantId: 'tenant-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'group.tenantId = :tenantId',
        { tenantId: 'tenant-1' }
      );
    });

    it('应该正确排序', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(0);
      vi.mocked(mockQueryBuilder.getMany).mockResolvedValue([]);

      await service.findAll({});

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('group.sort', 'ASC');
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('group.createTime', 'DESC');
    });
  });

  describe('findChildren', () => {
    it('应该返回指定父组的子组', async () => {
      vi.mocked(groupRepository.find).mockResolvedValue([mockChildGroup] as any[]);

      const result = await service.findChildren('group-1');

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('group-1');
      expect(groupRepository.find).toHaveBeenCalledWith({
        where: { parentId: 'group-1' },
        order: { sort: 'ASC', createTime: 'DESC' },
      });
    });

    it('没有子组时应返回空数组', async () => {
      vi.mocked(groupRepository.find).mockResolvedValue([]);

      const result = await service.findChildren('group-1');

      expect(result).toEqual([]);
    });
  });

  describe('findTree', () => {
    it('应该返回指定父组的树形结构', async () => {
      const grandchildGroup = { ...mockChildGroup, id: 'group-3', parentId: 'group-2' };
      vi.mocked(groupRepository.find)
        .mockResolvedValueOnce([mockChildGroup] as any[]) // children of group-1
        .mockResolvedValueOnce([grandchildGroup] as any[]) // children of group-2
        .mockResolvedValueOnce([]); // children of group-3

      const result = await service.findTree('group-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('group-2');
      expect(result[1].id).toBe('group-3');
    });

    it('不指定父组时应返回顶级组', async () => {
      vi.mocked(groupRepository.find).mockResolvedValue([mockGroup] as any[]);

      const result = await service.findTree();

      expect(result).toHaveLength(1);
      expect(groupRepository.find).toHaveBeenCalledWith({
        where: { parentId: null as any },
        order: { sort: 'ASC', createTime: 'DESC' },
      });
    });
  });

  describe('update', () => {
    const updateDto = {
      description: 'Updated description',
    };

    it('应该成功更新组', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);
      vi.mocked(groupRepository.save).mockResolvedValue({ ...mockGroup, ...updateDto } as any);

      const result = await service.update('group-1', updateDto);

      expect(result.description).toBe('Updated description');
    });

    it('组不存在时应抛出NotFoundException', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('系统组不允许修改', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockSystemGroup as any);

      await expect(service.update('group-system', updateDto)).rejects.toThrow(BusinessException);
      await expect(service.update('group-system', updateDto)).rejects.toThrow('系统组不允许修改');
    });

    it('更新名称时检查唯一性', async () => {
      const dtoWithName = { name: 'newname' };
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any); // findById
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // name uniqueness check
      vi.mocked(groupRepository.save).mockResolvedValue(mockGroup as any);

      await service.update('group-1', dtoWithName);

      expect(groupRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('更新名称已被使用时应抛出ConflictException', async () => {
      const dtoWithName = { name: 'existingname' };
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any); // findById
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce({ id: 'other-group' } as any); // name exists

      await expect(service.update('group-1', dtoWithName)).rejects.toThrow('组名已存在');
    });

    it('更新代码时检查唯一性', async () => {
      const dtoWithCode = { code: 'NEWCODE' };
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any); // findById
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // code uniqueness check
      vi.mocked(groupRepository.save).mockResolvedValue(mockGroup as any);

      await service.update('group-1', dtoWithCode);

      expect(groupRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('更新代码已被使用时应抛出ConflictException', async () => {
      const dtoWithCode = { code: 'EXISTING' };
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any); // findById
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce({ id: 'other-group' } as any); // code exists

      await expect(service.update('group-1', dtoWithCode)).rejects.toThrow('组代码已存在');
    });

    it('更新父组时应验证父组存在', async () => {
      const dtoWithParent = { parentId: 'new-parent' };
      const parentGroup = { ...mockGroup, id: 'new-parent' };
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any); // findById
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(parentGroup as any); // parent check
      vi.mocked(groupRepository.save).mockResolvedValue(mockGroup as any);

      await service.update('group-1', dtoWithParent);

      // 验证父组存在性被检查
      expect(groupRepository.findOne).toHaveBeenCalled();
    });

    it('新父组不存在时应抛出NotFoundException', async () => {
      const dtoWithParent = { parentId: 'non-existent' };
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any); // findById
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(null); // parent check

      await expect(service.update('group-1', dtoWithParent)).rejects.toThrow('父组不存在');
    });

    it('不能将组设置为自己的子组', async () => {
      const dtoWithSelfParent = { parentId: 'group-1' };
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);

      await expect(service.update('group-1', dtoWithSelfParent)).rejects.toThrow(BusinessException);
      await expect(service.update('group-1', dtoWithSelfParent)).rejects.toThrow('不能将组设置为自己的子组');
    });

    it('名称相同时不检查唯一性', async () => {
      const dtoWithSameName = { name: 'developers' };
      vi.mocked(groupRepository.findOne).mockResolvedValueOnce(mockGroup as any);
      vi.mocked(groupRepository.save).mockResolvedValue(mockGroup as any);

      await service.update('group-1', dtoWithSameName);

      expect(groupRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('应该成功删除组', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);
      vi.mocked(groupRepository.find).mockResolvedValue([]); // no children
      vi.mocked(groupRepository.remove).mockResolvedValue(mockGroup as any);

      await service.delete('group-1');

      expect(groupRepository.remove).toHaveBeenCalledWith(mockGroup);
    });

    it('组不存在时应抛出NotFoundException', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('系统组不允许删除', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockSystemGroup as any);

      await expect(service.delete('group-system')).rejects.toThrow(BusinessException);
      await expect(service.delete('group-system')).rejects.toThrow('系统组不允许删除');
    });

    it('有子组时不允许删除', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);
      vi.mocked(groupRepository.find).mockResolvedValue([mockChildGroup] as any[]);

      await expect(service.delete('group-1')).rejects.toThrow(BusinessException);
      await expect(service.delete('group-1')).rejects.toThrow('该组下有子组，无法删除');
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除组', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockGroup as any);
      vi.mocked(groupRepository.find).mockResolvedValue([]);
      vi.mocked(groupRepository.remove).mockResolvedValue(mockGroup as any);

      await service.deleteMany(['group-1', 'group-2']);

      expect(groupRepository.remove).toHaveBeenCalledTimes(2);
    });

    it('删除系统组时应抛出异常', async () => {
      vi.mocked(groupRepository.findOne).mockResolvedValue(mockSystemGroup as any);

      await expect(service.deleteMany(['group-system'])).rejects.toThrow(BusinessException);
    });
  });

  describe('getGroupUserIds', () => {
    it('应该返回组内的用户ID列表', async () => {
      vi.mocked(identityService.getGroupUserIds).mockResolvedValue(['user-1', 'user-2']);

      const result = await service.getGroupUserIds('group-1');

      expect(result).toEqual(['user-1', 'user-2']);
    });
  });

  describe('getGroupUsers', () => {
    it('应该返回组内的用户列表', async () => {
      const mockUsers = [{ id: 'user-1', username: 'user1' }];
      vi.mocked(groupRepository.findOne).mockResolvedValue({ ...mockGroup, users: mockUsers } as any);

      const result = await service.getGroupUsers('group-1');

      expect(result).toEqual(mockUsers);
    });
  });

  describe('count', () => {
    it('应该返回组总数', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(50);

      const result = await service.count({});

      expect(result).toBe(50);
    });

    it('应该支持条件统计', async () => {
      const mockQueryBuilder = createMockQueryBuilder();
      vi.mocked(groupRepository.createQueryBuilder).mockReturnValue(mockQueryBuilder);
      vi.mocked(mockQueryBuilder.getCount).mockResolvedValue(25);

      await service.count({ name: 'dev', type: 'department', parentId: 'parent-1', isSystem: false, tenantId: 'tenant-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });
});
