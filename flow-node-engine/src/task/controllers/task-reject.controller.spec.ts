import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RejectType, RejectStrategy, MultiInstanceRejectStrategy } from '../dto/task-reject.dto';
import { TaskRejectService } from '../services/task-reject.service';
import { TaskRejectController } from './task-reject.controller';

describe('TaskRejectController', () => {
  let controller: TaskRejectController;
  let taskRejectService: TaskRejectService;

  const mockTaskRejectService = {
    reject: vi.fn(),
    batchReject: vi.fn(),
    getRejectableNodes: vi.fn(),
    queryRejectRecordsWithPaging: vi.fn(),
    getRejectRecordById: vi.fn(),
    getRejectConfigForTask: vi.fn(),
    handleMultiInstanceReject: vi.fn(),
    checkCanReject: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskRejectController],
      providers: [{ provide: TaskRejectService, useValue: mockTaskRejectService }],
    }).compile();

    controller = module.get<TaskRejectController>(TaskRejectController);
    taskRejectService = module.get<TaskRejectService>(TaskRejectService);
  });

  describe('rejectTask', () => {
    it('应该驳回任务', async () => {
      const dto = {
        reason: '退回修改',
        comment: '请完善信息',
      };
      const mockRecord = {
        id_: 'reject-1',
        task_id_: 'task-1',
        reject_type_: RejectType.ROLLBACK,
        strategy_: RejectStrategy.TO_PREVIOUS,
        reason_: '退回修改',
      };
      mockTaskRejectService.reject.mockResolvedValue(mockRecord);

      const result = await controller.rejectTask('task-1', dto, 'user-1');

      expect(mockTaskRejectService.reject).toHaveBeenCalledWith({
        taskId: 'task-1',
        rejectType: RejectType.ROLLBACK,
        strategy: RejectStrategy.TO_PREVIOUS,
        targetActivityId: undefined,
        reason: '退回修改',
        comment: '请完善信息',
        variables: undefined,
        userId: 'user-1',
        skipListeners: undefined,
      });
      expect(result.id).toBe('reject-1');
    });

    it('应该支持指定目标节点驳回', async () => {
      const dto = {
        rejectType: RejectType.ROLLBACK,
        strategy: RejectStrategy.TO_SPECIFIC,
        targetActivityId: 'activity-1',
        reason: '退回到指定节点',
      };
      const mockRecord = {
        id_: 'reject-1',
        task_id_: 'task-1',
        target_activity_id_: 'activity-1',
      };
      mockTaskRejectService.reject.mockResolvedValue(mockRecord);

      const result = await controller.rejectTask('task-1', dto, 'user-1');

      expect(mockTaskRejectService.reject).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: RejectStrategy.TO_SPECIFIC,
          targetActivityId: 'activity-1',
        }),
      );
      expect(result.targetActivityId).toBe('activity-1');
    });
  });

  describe('batchReject', () => {
    it('应该批量驳回任务', async () => {
      const dto = {
        taskIds: ['task-1', 'task-2'],
        reason: '批量退回',
      };
      const mockRecords = [
        { id_: 'reject-1', task_id_: 'task-1' },
        { id_: 'reject-2', task_id_: 'task-2' },
      ];
      mockTaskRejectService.batchReject.mockResolvedValue(mockRecords);

      const result = await controller.batchReject(dto, 'user-1');

      expect(mockTaskRejectService.batchReject).toHaveBeenCalledWith({
        taskIds: ['task-1', 'task-2'],
        rejectType: RejectType.ROLLBACK,
        reason: '批量退回',
        comment: undefined,
        userId: 'user-1',
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getRejectableNodes', () => {
    it('应该返回可退回的节点列表', async () => {
      const mockNodes = [
        {
          activityId: 'activity-1',
          activityName: '填写申请',
          activityType: 'userTask',
          assignee: 'user-1',
          candidateUsers: [],
          candidateGroups: [],
          createTime: new Date(),
          endTime: null,
        },
        {
          activityId: 'activity-2',
          activityName: '部门审批',
          activityType: 'userTask',
          assignee: 'user-2',
          candidateUsers: [],
          candidateGroups: [],
          createTime: new Date(),
          endTime: new Date(),
        },
      ];
      mockTaskRejectService.getRejectableNodes.mockResolvedValue(mockNodes);

      const result = await controller.getRejectableNodes('task-1');

      expect(mockTaskRejectService.getRejectableNodes).toHaveBeenCalledWith('task-1');
      expect(result).toHaveLength(2);
      expect(result[0].activityId).toBe('activity-1');
    });
  });

  describe('queryRejectRecords', () => {
    it('应该查询驳回记录列表', async () => {
      const query = { taskId: 'task-1', page: '1', pageSize: '10' };
      const mockResult = {
        total: 5,
        list: [
          { id_: 'reject-1', task_id_: 'task-1', reason_: '退回修改' },
          { id_: 'reject-2', task_id_: 'task-1', reason_: '信息不完整' },
        ],
      };
      mockTaskRejectService.queryRejectRecordsWithPaging.mockResolvedValue(mockResult);

      const result = await controller.queryRejectRecords(query);

      expect(mockTaskRejectService.queryRejectRecordsWithPaging).toHaveBeenCalledWith({
        taskId: 'task-1',
        processInstanceId: undefined,
        rejectUserId: undefined,
        rejectType: undefined,
        page: 1,
        pageSize: 10,
      });
      expect(result.total).toBe(5);
      expect(result.list).toHaveLength(2);
    });
  });

  describe('getRejectRecord', () => {
    it('应该返回单条驳回记录详情', async () => {
      const mockRecord = {
        id_: 'reject-1',
        task_id_: 'task-1',
        proc_inst_id_: 'proc-1',
        execution_id_: 'exec-1',
        reject_type_: RejectType.ROLLBACK,
        strategy_: RejectStrategy.TO_PREVIOUS,
        source_activity_id_: 'activity-2',
        target_activity_id_: 'activity-1',
        user_id_: 'user-1',
        reason_: '退回修改',
        comment_: '请完善信息',
        create_time_: new Date(),
      };
      mockTaskRejectService.getRejectRecordById.mockResolvedValue(mockRecord);

      const result = await controller.getRejectRecord('reject-1');

      expect(mockTaskRejectService.getRejectRecordById).toHaveBeenCalledWith('reject-1');
      expect(result.id).toBe('reject-1');
      expect(result.taskId).toBe('task-1');
    });
  });

  describe('getRejectConfig', () => {
    it('应该返回任务的退回策略配置', async () => {
      const mockConfig = {
        processDefinitionId: 'proc-def-1',
        processDefinitionKey: 'test-process',
        activityId: 'activity-2',
        strategy: RejectStrategy.TO_PREVIOUS,
        allowedTargetActivities: ['activity-1'],
        multiInstanceStrategy: MultiInstanceRejectStrategy.ALL_BACK,
        rejectPercentage: 100,
        allowUserChoice: true,
      };
      mockTaskRejectService.getRejectConfigForTask.mockResolvedValue(mockConfig);

      const result = await controller.getRejectConfig('task-1');

      expect(mockTaskRejectService.getRejectConfigForTask).toHaveBeenCalledWith('task-1');
      expect(result.strategy).toBe(RejectStrategy.TO_PREVIOUS);
      expect(result.allowUserChoice).toBe(true);
    });
  });

  describe('multiInstanceReject', () => {
    it('应该处理多实例任务驳回', async () => {
      const dto = {
        strategy: MultiInstanceRejectStrategy.ALL_BACK,
        reason: '多实例退回',
      };
      const mockResult = {
        success: true,
        message: '已退回所有实例',
        shouldReject: true,
      };
      mockTaskRejectService.handleMultiInstanceReject.mockResolvedValue(mockResult);

      const result = await controller.multiInstanceReject('task-1', dto, 'user-1');

      expect(mockTaskRejectService.handleMultiInstanceReject).toHaveBeenCalledWith({
        taskId: 'task-1',
        strategy: MultiInstanceRejectStrategy.ALL_BACK,
        reason: '多实例退回',
        variables: undefined,
        userId: 'user-1',
      });
      expect(result.success).toBe(true);
      expect(result.shouldReject).toBe(true);
    });

    it('应该支持多数人退回策略', async () => {
      const dto = {
        strategy: MultiInstanceRejectStrategy.MAJORITY_BACK,
        reason: '多数人退回',
        variables: { majorityThreshold: 0.6 },
      };
      const mockResult = {
        success: true,
        message: '已达到退回阈值',
        shouldReject: true,
      };
      mockTaskRejectService.handleMultiInstanceReject.mockResolvedValue(mockResult);

      const result = await controller.multiInstanceReject('task-1', dto, 'user-1');

      expect(mockTaskRejectService.handleMultiInstanceReject).toHaveBeenCalledWith({
        taskId: 'task-1',
        strategy: MultiInstanceRejectStrategy.MAJORITY_BACK,
        reason: '多数人退回',
        variables: { majorityThreshold: 0.6 },
        userId: 'user-1',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('canReject', () => {
    it('应该检查任务是否可以驳回', async () => {
      const mockResult = {
        canReject: true,
        strategies: [RejectStrategy.TO_PREVIOUS, RejectStrategy.TO_START],
      };
      mockTaskRejectService.checkCanReject.mockResolvedValue(mockResult);

      const result = await controller.canReject('task-1', 'user-1');

      expect(mockTaskRejectService.checkCanReject).toHaveBeenCalledWith('task-1', 'user-1');
      expect(result.canReject).toBe(true);
      expect(result.strategies).toContain(RejectStrategy.TO_PREVIOUS);
    });

    it('应该返回不可驳回的原因', async () => {
      const mockResult = {
        canReject: false,
        reason: '任务已完成，无法驳回',
      };
      mockTaskRejectService.checkCanReject.mockResolvedValue(mockResult);

      const result = await controller.canReject('task-1', 'user-1');

      expect(result.canReject).toBe(false);
      expect(result.reason).toBe('任务已完成，无法驳回');
    });
  });

  describe('rejectToActivity', () => {
    it('应该退回到指定节点', async () => {
      const mockRecord = {
        id_: 'reject-1',
        task_id_: 'task-1',
        reject_type_: RejectType.ROLLBACK,
        strategy_: RejectStrategy.TO_SPECIFIC,
        target_activity_id_: 'activity-1',
        reason_: '退回到填写申请',
      };
      mockTaskRejectService.reject.mockResolvedValue(mockRecord);

      const result = await controller.rejectToActivity(
        'task-1',
        'activity-1',
        '退回到填写申请',
        { comment: '请修改' },
        'user-1',
      );

      expect(mockTaskRejectService.reject).toHaveBeenCalledWith({
        taskId: 'task-1',
        rejectType: RejectType.ROLLBACK,
        strategy: RejectStrategy.TO_SPECIFIC,
        targetActivityId: 'activity-1',
        reason: '退回到填写申请',
        variables: { comment: '请修改' },
        userId: 'user-1',
      });
      expect(result.targetActivityId).toBe('activity-1');
    });
  });
});
