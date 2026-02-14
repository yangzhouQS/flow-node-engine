/**
 * 集成测试 - 并行网关分叉/汇聚
 * 测试场景：并行网关实现多任务并发执行和汇聚
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

// 测试用BPMN XML - 并行网关分叉/汇聚流程
const PARALLEL_GATEWAY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="parallelGatewayProcess" name="并行网关测试流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="forkGateway"/>
    
    <!-- 并行网关 - 分叉 -->
    <parallelGateway id="forkGateway" name="并行分叉"/>
    
    <!-- 并行分支 -->
    <sequenceFlow id="flow2" sourceRef="forkGateway" targetRef="task1"/>
    <sequenceFlow id="flow3" sourceRef="forkGateway" targetRef="task2"/>
    <sequenceFlow id="flow4" sourceRef="forkGateway" targetRef="task3"/>
    
    <!-- 并行任务 -->
    <userTask id="task1" name="技术评审">
      <extensionElements>
        <flowable:assignee>${techReviewer}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <userTask id="task2" name="财务审核">
      <extensionElements>
        <flowable:assignee>${financeReviewer}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <userTask id="task3" name="法务审核">
      <extensionElements>
        <flowable:assignee>${legalReviewer}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <!-- 汇聚流 -->
    <sequenceFlow id="flow5" sourceRef="task1" targetRef="joinGateway"/>
    <sequenceFlow id="flow6" sourceRef="task2" targetRef="joinGateway"/>
    <sequenceFlow id="flow7" sourceRef="task3" targetRef="joinGateway"/>
    
    <!-- 并行网关 - 汇聚 -->
    <parallelGateway id="joinGateway" name="并行汇聚"/>
    
    <sequenceFlow id="flow8" sourceRef="joinGateway" targetRef="finalTask"/>
    
    <!-- 汇聚后任务 -->
    <userTask id="finalTask" name="最终审批">
      <extensionElements>
        <flowable:assignee>${finalApprover}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow9" sourceRef="finalTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('集成测试 - 并行网关分叉/汇聚', () => {
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

  describe('6.3.3 并行网关分叉/汇聚测试', () => {
    beforeEach(async () => {
      // 部署流程定义
      await processDefinitionService.deploy({
        name: '并行网关测试流程',
        key: 'parallelGatewayProcess',
        bpmnXml: PARALLEL_GATEWAY_BPMN_XML,
        generateDiagram: false,
      });
    });

    it('应该同时创建所有并行分支任务', async () => {
      // 启动流程实例
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'parallelGatewayProcess',
        businessKey: 'PRJ-001',
        variables: {
          techReviewer: 'tech001',
          financeReviewer: 'finance001',
          legalReviewer: 'legal001',
          finalApprover: 'manager001',
        },
      });

      // 验证所有并行任务被同时创建
      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      expect(activeTasks.length).toBe(3);
      
      // 验证三个不同的任务
      const taskKeys = activeTasks.map((t: any) => t.taskDefinitionKey);
      expect(taskKeys).toContain('task1');
      expect(taskKeys).toContain('task2');
      expect(taskKeys).toContain('task3');
    });

    it('应该为每个并行分支分配不同的处理人', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'parallelGatewayProcess',
        businessKey: 'PRJ-002',
        variables: {
          techReviewer: 'techUser',
          financeReviewer: 'financeUser',
          legalReviewer: 'legalUser',
          finalApprover: 'manager001',
        },
      });

      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      const techTask = activeTasks.find((t: any) => t.taskDefinitionKey === 'task1');
      const financeTask = activeTasks.find((t: any) => t.taskDefinitionKey === 'task2');
      const legalTask = activeTasks.find((t: any) => t.taskDefinitionKey === 'task3');
      
      expect(techTask?.assignee).toBe('techUser');
      expect(financeTask?.assignee).toBe('financeUser');
      expect(legalTask?.assignee).toBe('legalUser');
    });

    it('应该在所有并行任务完成后才创建汇聚后任务', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'parallelGatewayProcess',
        businessKey: 'PRJ-003',
        variables: {
          techReviewer: 'tech001',
          financeReviewer: 'finance001',
          legalReviewer: 'legal001',
          finalApprover: 'manager001',
        },
      });

      // 获取并行任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      // 完成第一个任务
      const task1 = activeTasks.find((t: any) => t.taskDefinitionKey === 'task1');
      await taskService.complete(task1!.id, { techApproved: true });
      
      // 验证汇聚后任务尚未创建
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const finalTask = allTasks.find((t: any) => t.taskDefinitionKey === 'finalTask');
      expect(finalTask).toBeUndefined();
      
      // 完成第二个任务
      activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      const task2 = activeTasks.find((t: any) => t.taskDefinitionKey === 'task2');
      await taskService.complete(task2!.id, { financeApproved: true });
      
      // 验证汇聚后任务仍未创建
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const finalTask2 = allTasks.find((t: any) => t.taskDefinitionKey === 'finalTask');
      expect(finalTask2).toBeUndefined();
      
      // 完成第三个任务
      activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      const task3 = activeTasks.find((t: any) => t.taskDefinitionKey === 'task3');
      await taskService.complete(task3!.id, { legalApproved: true });
      
      // 验证汇聚后任务已创建
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const finalTask3 = allTasks.find((t: any) => t.taskDefinitionKey === 'finalTask');
      expect(finalTask3).toBeDefined();
      expect(finalTask3?.name).toBe('最终审批');
    });

    it('应该支持并行任务的任意顺序完成', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'parallelGatewayProcess',
        businessKey: 'PRJ-004',
        variables: {
          techReviewer: 'tech001',
          financeReviewer: 'finance001',
          legalReviewer: 'legal001',
          finalApprover: 'manager001',
        },
      });

      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      // 按不同顺序完成: task3 -> task1 -> task2
      const task3 = activeTasks.find((t: any) => t.taskDefinitionKey === 'task3');
      await taskService.complete(task3!.id, {});
      
      allTasks = await taskService.findByProcessInstance(startResult.id);
      activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      const task1 = activeTasks.find((t: any) => t.taskDefinitionKey === 'task1');
      await taskService.complete(task1!.id, {});
      
      allTasks = await taskService.findByProcessInstance(startResult.id);
      activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      const task2 = activeTasks.find((t: any) => t.taskDefinitionKey === 'task2');
      await taskService.complete(task2!.id, {});
      
      // 验证流程正常继续
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const finalTask = allTasks.find((t: any) => t.taskDefinitionKey === 'finalTask');
      expect(finalTask).toBeDefined();
    });

    it('应该正确汇聚所有并行分支的变量', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'parallelGatewayProcess',
        businessKey: 'PRJ-005',
        variables: {
          techReviewer: 'tech001',
          financeReviewer: 'finance001',
          legalReviewer: 'legal001',
          finalApprover: 'manager001',
        },
      });

      // 完成所有并行任务并设置变量
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      const task1 = activeTasks.find((t: any) => t.taskDefinitionKey === 'task1');
      await taskService.complete(task1!.id, { techScore: 90, techComments: '技术通过' });
      
      allTasks = await taskService.findByProcessInstance(startResult.id);
      activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      const task2 = activeTasks.find((t: any) => t.taskDefinitionKey === 'task2');
      await taskService.complete(task2!.id, { financeScore: 85, budgetApproved: true });
      
      allTasks = await taskService.findByProcessInstance(startResult.id);
      activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      const task3 = activeTasks.find((t: any) => t.taskDefinitionKey === 'task3');
      await taskService.complete(task3!.id, { legalScore: 95, riskLevel: 'LOW' });
      
      // 验证所有变量都被保存
      const vars = await variableRepo.find();
      const varNames = vars.map((v: any) => v.name);
      expect(varNames).toContain('techScore');
      expect(varNames).toContain('financeScore');
      expect(varNames).toContain('legalScore');
    });

    it('应该在完成最终任务后正常结束流程', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'parallelGatewayProcess',
        businessKey: 'PRJ-006',
        variables: {
          techReviewer: 'tech001',
          financeReviewer: 'finance001',
          legalReviewer: 'legal001',
          finalApprover: 'manager001',
        },
      });

      // 完成所有并行任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let activeTasks = allTasks.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      for (const task of activeTasks) {
        if ((task as any).taskDefinitionKey !== 'finalTask') {
          await taskService.complete((task as any).id, {});
        }
      }
      
      // 完成最终任务
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const finalTask = allTasks.find((t: any) => t.taskDefinitionKey === 'finalTask');
      await taskService.complete(finalTask!.id, { finalApproved: true });
      
      // 验证流程已完成
      const instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('COMPLETED');
    });

    it('应该正确处理多个并行流程实例', async () => {
      // 启动多个流程实例
      const results = await Promise.all([
        processInstanceService.start({
          processDefinitionKey: 'parallelGatewayProcess',
          businessKey: 'PRJ-007',
          variables: {
            techReviewer: 'tech001',
            financeReviewer: 'finance001',
            legalReviewer: 'legal001',
            finalApprover: 'manager001',
          },
        }),
        processInstanceService.start({
          processDefinitionKey: 'parallelGatewayProcess',
          businessKey: 'PRJ-008',
          variables: {
            techReviewer: 'tech002',
            financeReviewer: 'finance002',
            legalReviewer: 'legal002',
            finalApprover: 'manager002',
          },
        }),
      ]);

      // 验证每个流程实例都有独立的任务集
      const tasks1 = await taskService.findByProcessInstance(results[0].id);
      const tasks2 = await taskService.findByProcessInstance(results[1].id);
      
      const activeTasks1 = tasks1.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      const activeTasks2 = tasks2.filter((t: any) => t.status === 'ACTIVE' || t.status === 'PENDING');
      
      expect(activeTasks1.length).toBe(3);
      expect(activeTasks2.length).toBe(3);
      
      // 验证任务属于不同的流程实例
      const instanceIds1 = new Set(activeTasks1.map((t: any) => t.processInstanceId));
      const instanceIds2 = new Set(activeTasks2.map((t: any) => t.processInstanceId));
      
      expect(instanceIds1.size).toBe(1);
      expect(instanceIds2.size).toBe(1);
      expect(instanceIds1).not.toEqual(instanceIds2);
    });
  });
});
