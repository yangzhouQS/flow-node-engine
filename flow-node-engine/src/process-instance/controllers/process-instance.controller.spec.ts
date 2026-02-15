import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { ProcessInstanceService } from '../services/process-instance.service';
import { ProcessInstanceController } from './process-instance.controller';

describe('ProcessInstanceController', () => {
  let controller: ProcessInstanceController;
  let service: ProcessInstanceService;

  const mockProcessInstance = {
    id: 'pi-1',
    processDefinitionId: 'pd-1',
    businessKey: 'BK-001',
    startUserId: 'user-1',
    tenantId: 'tenant-1',
    state: 'ACTIVE',
    startTime: new Date(),
    endTime: null,
    created: new Date(),
    updated: new Date(),
  };

  const mockService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByBusinessKey: vi.fn(),
    findByProcessDefinitionId: vi.fn(),
    update: vi.fn(),
    updateVariables: vi.fn(),
    getVariables: vi.fn(),
    getVariable: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    suspend: vi.fn(),
    activate: vi.fn(),
    complete: vi.fn(),
    getExecutions: vi.fn(),
    getVariableList: vi.fn(),
    count: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessInstanceController],
      providers: [
        {
          provide: ProcessInstanceService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ProcessInstanceController>(ProcessInstanceController);
    service = module.get<ProcessInstanceService>(ProcessInstanceService);
  });

  describe('create', () => {
    it('应该成功创建流程实例', async () => {
      const createDto = {
        processDefinitionId: 'pd-1',
        businessKey: 'BK-001',
        startUserId: 'user-1',
        variables: {},
        tenantId: 'tenant-1',
      };

      mockService.create.mockResolvedValue(mockProcessInstance);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(
        'pd-1',
        'BK-001',
        'user-1',
        {},
        'tenant-1',
      );
      expect(result).toBeInstanceOf(ApiResponseDto);
      expect(result.code).toBe(201);
      expect(result.data).toEqual(mockProcessInstance);
    });

    it('应该处理创建失败的情况', async () => {
      const createDto = {
        processDefinitionId: 'non-existent',
        businessKey: 'BK-001',
        startUserId: 'user-1',
      };

      mockService.create.mockRejectedValue(new Error('Process definition not found'));

      await expect(controller.create(createDto)).rejects.toThrow('Process definition not found');
    });
  });

  describe('findAll', () => {
    it('应该返回所有流程实例', async () => {
      const query = { page: 1, pageSize: 10 };
      mockService.findAll.mockResolvedValue({ data: [mockProcessInstance], total: 1 });

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(1, 10, undefined, undefined);
      expect(result.code).toBe(200);
      expect(result.data).toEqual([mockProcessInstance]);
    });

    it('应该根据processDefinitionId过滤', async () => {
      const query = { page: 1, pageSize: 10, processDefinitionId: 'pd-1' };
      mockService.findByProcessDefinitionId.mockResolvedValue({ data: [mockProcessInstance], total: 1 });

      const result = await controller.findAll(query);

      expect(service.findByProcessDefinitionId).toHaveBeenCalledWith('pd-1', 1, 10);
      expect(result.code).toBe(200);
    });

    it('应该根据businessKey过滤', async () => {
      const query = { page: 1, pageSize: 10, businessKey: 'BK-001', tenantId: 'tenant-1' };
      mockService.findByBusinessKey.mockResolvedValue(mockProcessInstance);

      const result = await controller.findAll(query);

      expect(service.findByBusinessKey).toHaveBeenCalledWith('BK-001', 'tenant-1');
      expect(result.code).toBe(200);
    });

    it('应该根据state和tenantId过滤', async () => {
      const query = { page: 1, pageSize: 10, state: 'ACTIVE', tenantId: 'tenant-1' };
      mockService.findAll.mockResolvedValue({ data: [mockProcessInstance], total: 1 });

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(1, 10, 'ACTIVE', 'tenant-1');
      expect(result.code).toBe(200);
    });
  });

  describe('findById', () => {
    it('应该根据ID返回流程实例', async () => {
      mockService.findById.mockResolvedValue(mockProcessInstance);

      const result = await controller.findById('pi-1');

      expect(service.findById).toHaveBeenCalledWith('pi-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockProcessInstance);
    });

    it('应该处理流程实例不存在的情况', async () => {
      mockService.findById.mockResolvedValue(null);

      const result = await controller.findById('non-existent');

      expect(result.code).toBe(200);
      expect(result.data).toBeNull();
    });
  });

  describe('findByBusinessKey', () => {
    it('应该根据businessKey返回流程实例', async () => {
      mockService.findByBusinessKey.mockResolvedValue(mockProcessInstance);

      const result = await controller.findByBusinessKey('BK-001', 'tenant-1');

      expect(service.findByBusinessKey).toHaveBeenCalledWith('BK-001', 'tenant-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockProcessInstance);
    });

    it('应该处理没有tenantId的情况', async () => {
      mockService.findByBusinessKey.mockResolvedValue(mockProcessInstance);

      const result = await controller.findByBusinessKey('BK-001');

      expect(service.findByBusinessKey).toHaveBeenCalledWith('BK-001', undefined);
      expect(result.code).toBe(200);
    });
  });

  describe('update', () => {
    it('应该成功更新流程实例', async () => {
      const updateDto = { state: 'SUSPENDED' };
      const updatedInstance = { ...mockProcessInstance, state: 'SUSPENDED' };
      mockService.update.mockResolvedValue(updatedInstance);

      const result = await controller.update('pi-1', updateDto);

      expect(service.update).toHaveBeenCalledWith('pi-1', updateDto);
      expect(result.code).toBe(200);
      expect(result.data).toEqual(updatedInstance);
    });

    it('应该处理更新失败的情况', async () => {
      const updateDto = { state: 'SUSPENDED' };
      mockService.update.mockRejectedValue(new Error('Process instance not found'));

      await expect(controller.update('non-existent', updateDto)).rejects.toThrow('Process instance not found');
    });
  });

  describe('updateVariables', () => {
    it('应该成功更新流程实例变量', async () => {
      const updateDto = { variables: { key: 'value' } };
      mockService.updateVariables.mockResolvedValue(mockProcessInstance);

      const result = await controller.updateVariables('pi-1', updateDto);

      expect(service.updateVariables).toHaveBeenCalledWith('pi-1', { key: 'value' });
      expect(result.code).toBe(200);
    });
  });

  describe('getVariables', () => {
    it('应该返回流程实例的所有变量', async () => {
      const variables = { key1: 'value1', key2: 'value2' };
      mockService.getVariables.mockResolvedValue(variables);

      const result = await controller.getVariables('pi-1');

      expect(service.getVariables).toHaveBeenCalledWith('pi-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(variables);
    });
  });

  describe('getVariable', () => {
    it('应该返回流程实例的单个变量', async () => {
      mockService.getVariable.mockResolvedValue('value1');

      const result = await controller.getVariable('pi-1', 'key1');

      expect(service.getVariable).toHaveBeenCalledWith('pi-1', 'key1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual({ name: 'key1', value: 'value1' });
    });

    it('应该处理变量不存在的情况', async () => {
      mockService.getVariable.mockResolvedValue(undefined);

      const result = await controller.getVariable('pi-1', 'non-existent');

      expect(result.data).toEqual({ name: 'non-existent', value: undefined });
    });
  });

  describe('delete', () => {
    it('应该成功删除流程实例', async () => {
      mockService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('pi-1', 'test reason');

      expect(service.delete).toHaveBeenCalledWith('pi-1', 'test reason');
      expect(result.code).toBe(200);
    });

    it('应该处理没有删除原因的情况', async () => {
      mockService.delete.mockResolvedValue(undefined);

      const result = await controller.delete('pi-1');

      expect(service.delete).toHaveBeenCalledWith('pi-1', undefined);
      expect(result.code).toBe(200);
    });
  });

  describe('deleteMany', () => {
    it('应该成功批量删除流程实例', async () => {
      mockService.deleteMany.mockResolvedValue(undefined);

      const result = await controller.deleteMany(['pi-1', 'pi-2'], 'batch delete');

      expect(service.deleteMany).toHaveBeenCalledWith(['pi-1', 'pi-2'], 'batch delete');
      expect(result.code).toBe(200);
    });
  });

  describe('suspend', () => {
    it('应该成功挂起流程实例', async () => {
      const suspendedInstance = { ...mockProcessInstance, state: 'SUSPENDED' };
      mockService.suspend.mockResolvedValue(suspendedInstance);

      const result = await controller.suspend('pi-1');

      expect(service.suspend).toHaveBeenCalledWith('pi-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(suspendedInstance);
    });
  });

  describe('activate', () => {
    it('应该成功激活流程实例', async () => {
      mockService.activate.mockResolvedValue(mockProcessInstance);

      const result = await controller.activate('pi-1');

      expect(service.activate).toHaveBeenCalledWith('pi-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(mockProcessInstance);
    });
  });

  describe('complete', () => {
    it('应该成功完成流程实例', async () => {
      const completedInstance = { ...mockProcessInstance, state: 'COMPLETED', endTime: new Date() };
      mockService.complete.mockResolvedValue(completedInstance);

      const result = await controller.complete('pi-1');

      expect(service.complete).toHaveBeenCalledWith('pi-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(completedInstance);
    });
  });

  describe('getExecutions', () => {
    it('应该返回流程实例的执行列表', async () => {
      const executions = [{ id: 'e-1', processInstanceId: 'pi-1' }];
      mockService.getExecutions.mockResolvedValue(executions);

      const result = await controller.getExecutions('pi-1');

      expect(service.getExecutions).toHaveBeenCalledWith('pi-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(executions);
    });
  });

  describe('getVariableList', () => {
    it('应该返回流程实例的变量列表', async () => {
      const variables = [{ name: 'key1', value: 'value1' }];
      mockService.getVariableList.mockResolvedValue(variables);

      const result = await controller.getVariableList('pi-1');

      expect(service.getVariableList).toHaveBeenCalledWith('pi-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual(variables);
    });
  });

  describe('count', () => {
    it('应该返回流程实例数量', async () => {
      mockService.count.mockResolvedValue(10);

      const result = await controller.count('ACTIVE', 'tenant-1');

      expect(service.count).toHaveBeenCalledWith('ACTIVE', 'tenant-1');
      expect(result.code).toBe(200);
      expect(result.data).toEqual({ count: 10 });
    });

    it('应该处理没有过滤条件的情况', async () => {
      mockService.count.mockResolvedValue(5);

      const result = await controller.count();

      expect(service.count).toHaveBeenCalledWith(undefined, undefined);
      expect(result.code).toBe(200);
      expect(result.data).toEqual({ count: 5 });
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
