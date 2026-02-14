import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { VariableService } from './variable.service';
import { Variable } from '../entities/variable.entity';
import { ProcessInstance } from '../entities/process-instance.entity';
import { Execution } from '../entities/execution.entity';

describe('VariableService', () => {
  let service: VariableService;
  let variableRepository: vi.Mocked<Repository<Variable>>;
  let processInstanceRepository: vi.Mocked<Repository<ProcessInstance>>;
  let executionRepository: vi.Mocked<Repository<Execution>>;

  const mockProcessInstance: Partial<ProcessInstance> = {
    id: 'pi-123',
    processDefinitionId: 'pd-123',
    businessKey: 'biz-123',
    state: 'active',
  };

  const mockExecution: Partial<Execution> = {
    id: 'exec-123',
    processInstanceId: 'pi-123',
    activityId: 'task-1',
    state: 'active',
  };

  const mockVariable: Partial<Variable> = {
    id: 'var-123',
    processInstanceId: 'pi-123',
    executionId: 'exec-123',
    name: 'testVar',
    type: 'string',
    value: '"testValue"',
    isLocal: true,
    scope: 'execution',
    createTime: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = () => ({
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariableService,
        { provide: getRepositoryToken(Variable), useFactory: mockRepo },
        { provide: getRepositoryToken(ProcessInstance), useFactory: mockRepo },
        { provide: getRepositoryToken(Execution), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get<VariableService>(VariableService);
    variableRepository = module.get(getRepositoryToken(Variable));
    processInstanceRepository = module.get(getRepositoryToken(ProcessInstance));
    executionRepository = module.get(getRepositoryToken(Execution));
  });

  describe('create', () => {
    it('应该成功创建变量', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      variableRepository.create.mockReturnValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue(mockVariable as Variable);

      const result = await service.create('pi-123', 'testVar', 'testValue', 'string');

      expect(result).toEqual(mockVariable);
      expect(variableRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          processInstanceId: 'pi-123',
          name: 'testVar',
          type: 'string',
        })
      );
    });

    it('应该序列化值为JSON字符串', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      variableRepository.create.mockReturnValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue(mockVariable as Variable);

      await service.create('pi-123', 'objVar', { key: 'value' }, 'object');

      expect(variableRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          value: '{"key":"value"}',
        })
      );
    });

    it('流程实例不存在时应抛出NotFoundException', async () => {
      processInstanceRepository.findOne.mockResolvedValue(null);

      await expect(service.create('non-existent', 'testVar', 'value')).rejects.toThrow(
        '流程实例不存在: non-existent'
      );
    });

    it('指定了执行实例ID时应验证执行实例存在', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.findOne.mockResolvedValue(null);

      await expect(service.create('pi-123', 'testVar', 'value', 'string', 'non-existent')).rejects.toThrow(
        '执行实例不存在: non-existent'
      );
    });

    it('执行实例存在时应该成功创建', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      executionRepository.findOne.mockResolvedValue(mockExecution as Execution);
      variableRepository.create.mockReturnValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue(mockVariable as Variable);

      const result = await service.create('pi-123', 'testVar', 'value', 'string', 'exec-123');

      expect(result).toEqual(mockVariable);
    });

    it('应该使用默认值', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      variableRepository.create.mockReturnValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue(mockVariable as Variable);

      await service.create('pi-123', 'testVar', 'value');

      expect(variableRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'string',
          isLocal: true,
          scope: 'execution',
        })
      );
    });
  });

  describe('findById', () => {
    it('应该返回变量及其关联', async () => {
      variableRepository.findOne.mockResolvedValue(mockVariable as Variable);

      const result = await service.findById('var-123');

      expect(result).toEqual(mockVariable);
      expect(variableRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'var-123' },
        relations: ['processInstance', 'execution'],
      });
    });

    it('变量不存在时应抛出NotFoundException', async () => {
      variableRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow('变量不存在: non-existent');
    });
  });

  describe('findByProcessInstanceId', () => {
    it('应该返回指定流程实例的变量列表', async () => {
      const mockVariables = [mockVariable as Variable];
      variableRepository.find.mockResolvedValue(mockVariables);

      const result = await service.findByProcessInstanceId('pi-123');

      expect(result).toEqual(mockVariables);
      expect(variableRepository.find).toHaveBeenCalledWith({
        where: { processInstanceId: 'pi-123' },
        relations: ['execution'],
        order: { createTime: 'ASC' },
      });
    });

    it('应该支持scope过滤', async () => {
      variableRepository.find.mockResolvedValue([]);

      await service.findByProcessInstanceId('pi-123', 'execution');

      expect(variableRepository.find).toHaveBeenCalledWith({
        where: { processInstanceId: 'pi-123', scope: 'execution' },
        relations: ['execution'],
        order: { createTime: 'ASC' },
      });
    });
  });

  describe('findByExecutionId', () => {
    it('应该返回指定执行实例的变量列表', async () => {
      const mockVariables = [mockVariable as Variable];
      variableRepository.find.mockResolvedValue(mockVariables);

      const result = await service.findByExecutionId('exec-123');

      expect(result).toEqual(mockVariables);
      expect(variableRepository.find).toHaveBeenCalledWith({
        where: { executionId: 'exec-123' },
        relations: ['processInstance'],
        order: { createTime: 'ASC' },
      });
    });
  });

  describe('findByName', () => {
    it('应该根据名称返回变量列表', async () => {
      const mockVariables = [mockVariable as Variable];
      variableRepository.find.mockResolvedValue(mockVariables);

      const result = await service.findByName('testVar');

      expect(result).toEqual(mockVariables);
      expect(variableRepository.find).toHaveBeenCalledWith({
        where: { name: 'testVar' },
        relations: ['processInstance', 'execution'],
        order: { createTime: 'DESC' },
      });
    });

    it('应该支持流程实例ID过滤', async () => {
      variableRepository.find.mockResolvedValue([]);

      await service.findByName('testVar', 'pi-123');

      expect(variableRepository.find).toHaveBeenCalledWith({
        where: { name: 'testVar', processInstanceId: 'pi-123' },
        relations: ['processInstance', 'execution'],
        order: { createTime: 'DESC' },
      });
    });

    it('应该支持执行实例ID过滤', async () => {
      variableRepository.find.mockResolvedValue([]);

      await service.findByName('testVar', 'pi-123', 'exec-123');

      expect(variableRepository.find).toHaveBeenCalledWith({
        where: { name: 'testVar', processInstanceId: 'pi-123', executionId: 'exec-123' },
        relations: ['processInstance', 'execution'],
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
      return qb as unknown as vi.Mocked<SelectQueryBuilder<Variable>>;
    };

    it('应该返回分页变量列表', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[mockVariable as Variable], 1]);
      variableRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll(1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该支持scope过滤', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      variableRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll(1, 10, 'execution');

      expect(mockQb.andWhere).toHaveBeenCalledWith('v.scope = :scope', { scope: 'execution' });
    });

    it('应该正确计算分页偏移量', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);
      variableRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll(3, 20);

      expect(mockQb.skip).toHaveBeenCalledWith(40);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });
  });

  describe('update', () => {
    it('应该成功更新变量', async () => {
      variableRepository.findOne.mockResolvedValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue({
        ...mockVariable,
        value: '"updatedValue"',
      } as Variable);

      const result = await service.update('var-123', { value: 'updatedValue' });

      expect(variableRepository.save).toHaveBeenCalled();
    });

    it('更新值时应该序列化', async () => {
      variableRepository.findOne.mockResolvedValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue(mockVariable as Variable);

      await service.update('var-123', { value: { key: 'value' } });

      expect(variableRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          value: '{"key":"value"}',
        })
      );
    });

    it('变量不存在时应抛出NotFoundException', async () => {
      variableRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', { value: 'new' })).rejects.toThrow(
        '变量不存在: non-existent'
      );
    });
  });

  describe('delete', () => {
    it('应该删除变量', async () => {
      variableRepository.findOne.mockResolvedValue(mockVariable as Variable);
      variableRepository.remove.mockResolvedValue(mockVariable as Variable);

      await service.delete('var-123');

      expect(variableRepository.remove).toHaveBeenCalledWith(mockVariable);
    });

    it('变量不存在时应抛出NotFoundException', async () => {
      variableRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow('变量不存在: non-existent');
    });
  });

  describe('deleteMany', () => {
    it('应该批量删除变量', async () => {
      variableRepository.findOne.mockResolvedValue(mockVariable as Variable);
      variableRepository.remove.mockResolvedValue(mockVariable as Variable);

      await service.deleteMany(['var-123', 'var-456']);

      expect(variableRepository.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteByProcessInstanceId', () => {
    it('应该删除流程实例的所有变量', async () => {
      variableRepository.delete.mockResolvedValue({ affected: 2 } as any);

      await service.deleteByProcessInstanceId('pi-123');

      expect(variableRepository.delete).toHaveBeenCalledWith({ processInstanceId: 'pi-123' });
    });
  });

  describe('deleteByExecutionId', () => {
    it('应该删除执行实例的所有变量', async () => {
      variableRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteByExecutionId('exec-123');

      expect(variableRepository.delete).toHaveBeenCalledWith({ executionId: 'exec-123' });
    });
  });

  describe('getProcessInstanceVariables', () => {
    it('应该返回流程实例的变量键值对', async () => {
      const mockVariables = [
        { ...mockVariable, name: 'var1', value: '"value1"' },
        { ...mockVariable, name: 'var2', value: '"value2"' },
      ] as Variable[];
      variableRepository.find.mockResolvedValue(mockVariables);

      const result = await service.getProcessInstanceVariables('pi-123');

      expect(result).toEqual({ var1: 'value1', var2: 'value2' });
    });

    it('应该支持scope过滤', async () => {
      variableRepository.find.mockResolvedValue([]);

      await service.getProcessInstanceVariables('pi-123', 'execution');

      expect(variableRepository.find).toHaveBeenCalledWith({
        where: { processInstanceId: 'pi-123', scope: 'execution' },
        relations: ['execution'],
        order: { createTime: 'ASC' },
      });
    });

    it('JSON解析失败时应返回原始值', async () => {
      const mockVariables = [
        { ...mockVariable, name: 'invalid', value: 'not a json' },
      ] as Variable[];
      variableRepository.find.mockResolvedValue(mockVariables);

      const result = await service.getProcessInstanceVariables('pi-123');

      expect(result).toEqual({ invalid: 'not a json' });
    });
  });

  describe('getExecutionVariables', () => {
    it('应该返回执行实例的变量键值对', async () => {
      const mockVariables = [
        { ...mockVariable, name: 'var1', value: '"value1"' },
      ] as Variable[];
      variableRepository.find.mockResolvedValue(mockVariables);

      const result = await service.getExecutionVariables('exec-123');

      expect(result).toEqual({ var1: 'value1' });
    });
  });

  describe('createMany', () => {
    it('应该批量创建变量', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      variableRepository.create.mockReturnValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue(mockVariable as Variable);

      const result = await service.createMany('pi-123', { var1: 'value1', var2: 'value2' });

      expect(result).toHaveLength(2);
      expect(variableRepository.save).toHaveBeenCalledTimes(2);
    });

    it('空对象时应该返回空数组', async () => {
      const result = await service.createMany('pi-123', {});

      expect(result).toHaveLength(0);
      expect(variableRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateMany', () => {
    it('应该更新已存在的变量', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      variableRepository.findOne.mockResolvedValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue(mockVariable as Variable);

      const result = await service.updateMany('pi-123', { testVar: 'newValue' });

      expect(result).toHaveLength(1);
      expect(variableRepository.findOne).toHaveBeenCalled();
    });

    it('应该创建不存在的变量', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      variableRepository.findOne.mockResolvedValue(null);
      variableRepository.create.mockReturnValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue(mockVariable as Variable);

      const result = await service.updateMany('pi-123', { newVar: 'value' });

      expect(result).toHaveLength(1);
      expect(variableRepository.create).toHaveBeenCalled();
    });

    it('应该支持执行实例ID', async () => {
      processInstanceRepository.findOne.mockResolvedValue(mockProcessInstance as ProcessInstance);
      variableRepository.findOne.mockResolvedValue(mockVariable as Variable);
      variableRepository.save.mockResolvedValue(mockVariable as Variable);

      await service.updateMany('pi-123', { testVar: 'newValue' }, 'exec-123');

      expect(variableRepository.findOne).toHaveBeenCalledWith({
        where: { processInstanceId: 'pi-123', name: 'testVar', executionId: 'exec-123' },
      });
    });
  });

  describe('count', () => {
    const createMockQueryBuilder = () => {
      const qb = {
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn(),
      };
      return qb as unknown as vi.Mocked<SelectQueryBuilder<Variable>>;
    };

    it('应该返回变量总数', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(10);
      variableRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.count();

      expect(result).toBe(10);
    });

    it('应该支持scope条件统计', async () => {
      const mockQb = createMockQueryBuilder();
      mockQb.getCount.mockResolvedValue(5);
      variableRepository.createQueryBuilder.mockReturnValue(mockQb);

      await service.count('execution');

      expect(mockQb.andWhere).toHaveBeenCalledWith('v.scope = :scope', { scope: 'execution' });
    });
  });
});
