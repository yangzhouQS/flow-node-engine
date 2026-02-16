import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskService } from '../services/task.service';
import { TaskController } from './task.controller';

describe('TaskController', () => {
  let controller: TaskController;
  let service: TaskService;

  const mockTask = {
    id: 'task-1',
    name: 'Test Task',
    processInstanceId: 'pi-1',
    assignee: 'user-1',
    state: 'ACTIVE',
    created: new Date(),
    updated: new Date(),
  };

  const mockService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByProcessInstanceId: vi.fn(),
    findByAssignee: vi.fn(),
    update: vi.fn(),
    claim: vi.fn(),
    unclaim: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    delete: vi.fn(),
    getStatistics: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        {
          provide: TaskService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<TaskController>(TaskController);
    service = module.get<TaskService>(TaskService);
  });

  describe('create', () => {
    it('应该成功创建任务', async () => {
      const createDto = {
        name: 'Test Task',
        processInstanceId: 'pi-1',
        assignee: 'user-1',
        taskDefinitionKey: 'task-def-key-1',
        taskDefinitionId: 'task-def-id-1',
        taskDefinitionVersion: 1,
      };

      mockService.create.mockResolvedValue(mockTask);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('任务创建成功');
      expect(result.data).toEqual(mockTask);
    });

    it('应该处理创建失败的情况', async () => {
      const createDto = {
        name: 'Test Task',
        processInstanceId: 'non-existent',
        taskDefinitionKey: 'task-def-key-1',
        taskDefinitionId: 'task-def-id-1',
        taskDefinitionVersion: 1,
      };

      mockService.create.mockRejectedValue(new Error('Process instance not found'));

      await expect(controller.create(createDto)).rejects.toThrow('Process instance not found');
    });
  });

  describe('findAll', () => {
    it('应该返回所有任务', async () => {
      const query = { page: 1, pageSize: 10 };
      mockService.findAll.mockResolvedValue({ tasks: [mockTask], total: 1 });

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockTask]);
      expect(result.total).toBe(1);
    });

    it('应该支持分页查询', async () => {
      const query = { page: 2, pageSize: 20 };
      mockService.findAll.mockResolvedValue({ tasks: [mockTask], total: 50 });

      const result = await controller.findAll(query);

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(50);
    });

    it('应该返回空数组当没有任务', async () => {
      const query = { page: 1, pageSize: 10 };
      mockService.findAll.mockResolvedValue({ tasks: [], total: 0 });

      const result = await controller.findAll(query);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('应该根据ID返回任务', async () => {
      mockService.findById.mockResolvedValue(mockTask);

      const result = await controller.findById('task-1');

      expect(service.findById).toHaveBeenCalledWith('task-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockTask);
    });

    it('应该处理任务不存在的情况', async () => {
      mockService.findById.mockResolvedValue(null);

      const result = await controller.findById('non-existent');

      expect(result.code).toBe(200);
      expect(result.data).toBeNull();
    });
  });

  describe('findByProcessInstanceId', () => {
    it('应该根据流程实例ID返回任务列表', async () => {
      mockService.findByProcessInstanceId.mockResolvedValue([mockTask]);

      const result = await controller.findByProcessInstanceId('pi-1');

      expect(service.findByProcessInstanceId).toHaveBeenCalledWith('pi-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockTask]);
    });

    it('应该返回空数组当流程实例没有任务', async () => {
      mockService.findByProcessInstanceId.mockResolvedValue([]);

      const result = await controller.findByProcessInstanceId('pi-without-tasks');

      expect(result.data).toEqual([]);
    });
  });

  describe('findByAssignee', () => {
    it('应该根据任务负责人返回任务列表', async () => {
      mockService.findByAssignee.mockResolvedValue([mockTask]);

      const result = await controller.findByAssignee('user-1');

      expect(service.findByAssignee).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockTask]);
    });

    it('应该返回空数组当负责人没有任务', async () => {
      mockService.findByAssignee.mockResolvedValue([]);

      const result = await controller.findByAssignee('user-without-tasks');

      expect(result.data).toEqual([]);
    });
  });

  describe('update', () => {
    it('应该成功更新任务', async () => {
      const updateDto = { name: 'Updated Task' };
      const updatedTask = { ...mockTask, name: 'Updated Task' };
      mockService.update.mockResolvedValue(updatedTask);

      const result = await controller.update('task-1', updateDto);

      expect(service.update).toHaveBeenCalledWith('task-1', updateDto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('更新成功');
      expect(result.data).toEqual(updatedTask);
    });

    it('应该处理更新失败的情况', async () => {
      const updateDto = { name: 'Updated Task' };
      mockService.update.mockRejectedValue(new Error('Task not found'));

      await expect(controller.update('non-existent', updateDto)).rejects.toThrow('Task not found');
    });
  });

  describe('claim', () => {
    it('应该成功认领任务', async () => {
      const claimDto = { taskId: 'task-1', userId: 'user-1' };
      const claimedTask = { ...mockTask, assignee: 'user-1' };
      mockService.claim.mockResolvedValue(claimedTask);

      const result = await controller.claim(claimDto);

      expect(service.claim).toHaveBeenCalledWith(claimDto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('认领成功');
      expect(result.data).toEqual(claimedTask);
    });

    it('应该处理认领失败的情况', async () => {
      const claimDto = { taskId: 'task-1', userId: 'user-1' };
      mockService.claim.mockRejectedValue(new Error('Task already claimed'));

      await expect(controller.claim(claimDto)).rejects.toThrow('Task already claimed');
    });
  });

  describe('unclaim', () => {
    it('应该成功取消认领任务', async () => {
      const unclaimedTask = { ...mockTask, assignee: null };
      mockService.unclaim.mockResolvedValue(unclaimedTask);

      const result = await controller.unclaim('task-1');

      expect(service.unclaim).toHaveBeenCalledWith('task-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('取消认领成功');
      expect(result.data).toEqual(unclaimedTask);
    });
  });

  describe('complete', () => {
    it('应该成功完成任务', async () => {
      const completeDto = { taskId: 'task-1', variables: {} };
      const completedTask = { ...mockTask, state: 'COMPLETED' };
      mockService.complete.mockResolvedValue(completedTask);

      const result = await controller.complete(completeDto);

      expect(service.complete).toHaveBeenCalledWith(completeDto);
      expect(result.code).toBe(200);
      expect(result.message).toBe('完成成功');
      expect(result.data).toEqual(completedTask);
    });

    it('应该处理完成失败的情况', async () => {
      const completeDto = { taskId: 'task-1', variables: {} };
      mockService.complete.mockRejectedValue(new Error('Task not found'));

      await expect(controller.complete(completeDto)).rejects.toThrow('Task not found');
    });
  });

  describe('cancel', () => {
    it('应该成功取消任务', async () => {
      const cancelledTask = { ...mockTask, state: 'CANCELLED' };
      mockService.cancel.mockResolvedValue(cancelledTask);

      const result = await controller.cancel('task-1', '不再需要');

      expect(service.cancel).toHaveBeenCalledWith('task-1', '不再需要');
      expect(result.code).toBe(200);
      expect(result.message).toBe('取消成功');
      expect(result.data).toEqual(cancelledTask);
    });

    it('应该处理没有取消原因的情况', async () => {
      const cancelledTask = { ...mockTask, state: 'CANCELLED' };
      mockService.cancel.mockResolvedValue(cancelledTask);

      const result = await controller.cancel('task-1');

      expect(service.cancel).toHaveBeenCalledWith('task-1', undefined);
      expect(result.code).toBe(200);
    });
  });

  describe('delete', () => {
    it('应该成功删除任务', async () => {
      mockService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('task-1');

      expect(service.delete).toHaveBeenCalledWith('task-1');
      expect(result.code).toBe(200);
      expect(result.message).toBe('删除成功');
    });

    it('应该处理删除失败的情况', async () => {
      mockService.delete.mockRejectedValue(new Error('Task not found'));

      await expect(controller.delete('non-existent')).rejects.toThrow('Task not found');
    });
  });

  describe('getStatistics', () => {
    it('应该返回任务统计信息', async () => {
      const statistics = {
        total: 100,
        active: 50,
        completed: 40,
        cancelled: 10,
      };
      mockService.getStatistics.mockResolvedValue(statistics);

      const result = await controller.getStatistics('user-1');

      expect(service.getStatistics).toHaveBeenCalledWith('user-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(statistics);
    });

    it('应该返回全局统计信息当没有指定负责人', async () => {
      const statistics = {
        total: 500,
        active: 200,
        completed: 250,
        cancelled: 50,
      };
      mockService.getStatistics.mockResolvedValue(statistics);

      const result = await controller.getStatistics();

      expect(service.getStatistics).toHaveBeenCalledWith(undefined);
      expect(result.code).toBe(200);
      expect(result.data).toEqual(statistics);
    });
  });

  describe('controller definition', () => {
    it('应该正确定义控制器', () => {
      expect(controller).toBeDefined();
    });

    it('应该注入service', () => {
      expect(service).toBeDefined();
    });
  });
});
