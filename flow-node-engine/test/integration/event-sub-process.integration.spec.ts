/**
 * 集成测试 - 事件子流程触发
 * 测试场景：事件子流程(Event Sub-Process)的触发和执行
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
import { EventSubProcessExecutorService } from '../../src/core/services/event-sub-process-executor.service';
import { HistoryService } from '../../src/history/services/history.service';
import { EventBusService } from '../../src/core/services/event-bus.service';

// 带错误事件子流程的BPMN
const ERROR_EVENT_SUB_PROCESS_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="errorEventSubProcessTest" name="错误事件子流程测试" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="mainTask"/>
    
    <userTask id="mainTask" name="主任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="mainTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
    
    <!-- 错误事件子流程 -->
    <subProcess id="errorEventSubProcess" triggeredByEvent="true">
      <startEvent id="errorStart" name="错误开始">
        <errorEventDefinition errorRef="error_001"/>
      </startEvent>
      <sequenceFlow id="errorFlow1" sourceRef="errorStart" targetRef="errorHandleTask"/>
      
      <userTask id="errorHandleTask" name="错误处理任务">
        <extensionElements>
          <flowable:assignee>${errorHandler}</flowable:assignee>
        </extensionElements>
      </userTask>
      
      <sequenceFlow id="errorFlow2" sourceRef="errorHandleTask" targetRef="errorEnd"/>
      <endEvent id="errorEnd" name="错误处理结束"/>
    </subProcess>
  </process>
  
  <error id="error_001" name="BusinessError" errorCode="BIZ_001"/>
</definitions>`;

// 带信号事件子流程的BPMN
const SIGNAL_EVENT_SUB_PROCESS_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="signalEventSubProcessTest" name="信号事件子流程测试" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="waitTask"/>
    
    <userTask id="waitTask" name="等待任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="waitTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
    
    <!-- 信号事件子流程 -->
    <subProcess id="signalEventSubProcess" triggeredByEvent="true">
      <startEvent id="signalStart" name="信号开始">
        <signalEventDefinition signalRef="signal_cancel"/>
      </startEvent>
      <sequenceFlow id="signalFlow1" sourceRef="signalStart" targetRef="cancelTask"/>
      
      <userTask id="cancelTask" name="取消处理任务">
        <extensionElements>
          <flowable:assignee>${cancelHandler}</flowable:assignee>
        </extensionElements>
      </userTask>
      
      <sequenceFlow id="signalFlow2" sourceRef="cancelTask" targetRef="cancelEnd"/>
      <endEvent id="cancelEnd" name="取消处理结束"/>
    </subProcess>
  </process>
  
  <signal id="signal_cancel" name="cancelSignal"/>
</definitions>`;

// 带定时器事件子流程的BPMN
const TIMER_EVENT_SUB_PROCESS_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="timerEventSubProcessTest" name="定时器事件子流程测试" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="longTask"/>
    
    <userTask id="longTask" name="长时间任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="longTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
    
    <!-- 定时器事件子流程 -->
    <subProcess id="timerEventSubProcess" triggeredByEvent="true">
      <startEvent id="timerStart" name="定时器开始">
        <timerEventDefinition>
          <timeDuration>PT1H</timeDuration>
        </timerEventDefinition>
      </startEvent>
      <sequenceFlow id="timerFlow1" sourceRef="timerStart" targetRef="timeoutTask"/>
      
      <userTask id="timeoutTask" name="超时处理任务">
        <extensionElements>
          <flowable:assignee>${timeoutHandler}</flowable:assignee>
        </extensionElements>
      </userTask>
      
      <sequenceFlow id="timerFlow2" sourceRef="timeoutTask" targetRef="timerEnd"/>
      <endEvent id="timerEnd" name="超时处理结束"/>
    </subProcess>
  </process>
</definitions>`;

// 带消息事件子流程的BPMN
const MESSAGE_EVENT_SUB_PROCESS_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="messageEventSubProcessTest" name="消息事件子流程测试" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="processingTask"/>
    
    <userTask id="processingTask" name="处理中任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="processingTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
    
    <!-- 消息事件子流程 -->
    <subProcess id="messageEventSubProcess" triggeredByEvent="true">
      <startEvent id="messageStart" name="消息开始">
        <messageEventDefinition messageRef="msg_update"/>
      </startEvent>
      <sequenceFlow id="msgFlow1" sourceRef="messageStart" targetRef="updateTask"/>
      
      <userTask id="updateTask" name="更新处理任务">
        <extensionElements>
          <flowable:assignee>${updateHandler}</flowable:assignee>
        </extensionElements>
      </userTask>
      
      <sequenceFlow id="msgFlow2" sourceRef="updateTask" targetRef="msgEnd"/>
      <endEvent id="msgEnd" name="更新处理结束"/>
    </subProcess>
  </process>
  
  <message id="msg_update" name="updateMessage"/>
</definitions>`;

describe('集成测试 - 事件子流程触发', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let taskService: TaskService;
  let eventSubProcessExecutorService: EventSubProcessExecutorService;
  let historyService: HistoryService;
  let eventBusService: EventBusService;

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
        EventSubProcessExecutorService,
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
    eventSubProcessExecutorService = module.get<EventSubProcessExecutorService>(EventSubProcessExecutorService);
    historyService = module.get<HistoryService>(HistoryService);
    eventBusService = module.get<EventBusService>(EventBusService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.7 事件子流程触发测试', () => {
    describe('错误事件子流程', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '错误事件子流程测试',
          key: 'errorEventSubProcessTest',
          bpmnXml: ERROR_EVENT_SUB_PROCESS_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带错误事件子流程的流程定义', async () => {
        const definition = await processDefinitionService.findByKey('errorEventSubProcessTest');
        expect(definition).toBeDefined();
        expect(definition?.key).toBe('errorEventSubProcessTest');
      });

      it('应该能够启动带错误事件子流程的流程实例', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'errorEventSubProcessTest',
          businessKey: 'ERROR-001',
          variables: {
            assignee: 'mainUser',
            errorHandler: 'errorHandlerUser',
          },
        });

        expect(startResult).toBeDefined();
        expect(startResult.businessKey).toBe('ERROR-001');

        // 验证主任务已创建
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const mainTask = allTasks.find((t: any) => t.taskDefinitionKey === 'mainTask');
        expect(mainTask).toBeDefined();
      });

      it('应该能够在抛出错误时触发错误事件子流程', async () => {
        // 启动流程
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'errorEventSubProcessTest',
          businessKey: 'ERROR-002',
          variables: {
            assignee: 'mainUser',
            errorHandler: 'errorHandlerUser',
          },
        });

        // 模拟抛出错误
        await eventBusService.emit('PROCESS_ERROR', {
          processInstanceId: startResult.id,
          errorCode: 'BIZ_001',
          errorMessage: '业务错误发生',
        });

        // 验证错误处理任务已创建
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const errorHandleTask = allTasks.find((t: any) => t.taskDefinitionKey === 'errorHandleTask');
        expect(errorHandleTask).toBeDefined();
        expect(errorHandleTask?.assignee).toBe('errorHandlerUser');
      });

      it('应该能够在错误处理后继续流程', async () => {
        // 启动流程
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'errorEventSubProcessTest',
          businessKey: 'ERROR-003',
          variables: {
            assignee: 'mainUser',
            errorHandler: 'errorHandlerUser',
          },
        });

        // 触发错误
        await eventBusService.emit('PROCESS_ERROR', {
          processInstanceId: startResult.id,
          errorCode: 'BIZ_001',
          errorMessage: '业务错误发生',
        });

        // 完成错误处理任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const errorHandleTask = allTasks.find((t: any) => t.taskDefinitionKey === 'errorHandleTask');
        await taskService.complete(errorHandleTask!.id, {});

        // 验证流程状态
        const instance = await processInstanceService.findById(startResult.id);
        expect(instance?.status).toBe('ACTIVE');
      });
    });

    describe('信号事件子流程', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '信号事件子流程测试',
          key: 'signalEventSubProcessTest',
          bpmnXml: SIGNAL_EVENT_SUB_PROCESS_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够在接收信号时触发信号事件子流程', async () => {
        // 启动流程
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'signalEventSubProcessTest',
          businessKey: 'SIGNAL-001',
          variables: {
            assignee: 'mainUser',
            cancelHandler: 'cancelHandlerUser',
          },
        });

        // 发送取消信号
        await eventBusService.emit('SIGNAL_RECEIVED', {
          signalName: 'cancelSignal',
          processInstanceId: startResult.id,
        });

        // 验证取消处理任务已创建
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const cancelTask = allTasks.find((t: any) => t.taskDefinitionKey === 'cancelTask');
        expect(cancelTask).toBeDefined();
      });

      it('应该能够完成信号事件子流程', async () => {
        // 启动流程
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'signalEventSubProcessTest',
          businessKey: 'SIGNAL-002',
          variables: {
            assignee: 'mainUser',
            cancelHandler: 'cancelHandlerUser',
          },
        });

        // 发送取消信号
        await eventBusService.emit('SIGNAL_RECEIVED', {
          signalName: 'cancelSignal',
          processInstanceId: startResult.id,
        });

        // 完成取消处理任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const cancelTask = allTasks.find((t: any) => t.taskDefinitionKey === 'cancelTask');
        await taskService.complete(cancelTask!.id, {});

        // 验证流程仍在运行
        const instance = await processInstanceService.findById(startResult.id);
        expect(instance?.status).toBe('ACTIVE');
      });
    });

    describe('定时器事件子流程', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '定时器事件子流程测试',
          key: 'timerEventSubProcessTest',
          bpmnXml: TIMER_EVENT_SUB_PROCESS_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带定时器事件子流程的流程定义', async () => {
        const definition = await processDefinitionService.findByKey('timerEventSubProcessTest');
        expect(definition).toBeDefined();
      });

      it('应该在定时器触发时创建超时处理任务', async () => {
        // 启动流程
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerEventSubProcessTest',
          businessKey: 'TIMER-001',
          variables: {
            assignee: 'mainUser',
            timeoutHandler: 'timeoutHandlerUser',
          },
        });

        // 模拟定时器触发
        await eventBusService.emit('TIMER_FIRED', {
          processInstanceId: startResult.id,
          timerId: 'timerStart',
        });

        // 验证超时处理任务已创建
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const timeoutTask = allTasks.find((t: any) => t.taskDefinitionKey === 'timeoutTask');
        expect(timeoutTask).toBeDefined();
      });
    });

    describe('消息事件子流程', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '消息事件子流程测试',
          key: 'messageEventSubProcessTest',
          bpmnXml: MESSAGE_EVENT_SUB_PROCESS_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够在接收消息时触发消息事件子流程', async () => {
        // 启动流程
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'messageEventSubProcessTest',
          businessKey: 'MSG-001',
          variables: {
            assignee: 'mainUser',
            updateHandler: 'updateHandlerUser',
          },
        });

        // 发送消息
        await eventBusService.emit('MESSAGE_RECEIVED', {
          messageName: 'updateMessage',
          processInstanceId: startResult.id,
          payload: { updateData: 'new data' },
        });

        // 验证更新处理任务已创建
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const updateTask = allTasks.find((t: any) => t.taskDefinitionKey === 'updateTask');
        expect(updateTask).toBeDefined();
      });

      it('应该在消息事件子流程中传递消息负载', async () => {
        // 启动流程
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'messageEventSubProcessTest',
          businessKey: 'MSG-002',
          variables: {
            assignee: 'mainUser',
            updateHandler: 'updateHandlerUser',
          },
        });

        // 发送带负载的消息
        await eventBusService.emit('MESSAGE_RECEIVED', {
          messageName: 'updateMessage',
          processInstanceId: startResult.id,
          payload: { 
            updateData: 'new data',
            updateReason: '用户请求更新',
          },
        });

        // 验证变量已传递
        const vars = await variableRepo.find();
        const varNames = vars.map((v: any) => v.name);
        expect(varNames).toContain('updateData');
        expect(varNames).toContain('updateReason');
      });
    });
  });
});
