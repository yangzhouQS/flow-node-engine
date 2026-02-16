import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';

import { BusinessException } from '../../common/exceptions/business.exception';
import { EventBusService } from '../../core/services/event-bus.service';
import { ProcessEngineService } from '../../core/services/process-engine.service';
import { Task, TaskStatus } from '../entities/task.entity';
import { TaskService } from './task.service';

describe('TaskService', () => {
  let service: TaskService;
  let taskRepository: Mocked<Repository<Task>>;
  let eventBusService: Mocked<EventBusService>;
  let processEngineService: Mocked<ProcessEngineService>;

  const mockTask: Partial<Task> = {
    id: 'task-123',
    name: 'Test Task',
    description: 'Test task description',
    taskDefinitionKey: 'task-key-1',
    taskDefinitionId: 'task-def-1',
    taskDefinitionVersion: 1,
    processInstanceId: 'pi-123',
    assignee: 'user-1',
    assigneeFullName: 'Test User',
    owner: 'owner-1',
    priority: 1,
    status: TaskStatus.CREATED,
    createTime: new Date(),
    formData: {},
    variables: {},
  };

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
      createQueryBuilder: vi.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useFactory: mockRepo },
        { provide: EventBusService, useValue: { emit: vi.fn() } },
        { provide: ProcessEngineService, useValue: { continueProcess: vi.fn() } },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    taskRepository = module.get(getRepositoryToken(Task));
    eventBusService = module.get(EventBusService);
    processEngineService = module.get(ProcessEngineService);
  });

  describe('create', () => {
    it('应该成功创建任务', async () => {
      const createDto = {
        name: 'New Task',
        taskDefinitionKey: 'task-key-1',
        taskDefinitionId: 'task-def-1',
        taskDefinitionVersion: 1,
        processInstanceId: 'pi-123',
      };
      taskRepository.create.mockReturnValue(mockTask as Task);
      taskRepository.save.mockResolvedValue(mockTask as Task);

      const result = await service.create(createDto as any);

      expect(result).toEqual(mockTask);
      expect(taskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...createDto,
          status: TaskStatus.CREATED,
        })
      );
    });

    it('创建任务后应该发送事件', async () => {
      taskRepository.create.mockReturnValue(mockTask as Task);
      taskRepository.save.mockResolvedValue(mockTask as Task);

      await service.create({} as any);

      expect(eventBusService.emit).toHaveBeenCalledWith('task.created', {
        taskId: mockTask.id,
        processInstanceId: mockTask.processInstanceId,
        taskDefinitionKey: mockTask.taskDefinitionKey,
      });
    });
  });

  describe('findAll', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn(),
      };
      return qb as unknown as Mocked<SelectQueryBuilder<Task>>;
    };

    it('应该返回分页任务列表', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockTask as Task], 1]);
      taskRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.tasks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该支持assignee过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      taskRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll({ assignee: 'user-1', page: 1, pageSize: 10 });

      expect(mockQb.andWhere).toHaveBeenCalledWith('task.assignee = :assignee', { assignee: 'user-1' });
    });

    it('应该支持processInstanceId过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      taskRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll({ processInstanceId: 'pi-123', page: 1, pageSize: 10 });

      expect(mockQb.andWhere).toHaveBeenCalledWith('task.processInstanceId = :processInstanceId', { processInstanceId: 'pi-123' });
    });

    it('应该支持status过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      taskRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll({ status: TaskStatus.ASSIGNED, page: 1, pageSize: 10 });

      expect(mockQb.andWhere).toHaveBeenCalledWith('task.status = :status', { status: TaskStatus.ASSIGNED });
    });

    it('应该支持statusList过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      taskRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll({ statusList: [TaskStatus.ASSIGNED, TaskStatus.CREATED], page: 1, pageSize: 10 });

      expect(mockQb.andWhere).toHaveBeenCalledWith('task.status IN (:...statusList)', {
        statusList: [TaskStatus.ASSIGNED, TaskStatus.CREATED],
      });
    });

    it('应该支持createTime范围过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      taskRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll({
        createTimeStart: '2024-01-01',
        createTimeEnd: '2024-12-31',
        page: 1,
        pageSize: 10,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'task.createTime BETWEEN :createTimeStart AND :createTimeEnd',
        expect.objectContaining({
          createTimeStart: expect.any(Date),
          createTimeEnd: expect.any(Date),
        })
      );
    });

    it('应该正确计算分页偏移量', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      taskRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll({ page: 3, pageSize: 20 });

      expect(mockQb.skip).toHaveBeenCalledWith(40);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });
  });

  describe('findById', () => {
    it('应该返回任务', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask as Task);

      const result = await service.findById('task-123');

      expect(result).toEqual(mockTask);
    });

    it('任务不存在时应抛出NotFoundException', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProcessInstanceId', () => {
    it('应该返回指定流程实例的任务列表', async () => {
      taskRepository.find.mockResolvedValue([mockTask as Task]);

      const result = await service.findByProcessInstanceId('pi-123');

      expect(result).toHaveLength(1);
      expect(taskRepository.find).toHaveBeenCalledWith({ where: { processInstanceId: 'pi-123' } });
    });
  });

  describe('findByAssignee', () => {
    it('应该返回指定负责人的任务列表', async () => {
      taskRepository.find.mockResolvedValue([mockTask as Task]);

      const result = await service.findByAssignee('user-1');

      expect(result).toHaveLength(1);
      expect(taskRepository.find).toHaveBeenCalledWith({ where: { assignee: 'user-1' } });
    });
  });

  describe('update', () => {
    it('应该成功更新任务', async () => {
      const updateableTask = { ...mockTask, status: TaskStatus.CREATED };
      taskRepository.findOne.mockResolvedValue(updateableTask as Task);
      taskRepository.save.mockResolvedValue({ ...updateableTask, name: 'Updated' } as Task);

      const result = await service.update('task-123', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('已完成的任务不能更新', async () => {
      const completedTask = { ...mockTask, status: TaskStatus.COMPLETED };
      taskRepository.findOne.mockResolvedValue(completedTask as Task);

      await expect(service.update('task-123', { name: 'Updated' })).rejects.toThrow(BusinessException);
    });

    it('已取消的任务不能更新', async () => {
      const cancelledTask = { ...mockTask, status: TaskStatus.CANCELLED };
      taskRepository.findOne.mockResolvedValue(cancelledTask as Task);

      await expect(service.update('task-123', { name: 'Updated' })).rejects.toThrow(BusinessException);
    });

    it('更新任务后应该发送事件', async () => {
      const updateableTask = { ...mockTask, status: TaskStatus.CREATED };
      taskRepository.findOne.mockResolvedValue(updateableTask as Task);
      taskRepository.save.mockResolvedValue(updateableTask as Task);

      await service.update('task-123', { name: 'Updated' });

      expect(eventBusService.emit).toHaveBeenCalledWith('task.updated', expect.any(Object));
    });
  });

  describe('claim', () => {
    it('应该成功认领任务', async () => {
      const claimableTask = { ...mockTask, status: TaskStatus.CREATED };
      taskRepository.findOne.mockResolvedValue(claimableTask as Task);
      taskRepository.save.mockResolvedValue({
        ...claimableTask,
        status: TaskStatus.ASSIGNED,
        assignee: 'user-2',
      } as Task);

      const result = await service.claim({ taskId: 'task-123', assignee: 'user-2', assigneeFullName: 'User 2' });

      expect(result.status).toBe(TaskStatus.ASSIGNED);
      expect(result.assignee).toBe('user-2');
    });

    it('已分配的任务不能再次认领', async () => {
      const assignedTask = { ...mockTask, status: TaskStatus.ASSIGNED };
      taskRepository.findOne.mockResolvedValue(assignedTask as Task);

      await expect(service.claim({ taskId: 'task-123', assignee: 'user-2' })).rejects.toThrow(BusinessException);
    });

    it('已完成的任务不能认领', async () => {
      const completedTask = { ...mockTask, status: TaskStatus.COMPLETED };
      taskRepository.findOne.mockResolvedValue(completedTask as Task);

      await expect(service.claim({ taskId: 'task-123', assignee: 'user-2' })).rejects.toThrow(BusinessException);
    });

    it('认领任务后应该发送事件', async () => {
      const claimableTask = { ...mockTask, status: TaskStatus.CREATED };
      taskRepository.findOne.mockResolvedValue(claimableTask as Task);
      taskRepository.save.mockResolvedValue({ ...claimableTask, status: TaskStatus.ASSIGNED } as Task);

      await service.claim({ taskId: 'task-123', assignee: 'user-2' });

      expect(eventBusService.emit).toHaveBeenCalledWith('task.claimed', expect.any(Object));
    });
  });

  describe('unclaim', () => {
    it('应该成功取消认领任务', async () => {
      const assignedTask = { ...mockTask, status: TaskStatus.ASSIGNED, assignee: 'user-1' };
      taskRepository.findOne.mockResolvedValue(assignedTask as Task);
      taskRepository.save.mockResolvedValue({
        ...assignedTask,
        status: TaskStatus.UNASSIGNED,
        assignee: null,
      } as Task);

      const result = await service.unclaim('task-123');

      expect(result.status).toBe(TaskStatus.UNASSIGNED);
      expect(result.assignee).toBeNull();
    });

    it('未分配的任务不能取消认领', async () => {
      const unassignedTask = { ...mockTask, status: TaskStatus.UNASSIGNED };
      taskRepository.findOne.mockResolvedValue(unassignedTask as Task);

      await expect(service.unclaim('task-123')).rejects.toThrow(BusinessException);
    });

    it('取消认领后应该发送事件', async () => {
      const assignedTask = { ...mockTask, status: TaskStatus.ASSIGNED };
      taskRepository.findOne.mockResolvedValue(assignedTask as Task);
      taskRepository.save.mockResolvedValue({ ...assignedTask, status: TaskStatus.UNASSIGNED } as Task);

      await service.unclaim('task-123');

      expect(eventBusService.emit).toHaveBeenCalledWith('task.unclaimed', expect.any(Object));
    });
  });

  describe('complete', () => {
    it('应该成功完成任务', async () => {
      const assignedTask = { ...mockTask, status: TaskStatus.ASSIGNED };
      taskRepository.findOne.mockResolvedValue(assignedTask as Task);
      taskRepository.save.mockResolvedValue({
        ...assignedTask,
        status: TaskStatus.COMPLETED,
        completionTime: new Date(),
      } as Task);

      const result = await service.complete({ taskId: 'task-123', userId: 'user-1' });

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.completionTime).toBeDefined();
    });

    it('未分配的任务不能完成', async () => {
      const unassignedTask = { ...mockTask, status: TaskStatus.UNASSIGNED };
      taskRepository.findOne.mockResolvedValue(unassignedTask as Task);

      await expect(service.complete({ taskId: 'task-123', userId: 'user-1' })).rejects.toThrow(BusinessException);
    });

    it('完成任务后应该发送事件', async () => {
      const assignedTask = { ...mockTask, status: TaskStatus.ASSIGNED };
      taskRepository.findOne.mockResolvedValue(assignedTask as Task);
      taskRepository.save.mockResolvedValue({ ...assignedTask, status: TaskStatus.COMPLETED } as Task);

      await service.complete({ taskId: 'task-123', userId: 'user-1' });

      expect(eventBusService.emit).toHaveBeenCalledWith('task.completed', expect.any(Object));
    });

    it('完成任务后应该继续流程执行', async () => {
      const assignedTask = { ...mockTask, status: TaskStatus.ASSIGNED };
      taskRepository.findOne.mockResolvedValue(assignedTask as Task);
      taskRepository.save.mockResolvedValue({ ...assignedTask, status: TaskStatus.COMPLETED } as Task);

      await service.complete({ taskId: 'task-123', userId: 'user-1' });

      expect(processEngineService.continueProcess).toHaveBeenCalled();
    });

    it('完成任务时应该合并表单数据', async () => {
      const assignedTask = { ...mockTask, status: TaskStatus.ASSIGNED, formData: { field1: 'value1' } };
      taskRepository.findOne.mockResolvedValue(assignedTask as Task);
      taskRepository.save.mockResolvedValue({ ...assignedTask, status: TaskStatus.COMPLETED } as Task);

      await service.complete({ taskId: 'task-123', userId: 'user-1', formData: { field2: 'value2' } });

      expect(taskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: { field1: 'value1', field2: 'value2' },
        })
      );
    });
  });

  describe('cancel', () => {
    it('应该成功取消任务', async () => {
      const activeTask = { ...mockTask, status: TaskStatus.ASSIGNED };
      taskRepository.findOne.mockResolvedValue(activeTask as Task);
      taskRepository.save.mockResolvedValue({
        ...activeTask,
        status: TaskStatus.CANCELLED,
      } as Task);

      const result = await service.cancel('task-123', 'Test reason');

      expect(result.status).toBe(TaskStatus.CANCELLED);
    });

    it('已完成的任务不能取消', async () => {
      const completedTask = { ...mockTask, status: TaskStatus.COMPLETED };
      taskRepository.findOne.mockResolvedValue(completedTask as Task);

      await expect(service.cancel('task-123')).rejects.toThrow(BusinessException);
    });

    it('已取消的任务不能再次取消', async () => {
      const cancelledTask = { ...mockTask, status: TaskStatus.CANCELLED };
      taskRepository.findOne.mockResolvedValue(cancelledTask as Task);

      await expect(service.cancel('task-123')).rejects.toThrow(BusinessException);
    });

    it('取消任务后应该发送事件', async () => {
      const activeTask = { ...mockTask, status: TaskStatus.ASSIGNED };
      taskRepository.findOne.mockResolvedValue(activeTask as Task);
      taskRepository.save.mockResolvedValue({ ...activeTask, status: TaskStatus.CANCELLED } as Task);

      await service.cancel('task-123', 'Test reason');

      expect(eventBusService.emit).toHaveBeenCalledWith('task.cancelled', expect.objectContaining({ reason: 'Test reason' }));
    });
  });

  describe('delete', () => {
    it('应该成功删除任务', async () => {
      const deletableTask = { ...mockTask, status: TaskStatus.CREATED };
      taskRepository.findOne.mockResolvedValue(deletableTask as Task);
      taskRepository.remove.mockResolvedValue(deletableTask as Task);

      await service.delete('task-123');

      expect(taskRepository.remove).toHaveBeenCalled();
    });

    it('已完成的任务不能删除', async () => {
      const completedTask = { ...mockTask, status: TaskStatus.COMPLETED };
      taskRepository.findOne.mockResolvedValue(completedTask as Task);

      await expect(service.delete('task-123')).rejects.toThrow(BusinessException);
    });

    it('删除任务后应该发送事件', async () => {
      const deletableTask = { ...mockTask, status: TaskStatus.CREATED };
      taskRepository.findOne.mockResolvedValue(deletableTask as Task);
      taskRepository.remove.mockResolvedValue(deletableTask as Task);

      await service.delete('task-123');

      expect(eventBusService.emit).toHaveBeenCalledWith('task.deleted', expect.any(Object));
    });
  });

  describe('getStatistics', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValueOnce(100).mockResolvedValueOnce(20).mockResolvedValueOnce(30)
          .mockResolvedValueOnce(10).mockResolvedValueOnce(35).mockResolvedValueOnce(5),
      };
      return qb as unknown as Mocked<SelectQueryBuilder<Task>>;
    };

    it('应该返回任务统计信息', async () => {
      const mockQb = createMockQueryBuilder();
      taskRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.getStatistics();

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('assigned');
      expect(result).toHaveProperty('unassigned');
      expect(result).toHaveProperty('completed');
      expect(result).toHaveProperty('cancelled');
    });

    it('应该支持按assignee过滤统计', async () => {
      const mockQb = createMockQueryBuilder();
      taskRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.getStatistics('user-1');

      expect(mockQb.andWhere).toHaveBeenCalledWith('task.assignee = :assignee', { assignee: 'user-1' });
    });
  });
});
