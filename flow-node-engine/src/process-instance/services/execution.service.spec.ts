import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';

import { Execution } from '../entities/execution.entity';
import { ProcessInstance } from '../entities/process-instance.entity';
import { Variable } from '../entities/variable.entity';
import { ExecutionService } from './execution.service';

describe('ExecutionService', () => {
  let service: ExecutionService;
  let executionRepository: Mocked<Repository<Execution>>;
  let processInstanceRepository: Mocked<Repository<ProcessInstance>>;
  let variableRepository: Mocked<Repository<Variable>>;

  const mockProcessInstance: Partial<ProcessInstance> = {
    id: 'pi-123',
    processDefinitionId: 'pd-123',
    businessKey: 'biz-123',
    tenantId: 'tenant-1',
    state: 'active',
  };

  const mockExecution: Partial<Execution> = {
    id: 'exec-123',
    processInstanceId: 'pi-123',
    activityId: 'task-1',
    activityName: 'Task 1',
    activityType: 'userTask',
    state: 'active',
    businessKey: 'biz-123',
    tenantId: 'tenant-1',
    variables: { var1: 'value1' },
    startTime: new Date(),
    createTime: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      createQueryBuilder: vi.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionService,
        { provide: getRepositoryToken(Execution), useFactory: mockRepo },
        { provide: getRepositoryToken(ProcessInstance), useFactory: mockRepo },
        { provide: getRepositoryToken(Variable), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<ExecutionService>(ExecutionService);
    executionRepository = module.get(getRepositoryToken(Execution));
    processInstanceRepository = module.get(getRepositoryToken(ProcessInstance));
    variableRepository = module.get(getRepositoryToken(Variable));
  });

  describe('create', () => {
    it('应该成功创建执行实例', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.create.mockReturnValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue(mockExecution as Execution);

      const result = await service.create(
        'pi-123',
        'task-1',
        'Task 1',
        'userTask',
        'parent-1',
        'biz-123',
        { var1: 'value1' },
        'tenant-1'
      );

      expect(result).toEqual(mockExecution);
      expect(executionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          processInstanceId: 'pi-123',
          activityId: 'task-1',
          activityName: 'Task 1',
          activityType: 'userTask',
          parentActivityId: 'parent-1',
        })
      );
    });

    it('流程实例不存在时应抛出NotFoundException', async () => {
      processInstanceRepository.findOne.mockResolvedValue(null);

      await expect(service.create('non-existent', 'task-1', 'Task 1', 'userTask')).rejects.toThrow(
        '流程实例不存在: non-existent'
      );
    });

    it('应该继承流程实例的businessKey', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.create.mockReturnValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue(mockExecution as Execution);

      await service.create('pi-123', 'task-1', 'Task 1', 'userTask');

      expect(executionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ businessKey: 'biz-123' })
      );
    });

    it('应该继承流程实例的tenantId', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.create.mockReturnValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue(mockExecution as Execution);

      await service.create('pi-123', 'task-1', 'Task 1', 'userTask');

      expect(executionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' })
      );
    });

    it('应该使用传入的businessKey覆盖继承值', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.create.mockReturnValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue(mockExecution as Execution);

      await service.create('pi-123', 'task-1', 'Task 1', 'userTask', undefined, 'custom-biz');

      expect(executionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ businessKey: 'custom-biz' })
      );
    });
  });

  describe('findById', () => {
    it('应该返回执行实例及其关联', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);

      const result = await service.findById('exec-123');

      expect(result).toEqual(mockExecution);
      expect(executionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'exec-123' },
        relations: ['processInstance', 'variables'],
      });
    });

    it('执行实例不存在时应抛出NotFoundException', async () => {
      executionRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow('执行实例不存在: non-existent');
    });
  });

  describe('findByProcessInstanceId', () => {
    it('应该返回指定流程实例的执行实例列表', async () => {
      const mockExecutions = [mockExecution as Execution];
      executionRepository.find.mockResolvedValue(mockExecutions);

      const result = await service.findByProcessInstanceId('pi-123');

      expect(result).toEqual(mockExecutions);
      expect(executionRepository.find).toHaveBeenCalledWith({
        where: { processInstanceId: 'pi-123' },
        relations: ['variables'],
        order: { createTime: 'ASC' },
      });
    });

    it('应该支持state过滤', async () => {
      executionRepository.find.mockResolvedValue([]);

      await service.findByProcessInstanceId('pi-123', 'active');

      expect(executionRepository.find).toHaveBeenCalledWith({
        where: { processInstanceId: 'pi-123', state: 'active' },
        relations: ['variables'],
        order: { createTime: 'ASC' },
      });
    });
  });

  describe('findByActivityId', () => {
    it('应该返回指定活动的执行实例列表', async () => {
      const mockExecutions = [mockExecution as Execution];
      executionRepository.find.mockResolvedValue(mockExecutions);

      const result = await service.findByActivityId('task-1');

      expect(result).toEqual(mockExecutions);
      expect(executionRepository.find).toHaveBeenCalledWith({
        where: { activityId: 'task-1' },
        relations: ['processInstance'],
        order: { createTime: 'DESC' },
      });
    });

    it('应该支持流程实例ID过滤', async () => {
      executionRepository.find.mockResolvedValue([]);

      await service.findByActivityId('task-1', 'pi-123');

      expect(executionRepository.find).toHaveBeenCalledWith({
        where: { activityId: 'task-1', processInstanceId: 'pi-123' },
        relations: ['processInstance'],
        order: { createTime: 'DESC' },
      });
    });
  });

  describe('findAll', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn(),
      };
      return qb as unknown as Mocked<SelectQueryBuilder<Execution>>;
    };

    it('应该返回分页执行实例列表', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockExecution as Execution], 1]);
      executionRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该支持state过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      executionRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll(1, 10, 'active');

      expect(mockQb.andWhere).toHaveBeenCalledWith('e.state = :state', { state: 'active' });
    });

    it('应该支持租户ID过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      executionRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll(1, 10, undefined, 'tenant-1');

      expect(mockQb.andWhere).toHaveBeenCalledWith('e.tenantId = :tenantId', { tenantId: 'tenant-1' });
    });

    it('应该正确计算分页偏移量', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      executionRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll(3, 20);

      expect(mockQb.skip).toHaveBeenCalledWith(40);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });
  });

  describe('update', () => {
    it('应该成功更新执行实例', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue({
        ...mockExecution,
        activityName: 'Updated Task',
      } as Execution);

      const result = await service.update('exec-123', { activityName: 'Updated Task' });

      expect(result.activityName).toBe('Updated Task');
    });

    it('执行实例不存在时应抛出NotFoundException', async () => {
      executionRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', { activityName: 'Updated' })).rejects.toThrow(
        '执行实例不存在: non-existent'
      );
    });
  });

  describe('updateVariables', () => {
    it('应该合并变量', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue({
        ...mockExecution,
        variables: { var1: 'value1', var2: 'value2' },
      } as Execution);

      const result = await service.updateVariables('exec-123', { var2: 'value2' });

      expect(result.variables).toEqual({ var1: 'value1', var2: 'value2' });
    });
  });

  describe('getVariables', () => {
    it('应该返回执行实例变量', async () => {
      const executionWithVars = {
        ...mockExecution,
        variables: { var1: 'value1' }
      };
      executionRepository.findOne.mockResolvedValue(executionWithVars as Execution);

      const result = await service.getVariables('exec-123');

      expect(result).toEqual({ var1: 'value1' });
    });

    it('没有变量时应返回空对象', async () => {
      executionRepository.findOne.mockResolvedValue({
        ...mockExecution,
        variables: null,
      } as Execution);

      const result = await service.getVariables('exec-123');

      expect(result).toEqual({});
    });
  });

  describe('getVariable', () => {
    it('应该返回单个变量值', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);

      const result = await service.getVariable('exec-123', 'var1');

      expect(result).toBe('value1');
    });

    it('变量不存在时应返回undefined', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);

      const result = await service.getVariable('exec-123', 'non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('应该软删除执行实例', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue({
        ...mockExecution,
        state: 'deleted',
      } as Execution);

      await service.delete('exec-123', 'Test delete');

      expect(executionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'deleted',
          deleteReason: 'Test delete',
          endTime: expect.any(Date),
        })
      );
    });

    it('应该使用默认删除原因', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue(mockExecution as Execution);

      await service.delete('exec-123');

      expect(executionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ deleteReason: 'Deleted by user' })
      );
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除执行实例', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue(mockExecution as Execution);

      await service.deleteMany(['exec-123', 'exec-456'], 'Batch delete');

      expect(executionRepository.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('complete', () => {
    it('应该完成执行实例', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue({
        ...mockExecution,
        state: 'completed',
      } as Execution);

      const result = await service.complete('exec-123');

      expect(result.state).toBe('completed');
      expect(result.endTime).toBeDefined();
    });

    it('已完成时再次完成应抛出错误', async () => {
      executionRepository.findOne.mockResolvedValue({
        ...mockExecution,
        state: 'completed',
      } as Execution);

      await expect(service.complete('exec-123')).rejects.toThrow('执行实例已完成');
    });
  });

  describe('suspend', () => {
    it('应该挂起执行实例', async () => {
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue({
        ...mockExecution,
        state: 'suspended',
      } as Execution);

      const result = await service.suspend('exec-123');

      expect(result.state).toBe('suspended');
    });

    it('已挂起时再次挂起应抛出错误', async () => {
      executionRepository.findOne.mockResolvedValue({
        ...mockExecution,
        state: 'suspended',
      } as Execution);

      await expect(service.suspend('exec-123')).rejects.toThrow('执行实例已处于挂起状态');
    });
  });

  describe('activate', () => {
    it('应该激活执行实例', async () => {
      executionRepository.findOne.mockResolvedValue({
        ...mockExecution,
        state: 'suspended',
      } as Execution);
      executionRepository.save.mockResolvedValue({
        ...mockExecution,
        state: 'active',
      } as Execution);

      const result = await service.activate('exec-123');

      expect(result.state).toBe('active');
    });

    it('已激活时再次激活应抛出错误', async () => {
      const activeExecution = {
        ...mockExecution,
        state: 'active'
      };
      executionRepository.findOne.mockResolvedValue(activeExecution as Execution);

      await expect(service.activate('exec-123')).rejects.toThrow('执行实例已处于激活状态');
    });
  });

  describe('getVariableList', () => {
    it('应该返回执行实例的变量列表', async () => {
      const mockVariables = [{ id: 'var-1', name: 'var1', value: '"value1"' }] as Variable[];
      variableRepository.find.mockResolvedValue(mockVariables);

      const result = await service.getVariableList('exec-123');

      expect(result).toEqual(mockVariables);
      expect(variableRepository.find).toHaveBeenCalledWith({
        where: { executionId: 'exec-123' },
        order: { createTime: 'ASC' },
      });
    });
  });

  describe('getChildren', () => {
    it('应该返回子执行实例列表', async () => {
      const mockChildren = [{ ...mockExecution, parentActivityId: 'parent-1' }] as Execution[];
      executionRepository.find.mockResolvedValue(mockChildren);

      const result = await service.getChildren('parent-1', 'pi-123');

      expect(result).toEqual(mockChildren);
      expect(executionRepository.find).toHaveBeenCalledWith({
        where: { parentActivityId: 'parent-1', processInstanceId: 'pi-123' },
        relations: ['variables'],
        order: { createTime: 'ASC' },
      });
    });
  });

  describe('count', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn(),
      };
      return qb as unknown as Mocked<SelectQueryBuilder<Execution>>;
    };

    it('应该返回执行实例总数', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(10);
      executionRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.count();

      expect(result).toBe(10);
    });

    it('应该支持state条件统计', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(5);
      executionRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.count('active');

      expect(mockQb.andWhere).toHaveBeenCalledWith('e.state = :state', { state: 'active' });
    });

    it('应该支持租户ID条件统计', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(3);
      executionRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.count(undefined, 'tenant-1');

      expect(mockQb.andWhere).toHaveBeenCalledWith('e.tenantId = :tenantId', { tenantId: 'tenant-1' });
    });
  });
});
