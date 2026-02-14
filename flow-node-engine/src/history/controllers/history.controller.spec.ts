import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HistoryController } from './history.controller';
import { HistoryService } from '../services/history.service';

describe('HistoryController', () => {
  let controller: HistoryController;
  let historyService: ReturnType<typeof mockHistoryService>;

  // Mock HistoryService
  const mockHistoryService = {
    findHistoricActivityInstances: vi.fn(),
    findHistoricActivityInstanceById: vi.fn(),
    findHistoricActivityInstancesByProcessInstanceId: vi.fn(),
    findHistoricTaskInstances: vi.fn(),
    findHistoricTaskInstanceById: vi.fn(),
    findHistoricTaskInstancesByProcessInstanceId: vi.fn(),
    findHistoricTaskInstancesByAssignee: vi.fn(),
    findHistoricProcessInstances: vi.fn(),
    findHistoricProcessInstanceById: vi.fn(),
    findHistoricProcessInstanceByProcessInstanceId: vi.fn(),
    findHistoricProcessInstancesByBusinessKey: vi.fn(),
    getProcessInstanceHistory: vi.fn(),
    deleteHistoricProcessInstance: vi.fn(),
    deleteHistoricTaskInstance: vi.fn(),
    deleteHistoricActivityInstance: vi.fn(),
  };

  // Mock data
  const mockActivity = {
    id: 'activity-1',
    processInstanceId: 'process-1',
    activityId: 'task-1',
    activityName: '审批任务',
    activityType: 'userTask',
    startTime: new Date('2024-01-01T00:00:00Z'),
    endTime: new Date('2024-01-01T01:00:00Z'),
    durationInMillis: 3600000,
    assignee: 'user-1',
  };

  const mockTask = {
    id: 'task-1',
    processInstanceId: 'process-1',
    taskDefinitionKey: 'task_def_1',
    name: '审批任务',
    assignee: 'user-1',
    startTime: new Date('2024-01-01T00:00:00Z'),
    endTime: new Date('2024-01-01T01:00:00Z'),
    claimTime: new Date('2024-01-01T00:10:00Z'),
    durationInMillis: 3600000,
  };

  const mockProcess = {
    id: 'process-1',
    processDefinitionId: 'proc-def-1',
    processDefinitionKey: 'leave-process',
    processDefinitionName: '请假流程',
    businessKey: 'LEAVE-2024-001',
    startTime: new Date('2024-01-01T00:00:00Z'),
    endTime: new Date('2024-01-01T02:00:00Z'),
    durationInMillis: 7200000,
    startUserId: 'user-1',
    status: 'completed',
  };

  const mockFullHistory = {
    processInstance: mockProcess,
    activities: [mockActivity],
    tasks: [mockTask],
    variables: [{ name: 'days', value: 3 }],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HistoryController],
      providers: [
        {
          provide: HistoryService,
          useValue: mockHistoryService,
        },
      ],
    }).compile();

    controller = module.get<HistoryController>(HistoryController);
    historyService = mockHistoryService;
  });

  // ==================== 历史活动实例测试 ====================

  describe('findHistoricActivityInstances', () => {
    it('应该成功查询历史活动实例列表', async () => {
      const query = { page: 1, pageSize: 10 };
      const serviceResult = {
        activities: [mockActivity],
        total: 1,
      };

      historyService.findHistoricActivityInstances.mockResolvedValue(serviceResult);

      const result = await controller.findHistoricActivityInstances(query);

      expect(historyService.findHistoricActivityInstances).toHaveBeenCalledWith(query);
      expect(result.code).toBe(200);
      expect(result.message).toBe('查询成功');
      expect(result.data).toEqual([mockActivity]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('应该使用默认分页参数', async () => {
      const query = {};
      const serviceResult = {
        activities: [],
        total: 0,
      };

      historyService.findHistoricActivityInstances.mockResolvedValue(serviceResult);

      const result = await controller.findHistoricActivityInstances(query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('应该支持按流程实例ID筛选', async () => {
      const query = { processInstanceId: 'process-1' };
      const serviceResult = {
        activities: [mockActivity],
        total: 1,
      };

      historyService.findHistoricActivityInstances.mockResolvedValue(serviceResult);

      const result = await controller.findHistoricActivityInstances(query);

      expect(historyService.findHistoricActivityInstances).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findHistoricActivityInstanceById', () => {
    it('应该成功获取历史活动实例详情', async () => {
      historyService.findHistoricActivityInstanceById.mockResolvedValue(mockActivity);

      const result = await controller.findHistoricActivityInstanceById('activity-1');

      expect(historyService.findHistoricActivityInstanceById).toHaveBeenCalledWith('activity-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockActivity);
    });

    it('活动不存在时应该返回null', async () => {
      historyService.findHistoricActivityInstanceById.mockResolvedValue(null);

      const result = await controller.findHistoricActivityInstanceById('non-existent');

      expect(result.code).toBe(200);
      expect(result.data).toBeNull();
    });
  });

  describe('findHistoricActivityInstancesByProcessInstanceId', () => {
    it('应该成功按流程实例ID查询活动', async () => {
      historyService.findHistoricActivityInstancesByProcessInstanceId.mockResolvedValue([mockActivity]);

      const result = await controller.findHistoricActivityInstancesByProcessInstanceId('process-1');

      expect(historyService.findHistoricActivityInstancesByProcessInstanceId).toHaveBeenCalledWith('process-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockActivity]);
    });

    it('流程实例无活动时应该返回空数组', async () => {
      historyService.findHistoricActivityInstancesByProcessInstanceId.mockResolvedValue([]);

      const result = await controller.findHistoricActivityInstancesByProcessInstanceId('empty-process');

      expect(result.data).toEqual([]);
    });
  });

  // ==================== 历史任务实例测试 ====================

  describe('findHistoricTaskInstances', () => {
    it('应该成功查询历史任务实例列表', async () => {
      const query = { page: 1, pageSize: 10 };
      const serviceResult = {
        tasks: [mockTask],
        total: 1,
      };

      historyService.findHistoricTaskInstances.mockResolvedValue(serviceResult);

      const result = await controller.findHistoricTaskInstances(query);

      expect(historyService.findHistoricTaskInstances).toHaveBeenCalledWith(query);
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockTask]);
      expect(result.total).toBe(1);
    });

    it('应该支持按任务负责人筛选', async () => {
      const query = { assignee: 'user-1' };
      const serviceResult = {
        tasks: [mockTask],
        total: 1,
      };

      historyService.findHistoricTaskInstances.mockResolvedValue(serviceResult);

      const result = await controller.findHistoricTaskInstances(query);

      expect(historyService.findHistoricTaskInstances).toHaveBeenCalledWith(query);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findHistoricTaskInstanceById', () => {
    it('应该成功获取历史任务实例详情', async () => {
      historyService.findHistoricTaskInstanceById.mockResolvedValue(mockTask);

      const result = await controller.findHistoricTaskInstanceById('task-1');

      expect(historyService.findHistoricTaskInstanceById).toHaveBeenCalledWith('task-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockTask);
    });

    it('任务不存在时应该返回null', async () => {
      historyService.findHistoricTaskInstanceById.mockResolvedValue(null);

      const result = await controller.findHistoricTaskInstanceById('non-existent');

      expect(result.data).toBeNull();
    });
  });

  describe('findHistoricTaskInstancesByProcessInstanceId', () => {
    it('应该成功按流程实例ID查询任务', async () => {
      historyService.findHistoricTaskInstancesByProcessInstanceId.mockResolvedValue([mockTask]);

      const result = await controller.findHistoricTaskInstancesByProcessInstanceId('process-1');

      expect(historyService.findHistoricTaskInstancesByProcessInstanceId).toHaveBeenCalledWith('process-1');
      expect(result.data).toEqual([mockTask]);
    });
  });

  describe('findHistoricTaskInstancesByAssignee', () => {
    it('应该成功按负责人查询任务', async () => {
      historyService.findHistoricTaskInstancesByAssignee.mockResolvedValue([mockTask]);

      const result = await controller.findHistoricTaskInstancesByAssignee('user-1');

      expect(historyService.findHistoricTaskInstancesByAssignee).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockTask]);
    });

    it('负责人无任务时应该返回空数组', async () => {
      historyService.findHistoricTaskInstancesByAssignee.mockResolvedValue([]);

      const result = await controller.findHistoricTaskInstancesByAssignee('no-tasks-user');

      expect(result.data).toEqual([]);
    });
  });

  // ==================== 历史流程实例测试 ====================

  describe('findHistoricProcessInstances', () => {
    it('应该成功查询历史流程实例列表', async () => {
      const query = { page: 1, pageSize: 10 };
      const serviceResult = {
        processes: [mockProcess],
        total: 1,
      };

      historyService.findHistoricProcessInstances.mockResolvedValue(serviceResult);

      const result = await controller.findHistoricProcessInstances(query);

      expect(historyService.findHistoricProcessInstances).toHaveBeenCalledWith(query);
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockProcess]);
      expect(result.total).toBe(1);
    });

    it('应该支持按状态筛选', async () => {
      const query = { status: 'completed' };
      const serviceResult = {
        processes: [mockProcess],
        total: 1,
      };

      historyService.findHistoricProcessInstances.mockResolvedValue(serviceResult);

      const result = await controller.findHistoricProcessInstances(query);

      expect(historyService.findHistoricProcessInstances).toHaveBeenCalledWith(query);
    });
  });

  describe('findHistoricProcessInstanceById', () => {
    it('应该成功获取历史流程实例详情', async () => {
      historyService.findHistoricProcessInstanceById.mockResolvedValue(mockProcess);

      const result = await controller.findHistoricProcessInstanceById('process-1');

      expect(historyService.findHistoricProcessInstanceById).toHaveBeenCalledWith('process-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockProcess);
    });

    it('流程不存在时应该返回null', async () => {
      historyService.findHistoricProcessInstanceById.mockResolvedValue(null);

      const result = await controller.findHistoricProcessInstanceById('non-existent');

      expect(result.data).toBeNull();
    });
  });

  describe('findHistoricProcessInstanceByProcessInstanceId', () => {
    it('应该成功按流程实例ID查询历史流程', async () => {
      historyService.findHistoricProcessInstanceByProcessInstanceId.mockResolvedValue(mockProcess);

      const result = await controller.findHistoricProcessInstanceByProcessInstanceId('process-1');

      expect(historyService.findHistoricProcessInstanceByProcessInstanceId).toHaveBeenCalledWith('process-1');
      expect(result.data).toEqual(mockProcess);
    });
  });

  describe('findHistoricProcessInstancesByBusinessKey', () => {
    it('应该成功按业务Key查询流程', async () => {
      historyService.findHistoricProcessInstancesByBusinessKey.mockResolvedValue([mockProcess]);

      const result = await controller.findHistoricProcessInstancesByBusinessKey('LEAVE-2024-001');

      expect(historyService.findHistoricProcessInstancesByBusinessKey).toHaveBeenCalledWith('LEAVE-2024-001');
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockProcess]);
    });

    it('业务Key不存在时应该返回空数组', async () => {
      historyService.findHistoricProcessInstancesByBusinessKey.mockResolvedValue([]);

      const result = await controller.findHistoricProcessInstancesByBusinessKey('NON-EXISTENT');

      expect(result.data).toEqual([]);
    });
  });

  // ==================== 完整历史查询测试 ====================

  describe('getProcessInstanceHistory', () => {
    it('应该成功获取流程实例完整历史', async () => {
      historyService.getProcessInstanceHistory.mockResolvedValue(mockFullHistory);

      const result = await controller.getProcessInstanceHistory('process-1');

      expect(historyService.getProcessInstanceHistory).toHaveBeenCalledWith('process-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockFullHistory);
    });

    it('应该返回包含所有历史数据的完整对象', async () => {
      historyService.getProcessInstanceHistory.mockResolvedValue(mockFullHistory);

      const result = await controller.getProcessInstanceHistory('process-1');

      expect(result.data.processInstance).toBeDefined();
      expect(result.data.activities).toBeDefined();
      expect(result.data.tasks).toBeDefined();
      expect(result.data.variables).toBeDefined();
    });
  });

  // ==================== 删除操作测试 ====================

  describe('deleteHistoricProcessInstance', () => {
    it('应该成功删除历史流程实例', async () => {
      historyService.deleteHistoricProcessInstance.mockResolvedValue(undefined);

      const result = await controller.deleteHistoricProcessInstance('process-1');

      expect(historyService.deleteHistoricProcessInstance).toHaveBeenCalledWith('process-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
    });
  });

  describe('deleteHistoricTaskInstance', () => {
    it('应该成功删除历史任务实例', async () => {
      historyService.deleteHistoricTaskInstance.mockResolvedValue(undefined);

      const result = await controller.deleteHistoricTaskInstance('task-1');

      expect(historyService.deleteHistoricTaskInstance).toHaveBeenCalledWith('task-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
    });
  });

  describe('deleteHistoricActivityInstance', () => {
    it('应该成功删除历史活动实例', async () => {
      historyService.deleteHistoricActivityInstance.mockResolvedValue(undefined);

      const result = await controller.deleteHistoricActivityInstance('activity-1');

      expect(historyService.deleteHistoricActivityInstance).toHaveBeenCalledWith('activity-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
    });
  });

  // ==================== 边界条件测试 ====================

  describe('边界条件测试', () => {
    it('查询活动时应该处理大页码', async () => {
      const query = { page: 1000, pageSize: 10 };
      const serviceResult = {
        activities: [],
        total: 5,
      };

      historyService.findHistoricActivityInstances.mockResolvedValue(serviceResult);

      const result = await controller.findHistoricActivityInstances(query);

      expect(result.page).toBe(1000);
      expect(result.data).toHaveLength(0);
    });

    it('查询任务时应该处理空查询对象', async () => {
      const serviceResult = {
        tasks: [],
        total: 0,
      };

      historyService.findHistoricTaskInstances.mockResolvedValue(serviceResult);

      const result = await controller.findHistoricTaskInstances({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('应该处理无效的ID格式', async () => {
      historyService.findHistoricActivityInstanceById.mockResolvedValue(null);

      const result = await controller.findHistoricActivityInstanceById('');

      expect(result.data).toBeNull();
    });

    it('删除时应该传递正确的ID', async () => {
      historyService.deleteHistoricProcessInstance.mockResolvedValue(undefined);

      await controller.deleteHistoricProcessInstance('process-to-delete');

      expect(historyService.deleteHistoricProcessInstance).toHaveBeenCalledWith('process-to-delete');
    });
  });

  // ==================== 并发场景测试 ====================

  describe('并发场景测试', () => {
    it('应该支持同时查询多个历史任务', async () => {
      const task1 = { ...mockTask, id: 'task-1' };
      const task2 = { ...mockTask, id: 'task-2' };

      historyService.findHistoricTaskInstanceById.mockImplementation((id) => {
        if (id === 'task-1') return Promise.resolve(task1);
        if (id === 'task-2') return Promise.resolve(task2);
        return Promise.resolve(null);
      });

      const [result1, result2] = await Promise.all([
        controller.findHistoricTaskInstanceById('task-1'),
        controller.findHistoricTaskInstanceById('task-2'),
      ]);

      expect(result1.data.id).toBe('task-1');
      expect(result2.data.id).toBe('task-2');
    });

    it('应该支持同时查询多种历史数据', async () => {
      historyService.findHistoricActivityInstances.mockResolvedValue({ activities: [mockActivity], total: 1 });
      historyService.findHistoricTaskInstances.mockResolvedValue({ tasks: [mockTask], total: 1 });
      historyService.findHistoricProcessInstances.mockResolvedValue({ processes: [mockProcess], total: 1 });

      const [activities, tasks, processes] = await Promise.all([
        controller.findHistoricActivityInstances({}),
        controller.findHistoricTaskInstances({}),
        controller.findHistoricProcessInstances({}),
      ]);

      expect(activities.code).toBe(200);
      expect(tasks.code).toBe(200);
      expect(processes.code).toBe(200);
    });
  });

  // ==================== 数据完整性测试 ====================

  describe('数据完整性测试', () => {
    it('完整历史应该包含流程实例信息', async () => {
      historyService.getProcessInstanceHistory.mockResolvedValue(mockFullHistory);

      const result = await controller.getProcessInstanceHistory('process-1');

      expect(result.data.processInstance.id).toBe('process-1');
      expect(result.data.processInstance.businessKey).toBe('LEAVE-2024-001');
    });

    it('完整历史应该包含活动列表', async () => {
      historyService.getProcessInstanceHistory.mockResolvedValue(mockFullHistory);

      const result = await controller.getProcessInstanceHistory('process-1');

      expect(Array.isArray(result.data.activities)).toBe(true);
      expect(result.data.activities[0].activityType).toBe('userTask');
    });

    it('完整历史应该包含任务列表', async () => {
      historyService.getProcessInstanceHistory.mockResolvedValue(mockFullHistory);

      const result = await controller.getProcessInstanceHistory('process-1');

      expect(Array.isArray(result.data.tasks)).toBe(true);
      expect(result.data.tasks[0].assignee).toBe('user-1');
    });
  });
});
