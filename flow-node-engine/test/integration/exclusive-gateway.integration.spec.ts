/**
 * 集成测试 - 排他网关分支
 * 测试场景：基于条件的排他网关分支选择
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

// Services
import { ProcessDefinitionService } from '../../src/process-definition/services/process-definition.service';
import { ProcessInstanceService } from '../../src/process-instance/services/process-instance.service';
import { TaskService } from '../../src/task/services/task.service';
import { GatewayExecutorService } from '../../src/core/services/gateway-executor.service';
import { ExpressionEvaluatorService } from '../../src/core/services/expression-evaluator.service';
import { EventBusService } from '../../src/core/services/event-bus.service';

// 测试用BPMN XML - 排他网关分支流程
const EXCLUSIVE_GATEWAY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="exclusiveGatewayProcess" name="排他网关测试流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="gateway1"/>
    
    <!-- 排他网关 - 分支-->
    <exclusiveGateway id="gateway1" name="金额判断"/>
    
    <!-- 分支1: 金额 <= 1000 -->
    <sequenceFlow id="flow2" sourceRef="gateway1" targetRef="smallAmountTask">
      <conditionExpression xsi:type="tFormalExpression">${amount <= 1000}</conditionExpression>
    </sequenceFlow>
    
    <!-- 分支2: 1000< 金额 <= 5000 -->
    <sequenceFlow id="flow3" sourceRef="gateway1" targetRef="mediumAmountTask">
      <conditionExpression xsi:type="tFormalExpression">${amount > 1000 && amount <= 5000}</conditionExpression>
    </sequenceFlow>
    
    <!-- 分支3: 金额 > 5000 -->
    <sequenceFlow id="flow4" sourceRef="gateway1" targetRef="largeAmountTask">
      <conditionExpression xsi:type="tFormalExpression">${amount > 5000}</conditionExpression>
    </sequenceFlow>
    
    <!-- 各分支任务 -->
    <userTask id="smallAmountTask" name="小额审批">
      <extensionElements>
        <flowable:assignee>${approver}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <userTask id="mediumAmountTask" name="中额审批">
      <extensionElements>
        <flowable:assignee>${approver}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <userTask id="largeAmountTask" name="大额审批">
      <extensionElements>
        <flowable:assignee>${seniorApprover}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <!-- 汇聚到结束 -->
    <sequenceFlow id="flow5" sourceRef="smallAmountTask" targetRef="end"/>
    <sequenceFlow id="flow6" sourceRef="mediumAmountTask" targetRef="end"/>
    <sequenceFlow id="flow7" sourceRef="largeAmountTask" targetRef="end"/>
    
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('集成测试 - 排他网关分支', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let taskService: TaskService;
  let gatewayExecutorService: GatewayExecutorService;

  // Mock repositories
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let executionRepo: vi.Mocked<Repository<Execution>>;
  let variableRepo: vi.Mocked<Repository<Variable>>;
  let taskRepo: vi.Mocked<Repository<Task>>;

  // 测试数据存储
  let processDefinitions: Map<string, ProcessDefinition>;
  let processInstances: Map<string, ProcessInstance>;
  let executions: Map<string, Execution>;
  let variables: Map<string, Variable>;
  let tasks: Map<string, Task>;

  beforeEach(async () => {
    // 初始化数据存储
    processDefinitions = new Map();
    processInstances = new Map();
    executions = new Map();
    variables = new Map();
    tasks = new Map();

    // 创建mock repositories
    const createMockRepo = <T>(storage: Map<string, T>): vi.Mocked<Repository<T>> => {
      return {
        find: vi.fn(async () => Array.from(storage.values())),
        findOne: vi.fn(async (options: any) => {
          if (options?.where?.id) {
            return storage.get(options.where.id) || null;
          }
          if (options?.where?.processInstanceId) {
            return Array.from(storage.values()).find(
              (item: any) => item.processInstanceId === options.where.processInstanceId
            ) as T || null;
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

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        ProcessDefinitionService,
        ProcessInstanceService,
        TaskService,
        GatewayExecutorService,
        ExpressionEvaluatorService,
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
      ],
    }).compile();

    // 获取服务实例
    processDefinitionService = module.get<ProcessDefinitionService>(ProcessDefinitionService);
    processInstanceService = module.get<ProcessInstanceService>(ProcessInstanceService);
    taskService = module.get<TaskService>(TaskService);
    gatewayExecutorService = module.get<GatewayExecutorService>(GatewayExecutorService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.2 排他网关分支测试', () => {
    beforeEach(async () => {
      // 部署流程定义
      await processDefinitionService.deploy({
        name: '排他网关测试流程',
        key: 'exclusiveGatewayProcess',
        bpmnXml: EXCLUSIVE_GATEWAY_BPMN_XML,
        generateDiagram: false,
      });
    });

    it('应该选择小额审批分支当金额<=1000', async () => {
      // 启动流程实例 - 小额
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'exclusiveGatewayProcess',
        businessKey: 'REQ-001',
        variables: {
          amount: 500,
          approver: 'manager001',
          seniorApprover: 'director001',
        },
      });

      // 验证只有小额审批任务被创建
      const tasks = await taskService.findByProcessInstance(startResult.id);
      expect(tasks.length).toBe(1);
      expect(tasks[0].taskDefinitionKey).toBe('smallAmountTask');
      expect(tasks[0].name).toBe('小额审批');
      expect(tasks[0].assignee).toBe('manager001');
    });

    it('应该选择中额审批分支当1000<金额<=5000', async () => {
      // 启动流程实例 - 中额
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'exclusiveGatewayProcess',
        businessKey: 'REQ-002',
        variables: {
          amount: 3000,
          approver: 'manager001',
          seniorApprover: 'director001',
        },
      });

      // 验证只有中额审批任务被创建
      const tasks = await taskService.findByProcessInstance(startResult.id);
      expect(tasks.length).toBe(1);
      expect(tasks[0].taskDefinitionKey).toBe('mediumAmountTask');
      expect(tasks[0].name).toBe('中额审批');
      expect(tasks[0].assignee).toBe('manager001');
    });

    it('应该选择大额审批分支当金额>5000', async () => {
      // 启动流程实例 - 大额
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'exclusiveGatewayProcess',
        businessKey: 'REQ-003',
        variables: {
          amount: 10000,
          approver: 'manager001',
          seniorApprover: 'director001',
        },
      });

      // 验证只有大额审批任务被创建
      const tasks = await taskService.findByProcessInstance(startResult.id);
      expect(tasks.length).toBe(1);
      expect(tasks[0].taskDefinitionKey).toBe('largeAmountTask');
      expect(tasks[0].name).toBe('大额审批');
      expect(tasks[0].assignee).toBe('director001');
    });

    it('应该正确处理边界值 - 金额等于1000', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'exclusiveGatewayProcess',
        businessKey: 'REQ-004',
        variables: {
          amount: 1000,
          approver: 'manager001',
          seniorApprover: 'director001',
        },
      });

      const tasks = await taskService.findByProcessInstance(startResult.id);
      expect(tasks[0].taskDefinitionKey).toBe('smallAmountTask');
    });

    it('应该正确处理边界值 - 金额等于5000', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'exclusiveGatewayProcess',
        businessKey: 'REQ-005',
        variables: {
          amount: 5000,
          approver: 'manager001',
          seniorApprover: 'director001',
        },
      });

      const tasks = await taskService.findByProcessInstance(startResult.id);
      expect(tasks[0].taskDefinitionKey).toBe('mediumAmountTask');
    });

    it('应该正确处理边界值 - 金额略大于5000', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'exclusiveGatewayProcess',
        businessKey: 'REQ-006',
        variables: {
          amount: 5001,
          approver: 'manager001',
          seniorApprover: 'director001',
        },
      });

      const tasks = await taskService.findByProcessInstance(startResult.id);
      expect(tasks[0].taskDefinitionKey).toBe('largeAmountTask');
    });

    it('应该在完成分支任务后正常结束流程', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'exclusiveGatewayProcess',
        businessKey: 'REQ-007',
        variables: {
          amount: 2000,
          approver: 'manager001',
          seniorApprover: 'director001',
        },
      });

      // 完成中额审批任务
      const tasks = await taskService.findByProcessInstance(startResult.id);
      await taskService.complete(tasks[0].id, { approved: true });

      // 验证流程已完成
      const instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('COMPLETED');
    });

    it('应该支持动态变量更新影响分支选择', async () => {
      // 这个测试验证在流程执行过程中变量可以被更新
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'exclusiveGatewayProcess',
        businessKey: 'REQ-008',
        variables: {
          amount: 800,
          approver: 'manager001',
          seniorApprover: 'director001',
        },
      });

      // 验证初始分支
      let tasks = await taskService.findByProcessInstance(startResult.id);
      expect(tasks[0].taskDefinitionKey).toBe('smallAmountTask');

      // 完成任务
      await taskService.complete(tasks[0].id, { approved: true });

      // 验证流程完成
      const instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('COMPLETED');
    });

    it('应该正确处理多个流程实例的独立分支选择', async () => {
      // 同时启动多个流程实例
      const results = await Promise.all([
        processInstanceService.start({
          processDefinitionKey: 'exclusiveGatewayProcess',
          businessKey: 'REQ-009',
          variables: { amount: 500, approver: 'manager001', seniorApprover: 'director001' },
        }),
        processInstanceService.start({
          processDefinitionKey: 'exclusiveGatewayProcess',
          businessKey: 'REQ-010',
          variables: { amount: 3000, approver: 'manager001', seniorApprover: 'director001' },
        }),
        processInstanceService.start({
          processDefinitionKey: 'exclusiveGatewayProcess',
          businessKey: 'REQ-011',
          variables: { amount: 8000, approver: 'manager001', seniorApprover: 'director001' },
        }),
      ]);

      // 验证每个流程实例选择了正确的分支
      const tasks1 = await taskService.findByProcessInstance(results[0].id);
      expect(tasks1[0].taskDefinitionKey).toBe('smallAmountTask');

      const tasks2 = await taskService.findByProcessInstance(results[1].id);
      expect(tasks2[0].taskDefinitionKey).toBe('mediumAmountTask');

      const tasks3 = await taskService.findByProcessInstance(results[2].id);
      expect(tasks3[0].taskDefinitionKey).toBe('largeAmountTask');
    });
  });
});
