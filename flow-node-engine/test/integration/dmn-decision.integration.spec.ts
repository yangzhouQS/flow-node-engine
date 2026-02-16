/**
 * 集成测试 - DMN决策集成
 * 测试场景：决策表部署、决策执行、Business Rule Task集成、命中策略测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Entities
import { ProcessDefinition } from '../../src/process-definition/entities/process-definition.entity';
import { ProcessInstance } from '../../src/process-instance/entities/process-instance.entity';
import { Execution } from '../../src/process-instance/entities/execution.entity';
import { Variable } from '../../src/process-instance/entities/variable.entity';
import { Task } from '../../src/task/entities/task.entity';
import { DmnDecisionEntity, DmnDecisionStatus } from '../../src/dmn/entities/dmn-decision.entity';
import { DmnExecutionEntity } from '../../src/dmn/entities/dmn-execution.entity';

// Services
import { ProcessDefinitionService } from '../../src/process-definition/services/process-definition.service';
import { ProcessInstanceService } from '../../src/process-instance/services/process-instance.service';
import { TaskService } from '../../src/task/services/task.service';
import { DmnService } from '../../src/dmn/services/dmn.service';
import { HistoryService } from '../../src/history/services/history.service';
import { EventBusService } from '../../src/core/services/event-bus.service';
import { RuleEngineExecutorService } from '../../src/dmn/services/rule-engine-executor.service';

describe('集成测试 - DMN决策集成', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let taskService: TaskService;
  let dmnService: DmnService;
  let historyService: HistoryService;
  let eventBusService: EventBusService;

  // Mock repositories
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let executionRepo: vi.Mocked<Repository<Execution>>;
  let variableRepo: vi.Mocked<Repository<Variable>>;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let dmnDecisionRepo: vi.Mocked<Repository<DmnDecisionEntity>>;
  let dmnExecutionRepo: vi.Mocked<Repository<DmnExecutionEntity>>;
  let ruleEngineExecutor: vi.Mocked<RuleEngineExecutorService>;

  // 测试数据存储
  let processDefinitions: Map<string, ProcessDefinition>;
  let processInstances: Map<string, ProcessInstance>;
  let executions: Map<string, Execution>;
  let variables: Map<string, Variable>;
  let tasks: Map<string, Task>;
  let dmnDecisions: Map<string, DmnDecisionEntity>;
  let dmnExecutions: Map<string, DmnExecutionEntity>;

  beforeEach(async () => {
    // 初始化数据存储
    processDefinitions = new Map();
    processInstances = new Map();
    executions = new Map();
    variables = new Map();
    tasks = new Map();
    dmnDecisions = new Map();
    dmnExecutions = new Map();

    // 创建mock repositories
    const createMockRepo = <T>(storage: Map<string, T>): vi.Mocked<Repository<T>> => {
      return {
        find: vi.fn(async () => Array.from(storage.values())),
        findOne: vi.fn(async (options: any) => {
          if (options?.where?.id) {
            return storage.get(options.where.id) || null;
          }
          if (options?.where?.processInstanceId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.processInstanceId === options.where.processInstanceId
            ) as any;
          }
          if (options?.where?.decisionKey) {
            return (
              Array.from(storage.values()).find(
                (item: any) => item.decisionKey === options.where.decisionKey
              ) || null
            );
          }
          return Array.from(storage.values())[0] || null;
        }),
        save: vi.fn(async (entity: any) => {
          const id = entity.id || `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newEntity = { ...entity, id } as T;
          storage.set(id, newEntity);
          return newEntity;
        }),
        update: vi.fn(async () => ({ affected: 1, generatedMaps: [] })),
        delete: vi.fn(async () => ({ affected: 1, raw: {} })),
        create: vi.fn((entity: any) => entity),
        createQueryBuilder: vi.fn(),
        count: vi.fn(async () => storage.size),
        remove: vi.fn(async (entity: any) => {
          storage.delete(entity.id);
          return entity;
        }),
      } as any;
    };

    processDefinitionRepo = createMockRepo(processDefinitions);
    processInstanceRepo = createMockRepo(processInstances);
    executionRepo = createMockRepo(executions);
    variableRepo = createMockRepo(variables);
    taskRepo = createMockRepo(tasks);
    dmnDecisionRepo = createMockRepo(dmnDecisions);
    dmnExecutionRepo = createMockRepo(dmnExecutions);

    // 创建mock ruleEngineExecutor
    ruleEngineExecutor = {
      execute: vi.fn(async () => ({
        decisionId: 'decision-1',
        decisionKey: 'test-decision',
        matched: true,
        results: [{ riskLevel: '中风险' }],
        executionTimeMs: 10,
        audit: {
          decisionId: 'decision-1',
          ruleExecutions: [],
        },
      })),
      validateDecision: vi.fn(async () => ({ valid: true, errors: [], warnings: [] })),
    } as unknown as vi.Mocked<RuleEngineExecutorService>;

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        ProcessDefinitionService,
        ProcessInstanceService,
        TaskService,
        DmnService,
        HistoryService,
        EventBusService,
        RuleEngineExecutorService,
        {
          provide: getRepositoryToken(ProcessDefinition),
          useValue: processDefinitionRepo,
        },
        {
          provide: getRepositoryToken(ProcessInstance),
          useValue: processInstanceRepo,
        },
        {
          provide: getRepositoryToken(Execution),
          useValue: executionRepo,
        },
        {
          provide: getRepositoryToken(Variable),
          useValue: variableRepo,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: taskRepo,
        },
        {
          provide: getRepositoryToken(DmnDecisionEntity),
          useValue: dmnDecisionRepo,
        },
        {
          provide: getRepositoryToken(DmnExecutionEntity),
          useValue: dmnExecutionRepo,
        },
        {
          provide: RuleEngineExecutorService,
          useValue: ruleEngineExecutor,
        },
      ],
    }).compile();

    // 获取服务实例
    processDefinitionService = module.get<ProcessDefinitionService>(ProcessDefinitionService);
    processInstanceService = module.get<ProcessInstanceService>(ProcessInstanceService);
    taskService = module.get<TaskService>(TaskService);
    dmnService = module.get<DmnService>(DmnService);
    historyService = module.get<HistoryService>(HistoryService);
    eventBusService = module.get<EventBusService>(EventBusService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.12 决策表部署和执行', () => {
    describe('决策表部署', () => {
      it('应该能够部署简单决策表', async () => {
        const result = await dmnService.createDecision({
          decisionKey: 'simpleDecision',
          name: '简单决策',
          hitPolicy: 'UNIQUE',
          inputs: [{ id: 'input1', label: '年龄', expression: 'age', type: 'number' }],
          outputs: [{ id: 'output1', label: '风险等级', name: 'riskLevel', type: 'string' }],
          rules: [
            { conditions: [{ inputId: 'input1', operator: '<', value: 18 }], outputs: [{ outputId: 'output1', value: '低风险' }] },
            { conditions: [{ inputId: 'input1', operator: '>=', value: 18 }], outputs: [{ outputId: 'output1', value: '中风险' }] },
            { conditions: [{ inputId: 'input1', operator: '>', value: 60 }], outputs: [{ outputId: 'output1', value: '高风险' }] },
          ],
        });

        expect(result).toBeDefined();
        expect(result.decisionKey).toBe('simpleDecision');
      });

      it('应该能够部署优先级决策表', async () => {
        const result = await dmnService.createDecision({
          decisionKey: 'priorityDecision',
          name: '优先级决策',
          hitPolicy: 'PRIORITY',
          inputs: [
            { id: 'input1', label: '信用分数', expression: 'creditScore', type: 'number' },
            { id: 'input2', label: '收入', expression: 'income', type: 'number' },
          ],
          outputs: [
            { id: 'output1', label: '审批结果', name: 'approvalResult', type: 'string' },
            { id: 'output2', label: '优先级', name: 'priority', type: 'number' },
          ],
          rules: [
            { conditions: [{ inputId: 'input1', operator: '>=', value: 800 }, { inputId: 'input2', operator: '>=', value: 100000 }], outputs: [{ outputId: 'output1', value: '自动批准' }, { outputId: 'output2', value: 1 }] },
            { conditions: [{ inputId: 'input1', operator: '>=', value: 700 }, { inputId: 'input2', operator: '>=', value: 50000 }], outputs: [{ outputId: 'output1', value: '快速审批' }, { outputId: 'output2', value: 2 }] },
          ],
        });

        expect(result).toBeDefined();
        expect(result.decisionKey).toBe('priorityDecision');
      });

      it('应该能够部署收集策略决策表', async () => {
        const result = await dmnService.createDecision({
          decisionKey: 'collectDecision',
          name: '收集决策',
          hitPolicy: 'COLLECT',
          inputs: [{ id: 'input1', label: '客户类型', expression: 'customerType', type: 'string' }],
          outputs: [{ id: 'output1', label: '折扣', name: 'discount', type: 'number' }],
          rules: [
            { conditions: [{ inputId: 'input1', operator: '==', value: 'VIP' }], outputs: [{ outputId: 'output1', value: 10 }] },
            { conditions: [{ inputId: 'input1', operator: '==', value: '普通' }], outputs: [{ outputId: 'output1', value: 3 }] },
          ],
        });

        expect(result).toBeDefined();
        expect(result.decisionKey).toBe('collectDecision');
      });

      it('部署时应该解析决策表元数据', async () => {
        await dmnService.createDecision({
          decisionKey: 'simpleDecision',
          name: '简单决策',
          hitPolicy: 'UNIQUE',
          inputs: [{ id: 'input1', label: '年龄', expression: 'age', type: 'number' }],
          outputs: [{ id: 'output1', label: '风险等级', name: 'riskLevel', type: 'string' }],
          rules: [
            { conditions: [{ inputId: 'input1', operator: '<', value: 18 }], outputs: [{ outputId: 'output1', value: '低风险' }] },
            { conditions: [{ inputId: 'input1', operator: '>=', value: 18 }], outputs: [{ outputId: 'output1', value: '中风险' }] },
            { conditions: [{ inputId: 'input1', operator: '>', value: 60 }], outputs: [{ outputId: 'output1', value: '高风险' }] },
          ],
        });

        const decision = await dmnDecisionRepo.findOne({ where: { decisionKey: 'simpleDecision' } });
        expect(decision).toBeDefined();
        expect(decision?.hitPolicy).toBe('UNIQUE');
        expect(decision?.ruleCount).toBe(3);
      });
    });

    describe('决策执行 - UNIQUE命中策略', () => {
      let decisionId: string;

      beforeEach(async () => {
        const result = await dmnService.createDecision({
          decisionKey: 'simpleDecision',
          name: '简单决策',
          hitPolicy: 'UNIQUE',
          inputs: [{ id: 'input1', label: '年龄', expression: 'age', type: 'number' }],
          outputs: [{ id: 'output1', label: '风险等级', name: 'riskLevel', type: 'string' }],
          rules: [
            { conditions: [{ inputId: 'input1', operator: '<', value: 18 }], outputs: [{ outputId: 'output1', value: '低风险' }] },
            { conditions: [{ inputId: 'input1', operator: '>=', value: 18 }], outputs: [{ outputId: 'output1', value: '中风险' }] },
            { conditions: [{ inputId: 'input1', operator: '>', value: 60 }], outputs: [{ outputId: 'output1', value: '高风险' }] },
          ],
        });
        decisionId = result.id;
        await dmnService.publishDecision(decisionId);
      });

      it('应该能够执行决策并返回正确结果 - 低风险', async () => {
        const result = await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { age: 15 },
        });

        expect(result).toBeDefined();
        expect(result.matched).toBe(true);
      });

      it('应该能够执行决策并返回正确结果 - 中风险', async () => {
        const result = await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { age: 30 },
        });

        expect(result).toBeDefined();
        expect(result.matched).toBe(true);
      });

      it('应该能够执行决策并返回正确结果 - 高风险', async () => {
        const result = await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { age: 70 },
        });

        expect(result).toBeDefined();
        expect(result.matched).toBe(true);
      });

      it('UNIQUE策略应该只返回一个匹配结果', async () => {
        const result = await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { age: 25 },
        });

        expect(result).toBeDefined();
        expect(result.matched).toBe(true);
      });
    });

    describe('决策执行 - PRIORITY命中策略', () => {
      let decisionId: string;

      beforeEach(async () => {
        const result = await dmnService.createDecision({
          decisionKey: 'priorityDecision',
          name: '优先级决策',
          hitPolicy: 'PRIORITY',
          inputs: [
            { id: 'input1', label: '信用分数', expression: 'creditScore', type: 'number' },
            { id: 'input2', label: '收入', expression: 'income', type: 'number' },
          ],
          outputs: [
            { id: 'output1', label: '审批结果', name: 'approvalResult', type: 'string' },
            { id: 'output2', label: '优先级', name: 'priority', type: 'number' },
          ],
          rules: [
            { conditions: [{ inputId: 'input1', operator: '>=', value: 800 }, { inputId: 'input2', operator: '>=', value: 100000 }], outputs: [{ outputId: 'output1', value: '自动批准' }, { outputId: 'output2', value: 1 }] },
            { conditions: [{ inputId: 'input1', operator: '>=', value: 700 }, { inputId: 'input2', operator: '>=', value: 50000 }], outputs: [{ outputId: 'output1', value: '快速审批' }, { outputId: 'output2', value: 2 }] },
          ],
        });
        decisionId = result.id;
        await dmnService.publishDecision(decisionId);
      });

      it('应该返回最高优先级的匹配规则', async () => {
        const result = await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { creditScore: 850, income: 150000 },
        });

        expect(result).toBeDefined();
        expect(result.matched).toBe(true);
      });

      it('应该返回次高优先级的匹配规则', async () => {
        const result = await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { creditScore: 750, income: 60000 },
        });

        expect(result).toBeDefined();
        expect(result.matched).toBe(true);
      });

      it('应该返回默认规则当没有其他匹配时', async () => {
        const result = await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { creditScore: 500, income: 20000 },
        });

        expect(result).toBeDefined();
      });
    });

    describe('决策执行 - COLLECT命中策略', () => {
      let decisionId: string;

      beforeEach(async () => {
        const result = await dmnService.createDecision({
          decisionKey: 'collectDecision',
          name: '收集决策',
          hitPolicy: 'COLLECT',
          inputs: [{ id: 'input1', label: '客户类型', expression: 'customerType', type: 'string' }],
          outputs: [{ id: 'output1', label: '折扣', name: 'discount', type: 'number' }],
          rules: [
            { conditions: [{ inputId: 'input1', operator: '==', value: 'VIP' }], outputs: [{ outputId: 'output1', value: 10 }] },
            { conditions: [{ inputId: 'input1', operator: '==', value: '普通' }], outputs: [{ outputId: 'output1', value: 3 }] },
          ],
        });
        decisionId = result.id;
        await dmnService.publishDecision(decisionId);
      });

      it('应该返回所有匹配的结果', async () => {
        const result = await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { customerType: 'VIP' },
        });

        expect(result).toBeDefined();
        expect(result.matched).toBe(true);
      });

      it('应该返回单个匹配结果', async () => {
        const result = await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { customerType: '普通' },
        });

        expect(result).toBeDefined();
        expect(result.matched).toBe(true);
      });
    });

    describe('决策执行历史', () => {
      let decisionId: string;

      beforeEach(async () => {
        const result = await dmnService.createDecision({
          decisionKey: 'simpleDecision',
          name: '简单决策',
          hitPolicy: 'UNIQUE',
          inputs: [{ id: 'input1', label: '年龄', expression: 'age', type: 'number' }],
          outputs: [{ id: 'output1', label: '风险等级', name: 'riskLevel', type: 'string' }],
          rules: [
            { conditions: [{ inputId: 'input1', operator: '<', value: 18 }], outputs: [{ outputId: 'output1', value: '低风险' }] },
            { conditions: [{ inputId: 'input1', operator: '>=', value: 18 }], outputs: [{ outputId: 'output1', value: '中风险' }] },
            { conditions: [{ inputId: 'input1', operator: '>', value: 60 }], outputs: [{ outputId: 'output1', value: '高风险' }] },
          ],
        });
        decisionId = result.id;
        await dmnService.publishDecision(decisionId);
      });

      it('应该记录决策执行历史', async () => {
        await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { age: 25 },
        });

        const history = await dmnService.getExecutionHistory(decisionId);
        expect(history).toBeDefined();
      });

      it('历史记录应该包含输入变量', async () => {
        await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { age: 25 },
        });

        const history = await dmnService.getExecutionHistory(decisionId);
        expect(history).toBeDefined();
      });

      it('历史记录应该包含输出结果', async () => {
        await dmnService.executeDecision({
          decisionId: decisionId,
          inputData: { age: 25 },
        });

        const history = await dmnService.getExecutionHistory(decisionId);
        expect(history).toBeDefined();
      });
    });
  });

  describe('6.3.12 决策表版本管理', () => {
    it('应该支持决策表版本管理', async () => {
      // 创建第一个版本
      const result1 = await dmnService.createDecision({
        decisionKey: 'simpleDecision',
        name: '简单决策',
        hitPolicy: 'UNIQUE',
        inputs: [{ id: 'input1', label: '年龄', expression: 'age', type: 'number' }],
        outputs: [{ id: 'output1', label: '风险等级', name: 'riskLevel', type: 'string' }],
        rules: [
          { conditions: [{ inputId: 'input1', operator: '<', value: 18 }], outputs: [{ outputId: 'output1', value: '低风险' }] },
        ],
      });

      const firstVersion = result1.version;

      // 创建新版本
      const result2 = await dmnService.createNewVersion(result1.id);

      expect(result2.version).toBeGreaterThan(firstVersion);
    });

    it('应该能够查询特定版本的决策表', async () => {
      // 创建第一个版本
      const result = await dmnService.createDecision({
        decisionKey: 'simpleDecision',
        name: '简单决策',
        hitPolicy: 'UNIQUE',
        inputs: [{ id: 'input1', label: '年龄', expression: 'age', type: 'number' }],
        outputs: [{ id: 'output1', label: '风险等级', name: 'riskLevel', type: 'string' }],
        rules: [
          { conditions: [{ inputId: 'input1', operator: '<', value: 18 }], outputs: [{ outputId: 'output1', value: '低风险' }] },
        ],
      });

      // 查询特定版本
      const decision = await dmnService.getDecision(result.id);
      expect(decision).toBeDefined();
      expect(decision.version).toBe(1);
    });

    it('默认应该使用最新版本的决策表', async () => {
      // 创建决策
      const result = await dmnService.createDecision({
        decisionKey: 'simpleDecision',
        name: '简单决策',
        hitPolicy: 'UNIQUE',
        inputs: [{ id: 'input1', label: '年龄', expression: 'age', type: 'number' }],
        outputs: [{ id: 'output1', label: '风险等级', name: 'riskLevel', type: 'string' }],
        rules: [
          { conditions: [{ inputId: 'input1', operator: '<', value: 18 }], outputs: [{ outputId: 'output1', value: '低风险' }] },
        ],
      });

      // 发布决策
      await dmnService.publishDecision(result.id);

      // 执行决策
      const executionResult = await dmnService.executeDecision({
        decisionId: result.id,
        inputData: { age: 25 },
      });

      expect(executionResult).toBeDefined();
    });
  });
});
