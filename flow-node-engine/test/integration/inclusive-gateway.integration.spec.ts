/**
 * 集成测试 - 包容网关分叉/汇聚
 * 测试场景：包容网关实现条件多分支和汇聚
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

// 测试用BPMN XML - 包容网关分叉/汇聚流程
const INCLUSIVE_GATEWAY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="inclusiveGatewayProcess" name="包容网关测试流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="forkGateway"/>
    
    <!-- 包容网关 - 分叉 -->
    <inclusiveGateway id="forkGateway" name="包容分叉"/>
    
    <!-- 条件分支 -->
    <sequenceFlow id="flow2" sourceRef="forkGateway" targetRef="emailTask">
      <conditionExpression xsi:type="tFormalExpression">${notifyEmail}</conditionExpression>
    </sequenceFlow>
    
    <sequenceFlow id="flow3" sourceRef="forkGateway" targetRef="smsTask">
      <conditionExpression xsi:type="tFormalExpression">${notifySms}</conditionExpression>
    </sequenceFlow>
    
    <sequenceFlow id="flow4" sourceRef="forkGateway" targetRef="pushTask">
      <conditionExpression xsi:type="tFormalExpression">${notifyPush}</conditionExpression>
    </sequenceFlow>
    
    <!-- 通知任务 -->
    <userTask id="emailTask" name="邮件通知">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <userTask id="smsTask" name="短信通知">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <userTask id="pushTask" name="推送通知">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <!-- 汇聚流 -->
    <sequenceFlow id="flow5" sourceRef="emailTask" targetRef="joinGateway"/>
    <sequenceFlow id="flow6" sourceRef="smsTask" targetRef="joinGateway"/>
    <sequenceFlow id="flow7" sourceRef="pushTask" targetRef="joinGateway"/>
    
    <!-- 包容网关 - 汇聚 -->
    <inclusiveGateway id="joinGateway" name="包容汇聚"/>
    
    <sequenceFlow id="flow8" sourceRef="joinGateway" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('集成测试 - 包容网关分叉/汇聚', () => {
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
            return Array.from(storage.values()).filter(
              (item: any) => item.processInstanceId === options.where.processInstanceId
            ) as any;
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

  describe('6.3.4 包容网关分叉/汇聚测试', () => {
    beforeEach(async () => {
      // 部署流程定义
      await processDefinitionService.deploy({
        name: '包容网关测试流程',
        key: 'inclusiveGatewayProcess',
        bpmnXml: INCLUSIVE_GATEWAY_BPMN_XML,
        generateDiagram: false,
      });
    });

    it('应该只激活满足条件的分支 - 仅邮件', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'inclusiveGatewayProcess',
        businessKey: 'NOTIFY-001',
        variables: {
          notifyEmail: true,
          notifySms: false,
          notifyPush: false,
          assignee: 'user001',
        },
      });

      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      expect(activeTasks.length).toBe(1);
      expect(activeTasks[0].taskDefinitionKey).toBe('emailTask');
    });

    it('应该激活多个满足条件的分支 - 邮件和短信', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'inclusiveGatewayProcess',
        businessKey: 'NOTIFY-002',
        variables: {
          notifyEmail: true,
          notifySms: true,
          notifyPush: false,
          assignee: 'user001',
        },
      });

      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      expect(activeTasks.length).toBe(2);
      const taskKeys = activeTasks.map((t: any) => t.taskDefinitionKey);
      expect(taskKeys).toContain('emailTask');
      expect(taskKeys).toContain('smsTask');
      expect(taskKeys).not.toContain('pushTask');
    });

    it('应该激活所有满足条件的分支 - 全部', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'inclusiveGatewayProcess',
        businessKey: 'NOTIFY-003',
        variables: {
          notifyEmail: true,
          notifySms: true,
          notifyPush: true,
          assignee: 'user001',
        },
      });

      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      expect(activeTasks.length).toBe(3);
    });

    it('应该在所有激活的分支完成后才汇聚', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'inclusiveGatewayProcess',
        businessKey: 'NOTIFY-004',
        variables: {
          notifyEmail: true,
          notifySms: true,
          notifyPush: false,
          assignee: 'user001',
        },
      });

      // 获取激活的任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      expect(activeTasks.length).toBe(2);
      
      // 完成第一个任务
      const emailTask = activeTasks.find((t: any) => t.taskDefinitionKey === 'emailTask');
      await taskService.complete(emailTask!.id, {});
      
      // 验证流程尚未结束
      let instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('RUNNING');
      
      // 完成第二个任务
      allTasks = await taskService.findByProcessInstance(startResult.id);
      activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      const smsTask = activeTasks.find((t: any) => t.taskDefinitionKey === 'smsTask');
      await taskService.complete(smsTask!.id, {});
      
      // 验证流程已完成
      instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('COMPLETED');
    });

    it('应该正确处理没有条件满足的情况', async () => {
      // 当没有条件满足时，包容网关应该抛出错误或选择默认路径
      await expect(processInstanceService.start({
        processDefinitionKey: 'inclusiveGatewayProcess',
        businessKey: 'NOTIFY-005',
        variables: {
          notifyEmail: false,
          notifySms: false,
          notifyPush: false,
          assignee: 'user001',
        },
      })).rejects.toThrow();
    });

    it('应该支持动态条件组合', async () => {
      // 测试不同的条件组合
      const testCases = [
        { notifyEmail: true, notifySms: false, notifyPush: false, expectedCount: 1 },
        { notifyEmail: false, notifySms: true, notifyPush: false, expectedCount: 1 },
        { notifyEmail: false, notifySms: false, notifyPush: true, expectedCount: 1 },
        { notifyEmail: true, notifySms: true, notifyPush: false, expectedCount: 2 },
        { notifyEmail: true, notifySms: false, notifyPush: true, expectedCount: 2 },
        { notifyEmail: false, notifySms: true, notifyPush: true, expectedCount: 2 },
        { notifyEmail: true, notifySms: true, notifyPush: true, expectedCount: 3 },
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'inclusiveGatewayProcess',
          businessKey: `NOTIFY-CASE-${i}`,
          variables: {
            ...testCase,
            assignee: 'user001',
          },
        });

        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
        expect(activeTasks.length).toBe(testCase.expectedCount);
      }
    });
  });
});
