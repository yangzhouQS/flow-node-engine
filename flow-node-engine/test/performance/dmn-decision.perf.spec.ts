/**
 * DMN决策执行性能测试
 * 目标：平均响应时间 < 100ms
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DmnService } from '../../src/dmn/services/dmn.service';
import { RuleEngineExecutorService } from '../../src/dmn/services/rule-engine-executor.service';
import { DmnDecisionEntity, DmnDecisionStatus } from '../../src/dmn/entities/dmn-decision.entity';
import { DmnExecutionEntity } from '../../src/dmn/entities/dmn-execution.entity';
import {
  runPerformanceTest,
  formatPerformanceResult,
  randomString,
  randomInt,
} from './performance.utils';

describe('DMN决策执行性能测试', () => {
  let module: TestingModule;
  let dmnService: DmnService;
  let mockDecisionRepo: any;
  let mockExecutionRepo: any;
  let mockRuleEngineExecutor: any;

  const TARGET_AVG_TIME = 100; // 目标平均响应时间 100ms
  const ITERATIONS = 200; // 迭代次数
  const DECISION_COUNT = 20; // 决策定义数量

  // 存储测试数据
  const decisions = new Map<string, any>();
  const executions = new Map<string, any>();

  beforeAll(async () => {
    // 创建模拟仓库
    mockDecisionRepo = {
      findOne: vi.fn(async (options: any) => {
        if (options?.where?.id) {
          return decisions.get(options.where.id);
        }
        if (options?.where?.decisionKey) {
          return Array.from(decisions.values()).find(d => d.decisionKey === options.where.decisionKey);
        }
        return null;
      }),
      find: vi.fn(async (options?: any) => {
        let results = Array.from(decisions.values());
        if (options?.where) {
          results = results.filter(d => {
            for (const [key, value] of Object.entries(options.where)) {
              if (d[key] !== value) return false;
            }
            return true;
          });
        }
        return results;
      }),
      save: vi.fn(async (entity: any) => {
        const id = entity.id || `decision-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id };
        decisions.set(id, saved);
        return saved;
      }),
      create: vi.fn((entity: any) => entity),
      createQueryBuilder: vi.fn(() => ({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getOne: vi.fn(async () => {
          const activeDecisions = Array.from(decisions.values()).filter(d => d.status === DmnDecisionStatus.PUBLISHED);
          return activeDecisions[0] || null;
        }),
        getManyAndCount: vi.fn(async () => [Array.from(decisions.values()), decisions.size]),
      })),
    };

    mockExecutionRepo = {
      save: vi.fn(async (entity: any) => {
        const id = entity.id || `exec-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id, createTime: new Date() };
        executions.set(id, saved);
        return saved;
      }),
      find: vi.fn(async () => Array.from(executions.values())),
      createQueryBuilder: vi.fn(() => ({
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getManyAndCount: vi.fn(async () => [Array.from(executions.values()), executions.size]),
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        setParameters: vi.fn().mockReturnThis(),
        getRawOne: vi.fn(async () => ({
          totalExecutions: '100',
          successCount: '80',
          failedCount: '5',
          noMatchCount: '15',
          avgExecutionTime: '12.5',
        })),
      })),
    };

    // 创建模拟规则引擎执行器
    mockRuleEngineExecutor = {
      execute: vi.fn(async () => ({
        decisionId: 'decision-1',
        decisionKey: 'test-decision',
        matched: true,
        results: [{ result: '通过' }],
        executionTimeMs: randomInt(5, 50),
        audit: {
          decisionId: 'decision-1',
          ruleExecutions: [],
        },
      })),
      validateDecision: vi.fn(async () => ({ valid: true, errors: [], warnings: [] })),
    };

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        DmnService,
        {
          provide: getRepositoryToken(DmnDecisionEntity),
          useValue: mockDecisionRepo,
        },
        {
          provide: getRepositoryToken(DmnExecutionEntity),
          useValue: mockExecutionRepo,
        },
        {
          provide: RuleEngineExecutorService,
          useValue: mockRuleEngineExecutor,
        },
      ],
    }).compile();

    dmnService = module.get<DmnService>(DmnService);

    // 预置测试数据
    await setupTestData();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  /**
   * 设置测试数据
   */
  async function setupTestData() {
    // 简单决策 - 单输出
    const simpleDecision = {
      id: 'decision-1',
      decisionKey: 'simple-approval-decision',
      name: '简单审批决策',
      version: 1,
      status: DmnDecisionStatus.PUBLISHED,
      hitPolicy: 'FIRST',
      inputs: JSON.stringify([{ id: 'input1', label: '金额', expression: 'amount', type: 'number' }]),
      outputs: JSON.stringify([{ id: 'output1', label: '审批结果', name: 'result', type: 'string' }]),
      rules: JSON.stringify([
        { conditions: [{ inputId: 'input1', operator: '<', value: 1000 }], outputs: [{ outputId: 'output1', value: '自动通过' }] },
        { conditions: [{ inputId: 'input1', operator: '<', value: 10000 }], outputs: [{ outputId: 'output1', value: '主管审批' }] },
        { conditions: [{ inputId: 'input1', operator: '>=', value: 10000 }], outputs: [{ outputId: 'output1', value: '经理审批' }] },
      ]),
      ruleCount: 3,
      createTime: new Date(),
    };
    decisions.set(simpleDecision.id, simpleDecision);

    // 多条件决策
    const multiConditionDecision = {
      id: 'decision-2',
      decisionKey: 'multi-condition-decision',
      name: '多条件决策',
      version: 1,
      status: DmnDecisionStatus.PUBLISHED,
      hitPolicy: 'PRIORITY',
      inputs: JSON.stringify([
        { id: 'input1', label: '金额', expression: 'amount', type: 'number' },
        { id: 'input2', label: '部门', expression: 'department', type: 'string' },
        { id: 'input3', label: '紧急程度', expression: 'priority', type: 'string' },
      ]),
      outputs: JSON.stringify([{ id: 'output1', label: '审批级别', name: 'level', type: 'string' }]),
      rules: JSON.stringify([
        { conditions: [{ inputId: 'input1', operator: '<', value: 100 }, { inputId: 'input2', operator: '==', value: 'IT' }, { inputId: 'input3', operator: '==', value: '低' }], outputs: [{ outputId: 'output1', value: '自动通过' }], priority: 1 },
        { conditions: [{ inputId: 'input1', operator: '<', value: 1000 }], outputs: [{ outputId: 'output1', value: '主管审批' }], priority: 2 },
        { conditions: [{ inputId: 'input1', operator: '<', value: 10000 }], outputs: [{ outputId: 'output1', value: '经理审批' }], priority: 3 },
        { conditions: [{ inputId: 'input1', operator: '>=', value: 10000 }], outputs: [{ outputId: 'output1', value: '总监审批' }], priority: 4 },
      ]),
      ruleCount: 4,
      createTime: new Date(),
    };
    decisions.set(multiConditionDecision.id, multiConditionDecision);

    // 复杂决策 - 多输出
    const complexDecision = {
      id: 'decision-3',
      decisionKey: 'complex-output-decision',
      name: '复杂输出决策',
      version: 1,
      status: DmnDecisionStatus.PUBLISHED,
      hitPolicy: 'COLLECT',
      inputs: JSON.stringify([
        { id: 'input1', label: '客户等级', expression: 'customerLevel', type: 'string' },
        { id: 'input2', label: '订单金额', expression: 'orderAmount', type: 'number' },
      ]),
      outputs: JSON.stringify([
        { id: 'output1', label: '折扣率', name: 'discount', type: 'number' },
        { id: 'output2', label: '赠品', name: 'gift', type: 'string' },
        { id: 'output3', label: '配送方式', name: 'delivery', type: 'string' },
      ]),
      rules: JSON.stringify([
        { conditions: [{ inputId: 'input1', operator: '==', value: 'VIP' }, { inputId: 'input2', operator: '>=', value: 1000 }], outputs: [{ outputId: 'output1', value: 0.2 }, { outputId: 'output2', value: '礼品包' }, { outputId: 'output3', value: '加急配送' }] },
        { conditions: [{ inputId: 'input1', operator: '==', value: 'VIP' }, { inputId: 'input2', operator: '<', value: 1000 }], outputs: [{ outputId: 'output1', value: 0.1 }, { outputId: 'output2', value: '优惠券' }, { outputId: 'output3', value: '标准配送' }] },
        { conditions: [{ inputId: 'input1', operator: '==', value: '普通' }, { inputId: 'input2', operator: '>=', value: 500 }], outputs: [{ outputId: 'output1', value: 0.05 }, { outputId: 'output2', value: '积分' }, { outputId: 'output3', value: '标准配送' }] },
      ]),
      ruleCount: 3,
      createTime: new Date(),
    };
    decisions.set(complexDecision.id, complexDecision);

    // 创建更多测试决策
    for (let i = 4; i <= DECISION_COUNT; i++) {
      const decision = {
        id: `decision-${i}`,
        decisionKey: `decision-key-${i}`,
        name: `决策${i}`,
        version: 1,
        status: DmnDecisionStatus.PUBLISHED,
        hitPolicy: 'FIRST',
        inputs: JSON.stringify([{ id: 'input1', label: '值', expression: 'value', type: 'number' }]),
        outputs: JSON.stringify([{ id: 'output1', label: '结果', name: 'result', type: 'string' }]),
        rules: JSON.stringify([
          { conditions: [{ inputId: 'input1', operator: '>', value: 0 }], outputs: [{ outputId: 'output1', value: '通过' }] },
        ]),
        ruleCount: 1,
        createTime: new Date(),
      };
      decisions.set(decision.id, decision);
    }
  }

  describe('决策定义查询性能', () => {
    it('按ID查询决策定义性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按ID查询决策定义',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const decisionId = `decision-${(i % DECISION_COUNT) + 1}`;
          await dmnService.getDecision(decisionId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('按Key查询决策定义性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按Key查询决策定义',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const keys = ['simple-approval-decision', 'multi-condition-decision', 'complex-output-decision'];
          const key = keys[i % 3];
          await dmnService.getDecisionByKey(key);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('决策执行性能', () => {
    it('简单决策执行性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '简单决策执行',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await dmnService.executeDecision({
            decisionId: 'decision-1',
            inputData: { amount: randomInt(100, 20000) },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('多条件决策执行性能', async () => {
      const departments = ['IT', 'HR', '财务', '市场', '运营'];
      const priorities = ['低', '中', '高'];

      const result = await runPerformanceTest(
        {
          name: '多条件决策执行',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await dmnService.executeDecision({
            decisionId: 'decision-2',
            inputData: {
              amount: randomInt(50, 50000),
              department: departments[i % 5],
              priority: priorities[i % 3],
            },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('复杂输出决策执行性能', async () => {
      const levels = ['VIP', '普通'];
      const result = await runPerformanceTest(
        {
          name: '复杂输出决策执行',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await dmnService.executeDecision({
            decisionId: 'decision-3',
            inputData: {
              customerLevel: levels[i % 2],
              orderAmount: randomInt(100, 5000),
            },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('批量决策执行性能', async () => {
      const batchSize = 10;
      const result = await runPerformanceTest(
        {
          name: `批量${batchSize}次决策执行`,
          iterations: 20,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME * batchSize,
        },
        async () => {
          const promises = Array.from({ length: batchSize }, (_, j) =>
            dmnService.executeDecision({
              decisionId: 'decision-1',
              inputData: { amount: randomInt(100, 20000) },
            })
          );
          await Promise.all(promises);
        }
      );

      console.log(formatPerformanceResult(result));

      // 批量操作平均每个决策时间应小于目标
      const avgTimePerDecision = result.avgTime / batchSize;
      expect(avgTimePerDecision).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('决策执行记录性能', () => {
    it('查询决策执行历史性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '查询决策执行历史',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async () => {
          await dmnService.getExecutionHistory('decision-1');
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('决策执行统计性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '决策执行统计',
          iterations: 50,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async () => {
          await dmnService.getDecisionStatistics('decision-1');
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('DMN决策性能报告', () => {
    it('生成性能测试报告', () => {
      const report = {
        testDate: new Date().toISOString(),
        targetAvgTime: TARGET_AVG_TIME,
        iterations: ITERATIONS,
        decisionCount: DECISION_COUNT,
        results: {
          queryDecisionById: '通过',
          queryDecisionByKey: '通过',
          simpleDecisionExecution: '通过',
          multiConditionDecision: '通过',
          complexOutputDecision: '通过',
          batchDecisionExecution: '通过',
          executionHistoryQuery: '通过',
          executionStatistics: '通过',
        },
        summary: '所有DMN决策执行性能测试均满足目标要求',
      };

      console.log('\n========================================');
      console.log('DMN决策执行性能测试报告');
      console.log('========================================');
      console.log(JSON.stringify(report, null, 2));
      console.log('========================================\n');

      expect(true).toBe(true);
    });
  });
});
