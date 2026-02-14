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
import { DmnDecision } from '../../src/dmn/entities/dmn-decision.entity';
import { DmnExecution } from '../../src/dmn/entities/dmn-execution.entity';

// Services
import { ProcessDefinitionService } from '../../src/process-definition/services/process-definition.service';
import { ProcessInstanceService } from '../../src/process-instance/services/process-instance.service';
import { TaskService } from '../../src/task/services/task.service';
import { DmnService } from '../../src/dmn/services/dmn.service';
import { HistoryService } from '../../src/history/services/history.service';
import { EventBusService } from '../../src/core/services/event-bus.service';

// 简单决策表DMN XML - 唯一命中策略
const SIMPLE_DECISION_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd"
  xmlns:feel="http://www.omg.org/spec/FEEL/20140401"
  targetNamespace="http://flowable.org/test/dmn">
  <decision id="simpleDecision" name="简单决策">
    <decisionTable id="decisionTable" hitPolicy="UNIQUE">
      <input id="input1" label="年龄">
        <inputExpression id="inputExpr1" typeRef="number">
          <text>age</text>
        </inputExpression>
      </input>
      <output id="output1" label="风险等级" typeRef="string" name="riskLevel"/>
      <rule id="rule1">
        <inputEntry id="inputEntry1">
          <text>< 18</text>
        </inputEntry>
        <outputEntry id="outputEntry1">
          <text>"低风险"</text>
        </outputEntry>
      </rule>
      <rule id="rule2">
        <inputEntry id="inputEntry2">
          <text>[18..60]</text>
        </inputEntry>
        <outputEntry id="outputEntry2">
          <text>"中风险"</text>
        </outputEntry>
      </rule>
      <rule id="rule3">
        <inputEntry id="inputEntry3">
          <text>> 60</text>
        </inputEntry>
        <outputEntry id="outputEntry3">
          <text>"高风险"</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

// 多条件决策表DMN XML - 优先级命中策略
const PRIORITY_DECISION_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd"
  targetNamespace="http://flowable.org/test/dmn">
  <decision id="priorityDecision" name="优先级决策">
    <decisionTable id="decisionTable" hitPolicy="PRIORITY">
      <input id="input1" label="信用分数">
        <inputExpression id="inputExpr1" typeRef="number">
          <text>creditScore</text>
        </inputExpression>
      </input>
      <input id="input2" label="收入">
        <inputExpression id="inputExpr2" typeRef="number">
          <text>income</text>
        </inputExpression>
      </input>
      <output id="output1" label="审批结果" typeRef="string" name="approvalResult"/>
      <output id="output2" label="优先级" typeRef="number" name="priority"/>
      <rule id="rule1">
        <inputEntry id="inputEntry1">
          <text>>= 800</text>
        </inputEntry>
        <inputEntry id="inputEntry2">
          <text>>= 100000</text>
        </inputEntry>
        <outputEntry id="outputEntry1">
          <text>"自动批准"</text>
        </outputEntry>
        <outputEntry id="outputEntry2">
          <text>1</text>
        </outputEntry>
      </rule>
      <rule id="rule2">
        <inputEntry id="inputEntry3">
          <text>>= 700</text>
        </inputEntry>
        <inputEntry id="inputEntry4">
          <text>>= 50000</text>
        </inputEntry>
        <outputEntry id="outputEntry3">
          <text>"快速审批"</text>
        </outputEntry>
        <outputEntry id="outputEntry4">
          <text>2</text>
        </outputEntry>
      </rule>
      <rule id="rule3">
        <inputEntry id="inputEntry5">
          <text>>= 600</text>
        </inputEntry>
        <inputEntry id="inputEntry6">
          <text>-</text>
        </inputEntry>
        <outputEntry id="outputEntry5">
          <text>"人工审核"</text>
        </outputEntry>
        <outputEntry id="outputEntry6">
          <text>3</text>
        </outputEntry>
      </rule>
      <rule id="rule4">
        <inputEntry id="inputEntry7">
          <text>-</text>
        </inputEntry>
        <inputEntry id="inputEntry8">
          <text>-</text>
        </inputEntry>
        <outputEntry id="outputEntry7">
          <text>"拒绝"</text>
        </outputEntry>
        <outputEntry id="outputEntry8">
          <text>4</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

