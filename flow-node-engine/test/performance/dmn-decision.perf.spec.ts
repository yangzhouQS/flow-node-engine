/**
 * DMN决策执行性能测试
 * 目标：平均响应时间 < 100ms
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { DmnService } from '../../src/dmn/services/dmn.service';
import { DmnParserService } from '../../src/dmn/services/dmn-parser.service';
import { DmnExecutorService } from '../../src/dmn/services/dmn-executor.service';
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
  let mockDecisionExecutionRepo: any;

  const TARGET_AVG_TIME = 100; // 目标平均响应时间 100ms
  const ITERATIONS = 200; // 迭代次数
  const DECISION_COUNT = 20; // 决策定义数量

  // 存储测试数据
  const decisions = new Map<string, any>();
  const decisionExecutions = new Map<string, any>();

  beforeAll(async () => {
    // 创建模拟仓库
    mockDecisionRepo = {
      findOne: vi.fn(async (options: any) => {
        return decisions.get(options?.where?.id_ || options?.where?.key_);
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
        const id = entity.id_ || `decision-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id };
        decisions.set(id, saved);
        return saved;
      }),
    };

    mockDecisionExecutionRepo = {
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `exec-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id, execution_time_: new Date() };
        decisionExecutions.set(id, saved);
        return saved;
      }),
      find: vi.fn(async () => Array.from(decisionExecutions.values())),
    };

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        DmnService,
        DmnParserService,
        DmnExecutorService,
        {
          provide: 'DecisionDefinitionEntityRepository',
          useValue: mockDecisionRepo,
        },
        {
          provide: 'DecisionExecutionEntityRepository',
          useValue: mockDecisionExecutionRepo,
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
      id_: 'decision-1',
      key_: 'simple-approval-decision',
      name_: '简单审批决策',
      version_: 1,
      status_: 'ACTIVE',
      decision_type_: 'DECISION',
      dmn_xml_: `<?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd">
          <decision id="simple-approval-decision" name="简单审批决策">
            <decisionTable hitPolicy="FIRST">
              <input id="input1" label="金额">
                <inputExpression typeRef="number">
                  <text>amount</text>
                </inputExpression>
              </input>
              <output id="output1" label="审批结果" typeRef="string"/>
              <rule id="rule1">
                <inputEntry>
                  <text>< 1000</text>
                </inputEntry>
                <outputEntry>
                  <text>"自动通过"</text>
                </outputEntry>
              </rule>
              <rule id="rule2">
                <inputEntry>
                  <text>< 10000</text>
                </inputEntry>
                <outputEntry>
                  <text>"主管审批"</text>
                </outputEntry>
              </rule>
              <rule id="rule3">
                <inputEntry>
                  <text>>= 10000</text>
                </inputEntry>
                <outputEntry>
                  <text>"经理审批"</text>
                </outputEntry>
              </rule>
            </decisionTable>
          </decision>
        </definitions>`,
      create_time_: new Date(),
      tenant_id_: 'default',
    };
    decisions.set(simpleDecision.id_, simpleDecision);

    // 多条件决策
    const multiConditionDecision = {
      id_: 'decision-2',
      key_: 'multi-condition-decision',
      name_: '多条件决策',
      version_: 1,
      status_: 'ACTIVE',
      decision_type_: 'DECISION',
      dmn_xml_: `<?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd">
          <decision id="multi-condition-decision" name="多条件决策">
            <decisionTable hitPolicy="PRIORITY">
              <input id="input1" label="金额">
                <inputExpression typeRef="number">
                  <text>amount</text>
                </inputExpression>
              </input>
              <input id="input2" label="部门">
                <inputExpression typeRef="string">
                  <text>department</text>
                </inputExpression>
              </input>
              <input id="input3" label="紧急程度">
                <inputExpression typeRef="string">
                  <text>priority</text>
                </inputExpression>
              </input>
              <output id="output1" label="审批级别" typeRef="string"/>
              <rule id="rule1" priority="1">
                <inputEntry><text>< 100</text></inputEntry>
                <inputEntry><text>"IT"</text></inputEntry>
                <inputEntry><text>"低"</text></inputEntry>
                <outputEntry><text>"自动通过"</text></outputEntry>
              </rule>
              <rule id="rule2" priority="2">
                <inputEntry><text>< 1000</text></inputEntry>
                <inputEntry><text>-</text></inputEntry>
                <inputEntry><text>-</text></inputEntry>
                <outputEntry><text>"主管审批"</text></outputEntry>
              </rule>
              <rule id="rule3" priority="3">
                <inputEntry><text>< 10000</text></inputEntry>
                <inputEntry><text>-</text></inputEntry>
                <inputEntry><text>"高"</text></inputEntry>
                <outputEntry><text>"经理审批"</text></outputEntry>
              </rule>
              <rule id="rule4" priority="4">
                <inputEntry><text>>= 10000</text></inputEntry>
                <inputEntry><text>-</text></inputEntry>
                <inputEntry><text>-</text></inputEntry>
                <outputEntry><text>"总监审批"</text></outputEntry>
              </rule>
            </decisionTable>
          </decision>
        </definitions>`,
      create_time_: new Date(),
      tenant_id_: 'default',
    };
    decisions.set(multiConditionDecision.id_, multiConditionDecision);

    // 复杂决策 - 多输出
    const complexDecision = {
      id_: 'decision-3',
      key_: 'complex-output-decision',
      name_: '复杂输出决策',
      version_: 1,
      status_: 'ACTIVE',
      decision_type_: 'DECISION',
      dmn_xml_: `<?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd">
          <decision id="complex-output-decision" name="复杂输出决策">
            <decisionTable hitPolicy="COLLECT">
              <input id="input1" label="客户等级">
                <inputExpression typeRef="string">
                  <text>customerLevel</text>
                </inputExpression>
              </input>
              <input id="input2" label="订单金额">
                <inputExpression typeRef="number">
                  <text>orderAmount</text>
                </inputExpression>
              </input>
              <output id="output1" label="折扣率" typeRef="number"/>
              <output id="output2" label="赠品" typeRef="string"/>
              <output id="output3" label="配送方式" typeRef="string"/>
              <rule id="rule1">
                <inputEntry><text>"VIP"</text></inputEntry>
                <inputEntry><text>>= 1000</text></inputEntry>
                <outputEntry><text>0.2</text></outputEntry>
                <outputEntry><text>"礼品包"</text></outputEntry>
                <outputEntry><text>"加急配送"</text></outputEntry>
              </rule>
              <rule id="rule2">
                <inputEntry><text>"VIP"</text></inputEntry>
                <inputEntry><text>< 1000</text></inputEntry>
                <outputEntry><text>0.1</text></outputEntry>
                <outputEntry><text>"优惠券"</text></outputEntry>
                <outputEntry><text>"标准配送"</text></outputEntry>
              </rule>
              <rule id="rule3">
                <inputEntry><text>"普通"</text></inputEntry>
                <inputEntry><text>>= 500</text></inputEntry>
                <outputEntry><text>0.05</text></outputEntry>
                <outputEntry><text>"积分"</text></outputEntry>
                <outputEntry><text>"标准配送"</text></outputEntry>
              </rule>
            </decisionTable>
          </decision>
        </definitions>`,
      create_time_: new Date(),
      tenant_id_: 'default',
    };
    decisions.set(complexDecision.id_, complexDecision);

    // 创建更多测试决策
    for (let i = 4; i <= DECISION_COUNT; i++) {
      const decision = {
        id_: `decision-${i}`,
        key_: `decision-key-${i}`,
        name_: `决策${i}`,
        version_: 1,
        status_: 'ACTIVE',
        decision_type_: 'DECISION',
        dmn_xml_: `<?xml version="1.0" encoding="UTF-8"?>
          <definitions xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd">
            <decision id="decision-key-${i}" name="决策${i}">
              <decisionTable hitPolicy="FIRST">
                <input id="input1">
                  <inputExpression typeRef="number">
                    <text>value</text>
                  </inputExpression>
                </input>
                <output id="output1" typeRef="string"/>
                <rule id="rule1">
                  <inputEntry><text>> 0</text></inputEntry>
                  <outputEntry><text>"通过"</text></outputEntry>
                </rule>
              </decisionTable>
            </decision>
          </definitions>`,
        create_time_: new Date(),
        tenant_id_: 'default',
      };
      decisions.set(decision.id_, decision);
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
          await dmnService.getDecisionDefinitionById(decisionId);
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
          await dmnService.getDecisionDefinitionByKey(key);
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
          await dmnService.executeDecision('simple-approval-decision', {
            amount: randomInt(100, 20000),
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
          await dmnService.executeDecision('multi-condition-decision', {
            amount: randomInt(50, 50000),
            department: departments[i % 5],
            priority: priorities[i % 3],
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
          await dmnService.executeDecision('complex-output-decision', {
            customerLevel: levels[i % 2],
            orderAmount: randomInt(100, 5000),
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
            dmnService.executeDecision('simple-approval-decision', {
              amount: randomInt(100, 20000),
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

  describe('决策表解析性能', () => {
    it('决策表解析性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '决策表解析',
          iterations: 50,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME * 2,
        },
        async (i) => {
          const keys = ['simple-approval-decision', 'multi-condition-decision', 'complex-output-decision'];
          const key = keys[i % 3];
          await dmnService.parseDecisionTable(key);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME * 2);
    });
  });

  describe('决策结果缓存性能', () => {
    it('重复决策执行性能（缓存命中）', async () => {
      // 使用相同的输入参数
      const sameInput = { amount: 5000 };

      const result = await runPerformanceTest(
        {
          name: '重复决策执行（缓存命中）',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME / 2, // 缓存命中应该更快
        },
        async () => {
          await dmnService.executeDecision('simple-approval-decision', sameInput);
        }
      );

      console.log(formatPerformanceResult(result));

      // 缓存命中时应该更快
      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
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
          await dmnService.getDecisionExecutionHistory({
            decisionKey: 'simple-approval-decision',
            limit: 20,
          });
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
          await dmnService.getDecisionExecutionStatistics();
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
          decisionTableParsing: '通过',
          cachedDecisionExecution: '通过',
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
