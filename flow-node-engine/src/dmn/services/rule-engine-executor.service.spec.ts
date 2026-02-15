import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { RuleEngineExecutorService, ExecuteDecisionOptions } from './rule-engine-executor.service';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { HitPolicyHandlerFactory, UniqueHitPolicyHandler, FirstHitPolicyHandler } from './hit-policy-handlers.service';
import { DmnDecisionEntity, DmnDecisionStatus, HitPolicy, AggregationType } from '../entities/dmn-decision.entity';
import { DmnExecutionEntity, DmnExecutionStatus } from '../entities/dmn-execution.entity';

describe('RuleEngineExecutorService', () => {
  let service: RuleEngineExecutorService;
  let decisionRepository: vi.Mocked<Repository<DmnDecisionEntity>>;
  let executionRepository: vi.Mocked<Repository<DmnExecutionEntity>>;
  let conditionEvaluator: vi.Mocked<ConditionEvaluatorService>;
  let hitPolicyHandlerFactory: vi.Mocked<HitPolicyHandlerFactory>;

  const mockDecision: DmnDecisionEntity = {
    id: 'decision-1',
    decisionKey: 'test-decision',
    name: '测试决策',
    description: '测试用决策表',
    category: 'test',
    version: 1,
    status: DmnDecisionStatus.PUBLISHED,
    hitPolicy: HitPolicy.FIRST,
    aggregation: AggregationType.NONE,
    inputs: JSON.stringify([
      { id: 'input1', name: 'Input 1', type: 'string' },
      { id: 'input2', name: 'Input 2', type: 'number' },
    ]),
    outputs: JSON.stringify([
      { id: 'output1', name: 'Output 1', type: 'string' },
    ]),
    rules: JSON.stringify([
      {
        id: 'rule-1',
        conditions: [
          { inputId: 'input1', operator: '==', value: 'A' },
        ],
        outputs: [
          { outputId: 'output1', value: 'Result A' },
        ],
      },
      {
        id: 'rule-2',
        conditions: [
          { inputId: 'input1', operator: '==', value: 'B' },
        ],
        outputs: [
          { outputId: 'output1', value: 'Result B' },
        ],
      },
    ]),
    ruleCount: 2,
    tenantId: null,
    extra: null,
    createTime: new Date(),
    updateTime: null,
    publishTime: new Date(),
  };

  beforeEach(async () => {
    decisionRepository = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as vi.Mocked<Repository<DmnDecisionEntity>>;

    executionRepository = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
      createQueryBuilder: vi.fn(),
    } as unknown as vi.Mocked<Repository<DmnExecutionEntity>>;

    conditionEvaluator = {
      evaluate: vi.fn(),
    } as unknown as vi.Mocked<ConditionEvaluatorService>;

    const uniqueHandler = new UniqueHitPolicyHandler();
    const firstHandler = new FirstHitPolicyHandler();

    hitPolicyHandlerFactory = {
      getHandler: vi.fn().mockReturnValue(firstHandler),
      hasContinueEvaluatingBehavior: vi.fn().mockReturnValue(true),
      hasEvaluateRuleValidityBehavior: vi.fn().mockReturnValue(false),
      hasComposeDecisionResultBehavior: vi.fn().mockReturnValue(false),
    } as unknown as vi.Mocked<HitPolicyHandlerFactory>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleEngineExecutorService,
        {
          provide: getRepositoryToken(DmnDecisionEntity),
          useValue: decisionRepository,
        },
        {
          provide: getRepositoryToken(DmnExecutionEntity),
          useValue: executionRepository,
        },
        {
          provide: ConditionEvaluatorService,
          useValue: conditionEvaluator,
        },
        {
          provide: HitPolicyHandlerFactory,
          useValue: hitPolicyHandlerFactory,
        },
      ],
    }).compile();

    service = module.get<RuleEngineExecutorService>(RuleEngineExecutorService);
  });

  describe('execute', () => {
    it('应该成功执行决策并返回结果', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      conditionEvaluator.evaluate.mockReturnValue(true);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      const result = await service.execute({
        decisionId: 'decision-1',
        inputData: { input1: 'A' },
      });

      expect(result.status).toBe('success');
      expect(result.decisionId).toBe('decision-1');
      expect(result.decisionKey).toBe('test-decision');
      expect(result.audit).toBeDefined();
    });

    it('应该通过decisionKey获取决策', async () => {
      const mockQueryBuilder = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockDecision),
      };
      decisionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown as SelectQueryBuilder<DmnDecisionEntity>);
      conditionEvaluator.evaluate.mockReturnValue(true);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      const result = await service.execute({
        decisionKey: 'test-decision',
        inputData: { input1: 'A' },
      });

      expect(result.status).toBe('success');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'decision.decisionKey = :key',
        { key: 'test-decision' }
      );
    });

    it('当决策不存在时应该抛出BadRequestException', async () => {
      decisionRepository.findOne.mockResolvedValue(null);

      await expect(service.execute({
        decisionId: 'nonexistent',
        inputData: {},
      })).rejects.toThrow(BadRequestException);
    });

    it('当决策未发布时应该抛出BadRequestException', async () => {
      decisionRepository.findOne.mockResolvedValue({
        ...mockDecision,
        status: DmnDecisionStatus.DRAFT,
      });

      await expect(service.execute({
        decisionId: 'decision-1',
        inputData: {},
      })).rejects.toThrow(BadRequestException);
    });

    it('当没有提供decisionId和decisionKey时应该抛出BadRequestException', async () => {
      await expect(service.execute({
        inputData: {},
      })).rejects.toThrow(BadRequestException);
    });

    it('应该支持strictMode选项', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      conditionEvaluator.evaluate.mockReturnValue(true);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      const options: ExecuteDecisionOptions = {
        strictMode: false,
      };

      const result = await service.execute({
        decisionId: 'decision-1',
        inputData: { input1: 'A' },
      }, options);

      expect(result.status).toBe('success');
    });

    it('应该支持forceDMN11选项', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      conditionEvaluator.evaluate.mockReturnValue(true);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      const options: ExecuteDecisionOptions = {
        forceDMN11: true,
      };

      const result = await service.execute({
        decisionId: 'decision-1',
        inputData: { input1: 'A' },
      }, options);

      expect(result.status).toBe('success');
    });

    it('应该支持禁用审计', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      conditionEvaluator.evaluate.mockReturnValue(true);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      const options: ExecuteDecisionOptions = {
        enableAudit: false,
      };

      const result = await service.execute({
        decisionId: 'decision-1',
        inputData: { input1: 'A' },
      }, options);

      expect(result.audit).toBeUndefined();
    });

    it('应该正确处理无匹配结果', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      conditionEvaluator.evaluate.mockReturnValue(false);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      const result = await service.execute({
        decisionId: 'decision-1',
        inputData: { input1: 'X' },
      });

      expect(result.status).toBe('no_match');
      expect(result.matchedCount).toBe(0);
    });
  });

  describe('executeBatch', () => {
    it('应该批量执行决策', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      conditionEvaluator.evaluate.mockReturnValue(true);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      const inputDataList = [
        { input1: 'A' },
        { input1: 'B' },
        { input1: 'C' },
      ];

      const results = await service.executeBatch('decision-1', inputDataList);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('success');
    });

    it('应该在批量执行时处理错误', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      conditionEvaluator.evaluate.mockReturnValue(true);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      // 第二次调用抛出异常
      decisionRepository.findOne
        .mockResolvedValueOnce(mockDecision)
        .mockRejectedValueOnce(new Error('Database error'));

      const inputDataList = [
        { input1: 'A' },
        { input1: 'B' },
      ];

      const results = await service.executeBatch('decision-1', inputDataList);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('failed');
    });
  });

  describe('validateDecision', () => {
    it('应该验证有效的决策表', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);

      const result = await service.validateDecision('decision-1');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('当决策不存在时应该返回无效', async () => {
      decisionRepository.findOne.mockResolvedValue(null);

      const result = await service.validateDecision('nonexistent');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Decision not found');
    });

    it('当输入定义为空时应该返回错误', async () => {
      decisionRepository.findOne.mockResolvedValue({
        ...mockDecision,
        inputs: JSON.stringify([]),
      });

      const result = await service.validateDecision('decision-1');

      expect(result.errors).toContain('Decision table must have at least one input');
    });

    it('当输出定义为空时应该返回错误', async () => {
      decisionRepository.findOne.mockResolvedValue({
        ...mockDecision,
        outputs: JSON.stringify([]),
      });

      const result = await service.validateDecision('decision-1');

      expect(result.errors).toContain('Decision table must have at least one output');
    });

    it('当规则为空时应该返回警告', async () => {
      decisionRepository.findOne.mockResolvedValue({
        ...mockDecision,
        rules: JSON.stringify([]),
        ruleCount: 0,
      });

      const result = await service.validateDecision('decision-1');

      expect(result.warnings).toContain('Decision table has no rules defined');
    });

    it('当规则引用不存在的输入时应该返回错误', async () => {
      decisionRepository.findOne.mockResolvedValue({
        ...mockDecision,
        rules: JSON.stringify([
          {
            id: 'rule-1',
            conditions: [
              { inputId: 'nonexistent-input', operator: '==', value: 'A' },
            ],
            outputs: [
              { outputId: 'output1', value: 'Result' },
            ],
          },
        ]),
      });

      const result = await service.validateDecision('decision-1');

      expect(result.errors.some(e => e.includes('references unknown input'))).toBe(true);
    });

    it('当规则引用不存在的输出时应该返回错误', async () => {
      decisionRepository.findOne.mockResolvedValue({
        ...mockDecision,
        rules: JSON.stringify([
          {
            id: 'rule-1',
            conditions: [
              { inputId: 'input1', operator: '==', value: 'A' },
            ],
            outputs: [
              { outputId: 'nonexistent-output', value: 'Result' },
            ],
          },
        ]),
      });

      const result = await service.validateDecision('decision-1');

      expect(result.errors.some(e => e.includes('references unknown output'))).toBe(true);
    });
  });

  describe('行为接口检查', () => {
    it('hasContinueEvaluatingBehavior应该正确检测', () => {
      // 通过factory mock测试
      expect(hitPolicyHandlerFactory.hasContinueEvaluatingBehavior).toBeDefined();
    });

    it('hasEvaluateRuleValidityBehavior应该正确检测', () => {
      expect(hitPolicyHandlerFactory.hasEvaluateRuleValidityBehavior).toBeDefined();
    });

    it('hasComposeDecisionResultBehavior应该正确检测', () => {
      expect(hitPolicyHandlerFactory.hasComposeDecisionResultBehavior).toBeDefined();
    });
  });

  describe('审计跟踪', () => {
    it('应该生成完整的审计信息', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      conditionEvaluator.evaluate.mockReturnValue(true);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      const result = await service.execute({
        decisionId: 'decision-1',
        inputData: { input1: 'A' },
      });

      expect(result.audit).toBeDefined();
      expect(result.audit?.decisionId).toBe('decision-1');
      expect(result.audit?.decisionKey).toBe('test-decision');
      expect(result.audit?.ruleExecutions).toBeDefined();
      expect(result.audit?.strictMode).toBe(true);
      expect(result.audit?.forceDMN11).toBe(false);
    });

    it('审计应该包含规则执行详情', async () => {
      decisionRepository.findOne.mockResolvedValue(mockDecision);
      conditionEvaluator.evaluate.mockReturnValue(true);
      executionRepository.create.mockReturnValue({});
      executionRepository.save.mockResolvedValue({});

      const result = await service.execute({
        decisionId: 'decision-1',
        inputData: { input1: 'A' },
      });

      const ruleExecution = result.audit?.ruleExecutions[0];
      expect(ruleExecution).toBeDefined();
      expect(ruleExecution?.ruleId).toBe('rule-1');
      expect(ruleExecution?.inputEntries).toBeDefined();
      expect(ruleExecution?.outputEntries).toBeDefined();
    });
  });
});
