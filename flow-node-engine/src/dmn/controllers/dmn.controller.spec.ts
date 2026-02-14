import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DmnController } from './dmn.controller';
import { DmnService } from '../services/dmn.service';
import {
  CreateDecisionDto,
  UpdateDecisionDto,
  QueryDecisionDto,
  ExecuteDecisionDto,
} from '../dto/dmn.dto';

describe('DmnController', () => {
  let controller: DmnController;
  let service: DmnService;

  const mockDmnService = {
    createDecision: vi.fn(),
    updateDecision: vi.fn(),
    publishDecision: vi.fn(),
    createNewVersion: vi.fn(),
    suspendDecision: vi.fn(),
    activateDecision: vi.fn(),
    deleteDecision: vi.fn(),
    queryDecisions: vi.fn(),
    getDecision: vi.fn(),
    getDecisionByKey: vi.fn(),
    executeDecision: vi.fn(),
    getExecutionHistory: vi.fn(),
    getDecisionStatistics: vi.fn(),
    validateDecision: vi.fn(),
  };

  const mockDecisionResponse = {
    id: 'decision-1',
    key: 'test-decision',
    name: 'Test Decision',
    version: 1,
    status: 'DRAFT',
    hitPolicy: 'FIRST',
    inputs: [],
    outputs: [],
    rules: [],
    tenantId: 'tenant-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDecisionResult = {
    decisionId: 'decision-1',
    decisionKey: 'test-decision',
    inputs: { age: 25 },
    outputs: { result: 'approved' },
    matchedRules: [0],
    executionTime: 10,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DmnController],
      providers: [
        {
          provide: DmnService,
          useValue: mockDmnService,
        },
      ],
    }).compile();

    controller = module.get<DmnController>(DmnController);
    service = module.get<DmnService>(DmnService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createDecision', () => {
    it('should create a decision successfully', async () => {
      const dto: CreateDecisionDto = {
        key: 'test-decision',
        name: 'Test Decision',
        hitPolicy: 'FIRST',
        inputs: [],
        outputs: [],
        rules: [],
        tenantId: 'tenant-1',
      };

      mockDmnService.createDecision.mockResolvedValue(mockDecisionResponse);

      const result = await controller.createDecision(dto);

      expect(service.createDecision).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockDecisionResponse);
    });

    it('should throw error when creation fails', async () => {
      const dto: CreateDecisionDto = {
        key: 'test-decision',
        name: 'Test Decision',
        hitPolicy: 'FIRST',
        inputs: [],
        outputs: [],
        rules: [],
      };

      mockDmnService.createDecision.mockRejectedValue(new Error('Creation failed'));

      await expect(controller.createDecision(dto)).rejects.toThrow('Creation failed');
    });
  });

  describe('updateDecision', () => {
    it('should update a decision successfully', async () => {
      const dto: UpdateDecisionDto = {
        name: 'Updated Decision',
      };

      mockDmnService.updateDecision.mockResolvedValue({
        ...mockDecisionResponse,
        name: 'Updated Decision',
      });

      const result = await controller.updateDecision('decision-1', dto);

      expect(service.updateDecision).toHaveBeenCalledWith('decision-1', dto);
      expect(result.name).toBe('Updated Decision');
    });

    it('should throw error when decision not found', async () => {
      const dto: UpdateDecisionDto = { name: 'Updated' };

      mockDmnService.updateDecision.mockRejectedValue(new Error('Decision not found'));

      await expect(controller.updateDecision('non-existent', dto)).rejects.toThrow('Decision not found');
    });
  });

  describe('publishDecision', () => {
    it('should publish a decision successfully', async () => {
      mockDmnService.publishDecision.mockResolvedValue({
        ...mockDecisionResponse,
        status: 'PUBLISHED',
      });

      const result = await controller.publishDecision('decision-1');

      expect(service.publishDecision).toHaveBeenCalledWith('decision-1');
      expect(result.status).toBe('PUBLISHED');
    });

    it('should throw error when decision already published', async () => {
      mockDmnService.publishDecision.mockRejectedValue(new Error('Decision already published'));

      await expect(controller.publishDecision('decision-1')).rejects.toThrow('Decision already published');
    });
  });

  describe('createNewVersion', () => {
    it('should create a new version successfully', async () => {
      mockDmnService.createNewVersion.mockResolvedValue({
        ...mockDecisionResponse,
        version: 2,
      });

      const result = await controller.createNewVersion('decision-1');

      expect(service.createNewVersion).toHaveBeenCalledWith('decision-1');
      expect(result.version).toBe(2);
    });

    it('should throw error when decision not found', async () => {
      mockDmnService.createNewVersion.mockRejectedValue(new Error('Decision not found'));

      await expect(controller.createNewVersion('non-existent')).rejects.toThrow('Decision not found');
    });
  });

  describe('suspendDecision', () => {
    it('should suspend a decision successfully', async () => {
      mockDmnService.suspendDecision.mockResolvedValue({
        ...mockDecisionResponse,
        status: 'SUSPENDED',
      });

      const result = await controller.suspendDecision('decision-1');

      expect(service.suspendDecision).toHaveBeenCalledWith('decision-1');
      expect(result.status).toBe('SUSPENDED');
    });

    it('should throw error when decision is not published', async () => {
      mockDmnService.suspendDecision.mockRejectedValue(new Error('Only published decisions can be suspended'));

      await expect(controller.suspendDecision('decision-1')).rejects.toThrow('Only published decisions can be suspended');
    });
  });

  describe('activateDecision', () => {
    it('should activate a decision successfully', async () => {
      mockDmnService.activateDecision.mockResolvedValue({
        ...mockDecisionResponse,
        status: 'PUBLISHED',
      });

      const result = await controller.activateDecision('decision-1');

      expect(service.activateDecision).toHaveBeenCalledWith('decision-1');
      expect(result.status).toBe('PUBLISHED');
    });

    it('should throw error when decision is not suspended', async () => {
      mockDmnService.activateDecision.mockRejectedValue(new Error('Only suspended decisions can be activated'));

      await expect(controller.activateDecision('decision-1')).rejects.toThrow('Only suspended decisions can be activated');
    });
  });

  describe('deleteDecision', () => {
    it('should delete a decision successfully', async () => {
      mockDmnService.deleteDecision.mockResolvedValue(undefined);

      await controller.deleteDecision('decision-1');

      expect(service.deleteDecision).toHaveBeenCalledWith('decision-1');
    });

    it('should throw error when decision is published', async () => {
      mockDmnService.deleteDecision.mockRejectedValue(new Error('Published decisions cannot be deleted'));

      await expect(controller.deleteDecision('decision-1')).rejects.toThrow('Published decisions cannot be deleted');
    });
  });

  describe('queryDecisions', () => {
    it('should return a list of decisions', async () => {
      const queryDto: QueryDecisionDto = {
        page: 1,
        size: 10,
      };

      const mockResult = {
        data: [mockDecisionResponse],
        total: 1,
      };

      mockDmnService.queryDecisions.mockResolvedValue(mockResult);

      const result = await controller.queryDecisions(queryDto);

      expect(service.queryDecisions).toHaveBeenCalledWith(queryDto);
      expect(result).toEqual(mockResult);
    });

    it('should filter decisions by status', async () => {
      const queryDto: QueryDecisionDto = {
        status: 'PUBLISHED',
        page: 1,
        size: 10,
      };

      mockDmnService.queryDecisions.mockResolvedValue({
        data: [{ ...mockDecisionResponse, status: 'PUBLISHED' }],
        total: 1,
      });

      const result = await controller.queryDecisions(queryDto);

      expect(service.queryDecisions).toHaveBeenCalledWith(queryDto);
      expect(result.data[0].status).toBe('PUBLISHED');
    });
  });

  describe('getDecision', () => {
    it('should return a decision by id', async () => {
      mockDmnService.getDecision.mockResolvedValue(mockDecisionResponse);

      const result = await controller.getDecision('decision-1');

      expect(service.getDecision).toHaveBeenCalledWith('decision-1');
      expect(result).toEqual(mockDecisionResponse);
    });

    it('should throw error when decision not found', async () => {
      mockDmnService.getDecision.mockRejectedValue(new Error('Decision not found'));

      await expect(controller.getDecision('non-existent')).rejects.toThrow('Decision not found');
    });
  });

  describe('getDecisionByKey', () => {
    it('should return a decision by key', async () => {
      mockDmnService.getDecisionByKey.mockResolvedValue(mockDecisionResponse);

      const result = await controller.getDecisionByKey('test-decision');

      expect(service.getDecisionByKey).toHaveBeenCalledWith('test-decision', undefined);
      expect(result).toEqual(mockDecisionResponse);
    });

    it('should return a decision by key with tenantId', async () => {
      mockDmnService.getDecisionByKey.mockResolvedValue(mockDecisionResponse);

      const result = await controller.getDecisionByKey('test-decision', 'tenant-1');

      expect(service.getDecisionByKey).toHaveBeenCalledWith('test-decision', 'tenant-1');
      expect(result).toEqual(mockDecisionResponse);
    });

    it('should throw error when decision not found', async () => {
      mockDmnService.getDecisionByKey.mockRejectedValue(new Error('Decision not found'));

      await expect(controller.getDecisionByKey('non-existent')).rejects.toThrow('Decision not found');
    });
  });

  describe('executeDecision', () => {
    it('should execute a decision successfully', async () => {
      const dto: ExecuteDecisionDto = {
        decisionKey: 'test-decision',
        inputs: { age: 25 },
      };

      mockDmnService.executeDecision.mockResolvedValue(mockDecisionResult);

      const result = await controller.executeDecision(dto);

      expect(service.executeDecision).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockDecisionResult);
    });

    it('should execute a decision by id', async () => {
      const dto: ExecuteDecisionDto = {
        decisionId: 'decision-1',
        inputs: { age: 25 },
      };

      mockDmnService.executeDecision.mockResolvedValue(mockDecisionResult);

      const result = await controller.executeDecision(dto);

      expect(service.executeDecision).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockDecisionResult);
    });

    it('should throw error when decision not found', async () => {
      const dto: ExecuteDecisionDto = {
        decisionKey: 'non-existent',
        inputs: {},
      };

      mockDmnService.executeDecision.mockRejectedValue(new Error('Decision not found'));

      await expect(controller.executeDecision(dto)).rejects.toThrow('Decision not found');
    });
  });

  describe('getExecutionHistory', () => {
    it('should return execution history', async () => {
      const mockHistory = {
        data: [
          {
            id: 'exec-1',
            decisionId: 'decision-1',
            inputs: { age: 25 },
            outputs: { result: 'approved' },
            executedAt: new Date(),
            executionTime: 10,
          },
        ],
        total: 1,
      };

      mockDmnService.getExecutionHistory.mockResolvedValue(mockHistory);

      const result = await controller.getExecutionHistory('decision-1');

      expect(service.getExecutionHistory).toHaveBeenCalledWith('decision-1', undefined, undefined, undefined);
      expect(result).toEqual(mockHistory);
    });

    it('should filter history by processInstanceId', async () => {
      const mockHistory = {
        data: [],
        total: 0,
      };

      mockDmnService.getExecutionHistory.mockResolvedValue(mockHistory);

      const result = await controller.getExecutionHistory(undefined, 'process-1', 1, 10);

      expect(service.getExecutionHistory).toHaveBeenCalledWith(undefined, 'process-1', 1, 10);
      expect(result).toEqual(mockHistory);
    });
  });

  describe('getDecisionStatistics', () => {
    it('should return decision statistics', async () => {
      const mockStats = {
        totalExecutions: 100,
        successCount: 95,
        failedCount: 5,
        noMatchCount: 10,
        avgExecutionTime: 15,
      };

      mockDmnService.getDecisionStatistics.mockResolvedValue(mockStats);

      const result = await controller.getDecisionStatistics('decision-1');

      expect(service.getDecisionStatistics).toHaveBeenCalledWith('decision-1');
      expect(result).toEqual(mockStats);
    });

    it('should throw error when decision not found', async () => {
      mockDmnService.getDecisionStatistics.mockRejectedValue(new Error('Decision not found'));

      await expect(controller.getDecisionStatistics('non-existent')).rejects.toThrow('Decision not found');
    });
  });

  describe('validateDecision', () => {
    it('should return validation result for valid decision', async () => {
      const mockValidation = {
        valid: true,
        errors: [],
        warnings: [],
      };

      mockDmnService.validateDecision.mockResolvedValue(mockValidation);

      const result = await controller.validateDecision('decision-1');

      expect(service.validateDecision).toHaveBeenCalledWith('decision-1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation result for invalid decision', async () => {
      const mockValidation = {
        valid: false,
        errors: ['Missing required input', 'Invalid rule condition'],
        warnings: ['No outputs defined'],
      };

      mockDmnService.validateDecision.mockResolvedValue(mockValidation);

      const result = await controller.validateDecision('decision-1');

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
    });

    it('should throw error when decision not found', async () => {
      mockDmnService.validateDecision.mockRejectedValue(new Error('Decision not found'));

      await expect(controller.validateDecision('non-existent')).rejects.toThrow('Decision not found');
    });
  });
});
