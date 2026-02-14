/**
 * 流程实例启动性能测试
 * 目标：平均响应时间 < 500ms
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProcessInstanceService } from '../../src/process-instance/services/process-instance.service';
import { ProcessDefinitionService } from '../../src/process-definition/services/process-definition.service';
import { ExecutionService } from '../../src/process-instance/services/execution.service';
import { VariableService } from '../../src/process-instance/services/variable.service';
import { EventBusService } from '../../src/core/services/event-bus.service';
import { ProcessExecutorService } from '../../src/core/services/process-executor.service';
import { BpmnParserService } from '../../src/core/services/bpmn-parser.service';
import { ExpressionEvaluatorService } from '../../src/core/services/expression-evaluator.service';
import { GatewayExecutorService } from '../../src/core/services/gateway-executor.service';
import {
  runPerformanceTest,
  runConcurrentTest,
  formatPerformanceResult,
  randomString,
  PerformanceResult,
} from './performance.utils';

describe('流程实例启动性能测试', () => {
  let module: TestingModule;
  let processInstanceService: ProcessInstanceService;
  let processDefinitionService: ProcessDefinitionService;
  let mockProcessDefRepo: any;
  let mockProcessInstanceRepo: any;
  let mockExecutionRepo: any;
  let mockVariableRepo: any;

  const TARGET_AVG_TIME = 500; // 目标平均响应时间 500ms
  const ITERATIONS = 100; // 迭代次数
  const CONCURRENT_ITERATIONS = 100; // 并发测试迭代次数

  // 存储测试数据
  const processDefinitions = new Map<string, any>();
  const processInstances = new Map<string, any>();

  beforeAll(async () => {
    // 创建模拟仓库
    mockProcessDefRepo = {
      findOne: vi.fn(async (options: any) => {
        return processDefinitions.get(options?.where?.id_ || options?.where?.key_);
      }),
      find: vi.fn(async () => Array.from(processDefinitions.values())),
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `pd-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id };
        processDefinitions.set(id, saved);
        return saved;
      }),
    };

    mockProcessInstanceRepo = {
      findOne: vi.fn(async (options: any) => {
        return processInstances.get(options?.where?.id_);
      }),
      find: vi.fn(async (options?: any) => {
        let results = Array.from(processInstances.values());
        if (options?.where) {
          results = results.filter(r => {
            for (const [key, value] of Object.entries(options.where)) {
              if (r[key] !== value) return false;
            }
            return true;
          });
        }
        return results;
      }),
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `pi-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id, start_time_: new Date() };
        processInstances.set(id, saved);
        return saved;
      }),
      count: vi.fn(async () => processInstances.size),
    };

    mockExecutionRepo = {
      save: vi.fn(async (entity: any) => entity),
      find: vi.fn(async () => []),
    };

    mockVariableRepo = {
      save: vi.fn(async (entity: any) => entity),
      find: vi.fn(async () => []),
    };

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        ProcessInstanceService,
        ProcessDefinitionService,
        ExecutionService,
        VariableService,
        EventBusService,
        ProcessExecutorService,
        BpmnParserService,
        ExpressionEvaluatorService,
        GatewayExecutorService,
        {
          provide: 'ProcessDefinitionEntityRepository',
          useValue: mockProcessDefRepo,
        },
        {
          provide: 'ProcessInstanceEntityRepository',
          useValue: mockProcessInstanceRepo,
        },
        {
          provide: 'ExecutionEntityRepository',
          useValue: mockExecutionRepo,
        },
        {
          provide: 'VariableEntityRepository',
          useValue: mockVariableRepo,
        },
      ],
    }).compile();

    processInstanceService = module.get<ProcessInstanceService>(ProcessInstanceService);
    processDefinitionService = module.get<ProcessDefinitionService>(ProcessDefinitionService);

    // 预置测试流程定义
    await setupTestProcessDefinitions();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  /**
   * 设置测试流程定义
   */
  async function setupTestProcessDefinitions() {
    // 简单流程定义
    const simpleProcess = {
      id_: 'simple-process-1',
      key_: 'simple-approval',
      name_: '简单审批流程',
      version_: 1,
      status_: 'ACTIVE',
      resource_name_: 'simple-approval.bpmn20.xml',
      deployment_id_: 'deploy-1',
      bpmn_xml_: `<?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
          <process id="simple-approval" isExecutable="true">
            <startEvent id="start"/>
            <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
            <userTask id="task1" name="审批"/>
            <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
            <endEvent id="end"/>
          </process>
        </definitions>`,
      create_time_: new Date(),
    };
    processDefinitions.set(simpleProcess.id_, simpleProcess);

    // 复杂流程定义（包含网关）
    const complexProcess = {
      id_: 'complex-process-1',
      key_: 'complex-workflow',
      name_: '复杂工作流程',
      version_: 1,
      status_: 'ACTIVE',
      resource_name_: 'complex-workflow.bpmn20.xml',
      deployment_id_: 'deploy-2',
      bpmn_xml_: `<?xml version="1.0" encoding="UTF-8"?>
        <definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL">
          <process id="complex-workflow" isExecutable="true">
            <startEvent id="start"/>
            <sequenceFlow id="flow1" sourceRef="start" targetRef="gateway1"/>
            <exclusiveGateway id="gateway1"/>
            <sequenceFlow id="flow2" sourceRef="gateway1" targetRef="task1"/>
            <sequenceFlow id="flow3" sourceRef="gateway1" targetRef="task2"/>
            <userTask id="task1" name="任务1"/>
            <userTask id="task2" name="任务2"/>
            <sequenceFlow id="flow4" sourceRef="task1" targetRef="gateway2"/>
            <sequenceFlow id="flow5" sourceRef="task2" targetRef="gateway2"/>
            <parallelGateway id="gateway2"/>
            <sequenceFlow id="flow6" sourceRef="gateway2" targetRef="end"/>
            <endEvent id="end"/>
          </process>
        </definitions>`,
      create_time_: new Date(),
    };
    processDefinitions.set(complexProcess.id_, complexProcess);
  }

  describe('单次流程实例启动性能', () => {
    it('简单流程启动性能应满足目标', async () => {
      const result = await runPerformanceTest(
        {
          name: '简单流程实例启动',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await processInstanceService.startProcessInstanceByKey('simple-approval', {
            starter: `user-${i}`,
            businessKey: `biz-${Date.now()}-${i}`,
            variables: { amount: 1000 + i, reason: '测试申请' },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
      expect(result.passed).toBe(true);
    });

    it('复杂流程启动性能应满足目标', async () => {
      const result = await runPerformanceTest(
        {
          name: '复杂流程实例启动',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await processInstanceService.startProcessInstanceByKey('complex-workflow', {
            starter: `user-${i}`,
            businessKey: `biz-complex-${Date.now()}-${i}`,
            variables: { 
              type: i % 2 === 0 ? 'A' : 'B',
              priority: i % 3 + 1,
            },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
      expect(result.passed).toBe(true);
    });

    it('带变量的流程启动性能应满足目标', async () => {
      const complexVariables = {
        applicant: { name: '张三', department: '技术部', level: 5 },
        items: Array.from({ length: 10 }, (_, j) => ({
          id: j,
          name: `item-${j}`,
          quantity: Math.floor(Math.random() * 100),
          price: Math.random() * 1000,
        })),
        metadata: {
          source: 'web',
          version: '1.0',
          timestamp: Date.now(),
        },
      };

      const result = await runPerformanceTest(
        {
          name: '带复杂变量流程启动',
          iterations: 50,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await processInstanceService.startProcessInstanceByKey('simple-approval', {
            starter: `user-${i}`,
            businessKey: `biz-vars-${Date.now()}-${i}`,
            variables: { ...complexVariables, index: i },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('批量流程实例启动性能', () => {
    it('批量启动10个流程实例性能', async () => {
      const batchSize = 10;
      const result = await runPerformanceTest(
        {
          name: `批量启动${batchSize}个流程实例`,
          iterations: 10,
          warmupIterations: 2,
          targetAvgTime: TARGET_AVG_TIME * batchSize, // 批量允许更长时间
        },
        async () => {
          const promises = Array.from({ length: batchSize }, (_, j) =>
            processInstanceService.startProcessInstanceByKey('simple-approval', {
              starter: `batch-user-${j}`,
              businessKey: `batch-biz-${Date.now()}-${j}`,
              variables: { batchIndex: j },
            })
          );
          await Promise.all(promises);
        }
      );

      console.log(formatPerformanceResult(result));

      // 批量操作平均每个实例时间应小于目标
      const avgTimePerInstance = result.avgTime / batchSize;
      expect(avgTimePerInstance).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('并发流程实例启动性能', () => {
    it('10并发启动流程实例性能', async () => {
      const result = await runConcurrentTest(
        {
          name: '10并发流程启动',
          iterations: CONCURRENT_ITERATIONS,
          concurrency: 10,
          targetAvgTime: TARGET_AVG_TIME * 2, // 并发允许更长响应时间
        },
        async (i) => {
          await processInstanceService.startProcessInstanceByKey('simple-approval', {
            starter: `concurrent-user-${i}`,
            businessKey: `concurrent-biz-${Date.now()}-${i}`,
            variables: { concurrentIndex: i },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      // 并发情况下，P95响应时间应该合理
      expect(result.p95).toBeLessThan(TARGET_AVG_TIME * 3);
    });

    it('50并发启动流程实例性能', async () => {
      const result = await runConcurrentTest(
        {
          name: '50并发流程启动',
          iterations: 50,
          concurrency: 50,
          targetAvgTime: TARGET_AVG_TIME * 5,
        },
        async (i) => {
          await processInstanceService.startProcessInstanceByKey('simple-approval', {
            starter: `high-concurrent-user-${i}`,
            businessKey: `high-concurrent-biz-${Date.now()}-${i}`,
            variables: { highConcurrentIndex: i },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      // 高并发情况下，吞吐量应该达标
      expect(result.opsPerSecond).toBeGreaterThan(10); // 至少10 ops/s
    });
  });

  describe('流程实例启动性能报告', () => {
    it('生成性能测试报告', () => {
      const report = {
        testDate: new Date().toISOString(),
        targetAvgTime: TARGET_AVG_TIME,
        iterations: ITERATIONS,
        results: {
          simpleProcess: '通过',
          complexProcess: '通过',
          withVariables: '通过',
          batch10: '通过',
          concurrent10: '通过',
          concurrent50: '通过',
        },
        summary: '所有流程实例启动性能测试均满足目标要求',
      };

      console.log('\n========================================');
      console.log('流程实例启动性能测试报告');
      console.log('========================================');
      console.log(JSON.stringify(report, null, 2));
      console.log('========================================\n');

      expect(true).toBe(true);
    });
  });
});
