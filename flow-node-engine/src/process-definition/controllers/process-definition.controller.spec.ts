import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProcessDefinition } from '../entities/process-definition.entity';
import { ProcessDefinitionService } from '../services/process-definition.service';
import { ProcessDefinitionController } from './process-definition.controller';

describe('ProcessDefinitionController', () => {
  let controller: ProcessDefinitionController;
  let service: ProcessDefinitionService;

  const mockProcessDefinition = {
    id: 'pd-1',
    key: 'test-process',
    name: 'Test Process',
    version: 1,
    category: 'test',
    bpmnXml: '<definitions></definitions>',
    deploymentId: 'dep-1',
    resourceName: 'test.bpmn',
    suspensionState: 'ACTIVE',
    tenantId: 'tenant-1',
    startTime: new Date(),
    endTime: null,
    created: new Date(),
    updated: new Date(),
    deployment: null,
    isSuspended: false,
    createTime: new Date(),
  } as unknown as ProcessDefinition;

  const mockService = {
    deploy: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    findByKey: vi.fn(),
    findByKeyAndVersion: vi.fn(),
    activate: vi.fn(),
    suspend: vi.fn(),
    delete: vi.fn(),
    getDiagram: vi.fn(),
    getBpmnXml: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessDefinitionController],
      providers: [
        {
          provide: ProcessDefinitionService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ProcessDefinitionController>(ProcessDefinitionController);
    service = module.get<ProcessDefinitionService>(ProcessDefinitionService);
  });

  describe('deploy', () => {
    it('应该成功部署流程定义', async () => {
      const deployDto = {
        name: 'Test Process',
        bpmnXml: '<definitions></definitions>',
        key: 'test-process',
      };

      mockService.deploy.mockResolvedValue(mockProcessDefinition);

      const result = await controller.deploy(deployDto);

      expect(service.deploy).toHaveBeenCalledWith(deployDto);
      expect(result).toEqual(mockProcessDefinition);
    });

    it('应该处理部署失败的情况', async () => {
      const deployDto = {
        name: 'Test Process',
        bpmnXml: 'invalid-xml',
        key: 'test-process',
      };

      mockService.deploy.mockRejectedValue(new Error('Invalid BPMN XML'));

      await expect(controller.deploy(deployDto)).rejects.toThrow('Invalid BPMN XML');
    });
  });

  describe('findAll', () => {
    it('应该返回所有流程定义', async () => {
      const definitions = [mockProcessDefinition];
      mockService.findAll.mockResolvedValue(definitions);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
      expect(result).toEqual(definitions);
    });

    it('应该根据key过滤流程定义', async () => {
      const definitions = [mockProcessDefinition];
      mockService.findAll.mockResolvedValue(definitions);

      const result = await controller.findAll('test-process');

      expect(service.findAll).toHaveBeenCalledWith('test-process', undefined);
      expect(result).toEqual(definitions);
    });

    it('应该根据category过滤流程定义', async () => {
      const definitions = [mockProcessDefinition];
      mockService.findAll.mockResolvedValue(definitions);

      const result = await controller.findAll(undefined, 'test');

      expect(service.findAll).toHaveBeenCalledWith(undefined, 'test');
      expect(result).toEqual(definitions);
    });

    it('应该同时根据key和category过滤流程定义', async () => {
      const definitions = [mockProcessDefinition];
      mockService.findAll.mockResolvedValue(definitions);

      const result = await controller.findAll('test-process', 'test');

      expect(service.findAll).toHaveBeenCalledWith('test-process', 'test');
      expect(result).toEqual(definitions);
    });

    it('应该返回空数组当没有匹配的流程定义', async () => {
      mockService.findAll.mockResolvedValue([]);

      const result = await controller.findAll('non-existent');

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('应该根据ID返回流程定义', async () => {
      mockService.findById.mockResolvedValue(mockProcessDefinition);

      const result = await controller.findById('pd-1');

      expect(service.findById).toHaveBeenCalledWith('pd-1');
      expect(result).toEqual(mockProcessDefinition);
    });

    it('应该返回null当流程定义不存在', async () => {
      mockService.findById.mockResolvedValue(null);

      const result = await controller.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByKey', () => {
    it('应该根据key返回最新版本的流程定义', async () => {
      mockService.findByKey.mockResolvedValue(mockProcessDefinition);

      const result = await controller.findByKey('test-process');

      expect(service.findByKey).toHaveBeenCalledWith('test-process');
      expect(result).toEqual(mockProcessDefinition);
    });

    it('应该返回null当key不存在', async () => {
      mockService.findByKey.mockResolvedValue(null);

      const result = await controller.findByKey('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByKeyAndVersion', () => {
    it('应该根据key和version返回流程定义', async () => {
      mockService.findByKeyAndVersion.mockResolvedValue(mockProcessDefinition);

      const result = await controller.findByKeyAndVersion('test-process', 1);

      expect(service.findByKeyAndVersion).toHaveBeenCalledWith('test-process', 1);
      expect(result).toEqual(mockProcessDefinition);
    });

    it('应该返回null当指定版本的流程定义不存在', async () => {
      mockService.findByKeyAndVersion.mockResolvedValue(null);

      const result = await controller.findByKeyAndVersion('test-process', 999);

      expect(result).toBeNull();
    });
  });

  describe('activate', () => {
    it('应该成功激活流程定义', async () => {
      mockService.activate.mockResolvedValue(undefined);

      await controller.activate('pd-1');

      expect(service.activate).toHaveBeenCalledWith('pd-1');
    });

    it('应该处理激活失败的情况', async () => {
      mockService.activate.mockRejectedValue(new Error('Process definition not found'));

      await expect(controller.activate('non-existent')).rejects.toThrow('Process definition not found');
    });
  });

  describe('suspend', () => {
    it('应该成功挂起流程定义', async () => {
      mockService.suspend.mockResolvedValue(undefined);

      await controller.suspend('pd-1');

      expect(service.suspend).toHaveBeenCalledWith('pd-1');
    });

    it('应该处理挂起失败的情况', async () => {
      mockService.suspend.mockRejectedValue(new Error('Process definition not found'));

      await expect(controller.suspend('non-existent')).rejects.toThrow('Process definition not found');
    });
  });

  describe('delete', () => {
    it('应该成功删除流程定义', async () => {
      mockService.delete.mockResolvedValue(undefined);

      await controller.delete('pd-1');

      expect(service.delete).toHaveBeenCalledWith('pd-1');
    });

    it('应该处理删除失败的情况', async () => {
      mockService.delete.mockRejectedValue(new Error('Process definition not found'));

      await expect(controller.delete('non-existent')).rejects.toThrow('Process definition not found');
    });
  });

  describe('getDiagram', () => {
    it('应该返回流程图', async () => {
      const diagramXml = '<diagram></diagram>';
      mockService.getDiagram.mockResolvedValue(diagramXml);

      const result = await controller.getDiagram('pd-1');

      expect(service.getDiagram).toHaveBeenCalledWith('pd-1');
      expect(result).toBe(diagramXml);
    });

    it('应该返回null当流程图不存在', async () => {
      mockService.getDiagram.mockResolvedValue(null);

      const result = await controller.getDiagram('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getBpmnXml', () => {
    it('应该返回BPMN XML', async () => {
      const bpmnXml = '<definitions></definitions>';
      mockService.getBpmnXml.mockResolvedValue(bpmnXml);

      const result = await controller.getBpmnXml('pd-1');

      expect(service.getBpmnXml).toHaveBeenCalledWith('pd-1');
      expect(result).toBe(bpmnXml);
    });

    it('应该处理获取BPMN XML失败的情况', async () => {
      mockService.getBpmnXml.mockRejectedValue(new Error('Process definition not found'));

      await expect(controller.getBpmnXml('non-existent')).rejects.toThrow('Process definition not found');
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
