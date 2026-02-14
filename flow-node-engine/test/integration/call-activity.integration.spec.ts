/**
 * 集成测试 - 调用活动执行
 * 测试场景：调用活动(Call Activity)调用子流程
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
import { CallActivityExecutorService } from '../../src/core/services/call-activity-executor.service';
import { HistoryService } from '../../src/history/services/history.service';
import { EventBusService } from '../../src/core/services/event-bus.service';

// 被调用的子流程定义
const CALLED_SUB_PROCESS_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="calledSubProcess" name="被调用的子流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="subTask1"/>
    
    <userTask id="subTask1" name="子流程任务1">
      <extensionElements>
        <flowable:assignee>${subAssignee1}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="subTask1" targetRef="subTask2"/>
    
    <userTask id="subTask2" name="子流程任务2">
      <extensionElements>
        <flowable:assignee>${subAssignee2}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow3" sourceRef="subTask2" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 主流程定义 - 包含调用活动
const MAIN_PROCESS_WITH_CALL_ACTIVITY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="mainProcessWithCall" name="主流程-调用活动" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="mainTask"/>
    
    <userTask id="mainTask" name="主流程任务">
      <extensionElements>
        <flowable:assignee>${mainAssignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="mainTask" targetRef="callActivity"/>
    
    <callActivity id="callActivity" name="调用子流程" calledElement="calledSubProcess">
      <extensionElements>
        <flowable:in source="mainVar" target="subVar"/>
        <flowable:out source="subResult" target="mainResult"/>
      </extensionElements>
    </callActivity>
    
    <sequenceFlow id="flow3" sourceRef="callActivity" targetRef="finalTask"/>
    
    <userTask id="finalTask" name="最终任务">
      <extensionElements>
        <flowable:assignee>${finalAssignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow4" sourceRef="finalTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 带多调用活动的主流程
const MULTI_CALL_ACTIVITY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="multiCallProcess" name="多调用活动流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="callActivity1"/>
    
    <callActivity id="callActivity1" name="调用子流程1" calledElement="calledSubProcess">
      <extensionElements>
        <flowable:in source="var1" target="subVar1"/>
      </extensionElements>
    </callActivity>
    
    <sequenceFlow id="flow2" sourceRef="callActivity1" targetRef="callActivity2"/>
    
    <callActivity id="callActivity2" name="调用子流程2" calledElement="calledSubProcess">
      <extensionElements>
        <flowable:in source="var2" target="subVar2"/>
      </extensionElements>
    </callActivity>
    
    <sequenceFlow id="flow3" sourceRef="callActivity2" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('集成测试 - 调用活动执行', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let taskService: TaskService;
  let callActivityExecutorService: CallActivityExecutorService;
  let historyService: HistoryService;

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
          if (options?.where?.key) {
            return Array.from(storage.values()).find(
              (item: any) => item.key === options.where.key
            ) as any || null;
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
        CallActivityExecutorService,
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
      ],
    }).compile();

    // 获取服务实例
    processDefinitionService = module.get<ProcessDefinitionService>(ProcessDefinitionService);
    processInstanceService = module.get<ProcessInstanceService>(ProcessInstanceService);
    taskService = module.get<TaskService>(TaskService);
    callActivityExecutorService = module.get<CallActivityExecutorService>(CallActivityExecutorService);
    historyService = module.get<HistoryService>(HistoryService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.6 调用活动执行测试', () => {
    beforeEach(async () => {
      // 部署被调用的子流程
      await processDefinitionService.deploy({
        name: '被调用的子流程',
        key: 'calledSubProcess',
        bpmnXml: CALLED_SUB_PROCESS_BPMN_XML,
        generateDiagram: false,
      });

      // 部署主流程
      await processDefinitionService.deploy({
        name: '主流程-调用活动',
        key: 'mainProcessWithCall',
        bpmnXml: MAIN_PROCESS_WITH_CALL_ACTIVITY_BPMN_XML,
        generateDiagram: false,
      });
    });

    it('应该能够启动带调用活动的主流程', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'mainProcessWithCall',
        businessKey: 'CALL-001',
        variables: {
          mainAssignee: 'mainUser',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
          mainVar: 'mainValue',
        },
      });

      expect(startResult).toBeDefined();
      expect(startResult.businessKey).toBe('CALL-001');

      // 验证主流程任务已创建
      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const mainTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      expect(mainTask).toBeDefined();
      expect(mainTask?.assignee).toBe('mainUser');
    });

    it('应该能够通过调用活动启动子流程', async () => {
      // 启动主流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'mainProcessWithCall',
        businessKey: 'CALL-002',
        variables: {
          mainAssignee: 'mainUser',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
          mainVar: 'mainValue',
        },
      });

      // 完成主流程任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      const mainTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      await taskService.complete(mainTask!.id, {});

      // 验证子流程任务1已创建
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const subTask1 = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask1');
      expect(subTask1).toBeDefined();
      expect(subTask1?.assignee).toBe('subUser1');
    });

    it('应该能够完成子流程并返回主流程', async () => {
      // 启动主流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'mainProcessWithCall',
        businessKey: 'CALL-003',
        variables: {
          mainAssignee: 'mainUser',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
          mainVar: 'mainValue',
        },
      });

      // 完成主流程任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let task = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      await taskService.complete(task!.id, {});

      // 完成子流程任务1
      allTasks = await taskService.findByProcessInstance(startResult.id);
      task = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask1');
      await taskService.complete(task!.id, {});

      // 完成子流程任务2
      allTasks = await taskService.findByProcessInstance(startResult.id);
      task = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask2');
      await taskService.complete(task!.id, { subResult: 'subResultValue' });

      // 验证最终任务已创建（子流程完成，返回主流程）
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const finalTask = allTasks.find((t: any) => t.taskDefinitionKey === 'finalTask');
      expect(finalTask).toBeDefined();
    });

    it('应该能够完成整个调用活动流程', async () => {
      // 启动主流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'mainProcessWithCall',
        businessKey: 'CALL-004',
        variables: {
          mainAssignee: 'mainUser',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
          mainVar: 'mainValue',
        },
      });

      // 完成所有任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      
      // 主任务
      let task = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      await taskService.complete(task!.id, {});

      // 子任务1
      allTasks = await taskService.findByProcessInstance(startResult.id);
      task = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask1');
      await taskService.complete(task!.id, {});

      // 子任务2
      allTasks = await taskService.findByProcessInstance(startResult.id);
      task = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask2');
      await taskService.complete(task!.id, {});

      // 最终任务
      allTasks = await taskService.findByProcessInstance(startResult.id);
      task = allTasks.find((t: any) => t.taskDefinitionKey === 'finalTask');
      await taskService.complete(task!.id, {});

      // 验证流程已完成
      const instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('COMPLETED');
    });

    it('应该在调用活动中正确传递变量', async () => {
      // 启动主流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'mainProcessWithCall',
        businessKey: 'CALL-005',
        variables: {
          mainAssignee: 'mainUser',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
          mainVar: 'mainValueToPass',
        },
      });

      // 完成主流程任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      const mainTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      await taskService.complete(mainTask!.id, {});

      // 验证变量传递到子流程
      const vars = await variableRepo.find();
      const varNames = vars.map((v: any) => v.name);
      expect(varNames).toContain('mainVar');
    });

    it('应该正确创建子流程实例', async () => {
      // 启动主流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'mainProcessWithCall',
        businessKey: 'CALL-006',
        variables: {
          mainAssignee: 'mainUser',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
          mainVar: 'mainValue',
        },
      });

      // 完成主流程任务，触发调用活动
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      const mainTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      await taskService.complete(mainTask!.id, {});

      // 验证子流程实例已创建
      const allInstances = await processInstanceRepo.find();
      const subInstances = allInstances.filter(
        (inst: any) => inst.superExecutionId === startResult.id
      );
      expect(subInstances.length).toBeGreaterThan(0);
    });

    it('应该验证被调用流程定义存在', async () => {
      // 部署一个调用不存在流程的调用活动
      const INVALID_CALL_ACTIVITY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="invalidCallProcess" name="无效调用流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="callActivity"/>
    <callActivity id="callActivity" name="调用不存在的流程" calledElement="nonExistentProcess"/>
    <sequenceFlow id="flow2" sourceRef="callActivity" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

      await processDefinitionService.deploy({
        name: '无效调用流程',
        key: 'invalidCallProcess',
        bpmnXml: INVALID_CALL_ACTIVITY_BPMN,
        generateDiagram: false,
      });

      // 启动流程应该抛出错误
      await expect(processInstanceService.start({
        processDefinitionKey: 'invalidCallProcess',
        businessKey: 'INVALID-001',
        variables: {},
      })).rejects.toThrow();
    });
  });

  describe('多调用活动测试', () => {
    beforeEach(async () => {
      // 部署被调用的子流程
      await processDefinitionService.deploy({
        name: '被调用的子流程',
        key: 'calledSubProcess',
        bpmnXml: CALLED_SUB_PROCESS_BPMN_XML,
        generateDiagram: false,
      });

      // 部署多调用活动流程
      await processDefinitionService.deploy({
        name: '多调用活动流程',
        key: 'multiCallProcess',
        bpmnXml: MULTI_CALL_ACTIVITY_BPMN_XML,
        generateDiagram: false,
      });
    });

    it('应该能够顺序执行多个调用活动', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'multiCallProcess',
        businessKey: 'MULTI-001',
        variables: {
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          var1: 'value1',
          var2: 'value2',
        },
      });

      // 完成第一个子流程的所有任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let task = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask1');
      await taskService.complete(task!.id, {});

      allTasks = await taskService.findByProcessInstance(startResult.id);
      task = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask2');
      await taskService.complete(task!.id, {});

      // 验证进入第二个子流程
      allTasks = await taskService.findByProcessInstance(startResult.id);
      task = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask1');
      expect(task).toBeDefined();

      // 完成第二个子流程的所有任务
      await taskService.complete(task!.id, {});

      allTasks = await taskService.findByProcessInstance(startResult.id);
      task = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask2');
      await taskService.complete(task!.id, {});

      // 验证流程已完成
      const instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('COMPLETED');
    });
  });
});
