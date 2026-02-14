import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProcessDefinitionService } from './process-definition.service';
import { ProcessDefinition } from '../entities/process-definition.entity';
import { Deployment } from '../entities/deployment.entity';
import { BpmnParserService } from '../../core/services/bpmn-parser.service';
import { BusinessException } from '../../common/exceptions/business.exception';

describe('ProcessDefinitionService', () => {
  let service: ProcessDefinitionService;
  let processDefinitionRepository: Repository<ProcessDefinition>;
  let deploymentRepository: Repository<Deployment>;
  let bpmnParser: BpmnParserService;

  const mockProcessDefinitionRepository = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    delete: vi.fn(),
    createQueryBuilder: vi.fn(),
    update: vi.fn(),
  };

  const mockDeploymentRepository = {
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockBpmnParser = {
    parse: vi.fn(),
    generateDiagram: vi.fn(),
  };

  const mockBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
  <process id="testProcess" name="Test Process">
    <startEvent id="start" />
    <endEvent id="end" />
  </process>
</definitions>`;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessDefinitionService,
        {
          provide: getRepositoryToken(ProcessDefinition),
          useValue: mockProcessDefinitionRepository,
        },
        {
          provide: getRepositoryToken(Deployment),
          useValue: mockDeploymentRepository,
        },
        {
          provide: BpmnParserService,
          useValue: mockBpmnParser,
        },
      ],
    }).compile();

    service = module.get<ProcessDefinitionService>(ProcessDefinitionService);
    processDefinitionRepository = module.get(getRepositoryToken(ProcessDefinition));
    deploymentRepository = module.get(getRepositoryToken(Deployment));
    bpmnParser = module.get(BpmnParserService);

    // Reset all mocks
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deploy', () => {
    it('should deploy a new process definition successfully', async () => {
      const dto = {
        name: 'Test Process',
        key: 'test-process',
        bpmnXml: mockBpmnXml,
        generateDiagram: false,
      };

      mockBpmnParser.parse.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockProcessDefinitionRepository.findOne.mockResolvedValue(null);
      mockDeploymentRepository.create.mockReturnValue({ id: 'deploy-1' });
      mockDeploymentRepository.save.mockResolvedValue({ id: 'deploy-1' });
      mockProcessDefinitionRepository.create.mockReturnValue({
        id: 'proc-def-1',
        key: dto.key,
        version: 1,
      });
      mockProcessDefinitionRepository.save.mockResolvedValue({
        id: 'proc-def-1',
        key: dto.key,
        version: 1,
      });

      const result = await service.deploy(dto);

      expect(mockBpmnParser.parse).toHaveBeenCalledWith(dto.bpmnXml);
      expect(mockDeploymentRepository.save).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'proc-def-1',
        key: dto.key,
        version: 1,
      });
    });

    it('should throw BusinessException for invalid BPMN XML', async () => {
      const dto = {
        name: 'Test Process',
        key: 'test-process',
        bpmnXml: 'invalid xml',
        generateDiagram: false,
      };

      mockBpmnParser.parse.mockResolvedValue({
        isValid: false,
        errors: ['Invalid XML structure'],
        warnings: [],
      });

      await expect(service.deploy(dto)).rejects.toThrow(BusinessException);
      await expect(service.deploy(dto)).rejects.toThrow('BPMN XML 验证失败');
    });

    it('should increment version for existing process definition', async () => {
      const dto = {
        name: 'Test Process',
        key: 'test-process',
        bpmnXml: mockBpmnXml,
        generateDiagram: false,
      };

      mockBpmnParser.parse.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockProcessDefinitionRepository.findOne.mockResolvedValue({
        id: 'existing-id',
        key: dto.key,
        version: 1,
        deploymentId: 'deploy-1',
      });

      mockDeploymentRepository.create.mockReturnValue({ id: 'deploy-2' });
      mockDeploymentRepository.save.mockResolvedValue({ id: 'deploy-2' });
      mockProcessDefinitionRepository.create.mockReturnValue({
        id: 'proc-def-2',
        key: dto.key,
        version: 2,
      });
      mockProcessDefinitionRepository.save.mockResolvedValue({
        id: 'proc-def-2',
        key: dto.key,
        version: 2,
      });

      const result = await service.deploy(dto);

      expect(result.version).toBe(2);
    });

    it('should generate diagram when requested', async () => {
      const dto = {
        name: 'Test Process',
        key: 'test-process',
        bpmnXml: mockBpmnXml,
        generateDiagram: true,
      };

      mockBpmnParser.parse.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockBpmnParser.generateDiagram.mockResolvedValue('<svg>diagram</svg>');

      mockProcessDefinitionRepository.findOne.mockResolvedValue(null);
      mockDeploymentRepository.create.mockReturnValue({ id: 'deploy-1' });
      mockDeploymentRepository.save.mockResolvedValue({ id: 'deploy-1' });
      mockProcessDefinitionRepository.create.mockReturnValue({
        id: 'proc-def-1',
        diagramSvg: '<svg>diagram</svg>',
      });
      mockProcessDefinitionRepository.save.mockResolvedValue({
        id: 'proc-def-1',
        diagramSvg: '<svg>diagram</svg>',
      });

      const result = await service.deploy(dto);

      expect(mockBpmnParser.generateDiagram).toHaveBeenCalledWith(dto.bpmnXml);
    });
  });

  describe('findAll', () => {
    it('should return all process definitions', async () => {
      const mockDefinitions = [
        { id: '1', key: 'process-1', version: 1 },
        { id: '2', key: 'process-2', version: 1 },
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockDefinitions),
      };

      mockProcessDefinitionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll();

      expect(result).toEqual(mockDefinitions);
    });

    it('should filter by key when provided', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };

      mockProcessDefinitionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll('test-key');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'pd.key = :key',
        { key: 'test-key' }
      );
    });

    it('should filter by category when provided', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };

      mockProcessDefinitionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, 'test-category');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'pd.category = :category',
        { category: 'test-category' }
      );
    });
  });

  describe('findById', () => {
    it('should return process definition by id', async () => {
      const mockDefinition = { id: 'proc-1', key: 'test-process' };

      mockProcessDefinitionRepository.findOne.mockResolvedValue(mockDefinition);

      const result = await service.findById('proc-1');

      expect(result).toEqual(mockDefinition);
    });

    it('should return null if not found', async () => {
      mockProcessDefinitionRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByKey', () => {
    it('should return latest version by key', async () => {
      const mockDefinition = { id: 'proc-1', key: 'test-process', version: 2 };

      mockProcessDefinitionRepository.findOne.mockResolvedValue(mockDefinition);

      const result = await service.findByKey('test-process');

      expect(result).toEqual(mockDefinition);
    });
  });

  describe('findByKeyAndVersion', () => {
    it('should return specific version', async () => {
      const mockDefinition = { id: 'proc-1', key: 'test-process', version: 1 };

      mockProcessDefinitionRepository.findOne.mockResolvedValue(mockDefinition);

      const result = await service.findByKeyAndVersion('test-process', 1);

      expect(result).toEqual(mockDefinition);
    });
  });

  describe('activate', () => {
    it('should activate process definition', async () => {
      const mockDefinition = {
        id: 'proc-1',
        key: 'test-process',
        isSuspended: true,
      };

      mockProcessDefinitionRepository.findOne.mockResolvedValue(mockDefinition);
      mockProcessDefinitionRepository.save.mockResolvedValue({
        ...mockDefinition,
        isSuspended: false,
      });

      await service.activate('proc-1');

      expect(mockProcessDefinitionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isSuspended: false })
      );
    });

    it('should throw BusinessException if not found', async () => {
      mockProcessDefinitionRepository.findOne.mockResolvedValue(null);

      await expect(service.activate('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('suspend', () => {
    it('should suspend process definition', async () => {
      const mockDefinition = {
        id: 'proc-1',
        key: 'test-process',
        isSuspended: false,
      };

      mockProcessDefinitionRepository.findOne.mockResolvedValue(mockDefinition);
      mockProcessDefinitionRepository.save.mockResolvedValue({
        ...mockDefinition,
        isSuspended: true,
      });

      await service.suspend('proc-1');

      expect(mockProcessDefinitionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isSuspended: true })
      );
    });

    it('should throw BusinessException if not found', async () => {
      mockProcessDefinitionRepository.findOne.mockResolvedValue(null);

      await expect(service.suspend('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('delete', () => {
    it('should delete process definition and deployment', async () => {
      const mockDefinition = {
        id: 'proc-1',
        key: 'test-process',
        deploymentId: 'deploy-1',
      };

      mockProcessDefinitionRepository.findOne.mockResolvedValue(mockDefinition);
      mockProcessDefinitionRepository.delete.mockResolvedValue({ affected: 1 });
      mockDeploymentRepository.delete.mockResolvedValue({ affected: 1 });

      await service.delete('proc-1');

      expect(mockProcessDefinitionRepository.delete).toHaveBeenCalledWith('proc-1');
      expect(mockDeploymentRepository.delete).toHaveBeenCalledWith('deploy-1');
    });

    it('should throw BusinessException if not found', async () => {
      mockProcessDefinitionRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('getDiagram', () => {
    it('should return diagram SVG', async () => {
      const mockDefinition = {
        id: 'proc-1',
        diagramSvg: '<svg>diagram</svg>',
      };

      mockProcessDefinitionRepository.findOne.mockResolvedValue(mockDefinition);

      const result = await service.getDiagram('proc-1');

      expect(result).toBe('<svg>diagram</svg>');
    });

    it('should return null if no diagram', async () => {
      const mockDefinition = {
        id: 'proc-1',
        diagramSvg: null,
      };

      mockProcessDefinitionRepository.findOne.mockResolvedValue(mockDefinition);

      const result = await service.getDiagram('proc-1');

      expect(result).toBeNull();
    });

    it('should throw BusinessException if not found', async () => {
      mockProcessDefinitionRepository.findOne.mockResolvedValue(null);

      await expect(service.getDiagram('non-existent')).rejects.toThrow(BusinessException);
    });
  });

  describe('getBpmnXml', () => {
    it('should return BPMN XML', async () => {
      const mockDefinition = {
        id: 'proc-1',
        bpmnXml: mockBpmnXml,
      };

      mockProcessDefinitionRepository.findOne.mockResolvedValue(mockDefinition);

      const result = await service.getBpmnXml('proc-1');

      expect(result).toBe(mockBpmnXml);
    });

    it('should throw BusinessException if not found', async () => {
      mockProcessDefinitionRepository.findOne.mockResolvedValue(null);

      await expect(service.getBpmnXml('non-existent')).rejects.toThrow(BusinessException);
    });
  });
});
