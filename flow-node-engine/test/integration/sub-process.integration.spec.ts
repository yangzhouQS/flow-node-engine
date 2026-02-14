/**
 * 集成测试 - 内嵌子流程执行
 * 测试场景：内嵌子流程的启动、执行、完成
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
import { SubProcessExecutorService } from '../../src/core/services/sub-process-executor.service';
import { HistoryService } from '../../src/history/services/history.service';
import { EventBusService } from '../../src/core/services/event-bus.service';

// 测试用BPMN XML - 带内嵌子流程的审批流程
const SUB_PROCESS_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="subProcessTest" name="子流程测试" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="mainTask"/>
    
    <userTask id="mainTask" name="主流程任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="mainTask" targetRef="subProcess"/>
    
    <subProcess id="subProcess" name="审批子流程">
      <startEvent id="subStart" name="子流程开始"/>
      <sequenceFlow id="subFlow1" sourceRef="subStart" targetRef="subTask1"/>
      
      <userTask id="subTask1" name="子流程任务1">
        <extensionElements>
          <flowable:assignee>${subAssignee1}</flowable:assignee>
        </extensionElements>
      </userTask>
      
      <sequenceFlow id="subFlow2" sourceRef="subTask1" targetRef="subTask2"/>
      
      <userTask id="subTask2" name="子流程任务2">
        <extensionElements>
          <flowable:assignee>${subAssignee2}</flowable:assignee>
        </extensionElements>
      </userTask>
      
      <sequenceFlow id="subFlow3" sourceRef="subTask2" targetRef="subEnd"/>
      <endEvent id="subEnd" name="子流程结束"/>
    </subProcess>
    
    <sequenceFlow id="flow3" sourceRef="subProcess" targetRef="finalTask"/>
    
    <userTask id="finalTask" name="最终任务">
      <extensionElements>
        <flowable:assignee>${finalAssignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow4" sourceRef="finalTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 带多级嵌套子流程的BPMN
const NESTED_SUB_PROCESS_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="nestedSubProcessTest" name="嵌套子流程测试" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="level1SubProcess"/>
    
    <subProcess id="level1SubProcess" name="一级子流程">
      <startEvent id="level1Start" name="一级开始"/>
      <sequenceFlow id="level1Flow1" sourceRef="level1Start" targetRef="level1Task"/>
      
      <userTask id="level1Task" name="一级任务">
        <extensionElements>
          <flowable:assignee>${level1Assignee}</flowable:assignee>
        </extensionElements>
      </userTask>
      
      <sequenceFlow id="level1Flow2" sourceRef="level1Task" targetRef="level2SubProcess"/>
      
      <subProcess id="level2SubProcess" name="二级子流程">
        <startEvent id="level2Start" name="二级开始"/>
        <sequenceFlow id="level2Flow1" sourceRef="level2Start" targetRef="level2Task"/>
        
        <userTask id="level2Task" name="二级任务">
          <extensionElements>
            <flowable:assignee>${level2Assignee}</flowable:assignee>
          </extensionElements>
        </userTask>
        
        <sequenceFlow id="level2Flow2" sourceRef="level2Task" targetRef="level2End"/>
        <endEvent id="level2End" name="二级结束"/>
      </subProcess>
      
      <sequenceFlow id="level1Flow3" sourceRef="level2SubProcess" targetRef="level1End"/>
      <endEvent id="level1End" name="一级结束"/>
    </subProcess>
    
    <sequenceFlow id="flow2" sourceRef="level1SubProcess" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('集成测试 - 内嵌子流程执行', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let taskService: TaskService;
  let subProcessExecutorService: SubProcessExecutorService;
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
        SubProcessExecutorService,
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
    subProcessExecutorService = module.get<SubProcessExecutorService>(SubProcessExecutorService);
    historyService = module.get<HistoryService>(HistoryService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.5 内嵌子流程执行测试', () => {
    beforeEach(async () => {
      // 部署流程定义
      await processDefinitionService.deploy({
        name: '子流程测试',
        key: 'subProcessTest',
        bpmnXml: SUB_PROCESS_BPMN_XML,
        generateDiagram: false,
      });
    });

    it('应该能够启动带子流程的流程实例', async () => {
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'subProcessTest',
        businessKey: 'SUB-001',
        variables: {
          assignee: 'user001',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
        },
      });

      expect(startResult).toBeDefined();
      expect(startResult.businessKey).toBe('SUB-001');

      // 验证主流程任务已创建
      const allTasks = await taskService.findByProcessInstance(startResult.id);
      const mainTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      expect(mainTask).toBeDefined();
      expect(mainTask?.assignee).toBe('user001');
    });

    it('应该能够进入子流程并创建子流程任务', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'subProcessTest',
        businessKey: 'SUB-002',
        variables: {
          assignee: 'user002',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
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

    it('应该能够完成子流程内的所有任务', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'subProcessTest',
        businessKey: 'SUB-003',
        variables: {
          assignee: 'user003',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
        },
      });

      // 完成主流程任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let mainTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      await taskService.complete(mainTask!.id, {});

      // 完成子流程任务1
      allTasks = await taskService.findByProcessInstance(startResult.id);
      let subTask1 = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask1');
      await taskService.complete(subTask1!.id, {});

      // 验证子流程任务2已创建
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const subTask2 = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask2');
      expect(subTask2).toBeDefined();
      expect(subTask2?.assignee).toBe('subUser2');

      // 完成子流程任务2
      await taskService.complete(subTask2!.id, {});

      // 验证最终任务已创建（子流程完成）
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const finalTask = allTasks.find((t: any) => t.taskDefinitionKey === 'finalTask');
      expect(finalTask).toBeDefined();
    });

    it('应该能够完成整个流程包括子流程', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'subProcessTest',
        businessKey: 'SUB-004',
        variables: {
          assignee: 'user004',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
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

    it('应该在子流程中正确传递变量', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'subProcessTest',
        businessKey: 'SUB-005',
        variables: {
          assignee: 'user005',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
          globalVar: 'globalValue',
        },
      });

      // 完成主流程任务并设置变量
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      const mainTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      await taskService.complete(mainTask!.id, { mainTaskVar: 'mainValue' });

      // 验证变量在子流程任务中可用
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const subTask1 = allTasks.find((t: any) => t.taskDefinitionKey === 'subTask1');
      expect(subTask1).toBeDefined();

      // 验证变量存储
      const vars = await variableRepo.find();
      const varNames = vars.map((v: any) => v.name);
      expect(varNames).toContain('globalVar');
      expect(varNames).toContain('mainTaskVar');
    });

    it('应该正确创建子流程的执行层级', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'subProcessTest',
        businessKey: 'SUB-006',
        variables: {
          assignee: 'user006',
          subAssignee1: 'subUser1',
          subAssignee2: 'subUser2',
          finalAssignee: 'finalUser',
        },
      });

      // 完成主流程任务，进入子流程
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      const mainTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
      await taskService.complete(mainTask!.id, {});

      // 验证执行层级
      const executionList = await executionRepo.find();
      const subProcessExecutions = executionList.filter(
        (e: any) => e.activityId === 'subProcess'
      );
      expect(subProcessExecutions.length).toBeGreaterThan(0);
    });
  });

  describe('嵌套子流程测试', () => {
    beforeEach(async () => {
      // 部署嵌套子流程定义
      await processDefinitionService.deploy({
        name: '嵌套子流程测试',
        key: 'nestedSubProcessTest',
        bpmnXml: NESTED_SUB_PROCESS_BPMN_XML,
        generateDiagram: false,
      });
    });

    it('应该能够执行多级嵌套子流程', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'nestedSubProcessTest',
        businessKey: 'NESTED-001',
        variables: {
          level1Assignee: 'level1User',
          level2Assignee: 'level2User',
        },
      });

      // 验证一级任务已创建
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      const level1Task = allTasks.find((t: any) => t.taskDefinitionKey === 'level1Task');
      expect(level1Task).toBeDefined();
      expect(level1Task?.assignee).toBe('level1User');

      // 完成一级任务
      await taskService.complete(level1Task!.id, {});

      // 验证二级任务已创建
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const level2Task = allTasks.find((t: any) => t.taskDefinitionKey === 'level2Task');
      expect(level2Task).toBeDefined();
      expect(level2Task?.assignee).toBe('level2User');

      // 完成二级任务
      await taskService.complete(level2Task!.id, {});

      // 验证流程已完成
      const instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('COMPLETED');
    });

    it('应该在嵌套子流程中正确维护执行上下文', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'nestedSubProcessTest',
        businessKey: 'NESTED-002',
        variables: {
          level1Assignee: 'level1User',
          level2Assignee: 'level2User',
          contextVar: 'contextValue',
        },
      });

      // 完成一级任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let level1Task = allTasks.find((t: any) => t.taskDefinitionKey === 'level1Task');
      await taskService.complete(level1Task!.id, { level1Var: 'level1Value' });

      // 完成二级任务
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const level2Task = allTasks.find((t: any) => t.taskDefinitionKey === 'level2Task');
      await taskService.complete(level2Task!.id, { level2Var: 'level2Value' });

      // 验证所有变量都正确保存
      const vars = await variableRepo.find();
      const varNames = vars.map((v: any) => v.name);
      expect(varNames).toContain('contextVar');
      expect(varNames).toContain('level1Var');
      expect(varNames).toContain('level2Var');
    });
  });
});
