/**
 * IdentityLinkService 单元测试
 * 测试身份链接服务的核心功能
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Repository, In } from 'typeorm';
import { vi, describe, it, expect, beforeEach, afterEach, Mocked } from 'vitest';

import {
  HistoricIdentityLinkEntity,
  CreateHistoricIdentityLinkParams,
} from '../entities/historic-identity-link.entity';
import {
  IdentityLinkEntity,
  IdentityLinkType,
  CreateIdentityLinkParams,
} from '../entities/identity-link.entity';
import {
  IdentityLinkService,
  IdentityLinkQueryParams,
} from './identity-link.service';

// Mock 数据
const mockIdentityLink: IdentityLinkEntity = {
  id_: 'link-123',
  type_: 'task',
  user_id_: 'user-123',
  group_id_: null,
  task_id_: 'task-123',
  proc_inst_id_: 'process-123',
  proc_def_id_: 'process-def-123',
  link_type_: IdentityLinkType.CANDIDATE,
  tenant_id_: 'tenant-123',
  create_time_: new Date(),
};

const mockIdentityLinkWithGroup: IdentityLinkEntity = {
  id_: 'link-456',
  type_: 'task',
  user_id_: null,
  group_id_: 'group-123',
  task_id_: 'task-123',
  proc_inst_id_: 'process-123',
  proc_def_id_: 'process-def-123',
  link_type_: IdentityLinkType.CANDIDATE,
  tenant_id_: 'tenant-123',
  create_time_: new Date(),
};

const mockHistoricIdentityLink: HistoricIdentityLinkEntity = {
  id_: 'historic-link-123',
  type_: 'task',
  user_id_: 'user-123',
  group_id_: null,
  task_id_: 'task-123',
  historic_task_id_: 'historic-task-123',
  proc_inst_id_: 'process-123',
  proc_def_id_: 'process-def-123',
  link_type_: IdentityLinkType.PARTICIPANT,
  tenant_id_: 'tenant-123',
  create_time_: new Date(),
};

describe('IdentityLinkService', () => {
  let service: IdentityLinkService;
  let identityLinkRepository: Mocked<Repository<IdentityLinkEntity>>;
  let historicIdentityLinkRepository: Mocked<Repository<HistoricIdentityLinkEntity>>;

  beforeEach(async () => {
    // 创建 mock repositories
    identityLinkRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as any;

    historicIdentityLinkRepository = {
      create: vi.fn(),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityLinkService,
        { provide: 'IdentityLinkEntityRepository', useValue: identityLinkRepository },
        { provide: 'HistoricIdentityLinkEntityRepository', useValue: historicIdentityLinkRepository },
      ],
    })
      .overrideProvider('IdentityLinkEntityRepository')
      .useValue(identityLinkRepository)
      .overrideProvider('HistoricIdentityLinkEntityRepository')
      .useValue(historicIdentityLinkRepository)
      .compile();

    service = module.get<IdentityLinkService>(IdentityLinkService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== 运行时身份链接操作测试 ====================

  describe('createIdentityLink', () => {
    it('应该成功创建身份链接', async () => {
      const params: CreateIdentityLinkParams = {
        type: 'task',
        taskId: 'task-123',
        userId: 'user-123',
        linkType: IdentityLinkType.CANDIDATE,
      };

      identityLinkRepository.save.mockResolvedValue(mockIdentityLink);

      const result = await service.createIdentityLink(params);

      expect(identityLinkRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockIdentityLink);
    });

    it('应该创建组类型的身份链接', async () => {
      const params: CreateIdentityLinkParams = {
        type: 'task',
        taskId: 'task-123',
        groupId: 'group-123',
        linkType: IdentityLinkType.CANDIDATE,
      };

      identityLinkRepository.save.mockResolvedValue(mockIdentityLinkWithGroup);

      const result = await service.createIdentityLink(params);

      expect(result.group_id_).toBe('group-123');
    });

    it('应该使用默认类型创建身份链接', async () => {
      const params: CreateIdentityLinkParams = {
        taskId: 'task-123',
        userId: 'user-123',
        linkType: IdentityLinkType.ASSIGNEE,
      };

      identityLinkRepository.save.mockResolvedValue({
        ...mockIdentityLink,
        link_type_: IdentityLinkType.ASSIGNEE,
      });

      await service.createIdentityLink(params);

      expect(identityLinkRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type_: 'task',
        })
      );
    });
  });

  describe('createIdentityLinks', () => {
    it('应该批量创建身份链接', async () => {
      const paramsList: CreateIdentityLinkParams[] = [
        { taskId: 'task-123', userId: 'user-1', linkType: IdentityLinkType.CANDIDATE },
        { taskId: 'task-123', userId: 'user-2', linkType: IdentityLinkType.CANDIDATE },
      ];

      identityLinkRepository.save.mockResolvedValue([mockIdentityLink, mockIdentityLink] as any);

      const result = await service.createIdentityLinks(paramsList);

      expect(identityLinkRepository.save).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('getIdentityLinkById', () => {
    it('应该返回指定ID的身份链接', async () => {
      identityLinkRepository.findOne.mockResolvedValue(mockIdentityLink);

      const result = await service.getIdentityLinkById('link-123');

      expect(identityLinkRepository.findOne).toHaveBeenCalledWith({
        where: { id_: 'link-123' },
      });
      expect(result).toEqual(mockIdentityLink);
    });

    it('身份链接不存在时应该返回null', async () => {
      identityLinkRepository.findOne.mockResolvedValue(null);

      const result = await service.getIdentityLinkById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('queryIdentityLinks', () => {
    it('应该根据任务ID查询身份链接', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockIdentityLink]),
      };
      identityLinkRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.queryIdentityLinks({ taskId: 'task-123' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'link.task_id_ = :taskId',
        { taskId: 'task-123' }
      );
      expect(result).toHaveLength(1);
    });

    it('应该根据流程实例ID查询身份链接', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockIdentityLink]),
      };
      identityLinkRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryIdentityLinks({ processInstanceId: 'process-123' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'link.proc_inst_id_ = :procInstId',
        { procInstId: 'process-123' }
      );
    });

    it('应该根据用户ID查询身份链接', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockIdentityLink]),
      };
      identityLinkRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryIdentityLinks({ userId: 'user-123' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'link.user_id_ = :userId',
        { userId: 'user-123' }
      );
    });

    it('应该根据链接类型查询身份链接', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockIdentityLink]),
      };
      identityLinkRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.queryIdentityLinks({ linkType: IdentityLinkType.CANDIDATE });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'link.link_type_ = :linkType',
        { linkType: IdentityLinkType.CANDIDATE }
      );
    });
  });

  describe('getCandidateUsersForTask', () => {
    it('应该返回任务的候选人用户列表', async () => {
      identityLinkRepository.find.mockResolvedValue([mockIdentityLink]);

      const result = await service.getCandidateUsersForTask('task-123');

      expect(identityLinkRepository.find).toHaveBeenCalledWith({
        where: {
          task_id_: 'task-123',
          link_type_: IdentityLinkType.CANDIDATE,
        },
      });
      expect(result).toContain('user-123');
    });

    it('没有候选人用户时应该返回空数组', async () => {
      identityLinkRepository.find.mockResolvedValue([mockIdentityLinkWithGroup]);

      const result = await service.getCandidateUsersForTask('task-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getCandidateGroupsForTask', () => {
    it('应该返回任务的候选组列表', async () => {
      identityLinkRepository.find.mockResolvedValue([mockIdentityLinkWithGroup]);

      const result = await service.getCandidateGroupsForTask('task-123');

      expect(identityLinkRepository.find).toHaveBeenCalledWith({
        where: {
          task_id_: 'task-123',
          link_type_: IdentityLinkType.CANDIDATE,
        },
      });
      expect(result).toContain('group-123');
    });

    it('没有候选组时应该返回空数组', async () => {
      identityLinkRepository.find.mockResolvedValue([mockIdentityLink]);

      const result = await service.getCandidateGroupsForTask('task-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getTaskIdsForCandidateUser', () => {
    it('应该返回用户可认领的任务ID列表', async () => {
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockIdentityLink]),
      };
      identityLinkRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.getTaskIdsForCandidateUser('user-123', ['group-123']);

      expect(result).toContain('task-123');
    });
  });

  describe('addCandidateUserToTask', () => {
    it('应该添加任务候选人用户', async () => {
      identityLinkRepository.save.mockResolvedValue(mockIdentityLink);

      const result = await service.addCandidateUserToTask('task-123', 'user-123');

      expect(identityLinkRepository.save).toHaveBeenCalled();
      expect(result.link_type_).toBe(IdentityLinkType.CANDIDATE);
    });
  });

  describe('addCandidateGroupToTask', () => {
    it('应该添加任务候选组', async () => {
      identityLinkRepository.save.mockResolvedValue(mockIdentityLinkWithGroup);

      const result = await service.addCandidateGroupToTask('task-123', 'group-123');

      expect(identityLinkRepository.save).toHaveBeenCalled();
      expect(result.link_type_).toBe(IdentityLinkType.CANDIDATE);
    });
  });

  describe('deleteCandidateUserFromTask', () => {
    it('应该删除任务候选人用户', async () => {
      identityLinkRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteCandidateUserFromTask('task-123', 'user-123');

      expect(identityLinkRepository.delete).toHaveBeenCalledWith({
        task_id_: 'task-123',
        user_id_: 'user-123',
        link_type_: IdentityLinkType.CANDIDATE,
      });
    });
  });

  describe('deleteCandidateGroupFromTask', () => {
    it('应该删除任务候选组', async () => {
      identityLinkRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteCandidateGroupFromTask('task-123', 'group-123');

      expect(identityLinkRepository.delete).toHaveBeenCalledWith({
        task_id_: 'task-123',
        group_id_: 'group-123',
        link_type_: IdentityLinkType.CANDIDATE,
      });
    });
  });

  describe('setTaskAssignee', () => {
    it('应该设置任务受让人', async () => {
      identityLinkRepository.delete.mockResolvedValue({ affected: 0 } as any);
      identityLinkRepository.save.mockResolvedValue({
        ...mockIdentityLink,
        link_type_: IdentityLinkType.ASSIGNEE,
      });

      const result = await service.setTaskAssignee('task-123', 'user-123');

      expect(identityLinkRepository.delete).toHaveBeenCalledWith({
        task_id_: 'task-123',
        link_type_: IdentityLinkType.ASSIGNEE,
      });
      expect(result.link_type_).toBe(IdentityLinkType.ASSIGNEE);
    });

    it('设置新受让人前应该删除现有受让人', async () => {
      identityLinkRepository.delete.mockResolvedValue({ affected: 1 } as any);
      identityLinkRepository.save.mockResolvedValue({
        ...mockIdentityLink,
        link_type_: IdentityLinkType.ASSIGNEE,
      });

      await service.setTaskAssignee('task-123', 'user-456');

      expect(identityLinkRepository.delete).toHaveBeenCalled();
    });
  });

  describe('setTaskOwner', () => {
    it('应该设置任务拥有者', async () => {
      identityLinkRepository.delete.mockResolvedValue({ affected: 0 } as any);
      identityLinkRepository.save.mockResolvedValue({
        ...mockIdentityLink,
        link_type_: IdentityLinkType.OWNER,
      });

      const result = await service.setTaskOwner('task-123', 'user-123');

      expect(identityLinkRepository.delete).toHaveBeenCalledWith({
        task_id_: 'task-123',
        link_type_: IdentityLinkType.OWNER,
      });
      expect(result.link_type_).toBe(IdentityLinkType.OWNER);
    });
  });

  describe('addProcessParticipant', () => {
    it('应该添加流程参与者', async () => {
      identityLinkRepository.save.mockResolvedValue({
        ...mockIdentityLink,
        link_type_: IdentityLinkType.PARTICIPANT,
        task_id_: null,
      });

      const result = await service.addProcessParticipant('process-123', 'user-123');

      expect(result.link_type_).toBe(IdentityLinkType.PARTICIPANT);
    });
  });

  describe('setProcessStarter', () => {
    it('应该设置流程发起人', async () => {
      identityLinkRepository.save.mockResolvedValue({
        ...mockIdentityLink,
        link_type_: IdentityLinkType.STARTER,
        task_id_: null,
      });

      const result = await service.setProcessStarter('process-123', 'user-123');

      expect(result.link_type_).toBe(IdentityLinkType.STARTER);
    });
  });

  describe('deleteIdentityLink', () => {
    it('应该删除身份链接', async () => {
      identityLinkRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteIdentityLink('link-123');

      expect(identityLinkRepository.delete).toHaveBeenCalledWith({ id_: 'link-123' });
    });
  });

  describe('deleteIdentityLinksForTask', () => {
    it('应该删除任务的所有身份链接', async () => {
      identityLinkRepository.delete.mockResolvedValue({ affected: 3 } as any);

      await service.deleteIdentityLinksForTask('task-123');

      expect(identityLinkRepository.delete).toHaveBeenCalledWith({ task_id_: 'task-123' });
    });
  });

  describe('deleteIdentityLinksForProcessInstance', () => {
    it('应该删除流程实例的所有身份链接', async () => {
      identityLinkRepository.delete.mockResolvedValue({ affected: 5 } as any);

      await service.deleteIdentityLinksForProcessInstance('process-123');

      expect(identityLinkRepository.delete).toHaveBeenCalledWith({ proc_inst_id_: 'process-123' });
    });
  });

  // ==================== 历史身份链接操作测试 ====================

  describe('createHistoricIdentityLink', () => {
    it('应该创建历史身份链接', async () => {
      const params: CreateHistoricIdentityLinkParams = {
        taskId: 'task-123',
        userId: 'user-123',
        linkType: IdentityLinkType.PARTICIPANT,
      };

      historicIdentityLinkRepository.save.mockResolvedValue(mockHistoricIdentityLink);

      const result = await service.createHistoricIdentityLink(params);

      expect(historicIdentityLinkRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockHistoricIdentityLink);
    });
  });

  describe('archiveIdentityLinkToHistory', () => {
    it('应该将运行时身份链接归档到历史', async () => {
      historicIdentityLinkRepository.save.mockResolvedValue(mockHistoricIdentityLink);

      const result = await service.archiveIdentityLinkToHistory(mockIdentityLink);

      expect(historicIdentityLinkRepository.save).toHaveBeenCalled();
      expect(result.user_id_).toBe(mockIdentityLink.user_id_);
    });

    it('归档时应该包含历史任务ID', async () => {
      historicIdentityLinkRepository.save.mockResolvedValue({
        ...mockHistoricIdentityLink,
        historic_task_id_: 'historic-task-456',
      });

      const result = await service.archiveIdentityLinkToHistory(
        mockIdentityLink,
        'historic-task-456'
      );

      expect(result.historic_task_id_).toBe('historic-task-456');
    });
  });

  describe('queryHistoricIdentityLinks', () => {
    it('应该查询历史身份链接', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockHistoricIdentityLink]),
      };
      historicIdentityLinkRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.queryHistoricIdentityLinks({
        processInstanceId: 'process-123',
      });

      expect(result).toHaveLength(1);
    });
  });

  describe('getProcessParticipants', () => {
    it('应该返回流程参与者的用户列表', async () => {
      historicIdentityLinkRepository.find.mockResolvedValue([mockHistoricIdentityLink]);

      const result = await service.getProcessParticipants('process-123');

      expect(historicIdentityLinkRepository.find).toHaveBeenCalledWith({
        where: {
          proc_inst_id_: 'process-123',
          link_type_: IdentityLinkType.PARTICIPANT,
        },
      });
      expect(result).toContain('user-123');
    });

    it('没有参与者时应该返回空数组', async () => {
      historicIdentityLinkRepository.find.mockResolvedValue([]);

      const result = await service.getProcessParticipants('process-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getProcessStarter', () => {
    it('应该返回流程发起人', async () => {
      historicIdentityLinkRepository.findOne.mockResolvedValue({
        ...mockHistoricIdentityLink,
        link_type_: IdentityLinkType.STARTER,
      });

      const result = await service.getProcessStarter('process-123');

      expect(historicIdentityLinkRepository.findOne).toHaveBeenCalledWith({
        where: {
          proc_inst_id_: 'process-123',
          link_type_: IdentityLinkType.STARTER,
        },
      });
      expect(result).toBe('user-123');
    });

    it('没有发起人时应该返回null', async () => {
      historicIdentityLinkRepository.findOne.mockResolvedValue(null);

      const result = await service.getProcessStarter('process-123');

      expect(result).toBeNull();
    });
  });

  describe('deleteHistoricIdentityLink', () => {
    it('应该删除历史身份链接', async () => {
      historicIdentityLinkRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteHistoricIdentityLink('historic-link-123');

      expect(historicIdentityLinkRepository.delete).toHaveBeenCalledWith({ id_: 'historic-link-123' });
    });
  });

  describe('deleteHistoricIdentityLinksForProcessInstance', () => {
    it('应该删除流程实例的所有历史身份链接', async () => {
      historicIdentityLinkRepository.delete.mockResolvedValue({ affected: 5 } as any);

      await service.deleteHistoricIdentityLinksForProcessInstance('process-123');

      expect(historicIdentityLinkRepository.delete).toHaveBeenCalledWith({
        proc_inst_id_: 'process-123',
      });
    });
  });

  // ==================== 转换方法测试 ====================

  describe('toIdentityLinkInfo', () => {
    it('应该将实体转换为信息对象', () => {
      const result = service.toIdentityLinkInfo(mockIdentityLink);

      expect(result.id).toBe(mockIdentityLink.id_);
      expect(result.userId).toBe(mockIdentityLink.user_id_);
      expect(result.taskId).toBe(mockIdentityLink.task_id_);
      expect(result.linkType).toBe(mockIdentityLink.link_type_);
    });
  });

  describe('toHistoricIdentityLinkInfo', () => {
    it('应该将历史实体转换为信息对象', () => {
      const result = service.toHistoricIdentityLinkInfo(mockHistoricIdentityLink);

      expect(result.id).toBe(mockHistoricIdentityLink.id_);
      expect(result.historicTaskId).toBe(mockHistoricIdentityLink.historic_task_id_);
    });
  });

  // ==================== Controller兼容方法测试 ====================

  describe('create', () => {
    it('应该调用createIdentityLink', async () => {
      identityLinkRepository.save.mockResolvedValue(mockIdentityLink);

      const result = await service.create({
        taskId: 'task-123',
        userId: 'user-123',
        linkType: IdentityLinkType.CANDIDATE,
      });

      expect(result).toEqual(mockIdentityLink);
    });
  });

  describe('batchCreate', () => {
    it('应该调用createIdentityLinks', async () => {
      identityLinkRepository.save.mockResolvedValue([mockIdentityLink] as any);

      const result = await service.batchCreate([
        { taskId: 'task-123', userId: 'user-123', linkType: IdentityLinkType.CANDIDATE },
      ]);

      expect(result).toHaveLength(1);
    });
  });

  describe('query', () => {
    it('应该调用queryIdentityLinks', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([mockIdentityLink]),
      };
      identityLinkRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.query({ taskId: 'task-123' });

      expect(result).toHaveLength(1);
    });
  });

  describe('getTaskCandidates', () => {
    it('应该返回任务候选人（用户和组）', async () => {
      identityLinkRepository.find
        .mockResolvedValueOnce([mockIdentityLink]) // for users
        .mockResolvedValueOnce([mockIdentityLinkWithGroup]); // for groups

      const result = await service.getTaskCandidates('task-123');

      expect(result.users).toContain('user-123');
      expect(result.groups).toContain('group-123');
    });
  });

  describe('checkTaskAccess', () => {
    it('用户是受让人时应该返回true', async () => {
      identityLinkRepository.findOne.mockResolvedValueOnce({
        ...mockIdentityLink,
        link_type_: IdentityLinkType.ASSIGNEE,
      });

      const result = await service.checkTaskAccess('task-123', 'user-123');

      expect(result).toBe(true);
    });

    it('用户是拥有者时应该返回true', async () => {
      identityLinkRepository.findOne
        .mockResolvedValueOnce(null) // assignee check
        .mockResolvedValueOnce({
          ...mockIdentityLink,
          link_type_: IdentityLinkType.OWNER,
        });

      const result = await service.checkTaskAccess('task-123', 'user-123');

      expect(result).toBe(true);
    });

    it('用户是候选人用户时应该返回true', async () => {
      identityLinkRepository.findOne
        .mockResolvedValueOnce(null) // assignee check
        .mockResolvedValueOnce(null) // owner check
        .mockResolvedValueOnce(mockIdentityLink); // candidate user check

      const result = await service.checkTaskAccess('task-123', 'user-123');

      expect(result).toBe(true);
    });

    it('用户是候选组成员时应该返回true', async () => {
      identityLinkRepository.findOne
        .mockResolvedValueOnce(null) // assignee check
        .mockResolvedValueOnce(null) // owner check
        .mockResolvedValueOnce(null) // candidate user check
        .mockResolvedValueOnce(mockIdentityLinkWithGroup); // candidate group check

      const result = await service.checkTaskAccess('task-123', 'user-123', ['group-123']);

      expect(result).toBe(true);
    });

    it('用户没有任何权限时应该返回false', async () => {
      identityLinkRepository.findOne
        .mockResolvedValueOnce(null) // assignee check
        .mockResolvedValueOnce(null) // owner check
        .mockResolvedValueOnce(null); // candidate user check

      const result = await service.checkTaskAccess('task-123', 'user-123');

      expect(result).toBe(false);
    });
  });
});
