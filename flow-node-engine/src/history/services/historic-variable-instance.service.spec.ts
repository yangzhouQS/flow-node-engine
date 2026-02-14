import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import {
  HistoricVariableInstanceService,
  QueryHistoricVariableDto,
  CreateHistoricVariableDto,
  UpdateHistoricVariableDto,
} from './historic-variable-instance.service';
import {
  HistoricVariableInstanceEntity,
  HistoricVariableType,
} from '../entities/historic-variable-instance.entity';

describe('HistoricVariableInstanceService', () => {
  let service: HistoricVariableInstanceService;
  let repository: vi.Mocked<Repository<HistoricVariableInstanceEntity>>;

  const mockVariable: HistoricVariableInstanceEntity = {
    id_: 'var-1',
    proc_inst_id_: 'process-1',
    execution_id_: 'execution-1',
    task_id_: 'task-1',
    act_inst_id_: 'activity-1',
    name_: 'testVar',
    var_type_: HistoricVariableType.STRING,
    text_: 'testValue',
    text2_: null,
    long_: null,
    double_: null,
    bytes_: null,
    scope_id_: null,
    scope_type_: null,
    tenant_id_: 'tenant-1',
    create_time_: new Date('2026-01-01T10:00:00Z'),
    last_updated_time_: new Date('2026-01-01T10:00:00Z'),
    delete_time_: null,
    state_: 'CREATED',
  };

  beforeEach(async () => {
    const mockQueryBuilder = {
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn(),
      getMany: vi.fn(),
      getOne: vi.fn(),
      where: vi.fn().mockReturnThis(),
    } as unknown as SelectQueryBuilder<HistoricVariableInstanceEntity>;

    const mockRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(mockQueryBuilder),
      findOne: vi.fn(),
      find: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoricVariableInstanceService,
        {
          provide: getRepositoryToken(HistoricVariableInstanceEntity),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<HistoricVariableInstanceService>(HistoricVariableInstanceService);
    repository = module.get(getRepositoryToken(HistoricVariableInstanceEntity));
  });

  describe('create', () => {
    it('应该创建历史变量实例', async () => {
      const dto: CreateHistoricVariableDto = {
        processInstanceId: 'process-1',
        name: 'testVar',
        type: HistoricVariableType.STRING,
        value: 'testValue',
        textValue: 'testValue',
      };

      repository.create.mockReturnValue(mockVariable);
      repository.save.mockResolvedValue(mockVariable);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result.name_).toBe('testVar');
    });

    it('创建时应该设置初始状态为CREATED', async () => {
      const dto: CreateHistoricVariableDto = {
        name: 'testVar',
        type: HistoricVariableType.STRING,
        value: 'testValue',
      };

      repository.create.mockReturnValue(mockVariable);
      repository.save.mockResolvedValue(mockVariable);

      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          state_: 'CREATED',
        })
      );
    });

    it('创建时应该设置createTime和lastUpdatedTime', async () => {
      const dto: CreateHistoricVariableDto = {
        name: 'testVar',
        type: HistoricVariableType.STRING,
        value: 'testValue',
      };

      repository.create.mockReturnValue(mockVariable);
      repository.save.mockResolvedValue(mockVariable);

      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          create_time_: expect.any(Date),
          last_updated_time_: expect.any(Date),
        })
      );
    });
  });

  describe('findById', () => {
    it('应该返回历史变量实例', async () => {
      repository.findOne.mockResolvedValue(mockVariable);

      const result = await service.findById('var-1');

      expect(result).toEqual(mockVariable);
    });

    it('变量不存在时应该返回null', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrFail', () => {
    it('应该返回历史变量实例', async () => {
      repository.findOne.mockResolvedValue(mockVariable);

      const result = await service.findByIdOrFail('var-1');

      expect(result).toEqual(mockVariable);
    });

    it('变量不存在时应抛出NotFoundException', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findByIdOrFail('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('应该更新历史变量', async () => {
      repository.findOne.mockResolvedValue(mockVariable);
      repository.save.mockResolvedValue({ ...mockVariable, text_: 'updatedValue' });

      const dto: UpdateHistoricVariableDto = { textValue: 'updatedValue' };
      const result = await service.update('var-1', dto);

      expect(result.text_).toBe('updatedValue');
    });

    it('更新时应该更新lastUpdatedTime', async () => {
      repository.findOne.mockResolvedValue(mockVariable);
      repository.save.mockResolvedValue(mockVariable);

      await service.update('var-1', { textValue: 'updatedValue' });

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          last_updated_time_: expect.any(Date),
        })
      );
    });

    it('变量不存在时应抛出NotFoundException', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete (软删除)', () => {
    it('应该软删除历史变量', async () => {
      repository.findOne.mockResolvedValue(mockVariable);
      repository.save.mockResolvedValue({ ...mockVariable, state_: 'DELETED' });

      await service.delete('var-1');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          state_: 'DELETED',
          delete_time_: expect.any(Date),
        })
      );
    });
  });

  describe('hardDelete', () => {
    it('应该物理删除历史变量', async () => {
      repository.delete.mockResolvedValue({ affected: 1, raw: {} });

      await service.hardDelete('var-1');

      expect(repository.delete).toHaveBeenCalledWith({ id_: 'var-1' });
    });
  });

  describe('query', () => {
    it('应该返回分页的历史变量列表', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      const dto: QueryHistoricVariableDto = { page: 1, size: 20 };
      const [variables, total] = await service.query(dto);

      expect(variables).toHaveLength(1);
      expect(total).toBe(1);
    });

    it('应该支持processInstanceId过滤', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      await service.query({ processInstanceId: 'process-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.proc_inst_id_ = :processInstanceId',
        { processInstanceId: 'process-1' }
      );
    });

    it('应该支持executionId过滤', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      await service.query({ executionId: 'execution-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.execution_id_ = :executionId',
        { executionId: 'execution-1' }
      );
    });

    it('应该支持taskId过滤', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      await service.query({ taskId: 'task-1' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.task_id_ = :taskId',
        { taskId: 'task-1' }
      );
    });

    it('应该支持name过滤', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      await service.query({ name: 'testVar' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.name_ = :name',
        { name: 'testVar' }
      );
    });

    it('应该支持nameLike模糊查询', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      await service.query({ nameLike: 'test' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.name_ LIKE :nameLike',
        { nameLike: '%test%' }
      );
    });

    it('应该支持type过滤', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      await service.query({ type: HistoricVariableType.STRING });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.var_type_ = :type',
        { type: HistoricVariableType.STRING }
      );
    });

    it('默认应该排除已删除的变量', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      await service.query({});

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.state_ != :deletedState',
        { deletedState: 'DELETED' }
      );
    });

    it('includeDeleted为true时应该包含已删除的变量', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      await service.query({ includeDeleted: true });

      // 不应该调用排除DELETED的过滤
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'variable.state_ != :deletedState',
        expect.any(Object)
      );
    });

    it('应该支持createTimeBefore过滤', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      const date = new Date('2026-01-31');
      await service.query({ createTimeBefore: date });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.create_time_ < :createTimeBefore',
        { createTimeBefore: date }
      );
    });

    it('应该支持createTimeAfter过滤', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getManyAndCount as any).mockResolvedValue([[mockVariable], 1]);

      const date = new Date('2026-01-01');
      await service.query({ createTimeAfter: date });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.create_time_ > :createTimeAfter',
        { createTimeAfter: date }
      );
    });
  });

  describe('findByProcessInstanceId', () => {
    it('应该返回指定流程实例的变量', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getMany as any).mockResolvedValue([mockVariable]);

      const result = await service.findByProcessInstanceId('process-1');

      expect(result).toHaveLength(1);
    });

    it('默认应该排除已删除的变量', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getMany as any).mockResolvedValue([mockVariable]);

      await service.findByProcessInstanceId('process-1');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.state_ != :deletedState',
        { deletedState: 'DELETED' }
      );
    });

    it('includeDeleted为true时应该包含已删除的变量', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getMany as any).mockResolvedValue([mockVariable]);

      await service.findByProcessInstanceId('process-1', true);

      // 不应该调用排除DELETED的过滤
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        'variable.state_ != :deletedState',
        expect.any(Object)
      );
    });
  });

  describe('findByExecutionId', () => {
    it('应该返回指定执行的变量', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getMany as any).mockResolvedValue([mockVariable]);

      const result = await service.findByExecutionId('execution-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('findByTaskId', () => {
    it('应该返回指定任务的变量', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getMany as any).mockResolvedValue([mockVariable]);

      const result = await service.findByTaskId('task-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('findByName', () => {
    it('应该返回指定名称的变量', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getOne as any).mockResolvedValue(mockVariable);

      const result = await service.findByName('testVar');

      expect(result).toEqual(mockVariable);
    });

    it('应该支持按流程实例过滤', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getOne as any).mockResolvedValue(mockVariable);

      await service.findByName('testVar', 'process-1');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.proc_inst_id_ = :processInstanceId',
        { processInstanceId: 'process-1' }
      );
    });
  });

  describe('createBatch', () => {
    it('应该批量创建历史变量', async () => {
      const dtos: CreateHistoricVariableDto[] = [
        { name: 'var1', type: HistoricVariableType.STRING, value: 'value1' },
        { name: 'var2', type: HistoricVariableType.INTEGER, value: 100 },
      ];

      repository.create.mockReturnValue(mockVariable);
      repository.save.mockResolvedValue([mockVariable, mockVariable]);

      const result = await service.createBatch(dtos);

      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('deleteBatch', () => {
    it('应该批量软删除历史变量', async () => {
      repository.update.mockResolvedValue({ affected: 2, raw: {} });

      await service.deleteBatch(['var-1', 'var-2']);

      expect(repository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id_: expect.anything(),
        }),
        { state_: 'DELETED', delete_time_: expect.any(Date) }
      );
    });
  });

  describe('deleteByProcessInstanceId', () => {
    it('应该删除指定流程实例的所有变量', async () => {
      repository.update.mockResolvedValue({ affected: 5, raw: {} });

      await service.deleteByProcessInstanceId('process-1');

      expect(repository.update).toHaveBeenCalledWith(
        { proc_inst_id_: 'process-1' },
        { state_: 'DELETED', delete_time_: expect.any(Date) }
      );
    });
  });

  describe('getStatistics', () => {
    it('应该返回变量统计信息', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getMany as any).mockResolvedValue([
        { ...mockVariable, var_type_: HistoricVariableType.STRING, proc_inst_id_: 'process-1' },
        { ...mockVariable, var_type_: HistoricVariableType.STRING, proc_inst_id_: 'process-1' },
        { ...mockVariable, var_type_: HistoricVariableType.INTEGER, proc_inst_id_: 'process-2' },
      ]);

      const result = await service.getStatistics();

      expect(result.totalCount).toBe(3);
      expect(result.byType[HistoricVariableType.STRING]).toBe(2);
      expect(result.byType[HistoricVariableType.INTEGER]).toBe(1);
      expect(result.averageVariablesPerProcess).toBeCloseTo(1.5);
    });

    it('应该支持按流程实例过滤统计', async () => {
      const mockQueryBuilder = repository.createQueryBuilder();
      (mockQueryBuilder.getMany as any).mockResolvedValue([mockVariable]);

      await service.getStatistics('process-1');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'variable.proc_inst_id_ = :processInstanceId',
        { processInstanceId: 'process-1' }
      );
    });
  });

  describe('getValue', () => {
    it('应该正确获取STRING类型值', () => {
      const variable = { ...mockVariable, var_type_: HistoricVariableType.STRING, text_: 'test' };
      expect(service.getValue(variable as any)).toBe('test');
    });

    it('应该正确获取INTEGER/LONG类型值', () => {
      const variable = { ...mockVariable, var_type_: HistoricVariableType.INTEGER, long_: 100 };
      expect(service.getValue(variable as any)).toBe(100);
    });

    it('应该正确获取DOUBLE类型值', () => {
      const variable = { ...mockVariable, var_type_: HistoricVariableType.DOUBLE, double_: 3.14 };
      expect(service.getValue(variable as any)).toBe(3.14);
    });

    it('应该正确获取BOOLEAN类型值', () => {
      const trueVar = { ...mockVariable, var_type_: HistoricVariableType.BOOLEAN, text_: 'true' };
      expect(service.getValue(trueVar as any)).toBe(true);

      const falseVar = { ...mockVariable, var_type_: HistoricVariableType.BOOLEAN, text_: 'false' };
      expect(service.getValue(falseVar as any)).toBe(false);
    });

    it('应该正确获取DATE类型值', () => {
      const dateStr = '2026-01-01T00:00:00.000Z';
      const variable = { ...mockVariable, var_type_: HistoricVariableType.DATE, text_: dateStr };
      const result = service.getValue(variable as any);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(dateStr);
    });

    it('应该正确获取JSON类型值', () => {
      const jsonObj = { key: 'value' };
      const variable = { ...mockVariable, var_type_: HistoricVariableType.JSON, text_: JSON.stringify(jsonObj) };
      expect(service.getValue(variable as any)).toEqual(jsonObj);
    });

    it('应该正确获取BINARY类型值', () => {
      const buffer = Buffer.from('test');
      const variable = { ...mockVariable, var_type_: HistoricVariableType.BINARY, bytes_: buffer };
      expect(service.getValue(variable as any)).toBe(buffer);
    });
  });
});
