import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';

import { ProcessDefinition } from '../../process-definition/entities/process-definition.entity';
import { Execution } from '../entities/execution.entity';
import { ProcessInstance } from '../entities/process-instance.entity';
import { Variable } from '../entities/variable.entity';
import { ProcessInstanceService } from './process-instance.service';

describe('ProcessInstanceService', () => {
  let service: ProcessInstanceService;
  let processInstanceRepository: Mocked<Repository<ProcessInstance>>;
  let executionRepository: Mocked<Repository<Execution>>;
  let variableRepository: Mocked<Repository<Variable>>;
  let processDefinitionRepository: Mocked<Repository<ProcessDefinition>>;

  const mockProcessDefinition: Partial<ProcessDefinition> = {
    id: 'pd-123',
    key: 'test-process',
    name: 'Test Process',
    startActivityId: 'start',
    startActivityName: 'Start Event',
  };

  const mockProcessInstance: Partial<ProcessInstance> = {
    id: 'pi-123',
    processDefinitionId: 'pd-123',
    processDefinitionKey: 'test-process',
    businessKey: 'biz-123',
    startUserId: 'user-1',
    state: 'active',
    startTime: new Date(),
    variables: { var1: 'value1' },
    createTime: new Date(),
    updateTime: new Date(),
  };

  const mockExecution: Partial<Execution> = {
    id: 'exec-123',
    processInstanceId: 'pi-123',
    activityId: 'start',
    activityName: 'Start Event',
    activityType: 'startEvent',
    state: 'active',
    startTime: new Date(),
    createTime: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: vi.fn(),
      find: vi.fn(),
      findAndCount: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessInstanceService,
        { provide: getRepositoryToken(ProcessInstance), useFactory: mockRepo },
        { provide: getRepositoryToken(Execution), useFactory: mockRepo },
        { provide: getRepositoryToken(Variable), useFactory: mockRepo },
        { provide: getRepositoryToken(ProcessDefinition), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<ProcessInstanceService>(ProcessInstanceService);
    processInstanceRepository = module.get(getRepositoryToken(ProcessInstance));
    executionRepository = module.get(getRepositoryToken(Execution));
    variableRepository = module.get(getRepositoryToken(Variable));
    processDefinitionRepository = module.get(getRepositoryToken(ProcessDefinition));
  });

  describe('create', () => {
    it('应该成功创建流程实例', async () => {
      processDefinitionRepository.findOne.mockResolvedValue(mockProcessDefinition as ProcessDefinition);
      processInstanceRepository.create.mockReturnValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.create.mockReturnValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue(mockExecution as Execution);

      const result = await service.create('pd-123', 'biz-123', 'user-1', { var1: 'value1' });

      expect(result).toEqual(mockProcessInstance);
      expect(processDefinitionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'pd-123' },
      });
    });

    it('流程定义不存在时应抛出NotFoundException', async () => {
      processDefinitionRepository.findOne.mockResolvedValue(null);

      await expect(service.create('non-existent')).rejects.toThrow('流程定义不存在: non-existent');
    });

    it('应该使用流程定义的startActivityId创建执行实例', async () => {
      processDefinitionRepository.findOne.mockResolvedValue(mockProcessDefinition as ProcessDefinition);
      processInstanceRepository.create.mockReturnValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.create.mockReturnValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue(mockExecution as Execution);

      await service.create('pd-123');

      expect(executionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activityId: 'start',
          activityName: 'Start Event',
          activityType: 'startEvent',
        })
      );
    });

    it('应该支持租户ID', async () => {
      processDefinitionRepository.findOne.mockResolvedValue(mockProcessDefinition as ProcessDefinition);
      processInstanceRepository.create.mockReturnValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.create.mockReturnValue(mockExecution as Execution);
      executionRepository.save.mockResolvedValue(mockExecution as Execution);

      await service.create('pd-123', undefined, undefined, undefined, 'tenant-1');

      expect(processInstanceRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' })
      );
    });
  });

  describe('findById', () => {
    it('应该返回流程实例及其关联', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);

      const result = await service.findById('pi-123');

      expect(result).toEqual(mockProcessInstance);
      expect(processInstanceRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'pi-123' },
        relations: ['processDefinition', 'executions', 'variables'],
      });
    });

    it('流程实例不存在时应抛出NotFoundException', async () => {
      processInstanceRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow('流程实例不存在: non-existent');
    });
  });

  describe('findByBusinessKey', () => {
    it('应该根据业务键返回流程实例', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);

      const result = await service.findByBusinessKey('biz-123');

      expect(result).toEqual(mockProcessInstance);
    });

    it('应该支持租户ID过滤', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);

      await service.findByBusinessKey('biz-123', 'tenant-1');

      expect(processInstanceRepository.findOne).toHaveBeenCalledWith({
        where: { businessKey: 'biz-123', tenantId: 'tenant-1' },
        relations: ['processDefinition', 'executions', 'variables'],
      });
    });

    it('流程实例不存在时应抛出NotFoundException', async () => {
      processInstanceRepository.findOne.mockResolvedValue(null);

      await expect(service.findByBusinessKey('non-existent')).rejects.toThrow('流程实例不存在: non-existent');
    });
  });

  describe('findByProcessDefinitionId', () => {
    it('应该返回指定流程定义的流程实例列表', async () => {
      const mockList = [mockProcessInstance as ProcessInstance];
      processInstanceRepository.findAndCount.mockResolvedValue([mockList, 1]);

      const result = await service.findByProcessDefinitionId('pd-123', 1, 10);

      expect(result.data).toEqual(mockList);
      expect(result.total).toBe(1);
    });

    it('应该正确计算分页偏移量', async () => {
      processInstanceRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findByProcessDefinitionId('pd-123', 2, 20);

      expect(processInstanceRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
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
      return qb as unknown as Mocked<SelectQueryBuilder<ProcessInstance>>;
    };

    it('应该返回分页流程实例列表', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockProcessInstance as ProcessInstance], 1]);
      processInstanceRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该支持state过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      processInstanceRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll(1, 10, 'active');

      expect(mockQb.andWhere).toHaveBeenCalledWith('pi.state = :state', { state: 'active' });
    });

    it('应该支持租户ID过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      processInstanceRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll(1, 10, undefined, 'tenant-1');

      expect(mockQb.andWhere).toHaveBeenCalledWith('pi.tenantId = :tenantId', { tenantId: 'tenant-1' });
    });
  });

  describe('update', () => {
    it('应该成功更新流程实例', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue({
        ...mockProcessInstance,
        state: 'suspended',
      } as ProcessInstance);

      const result = await service.update('pi-123', { state: 'suspended' });

      expect(result.state).toBe('suspended');
    });

    it('流程实例不存在时应抛出NotFoundException', async () => {
      processInstanceRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', { state: 'suspended' })).rejects.toThrow(
        '流程实例不存在: non-existent'
      );
    });
  });

  describe('updateVariables', () => {
    it('应该合并变量', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue({
        ...mockProcessInstance,
        variables: { var1: 'value1', var2: 'value2' },
      } as ProcessInstance);

      const result = await service.updateVariables('pi-123', { var2: 'value2' });

      expect(result.variables).toEqual({ var1: 'value1', var2: 'value2' });
    });
  });

  describe('getVariables', () => {
    it('应该返回流程实例变量', async () => {
      const instanceWithVars = {
        ...mockProcessInstance,
        variables: { var1: 'value1' }
      };
      processInstanceRepository.findOne.mockResolvedValue(instanceWithVars as ProcessInstance);

      const result = await service.getVariables('pi-123');

      expect(result).toEqual({ var1: 'value1' });
    });

    it('没有变量时应返回空对象', async () => {
      processInstanceRepository.findOne.mockResolvedValue({
        ...mockProcessInstance,
        variables: null,
      } as ProcessInstance);

      const result = await service.getVariables('pi-123');

      expect(result).toEqual({});
    });
  });

  describe('getVariable', () => {
    it('应该返回单个变量值', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);

      const result = await service.getVariable('pi-123', 'var1');

      expect(result).toBe('value1');
    });

    it('变量不存在时应返回undefined', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);

      const result = await service.getVariable('pi-123', 'non-existent');

      expect(result).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('应该软删除流程实例', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue({
        ...mockProcessInstance,
        state: 'deleted',
      } as ProcessInstance);
      executionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.delete('pi-123', 'Test delete');

      expect(processInstanceRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'deleted',
          deleteReason: 'Test delete',
        })
      );
    });

    it('应该同时更新关联的执行实例状态', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.delete('pi-123');

      expect(executionRepository.update).toHaveBeenCalledWith(
        { processInstanceId: 'pi-123' },
        expect.objectContaining({ state: 'deleted' })
      );
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除流程实例', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.deleteMany(['pi-123', 'pi-456'], 'Batch delete');

      expect(processInstanceRepository.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('suspend', () => {
    it('应该挂起流程实例', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue({
        ...mockProcessInstance,
        state: 'suspended',
      } as ProcessInstance);

      const result = await service.suspend('pi-123');

      expect(result.state).toBe('suspended');
    });

    it('已挂起时再次挂起应抛出错误', async () => {
      processInstanceRepository.findOne.mockResolvedValue({
        ...mockProcessInstance,
        state: 'suspended',
      } as ProcessInstance);

      await expect(service.suspend('pi-123')).rejects.toThrow('流程实例已处于挂起状态');
    });
  });

  describe('activate', () => {
    it('应该激活流程实例', async () => {
      processInstanceRepository.findOne.mockResolvedValue({
        ...mockProcessInstance,
        state: 'suspended',
      } as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue({
        ...mockProcessInstance,
        state: 'active',
      } as ProcessInstance);

      const result = await service.activate('pi-123');

      expect(result.state).toBe('active');
    });

    it('已激活时再次激活应抛出错误', async () => {
      const activeInstance = {
        ...mockProcessInstance,
        state: 'active'
      };
      processInstanceRepository.findOne.mockResolvedValue(activeInstance as ProcessInstance);

      await expect(service.activate('pi-123')).rejects.toThrow('流程实例已处于激活状态');
    });
  });

  describe('complete', () => {
    it('应该完成流程实例', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue({
        ...mockProcessInstance,
        state: 'completed',
      } as ProcessInstance);
      executionRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.complete('pi-123');

      expect(result.state).toBe('completed');
      expect(result.endTime).toBeDefined();
    });

    it('已完成时再次完成应抛出错误', async () => {
      processInstanceRepository.findOne.mockResolvedValue({
        ...mockProcessInstance,
        state: 'completed',
      } as ProcessInstance);

      await expect(service.complete('pi-123')).rejects.toThrow('流程实例已完成');
    });

    it('应该同时更新所有执行实例状态', async () => {
      const activeInstance = {
        ...mockProcessInstance,
        state: 'active'
      };
      processInstanceRepository.findOne.mockResolvedValue(activeInstance as ProcessInstance);
      processInstanceRepository.save.mockResolvedValue({
        ...mockProcessInstance,
        state: 'completed',
      } as ProcessInstance);
      executionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.complete('pi-123');

      expect(executionRepository.update).toHaveBeenCalledWith(
        { processInstanceId: 'pi-123' },
        expect.objectContaining({ state: 'completed' })
      );
    });
  });

  describe('getExecutions', () => {
    it('应该返回流程实例的执行实例列表', async () => {
      const mockExecutions = [mockExecution as Execution];
      executionRepository.find.mockResolvedValue(mockExecutions);

      const result = await service.getExecutions('pi-123');

      expect(result).toEqual(mockExecutions);
      expect(executionRepository.find).toHaveBeenCalledWith({
        where: { processInstanceId: 'pi-123' },
        order: { createTime: 'ASC' },
      });
    });
  });

  describe('getVariableList', () => {
    it('应该返回流程实例的变量列表', async () => {
      const mockVariables = [{ id: 'var-1', name: 'var1', value: 'value1' }] as Variable[];
      variableRepository.find.mockResolvedValue(mockVariables);

      const result = await service.getVariableList('pi-123');

      expect(result).toEqual(mockVariables);
      expect(variableRepository.find).toHaveBeenCalledWith({
        where: { processInstanceId: 'pi-123' },
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
      return qb as unknown as Mocked<SelectQueryBuilder<ProcessInstance>>;
    };

    it('应该返回流程实例总数', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(10);
      processInstanceRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.count();

      expect(result).toBe(10);
    });

    it('应该支持state条件统计', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(5);
      processInstanceRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.count('active');

      expect(mockQb.andWhere).toHaveBeenCalledWith('pi.state = :state', { state: 'active' });
    });

    it('应该支持租户ID条件统计', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(3);
      processInstanceRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.count(undefined, 'tenant-1');

      expect(mockQb.andWhere).toHaveBeenCalledWith('pi.tenantId = :tenantId', { tenantId: 'tenant-1' });
    });
  });
});
