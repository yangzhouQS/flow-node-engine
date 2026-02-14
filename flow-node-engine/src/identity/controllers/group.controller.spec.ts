import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { GroupController } from './group.controller';
import { GroupService } from '../services/group.service';

describe('GroupController', () => {
  let controller: GroupController;
  let groupService: GroupService;

  const mockGroupService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByName: vi.fn(),
    findByCode: vi.fn(),
    findChildren: vi.fn(),
    findTree: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    getGroupUsers: vi.fn(),
    getGroupUserIds: vi.fn(),
    count: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupController],
      providers: [{ provide: GroupService, useValue: mockGroupService }],
    }).compile();

    controller = module.get<GroupController>(GroupController);
    groupService = module.get<GroupService>(GroupService);
  });

  describe('create', () => {
    it('应该创建组', async () => {
      const dto = { name: '开发组', code: 'dev', description: '开发团队' };
      const mockGroup = { id: 'group-1', ...dto };
      mockGroupService.create.mockResolvedValue(mockGroup);

      const result = await controller.create(dto);

      expect(mockGroupService.create).toHaveBeenCalledWith(dto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('创建成功');
      expect(result.data).toEqual(mockGroup);
    });
  });

  describe('findAll', () => {
    it('应该返回组列表', async () => {
      const query = { page: 1, pageSize: 10 };
      const mockResult = {
        data: [{ id: 'group-1', name: '开发组' }],
        total: 1,
      };
      mockGroupService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(query);

      expect(mockGroupService.findAll).toHaveBeenCalledWith(query);
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('findById', () => {
    it('应该根据ID返回组', async () => {
      const mockGroup = { id: 'group-1', name: '开发组' };
      mockGroupService.findById.mockResolvedValue(mockGroup);

      const result = await controller.findById('group-1');

      expect(mockGroupService.findById).toHaveBeenCalledWith('group-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockGroup);
    });

    it('应该处理组不存在的情况', async () => {
      mockGroupService.findById.mockResolvedValue(null);

      const result = await controller.findById('nonexistent');

      expect(result.data).toBeNull();
    });
  });

  describe('findByName', () => {
    it('应该根据名称返回组', async () => {
      const mockGroup = { id: 'group-1', name: '开发组' };
      mockGroupService.findByName.mockResolvedValue(mockGroup);

      const result = await controller.findByName('开发组');

      expect(mockGroupService.findByName).toHaveBeenCalledWith('开发组');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockGroup);
    });
  });

  describe('findByCode', () => {
    it('应该根据代码返回组', async () => {
      const mockGroup = { id: 'group-1', code: 'dev' };
      mockGroupService.findByCode.mockResolvedValue(mockGroup);

      const result = await controller.findByCode('dev');

      expect(mockGroupService.findByCode).toHaveBeenCalledWith('dev');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockGroup);
    });
  });

  describe('findChildren', () => {
    it('应该返回子组列表', async () => {
      const mockChildren = [
        { id: 'group-2', name: '前端组', parentId: 'group-1' },
        { id: 'group-3', name: '后端组', parentId: 'group-1' },
      ];
      mockGroupService.findChildren.mockResolvedValue(mockChildren);

      const result = await controller.findChildren('group-1');

      expect(mockGroupService.findChildren).toHaveBeenCalledWith('group-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockChildren);
    });
  });

  describe('findTree', () => {
    it('应该返回组树结构', async () => {
      const mockTree = [
        {
          id: 'group-1',
          name: '技术部',
          children: [
            { id: 'group-2', name: '前端组' },
            { id: 'group-3', name: '后端组' },
          ],
        },
      ];
      mockGroupService.findTree.mockResolvedValue(mockTree);

      const result = await controller.findTree('group-1');

      expect(mockGroupService.findTree).toHaveBeenCalledWith('group-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockTree);
    });

    it('应该支持不传父级ID参数', async () => {
      const mockTree = [{ id: 'group-1', name: '技术部' }];
      mockGroupService.findTree.mockResolvedValue(mockTree);

      const result = await controller.findTree(undefined);

      expect(mockGroupService.findTree).toHaveBeenCalledWith(undefined);
      expect(result.data).toEqual(mockTree);
    });
  });

  describe('update', () => {
    it('应该更新组', async () => {
      const dto = { description: '新的描述' };
      const mockGroup = { id: 'group-1', description: '新的描述' };
      mockGroupService.update.mockResolvedValue(mockGroup);

      const result = await controller.update('group-1', dto);

      expect(mockGroupService.update).toHaveBeenCalledWith('group-1', dto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('更新成功');
      expect(result.data).toEqual(mockGroup);
    });
  });

  describe('delete', () => {
    it('应该删除组', async () => {
      mockGroupService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('group-1');

      expect(mockGroupService.delete).toHaveBeenCalledWith('group-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
      expect(result.data).toBeNull();
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除组', async () => {
      mockGroupService.deleteMany.mockResolvedValue(undefined);

      const result = await controller.deleteMany({ ids: ['group-1', 'group-2'] });

      expect(mockGroupService.deleteMany).toHaveBeenCalledWith(['group-1', 'group-2']);
      expect(result.code).toBe(200);
      expect(result.data).toBeNull();
    });
  });

  describe('getGroupUsers', () => {
    it('应该返回组下的所有用户', async () => {
      const mockUsers = [{ id: 'user-1', username: 'testuser' }];
      mockGroupService.getGroupUsers.mockResolvedValue(mockUsers);

      const result = await controller.getGroupUsers('group-1');

      expect(mockGroupService.getGroupUsers).toHaveBeenCalledWith('group-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockUsers);
    });
  });

  describe('getGroupUserIds', () => {
    it('应该返回组下的所有用户ID', async () => {
      const mockUserIds = ['user-1', 'user-2'];
      mockGroupService.getGroupUserIds.mockResolvedValue(mockUserIds);

      const result = await controller.getGroupUserIds('group-1');

      expect(mockGroupService.getGroupUserIds).toHaveBeenCalledWith('group-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockUserIds);
    });
  });

  describe('count', () => {
    it('应该返回组数量', async () => {
      mockGroupService.count.mockResolvedValue(15);

      const result = await controller.count({ status: 'active' });

      expect(mockGroupService.count).toHaveBeenCalledWith({ status: 'active' });
      expect(result.code).toBe(200);
      expect(result.data.count).toBe(15);
    });

    it('应该处理空查询参数', async () => {
      mockGroupService.count.mockResolvedValue(8);

      const result = await controller.count({});

      expect(mockGroupService.count).toHaveBeenCalledWith({});
      expect(result.data.count).toBe(8);
    });
  });
});
