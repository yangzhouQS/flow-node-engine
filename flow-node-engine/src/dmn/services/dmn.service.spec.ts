import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { DmnService } from './dmn.service';
import { RuleEngineExecutorService } from './rule-engine-executor.service';
import { DmnDecisionEntity, DmnDecisionStatus, AggregationType } from '../entities/dmn-decision.entity';
import { DmnExecutionEntity, DmnExecutionStatus } from '../entities/dmn-execution.entity';

describe('DmnService', () => {
  let service: DmnService;
  let decisionRepository: vi.Mocked<Repository<DmnDecisionEntity>>;
  let executionRepository: vi.Mocked<Repository<DmnExecutionEntity>>;
  let ruleEngineExecutor: vi.Mocked<RuleEngineExecutorService>;

  const mockDecision: DmnDecisionEntity = {
    id: 'decision-1',
    decisionKey: 'approval-decision',
    name: '审批决策',
    description: '用于审批流程的决策表',
    category: 'approval',
    version: 1,
    status: DmnDecisionStatus.DRAFT,
    hitPolicy: 'FIRST',
    aggregation: AggregationType.NONE,
    inputs: JSON.stringify([{ name: 'amount', type: 'number' }]),
    outputs: JSON.stringify([{ name: 'approved', type: 'boolean' }]),
    rules: JSON.stringify([{ input: { amount: 1000 }, output: { approved: true } }]),
    ruleCount: 1,
    tenantId: null,
    extra: null,
    createTime: new Date(),
    updateTime: null,
    publishTime: null,
  };

  const mockExecution: DmnExecutionEntity = {
    id: 'exec-1',
    decisionId: 'decision-1',
    decisionKey: 'approval-decision',
    decisionVersion: 1,
    status: DmnExecutionStatus.SUCCESS,
    inputData: JSON.stringify({ amount: 1000 }),
    outputResult: JSON.stringify({ approved: true }),
    errorMessage: null,
    matchedCount: 1,
    executionTimeMs: 15,
    processInstanceId: 'pi-1',
    activityId: 'task-1',
    createTime: new Date(),
  };

  beforeEach(async () => {
    decisionRepository = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as vi.Mocked<Repository<DmnDecisionEntity>>;

    executionRepository = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as vi.Mocked<Repository<DmnExecutionEntity>>;

    ruleEngineExecutor = {
      execute: vi.fn(),
      validateDecision: vi.fn(),
    } as unknown as vi.Mocked<RuleEngineExecutorService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DmnService,
        {
          provide: getRepositoryToken(DmnDecisionEntity),
          useValue: decisionRepository,
        },
        {
          provide: getRepositoryToken(DmnExecutionEntity),
          useValue: executionRepository,
        },
        {
          provide: RuleEngineExecutorService,
          useValue: ruleEngineExecutor,
        },
      ],
    }).compile();

    service = module.get<DmnService>(DmnService);
  });

  describe('createDecision', () => {
    it('应该成功创建决策', async () => {
      decisionRepository.findOne.mockResolvedValue(null);
      decisionRepository.create.mockReturnValue(mockDecision);
      decisionRepository.save.mockResolvedValue(mockDecision);

      const result = await service.createDecision({
        decisionKey: 'approval-decision',
        name: '审批决策',
        hitPolicy: 'FIRST',
        inputs: [{ name: 'amount', type: 'number' }],
        outputs: [{ name: 'approved', type: 'boolean' }],
        rules: [{ input: { amount: 1000 }, output: { approved: true } }],
      });

      expect(result.decisionKey).toBe('approval-decision');
      expect(result.name).toBe('审批决策');
    });

    it('决策Key已存在时应该抛出BadRequestException', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);

      await expect(
        service.createDecision({
          decisionKey: 'approval-decision',
          name: '审批决策',
          hitPolicy: 'FIRST',
          inputs: [],
          outputs: [],
          rules: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('应该支持租户ID', async () => {
      decisionRepository.findOne.mockResolvedValue(null);
      const tenantDecision = { ...mockDecision, tenantId: 'tenant-1' };
      decisionRepository.create.mockReturnValue(tenantDecision);
      decisionRepository.save.mockResolvedValue(tenantDecision);

      const result = await service.createDecision({
        decisionKey: 'approval-decision',
        name: '审批决策',
        hitPolicy: 'FIRST',
        inputs: [],
        outputs: [],
        rules: [],
        tenantId: 'tenant-1',
      });

      expect(result.tenantId).toBe('tenant-1');
    });
  });

  describe('updateDecision', () => {
    it('应该成功更新决策', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      decisionRepository.save.mockResolvedValue({
        ...mockDecision,
        name: '更新后的名称',
        updateTime: new Date(),
      });

      const result = await service.updateDecision('decision-1', {
        name: '更新后的名称',
      });

      expect(result.name).toBe('更新后的名称');
    });

    it('决策不存在时应该抛出NotFoundException', async () => {
      decisionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateDecision('nonexistent', { name: '更新' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('已发布的决策不能修改', async () => {
      const publishedDecision = { ...mockDecision, status: DmnDecisionStatus.PUBLISHED };
      decisionRepository.findOne.mockResolvedValue(publishedDecision);

      await expect(
        service.updateDecision('decision-1', { name: '更新' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('应该正确更新规则数量', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      decisionRepository.save.mockResolvedValue({
        ...mockDecision,
        ruleCount: 3,
      });

      await service.updateDecision('decision-1', {
        rules: [
          { input: { amount: 100 }, output: { approved: true } },
          { input: { amount: 500 }, output: { approved: true } },
          { input: { amount: 1000 }, output: { approved: false } },
        ],
      });

      expect(decisionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ ruleCount: 3 }),
      );
    });
  });

  describe('publishDecision', () => {
    it('应该成功发布决策', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      ruleEngineExecutor.validateDecision.mockResolvedValue({ valid: true, errors: [], warnings: [] });
      decisionRepository.save.mockResolvedValue({
        ...mockDecision,
        status: DmnDecisionStatus.PUBLISHED,
        publishTime: new Date(),
      });

      const result = await service.publishDecision('decision-1');

      expect(result.status).toBe(DmnDecisionStatus.PUBLISHED);
    });

    it('决策不存在时应该抛出NotFoundException', async () => {
      decisionRepository.findOne.mockResolvedValue(null);

      await expect(service.publishDecision('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('已发布的决策不能再发布', async () => {
      const publishedDecision = { ...mockDecision, status: DmnDecisionStatus.PUBLISHED };
      decisionRepository.findOne.mockResolvedValue(publishedDecision);

      await expect(service.publishDecision('decision-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('验证失败时应该抛出BadRequestException', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      ruleEngineExecutor.validateDecision.mockResolvedValue({
        valid: false,
        errors: ['规则1的条件为空'],
        warnings: [],
      });

      await expect(service.publishDecision('decision-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('createNewVersion', () => {
    it('应该成功创建新版本', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      decisionRepository.findOne.mockResolvedValueOnce(mockDecision);
      decisionRepository.findOne.mockResolvedValueOnce({ ...mockDecision, version: 2 });
      const newVersionDecision = { ...mockDecision, id: 'decision-2', version: 2 };
      decisionRepository.create.mockReturnValue(newVersionDecision);
      decisionRepository.save.mockResolvedValue(newVersionDecision);

      // 重新设置mock以处理多次调用
      decisionRepository.findOne
        .mockResolvedValueOnce(mockDecision)
        .mockResolvedValueOnce({ ...mockDecision, version: 1 });
      decisionRepository.create.mockReturnValue({ ...mockDecision, id: 'decision-2', version: 2 });
      decisionRepository.save.mockResolvedValue({ ...mockDecision, id: 'decision-2', version: 2 });

      const result = await service.createNewVersion('decision-1');

      expect(result.version).toBe(2);
    });

    it('决策不存在时应该抛出NotFoundException', async () => {
      decisionRepository.findOne.mockResolvedValue(null);

      await expect(service.createNewVersion('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('suspendDecision', () => {
    it('应该成功挂起决策', async () => {
      const publishedDecision = { ...mockDecision, status: DmnDecisionStatus.PUBLISHED };
      decisionRepository.findOne.mockResolvedValue(publishedDecision);
      decisionRepository.save.mockResolvedValue({
        ...publishedDecision,
        status: DmnDecisionStatus.SUSPENDED,
      });

      const result = await service.suspendDecision('decision-1');

      expect(result.status).toBe(DmnDecisionStatus.SUSPENDED);
    });

    it('非发布状态的决策不能挂起', async () => {
      // mockDecision 的状态是 DRAFT，不是 PUBLISHED，所以应该抛出异常
      const draftDecision = { ...mockDecision, status: DmnDecisionStatus.DRAFT };
      decisionRepository.findOne.mockResolvedValue(draftDecision);

      await expect(service.suspendDecision('decision-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('activateDecision', () => {
    it('应该成功激活决策', async () => {
      const suspendedDecision = { ...mockDecision, status: DmnDecisionStatus.SUSPENDED };
      decisionRepository.findOne.mockResolvedValue(suspendedDecision);
      decisionRepository.save.mockResolvedValue({
        ...suspendedDecision,
        status: DmnDecisionStatus.PUBLISHED,
      });

      const result = await service.activateDecision('decision-1');

      expect(result.status).toBe(DmnDecisionStatus.PUBLISHED);
    });

    it('非挂起状态的决策不能激活', async () => {
      // mockDecision 的状态是 DRAFT，不是 SUSPENDED，所以应该抛出异常
      const draftDecision = { ...mockDecision, status: DmnDecisionStatus.DRAFT };
      decisionRepository.findOne.mockResolvedValue(draftDecision);

      await expect(service.activateDecision('decision-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteDecision', () => {
    it('应该成功删除决策', async () => {
      // 使用 DRAFT 状态的决策才能被删除
      const draftDecision = { ...mockDecision, status: DmnDecisionStatus.DRAFT };
      decisionRepository.findOne.mockResolvedValue(draftDecision);
      decisionRepository.remove.mockResolvedValue(draftDecision);

      await service.deleteDecision('decision-1');

      expect(decisionRepository.remove).toHaveBeenCalledWith(draftDecision);
    });

    it('已发布的决策不能删除', async () => {
      const publishedDecision = { ...mockDecision, status: DmnDecisionStatus.PUBLISHED };
      decisionRepository.findOne.mockResolvedValue(publishedDecision);

      await expect(service.deleteDecision('decision-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('queryDecisions', () => {
    it('应该成功查询决策列表', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockDecision], 1]),
      };
      decisionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnDecisionEntity>);

      const result = await service.queryDecisions({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该支持按状态筛选', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockDecision], 1]),
      };
      decisionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnDecisionEntity>);

      await service.queryDecisions({ status: DmnDecisionStatus.DRAFT });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'decision.status = :status',
        { status: DmnDecisionStatus.DRAFT },
      );
    });

    it('应该支持分页', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockDecision], 10]),
      };
      decisionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnDecisionEntity>);

      await service.queryDecisions({ page: 2, size: 10 });

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe('getDecision', () => {
    it('应该成功获取决策详情', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);

      const result = await service.getDecision('decision-1');

      expect(result.id).toBe('decision-1');
    });

    it('决策不存在时应该抛出NotFoundException', async () => {
      decisionRepository.findOne.mockResolvedValue(null);

      await expect(service.getDecision('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDecisionByKey', () => {
    it('应该成功通过Key获取最新版本的决策', async () => {
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockDecision),
      };
      decisionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnDecisionEntity>);

      const result = await service.getDecisionByKey('approval-decision');

      expect(result.decisionKey).toBe('approval-decision');
    });

    it('决策不存在时应该抛出NotFoundException', async () => {
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      };
      decisionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnDecisionEntity>);

      await expect(service.getDecisionByKey('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('executeDecision', () => {
    it('应该成功执行决策', async () => {
      ruleEngineExecutor.execute.mockResolvedValue({
        decisionId: 'decision-1',
        decisionKey: 'approval-decision',
        matched: true,
        results: [{ approved: true }],
        executionTimeMs: 10,
      });

      const result = await service.executeDecision({
        decisionId: 'decision-1',
        inputData: { amount: 1000 },
      });

      expect(result.matched).toBe(true);
      expect(result.results).toHaveLength(1);
    });
  });

  describe('getExecutionHistory', () => {
    it('应该成功获取执行历史', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockExecution], 1]),
      };
      executionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnExecutionEntity>);

      const result = await service.getExecutionHistory('decision-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('应该支持按流程实例ID筛选', async () => {
      const mockQueryBuilder = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn().mockResolvedValue([[mockExecution], 1]),
      };
      executionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnExecutionEntity>);

      await service.getExecutionHistory(undefined, 'pi-1');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'execution.processInstanceId = :processInstanceId',
        { processInstanceId: 'pi-1' },
      );
    });
  });

  describe('getDecisionStatistics', () => {
    it('应该成功获取决策统计', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        setParameters: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({
          totalExecutions: '100',
          successCount: '80',
          failedCount: '5',
          noMatchCount: '15',
          avgExecutionTime: '12.5',
        }),
      };
      executionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnExecutionEntity>);

      const result = await service.getDecisionStatistics('decision-1');

      expect(result.totalExecutions).toBe(100);
      expect(result.successCount).toBe(80);
      expect(result.avgExecutionTime).toBe(12.5);
    });

    it('决策不存在时应该抛出NotFoundException', async () => {
      decisionRepository.findOne.mockResolvedValue(null);

      await expect(service.getDecisionStatistics('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('没有执行记录时应该返回零值', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);

      const mockQueryBuilder = {
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        setParameters: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({
          totalExecutions: null,
          successCount: null,
          failedCount: null,
          noMatchCount: null,
          avgExecutionTime: null,
        }),
      };
      executionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnExecutionEntity>);

      const result = await service.getDecisionStatistics('decision-1');

      expect(result.totalExecutions).toBe(0);
      expect(result.avgExecutionTime).toBe(0);
    });
  });

  describe('validateDecision', () => {
    it('应该成功验证决策', async () => {
      ruleEngineExecutor.validateDecision.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: ['建议添加更多规则'],
      });

      const result = await service.validateDecision('decision-1');

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
    });
  });

  describe('toResponseDto', () => {
    it('应该正确转换实体到DTO', async () => {
      decisionRepository.findOne.mockResolvedValue(null);
      decisionRepository.create.mockReturnValue(mockDecision);
      decisionRepository.save.mockResolvedValue(mockDecision);

      const result = await service.createDecision({
        decisionKey: 'approval-decision',
        name: '审批决策',
        hitPolicy: 'FIRST',
        inputs: [{ name: 'amount', type: 'number' }],
        outputs: [{ name: 'approved', type: 'boolean' }],
        rules: [],
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('decisionKey');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('inputs');
      expect(result).toHaveProperty('outputs');
    });
  });
});