// 收集命中策略决策表
const COLLECT_DECISION_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd"
  targetNamespace="http://flowable.org/test/dmn">
  <decision id="collectDecision" name="收集决策">
    <decisionTable id="decisionTable" hitPolicy="COLLECT">
      <input id="input1" label="客户类型">
        <inputExpression id="inputExpr1" typeRef="string">
          <text>customerType</text>
        </inputExpression>
      </input>
      <output id="output1" label="折扣" typeRef="number" name="discount"/>
      <rule id="rule1">
        <inputEntry id="inputEntry1">
          <text>"VIP"</text>
        </inputEntry>
        <outputEntry id="outputEntry1">
          <text>10</text>
        </outputEntry>
      </rule>
      <rule id="rule2">
        <inputEntry id="inputEntry2">
          <text>"VIP"</text>
        </inputEntry>
        <outputEntry id="outputEntry2">
          <text>5</text>
        </outputEntry>
      </rule>
      <rule id="rule3">
        <inputEntry id="inputEntry3">
          <text>"普通"</text>
        </inputEntry>
        <outputEntry id="outputEntry3">
          <text>3</text>
        </outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

// Business Rule Task流程
const BUSINESS_RULE_TASK_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="businessRuleProcess" name="业务规则流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="businessRuleTask"/>
    
    <!-- Business Rule Task -->
    <businessRuleTask id="businessRuleTask" name="风险评估" 
                      decisionTableReferenceKey="simpleDecision">
      <extensionElements>
        <flowable:inputVariable name="age"/>
        <flowable:outputVariable name="riskLevel"/>
      </extensionElements>
    </businessRuleTask>
    
    <sequenceFlow id="flow2" sourceRef="businessRuleTask" targetRef="exclusiveGateway"/>
    
    <!-- 排他网关 - 根据决策结果分支 -->
    <exclusiveGateway id="exclusiveGateway" name="风险分支"/>
    
    <sequenceFlow id="lowRiskFlow" sourceRef="exclusiveGateway" targetRef="lowRiskTask">
      <conditionExpression xsi:type="tFormalExpression">${riskLevel == '低风险'}</conditionExpression>
    </sequenceFlow>
    
    <sequenceFlow id="mediumRiskFlow" sourceRef="exclusiveGateway" targetRef="mediumRiskTask">
      <conditionExpression xsi:type="tFormalExpression">${riskLevel == '中风险'}</conditionExpression>
    </sequenceFlow>
    
    <sequenceFlow id="highRiskFlow" sourceRef="exclusiveGateway" targetRef="highRiskTask">
      <conditionExpression xsi:type="tFormalExpression">${riskLevel == '高风险'}</conditionExpression>
    </sequenceFlow>
    
    <userTask id="lowRiskTask" name="低风险处理">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <userTask id="mediumRiskTask" name="中风险处理">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <userTask id="highRiskTask" name="高风险处理">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow3" sourceRef="lowRiskTask" targetRef="end"/>
    <sequenceFlow id="flow4" sourceRef="mediumRiskTask" targetRef="end"/>
    <sequenceFlow id="flow5" sourceRef="highRiskTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

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
  let dmnDecisionRepo: vi.Mocked<Repository<DmnDecision>>;
  let dmnExecutionRepo: vi.Mocked<Repository<DmnExecution>>;

  // 测试数据存储
  let processDefinitions: Map<string, ProcessDefinition>;
  let processInstances: Map<string, ProcessInstance>;
  let executions: Map<string, Execution>;
  let variables: Map<string, Variable>;
  let tasks: Map<string, Task>;
  let dmnDecisions: Map<string, DmnDecision>;
  let dmnExecutions: Map<string, DmnExecution>;

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
        count: vi.fn(async () => storage.size),
      } as any;
    };

    processDefinitionRepo = createMockRepo(processDefinitions);
    processInstanceRepo = createMockRepo(processInstances);
    executionRepo = createMockRepo(executions);
    variableRepo = createMockRepo(variables);
    taskRepo = createMockRepo(tasks);
    dmnDecisionRepo = createMockRepo(dmnDecisions);
    dmnExecutionRepo = createMockRepo(dmnExecutions);

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        ProcessDefinitionService,
        ProcessInstanceService,
        TaskService,
        DmnService,
        HistoryService,
        EventBusService,
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
          provide: getRepositoryToken(DmnDecision),
          useValue: dmnDecisionRepo,
        },
        {
          provide: getRepositoryToken(DmnExecution),
          useValue: dmnExecutionRepo,
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
        const result = await dmnService.deploy({
          name: '简单决策',
          key: 'simpleDecision',
          dmnXml: SIMPLE_DECISION_DMN_XML,
        });

        expect(result).toBeDefined();
        expect(result.decisionKey).toBe('simpleDecision');
      });

      it('应该能够部署优先级决策表', async () => {
        const result = await dmnService.deploy({
          name: '优先级决策',
          key: 'priorityDecision',
          dmnXml: PRIORITY_DECISION_DMN_XML,
        });

        expect(result).toBeDefined();
        expect(result.decisionKey).toBe('priorityDecision');
      });

      it('应该能够部署收集策略决策表', async () => {
        const result = await dmnService.deploy({
          name: '收集决策',
          key: 'collectDecision',
          dmnXml: COLLECT_DECISION_DMN_XML,
        });

        expect(result).toBeDefined();
        expect(result.decisionKey).toBe('collectDecision');
      });

      it('部署时应该解析决策表元数据', async () => {
        await dmnService.deploy({
          name: '简单决策',
          key: 'simpleDecision',
          dmnXml: SIMPLE_DECISION_DMN_XML,
        });

        const decision = await dmnService.findByKey('simpleDecision');
        expect(decision).toBeDefined();
        expect(decision?.hitPolicy).toBe('UNIQUE');
        expect(decision?.inputCount).toBe(1);
        expect(decision?.outputCount).toBe(1);
        expect(decision?.ruleCount).toBe(3);
      });
    });

    describe('决策执行 - UNIQUE命中策略', () => {
      beforeEach(async () => {
        await dmnService.deploy({
          name: '简单决策',
          key: 'simpleDecision',
          dmnXml: SIMPLE_DECISION_DMN_XML,
        });
      });

      it('应该能够执行决策并返回正确结果 - 低风险', async () => {
        const result = await dmnService.execute({
          decisionKey: 'simpleDecision',
          variables: {
            age: 15,
          },
        });

        expect(result).toBeDefined();
        expect(result.riskLevel).toBe('低风险');
      });

      it('应该能够执行决策并返回正确结果 - 中风险', async () => {
        const result = await dmnService.execute({
          decisionKey: 'simpleDecision',
          variables: {
            age: 30,
          },
        });

        expect(result).toBeDefined();
        expect(result.riskLevel).toBe('中风险');
      });

      it('应该能够执行决策并返回正确结果 - 高风险', async () => {
        const result = await dmnService.execute({
          decisionKey: 'simpleDecision',
          variables: {
            age: 70,
          },
        });

        expect(result).toBeDefined();
        expect(result.riskLevel).toBe('高风险');
      });

      it('UNIQUE策略应该只返回一个匹配结果', async () => {
        const result = await dmnService.execute({
          decisionKey: 'simpleDecision',
          variables: {
            age: 25,
          },
        });

        expect(Array.isArray(result)).toBe(false);
        expect(result.riskLevel).toBeDefined();
      });
    });

    describe('决策执行 - PRIORITY命中策略', () => {
      beforeEach(async () => {
        await dmnService.deploy({
          name: '优先级决策',
          key: 'priorityDecision',
          dmnXml: PRIORITY_DECISION_DMN_XML,
        });
      });

      it('应该返回最高优先级的匹配规则', async () => {
        const result = await dmnService.execute({
          decisionKey: 'priorityDecision',
          variables: {
            creditScore: 850,
            income: 150000,
          },
        });

        expect(result).toBeDefined();
        expect(result.approvalResult).toBe('自动批准');
      });

      it('应该返回次高优先级的匹配规则', async () => {
        const result = await dmnService.execute({
          decisionKey: 'priorityDecision',
          variables: {
            creditScore: 750,
            income: 60000,
          },
        });

        expect(result).toBeDefined();
        expect(result.approvalResult).toBe('快速审批');
      });

      it('应该返回默认规则当没有其他匹配时', async () => {
        const result = await dmnService.execute({
          decisionKey: 'priorityDecision',
          variables: {
            creditScore: 500,
            income: 20000,
          },
        });

        expect(result).toBeDefined();
        expect(result.approvalResult).toBe('拒绝');
      });
    });

    describe('决策执行 - COLLECT命中策略', () => {
      beforeEach(async () => {
        await dmnService.deploy({
          name: '收集决策',
          key: 'collectDecision',
          dmnXml: COLLECT_DECISION_DMN_XML,
        });
      });

      it('应该返回所有匹配的结果', async () => {
        const result = await dmnService.execute({
          decisionKey: 'collectDecision',
          variables: {
            customerType: 'VIP',
          },
        });

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        expect(result).toContain(10);
        expect(result).toContain(5);
      });

      it('应该返回单个匹配结果', async () => {
        const result = await dmnService.execute({
          decisionKey: 'collectDecision',
          variables: {
            customerType: '普通',
          },
        });

        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result).toContain(3);
      });
    });

    describe('决策执行历史', () => {
      beforeEach(async () => {
        await dmnService.deploy({
          name: '简单决策',
          key: 'simpleDecision',
          dmnXml: SIMPLE_DECISION_DMN_XML,
        });
      });

      it('应该记录决策执行历史', async () => {
        await dmnService.execute({
          decisionKey: 'simpleDecision',
          variables: {
            age: 25,
          },
          processInstanceId: 'proc-inst-001',
        });

        const history = await dmnService.findExecutionHistory('proc-inst-001');
        expect(history.length).toBeGreaterThan(0);
      });

      it('历史记录应该包含输入变量', async () => {
        await dmnService.execute({
          decisionKey: 'simpleDecision',
          variables: {
            age: 25,
          },
          processInstanceId: 'proc-inst-002',
        });

        const history = await dmnService.findExecutionHistory('proc-inst-002');
        const execution = history[0];
        expect(execution.inputVariables).toBeDefined();
        expect(execution.inputVariables.age).toBe(25);
      });

      it('历史记录应该包含输出结果', async () => {
        await dmnService.execute({
          decisionKey: 'simpleDecision',
          variables: {
            age: 25,
          },
          processInstanceId: 'proc-inst-003',
        });

        const history = await dmnService.findExecutionHistory('proc-inst-003');
        const execution = history[0];
        expect(execution.outputResults).toBeDefined();
        expect(execution.outputResults.riskLevel).toBe('中风险');
      });
    });
  });

  describe('6.3.12 Business Rule Task集成', () => {
    beforeEach(async () => {
      // 部署决策表
      await dmnService.deploy({
        name: '简单决策',
        key: 'simpleDecision',
        dmnXml: SIMPLE_DECISION_DMN_XML,
      });

      // 部署流程定义
      await processDefinitionService.deploy({
        name: '业务规则流程',
        key: 'businessRuleProcess',
        bpmnXml: BUSINESS_RULE_TASK_BPMN_XML,
        generateDiagram: false,
      });
    });

    it('应该能够部署带Business Rule Task的流程', async () => {
      const definition = await processDefinitionService.findByKey('businessRuleProcess');
      expect(definition).toBeDefined();
    });

    it('Business Rule Task应该执行决策表', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'businessRuleProcess',
        businessKey: 'BIZ-RULE-001',
        variables: {
          age: 25,
          assignee: 'user001',
        },
      });

      // 验证决策已执行，流程变量中应该有riskLevel
      const instance = await processInstanceService.findById(startResult.id);
      expect(instance).toBeDefined();
    });

    it('应该根据决策结果走低风险分支', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'businessRuleProcess',
        businessKey: 'BIZ-RULE-002',
        variables: {
          age: 15,
          assignee: 'user001',
        },
      });

      // 验证低风险任务已创建
      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const lowRiskTask = allTasks.find((t: any) => t.taskDefinitionKey === 'lowRiskTask');
      expect(lowRiskTask).toBeDefined();
    });

    it('应该根据决策结果走中风险分支', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'businessRuleProcess',
        businessKey: 'BIZ-RULE-003',
        variables: {
          age: 30,
          assignee: 'user001',
        },
      });

      // 验证中风险任务已创建
      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const mediumRiskTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mediumRiskTask');
      expect(mediumRiskTask).toBeDefined();
    });

    it('应该根据决策结果走高风险分支', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'businessRuleProcess',
        businessKey: 'BIZ-RULE-004',
        variables: {
          age: 70,
          assignee: 'user001',
        },
      });

      // 验证高风险任务已创建
      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const highRiskTask = allTasks.find((t: any) => t.taskDefinitionKey === 'highRiskTask');
      expect(highRiskTask).toBeDefined();
    });

    it('应该能够完成带Business Rule Task的流程', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'businessRuleProcess',
        businessKey: 'BIZ-RULE-005',
        variables: {
          age: 30,
          assignee: 'user001',
        },
      });

      // 完成任务
      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const task = allTasks.find((t: any) => t.status === 'ACTIVE');
      await taskService.complete(task!.id, {});

      // 验证流程完成
      const instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('COMPLETED');
    });
  });

  describe('6.3.12 决策表版本管理', () => {
    it('应该支持决策表版本管理', async () => {
      // 部署第一个版本
      await dmnService.deploy({
        name: '简单决策',
        key: 'simpleDecision',
        dmnXml: SIMPLE_DECISION_DMN_XML,
      });

      let decision = await dmnService.findByKey('simpleDecision');
      const firstVersion = decision?.version;

      // 部署第二个版本
      await dmnService.deploy({
        name: '简单决策',
        key: 'simpleDecision',
        dmnXml: SIMPLE_DECISION_DMN_XML,
      });

      decision = await dmnService.findByKey('simpleDecision');
      expect(decision?.version).toBeGreaterThan(firstVersion || 0);
    });

    it('应该能够查询特定版本的决策表', async () => {
      // 部署多个版本
      await dmnService.deploy({
        name: '简单决策',
        key: 'simpleDecision',
        dmnXml: SIMPLE_DECISION_DMN_XML,
      });

      await dmnService.deploy({
        name: '简单决策',
        key: 'simpleDecision',
        dmnXml: SIMPLE_DECISION_DMN_XML,
      });

      // 查询特定版本
      const decision = await dmnService.findByKeyAndVersion('simpleDecision', 1);
      expect(decision).toBeDefined();
      expect(decision?.version).toBe(1);
    });

    it('默认应该使用最新版本的决策表', async () => {
      // 部署多个版本
      await dmnService.deploy({
        name: '简单决策',
        key: 'simpleDecision',
        dmnXml: SIMPLE_DECISION_DMN_XML,
      });

      await dmnService.deploy({
        name: '简单决策',
        key: 'simpleDecision',
        dmnXml: SIMPLE_DECISION_DMN_XML,
      });

      // 执行决策（不指定版本）
      const result = await dmnService.execute({
        decisionKey: 'simpleDecision',
        variables: {
          age: 25,
        },
      });

      expect(result).toBeDefined();
    });
  });
});
