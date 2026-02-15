import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IdentityLinkService } from '../services/identity-link.service';
import { IdentityLinkController } from './identity-link.controller';

describe('IdentityLinkController', () => {
  let controller: IdentityLinkController;
  let identityLinkService: ReturnType<typeof mockIdentityLinkService>;

  // Mock IdentityLinkService
  const mockIdentityLinkService = {
    create: vi.fn(),
    batchCreate: vi.fn(),
    query: vi.fn(),
    getTaskCandidates: vi.fn(),
    getProcessParticipants: vi.fn(),
    addCandidateUser: vi.fn(),
    deleteCandidateUser: vi.fn(),
    addCandidateGroup: vi.fn(),
    deleteCandidateGroup: vi.fn(),
    setAssignee: vi.fn(),
    setOwner: vi.fn(),
    delete: vi.fn(),
    checkTaskAccess: vi.fn(),
  };

  // Mock data
  const mockLink = {
    id_: 'link-1',
    task_id_: 'task-1',
    proc_inst_id_: 'process-1',
    type_: 'candidate',
    user_id_: 'user-1',
    group_id_: null,
    create_time_: new Date('2024-01-01T00:00:00Z'),
    tenant_id_: 'tenant-1',
  };

  const mockGroupLink = {
    id_: 'link-2',
    task_id_: 'task-1',
    proc_inst_id_: 'process-1',
    type_: 'candidate',
    user_id_: null,
    group_id_: 'group-1',
    create_time_: new Date('2024-01-01T00:00:00Z'),
    tenant_id_: 'tenant-1',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IdentityLinkController],
      providers: [
        {
          provide: IdentityLinkService,
          useValue: mockIdentityLinkService,
        },
      ],
    }).compile();

    controller = module.get<IdentityLinkController>(IdentityLinkController);
    identityLinkService = mockIdentityLinkService;
  });

  describe('create', () => {
    it('应该成功创建身份链接', async () => {
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
        userId: 'user-1',
      };

      identityLinkService.create.mockResolvedValue(mockLink);

      const result = await controller.create(dto);

      expect(identityLinkService.create).toHaveBeenCalledWith({
        taskId: dto.taskId,
        processInstanceId: undefined,
        linkType: dto.type,
        userId: dto.userId,
        groupId: undefined,
      });
      expect(result.id).toBe('link-1');
      expect(result.taskId).toBe('task-1');
      expect(result.type).toBe('candidate');
      expect(result.userId).toBe('user-1');
    });

    it('应该支持创建组链接', async () => {
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
        groupId: 'group-1',
      };

      identityLinkService.create.mockResolvedValue(mockGroupLink);

      const result = await controller.create(dto);

      expect(identityLinkService.create).toHaveBeenCalledWith({
        taskId: dto.taskId,
        processInstanceId: undefined,
        linkType: dto.type,
        userId: undefined,
        groupId: dto.groupId,
      });
      expect(result.groupId).toBe('group-1');
    });

    it('应该支持创建流程实例级别的链接', async () => {
      const dto = {
        processInstanceId: 'process-1',
        type: 'participant',
        userId: 'user-1',
      };

      identityLinkService.create.mockResolvedValue({
        ...mockLink,
        proc_inst_id_: 'process-1',
        type_: 'participant',
      });

      const result = await controller.create(dto);

      expect(identityLinkService.create).toHaveBeenCalledWith({
        taskId: undefined,
        processInstanceId: 'process-1',
        linkType: 'participant',
        userId: 'user-1',
        groupId: undefined,
      });
    });
  });

  describe('batchCreate', () => {
    it('应该批量创建用户链接', async () => {
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
        userIds: ['user-1', 'user-2'],
      };

      const links = [
        { ...mockLink, id_: 'link-1', user_id_: 'user-1' },
        { ...mockLink, id_: 'link-2', user_id_: 'user-2' },
      ];

      identityLinkService.batchCreate.mockResolvedValue(links);

      const result = await controller.batchCreate(dto);

      expect(identityLinkService.batchCreate).toHaveBeenCalledWith([
        { taskId: 'task-1', processInstanceId: undefined, linkType: 'candidate', userId: 'user-1' },
        { taskId: 'task-1', processInstanceId: undefined, linkType: 'candidate', userId: 'user-2' },
      ]);
      expect(result).toHaveLength(2);
    });

    it('应该批量创建组链接', async () => {
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
        groupIds: ['group-1', 'group-2'],
      };

      const links = [
        { ...mockGroupLink, id_: 'link-1', group_id_: 'group-1' },
        { ...mockGroupLink, id_: 'link-2', group_id_: 'group-2' },
      ];

      identityLinkService.batchCreate.mockResolvedValue(links);

      const result = await controller.batchCreate(dto);

      expect(identityLinkService.batchCreate).toHaveBeenCalledWith([
        { taskId: 'task-1', processInstanceId: undefined, linkType: 'candidate', groupId: 'group-1' },
        { taskId: 'task-1', processInstanceId: undefined, linkType: 'candidate', groupId: 'group-2' },
      ]);
      expect(result).toHaveLength(2);
    });

    it('应该同时创建用户和组链接', async () => {
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
        userIds: ['user-1'],
        groupIds: ['group-1'],
      };

      const links = [
        { ...mockLink, id_: 'link-1', user_id_: 'user-1' },
        { ...mockGroupLink, id_: 'link-2', group_id_: 'group-1' },
      ];

      identityLinkService.batchCreate.mockResolvedValue(links);

      const result = await controller.batchCreate(dto);

      expect(result).toHaveLength(2);
    });

    it('空用户和组数组应该返回空结果', async () => {
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
        userIds: [],
        groupIds: [],
      };

      identityLinkService.batchCreate.mockResolvedValue([]);

      const result = await controller.batchCreate(dto);

      expect(identityLinkService.batchCreate).toHaveBeenCalledWith([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('query', () => {
    it('应该成功查询身份链接', async () => {
      const query = { taskId: 'task-1' };
      const links = [mockLink, mockGroupLink];

      identityLinkService.query.mockResolvedValue(links);

      const result = await controller.query(query);

      expect(identityLinkService.query).toHaveBeenCalledWith({
        taskId: 'task-1',
        processInstanceId: undefined,
        linkType: undefined,
        userId: undefined,
        groupId: undefined,
        tenantId: undefined,
      });
      expect(result).toHaveLength(2);
    });

    it('应该支持按用户ID查询', async () => {
      const query = { userId: 'user-1' };

      identityLinkService.query.mockResolvedValue([mockLink]);

      const result = await controller.query(query);

      expect(identityLinkService.query).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(result).toHaveLength(1);
    });

    it('应该支持按组ID查询', async () => {
      const query = { groupId: 'group-1' };

      identityLinkService.query.mockResolvedValue([mockGroupLink]);

      const result = await controller.query(query);

      expect(identityLinkService.query).toHaveBeenCalledWith(
        expect.objectContaining({ groupId: 'group-1' }),
      );
    });
  });

  describe('getTaskCandidates', () => {
    it('应该获取任务的候选人信息', async () => {
      const candidatesResult = {
        users: ['user-1', 'user-2'],
        groups: ['group-1'],
      };

      identityLinkService.getTaskCandidates.mockResolvedValue(candidatesResult);

      const result = await controller.getTaskCandidates('task-1');

      expect(identityLinkService.getTaskCandidates).toHaveBeenCalledWith('task-1');
      expect(result.taskId).toBe('task-1');
      expect(result.candidateUsers).toEqual([{ userId: 'user-1' }, { userId: 'user-2' }]);
      expect(result.candidateGroups).toEqual([{ groupId: 'group-1' }]);
    });

    it('任务无候选人时应该返回空数组', async () => {
      identityLinkService.getTaskCandidates.mockResolvedValue({ users: [], groups: [] });

      const result = await controller.getTaskCandidates('task-1');

      expect(result.candidateUsers).toEqual([]);
      expect(result.candidateGroups).toEqual([]);
    });
  });

  describe('getProcessParticipants', () => {
    it('应该获取流程实例的参与者', async () => {
      identityLinkService.getProcessParticipants.mockResolvedValue(['user-1', 'user-2']);

      const result = await controller.getProcessParticipants('process-1');

      expect(identityLinkService.getProcessParticipants).toHaveBeenCalledWith('process-1');
      expect(result.processInstanceId).toBe('process-1');
      expect(result.participants).toEqual([{ userId: 'user-1' }, { userId: 'user-2' }]);
    });

    it('流程无参与者时应该返回空数组', async () => {
      identityLinkService.getProcessParticipants.mockResolvedValue([]);

      const result = await controller.getProcessParticipants('process-1');

      expect(result.participants).toEqual([]);
    });
  });

  describe('addCandidateUser', () => {
    it('应该添加候选用户', async () => {
      identityLinkService.addCandidateUser.mockResolvedValue(mockLink);

      const result = await controller.addCandidateUser('task-1', 'user-1');

      expect(identityLinkService.addCandidateUser).toHaveBeenCalledWith('task-1', 'user-1');
      expect(result.userId).toBe('user-1');
    });
  });

  describe('deleteCandidateUser', () => {
    it('应该删除候选用户', async () => {
      identityLinkService.deleteCandidateUser.mockResolvedValue(undefined);

      await controller.deleteCandidateUser('task-1', 'user-1');

      expect(identityLinkService.deleteCandidateUser).toHaveBeenCalledWith('task-1', 'user-1');
    });
  });

  describe('addCandidateGroup', () => {
    it('应该添加候选组', async () => {
      identityLinkService.addCandidateGroup.mockResolvedValue(mockGroupLink);

      const result = await controller.addCandidateGroup('task-1', 'group-1');

      expect(identityLinkService.addCandidateGroup).toHaveBeenCalledWith('task-1', 'group-1');
      expect(result.groupId).toBe('group-1');
    });
  });

  describe('deleteCandidateGroup', () => {
    it('应该删除候选组', async () => {
      identityLinkService.deleteCandidateGroup.mockResolvedValue(undefined);

      await controller.deleteCandidateGroup('task-1', 'group-1');

      expect(identityLinkService.deleteCandidateGroup).toHaveBeenCalledWith('task-1', 'group-1');
    });
  });

  describe('setAssignee', () => {
    it('应该设置任务受让人', async () => {
      const assigneeLink = { ...mockLink, type_: 'assignee', user_id_: 'user-1' };
      identityLinkService.setAssignee.mockResolvedValue(assigneeLink);

      const result = await controller.setAssignee('task-1', 'user-1');

      expect(identityLinkService.setAssignee).toHaveBeenCalledWith('task-1', 'user-1');
      expect(result.type).toBe('assignee');
    });
  });

  describe('setOwner', () => {
    it('应该设置任务拥有者', async () => {
      const ownerLink = { ...mockLink, type_: 'owner', user_id_: 'user-1' };
      identityLinkService.setOwner.mockResolvedValue(ownerLink);

      const result = await controller.setOwner('task-1', 'user-1');

      expect(identityLinkService.setOwner).toHaveBeenCalledWith('task-1', 'user-1');
      expect(result.type).toBe('owner');
    });
  });

  describe('delete', () => {
    it('应该删除匹配的身份链接', async () => {
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
        userId: 'user-1',
      };

      identityLinkService.query.mockResolvedValue([mockLink]);
      identityLinkService.delete.mockResolvedValue(undefined);

      await controller.delete(dto);

      expect(identityLinkService.query).toHaveBeenCalledWith({
        taskId: 'task-1',
        processInstanceId: undefined,
        linkType: 'candidate',
        userId: 'user-1',
        groupId: undefined,
      });
      expect(identityLinkService.delete).toHaveBeenCalledWith('link-1');
    });

    it('应该删除多个匹配的链接', async () => {
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
      };

      const links = [
        { ...mockLink, id_: 'link-1' },
        { ...mockLink, id_: 'link-2' },
      ];

      identityLinkService.query.mockResolvedValue(links);
      identityLinkService.delete.mockResolvedValue(undefined);

      await controller.delete(dto);

      expect(identityLinkService.delete).toHaveBeenCalledTimes(2);
    });

    it('无匹配链接时不应该调用删除', async () => {
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
      };

      identityLinkService.query.mockResolvedValue([]);

      await controller.delete(dto);

      expect(identityLinkService.delete).not.toHaveBeenCalled();
    });
  });

  describe('checkTaskAccess', () => {
    it('用户有权限时应该返回true', async () => {
      identityLinkService.checkTaskAccess.mockResolvedValue(true);

      const result = await controller.checkTaskAccess('task-1', 'user-1');

      expect(identityLinkService.checkTaskAccess).toHaveBeenCalledWith('task-1', 'user-1', []);
      expect(result.hasAccess).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('用户无权限时应该返回false', async () => {
      identityLinkService.checkTaskAccess.mockResolvedValue(false);

      const result = await controller.checkTaskAccess('task-1', 'user-1');

      expect(result.hasAccess).toBe(false);
      expect(result.reason).toBe('User does not have access to this task');
    });

    it('应该正确解析组列表', async () => {
      identityLinkService.checkTaskAccess.mockResolvedValue(true);

      const result = await controller.checkTaskAccess('task-1', 'user-1', 'group-1,group-2');

      expect(identityLinkService.checkTaskAccess).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        ['group-1', 'group-2'],
      );
      expect(result.hasAccess).toBe(true);
    });

    it('空组参数应该解析为空数组', async () => {
      identityLinkService.checkTaskAccess.mockResolvedValue(false);

      await controller.checkTaskAccess('task-1', 'user-1', '');

      expect(identityLinkService.checkTaskAccess).toHaveBeenCalledWith('task-1', 'user-1', []);
    });
  });

  describe('toResponseDto', () => {
    it('应该正确转换链接对象', async () => {
      identityLinkService.create.mockResolvedValue(mockLink);

      const result = await controller.create({
        taskId: 'task-1',
        type: 'candidate',
        userId: 'user-1',
      });

      expect(result).toEqual({
        id: 'link-1',
        taskId: 'task-1',
        processInstanceId: 'process-1',
        type: 'candidate',
        userId: 'user-1',
        groupId: null,
        createTime: mockLink.create_time_,
        tenantId: 'tenant-1',
      });
    });
  });

  describe('边界条件测试', () => {
    it('创建时应该处理所有可选字段为空的情况', async () => {
      const dto = { type: 'candidate' };
      identityLinkService.create.mockResolvedValue({
        id_: 'link-1',
        task_id_: null,
        proc_inst_id_: null,
        type_: 'candidate',
        user_id_: null,
        group_id_: null,
        create_time_: new Date(),
        tenant_id_: null,
      });

      const result = await controller.create(dto);

      expect(result.taskId).toBeNull();
      expect(result.processInstanceId).toBeNull();
    });

    it('批量创建时应该处理大量数据', async () => {
      const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);
      const dto = {
        taskId: 'task-1',
        type: 'candidate',
        userIds,
      };

      const links = userIds.map((userId, i) => ({
        ...mockLink,
        id_: `link-${i}`,
        user_id_: userId,
      }));

      identityLinkService.batchCreate.mockResolvedValue(links);

      const result = await controller.batchCreate(dto);

      expect(result).toHaveLength(100);
    });

    it('检查权限时应该处理特殊字符的组名', async () => {
      identityLinkService.checkTaskAccess.mockResolvedValue(true);

      await controller.checkTaskAccess('task-1', 'user-1', 'group-with-dashes,group_with_underscores');

      expect(identityLinkService.checkTaskAccess).toHaveBeenCalledWith(
        'task-1',
        'user-1',
        ['group-with-dashes', 'group_with_underscores'],
      );
    });
  });

  describe('并发场景测试', () => {
    it('应该支持同时添加多个候选用户', async () => {
      identityLinkService.addCandidateUser.mockImplementation((taskId, userId) =>
        Promise.resolve({ ...mockLink, user_id_: userId }),
      );

      const results = await Promise.all([
        controller.addCandidateUser('task-1', 'user-1'),
        controller.addCandidateUser('task-1', 'user-2'),
        controller.addCandidateUser('task-1', 'user-3'),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].userId).toBe('user-1');
      expect(results[1].userId).toBe('user-2');
      expect(results[2].userId).toBe('user-3');
    });
  });
});
