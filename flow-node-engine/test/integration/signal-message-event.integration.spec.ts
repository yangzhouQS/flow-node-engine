/**
 * 集成测试 - 信号/消息事件
 * 测试场景：信号开始事件、信号捕获事件、信号抛出事件、消息开始事件、消息捕获事件、消息抛出事件
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
import { Event } from '../../src/event/entities/event.entity';

// Services
import { ProcessDefinitionService } from '../../src/process-definition/services/process-definition.service';
import { ProcessInstanceService } from '../../src/process-instance/services/process-instance.service';
import { TaskService } from '../../src/task/services/task.service';
import { EventSubscriptionService } from '../../src/event-subscription/services/event-subscription.service';
import { HistoryService } from '../../src/history/services/history.service';
import { EventBusService } from '../../src/core/services/event-bus.service';

// 信号开始事件流程
const SIGNAL_START_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <signal id="alertSignal" name="alert"/>
  <process id="signalStartProcess" name="信号开始流程" isExecutable="true">
    <startEvent id="signalStart" name="信号开始">
      <signalEventDefinition signalRef="alertSignal"/>
    </startEvent>
    <sequenceFlow id="flow1" sourceRef="signalStart" targetRef="task1"/>
    
    <userTask id="task1" name="处理任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 信号中间捕获事件流程
const SIGNAL_CATCH_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <signal id="waitSignal" name="waitSignal"/>
  <process id="signalCatchProcess" name="信号捕获流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    
    <userTask id="task1" name="任务1">
      <extensionElements>
        <flowable:assignee>${assignee1}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="signalCatch"/>
    
    <!-- 信号中间捕获事件 -->
    <intermediateCatchEvent id="signalCatch" name="等待信号">
      <signalEventDefinition signalRef="waitSignal"/>
    </intermediateCatchEvent>
    
    <sequenceFlow id="flow3" sourceRef="signalCatch" targetRef="task2"/>
    
    <userTask id="task2" name="任务2">
      <extensionElements>
        <flowable:assignee>${assignee2}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow4" sourceRef="task2" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 信号抛出事件流程
const SIGNAL_THROW_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <signal id="notifySignal" name="notify"/>
  <process id="signalThrowProcess" name="信号抛出流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    
    <userTask id="task1" name="任务1">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="signalThrow"/>
    
    <!-- 信号中间抛出事件 -->
    <intermediateThrowEvent id="signalThrow" name="发送通知">
      <signalEventDefinition signalRef="notifySignal"/>
    </intermediateThrowEvent>
    
    <sequenceFlow id="flow3" sourceRef="signalThrow" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 消息开始事件流程
const MESSAGE_START_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <message id="startMessage" name="startMessage"/>
  <process id="messageStartProcess" name="消息开始流程" isExecutable="true">
    <startEvent id="messageStart" name="消息开始">
      <messageEventDefinition messageRef="startMessage"/>
    </startEvent>
    <sequenceFlow id="flow1" sourceRef="messageStart" targetRef="task1"/>
    
    <userTask id="task1" name="处理任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 消息捕获事件流程
const MESSAGE_CATCH_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <message id="waitMessage" name="waitMessage"/>
  <process id="messageCatchProcess" name="消息捕获流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    
    <userTask id="task1" name="任务1">
      <extensionElements>
        <flowable:assignee>${assignee1}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="messageCatch"/>
    
    <!-- 消息中间捕获事件 -->
    <intermediateCatchEvent id="messageCatch" name="等待消息">
      <messageEventDefinition messageRef="waitMessage"/>
    </intermediateCatchEvent>
    
    <sequenceFlow id="flow3" sourceRef="messageCatch" targetRef="task2"/>
    
    <userTask id="task2" name="任务2">
      <extensionElements>
        <flowable:assignee>${assignee2}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow4" sourceRef="task2" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 带边界信号事件的流程
const BOUNDARY_SIGNAL_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <signal id="cancelSignal" name="cancel"/>
  <process id="boundarySignalProcess" name="边界信号事件流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="userTask"/>
    
    <userTask id="userTask" name="用户任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <!-- 边界信号事件 -->
    <boundaryEvent id="boundarySignal" attachedToRef="userTask" cancelActivity="true">
      <signalEventDefinition signalRef="cancelSignal"/>
    </boundaryEvent>
    
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="normalEnd"/>
    <endEvent id="normalEnd" name="正常结束"/>
    
    <sequenceFlow id="cancelFlow" sourceRef="boundarySignal" targetRef="cancelTask"/>
    <userTask id="cancelTask" name="取消处理">
      <extensionElements>
        <flowable:assignee>${cancelHandler}</flowable:assignee>
      </extensionElements>
    </userTask>
    <sequenceFlow id="flow3" sourceRef="cancelTask" targetRef="cancelEnd"/>
    <endEvent id="cancelEnd" name="取消结束"/>
  </process>
</definitions>`;

describe('集成测试 - 信号/消息事件', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let taskService: TaskService;
  let eventSubscriptionService: EventSubscriptionService;
  let historyService: HistoryService;
  let eventBusService: EventBusService;

  // Mock repositories
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let executionRepo: vi.Mocked<Repository<Execution>>;
  let variableRepo: vi.Mocked<Repository<Variable>>;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let eventRepo: vi.Mocked<Repository<Event>>;

  // 测试数据存储
  let processDefinitions: Map<string, ProcessDefinition>;
  let processInstances: Map<string, ProcessInstance>;
  let executions: Map<string, Execution>;
  let variables: Map<string, Variable>;
  let tasks: Map<string, Task>;
  let events: Map<string, Event>;

  beforeEach(async () => {
    // 初始化数据存储
    processDefinitions = new Map();
    processInstances = new Map();
    executions = new Map();
    variables = new Map();
    tasks = new Map();
    events = new Map();

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
    eventRepo = createMockRepo(events);

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        ProcessDefinitionService,
        ProcessInstanceService,
        TaskService,
        EventSubscriptionService,
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
          provide: getRepositoryToken(Event),
          useValue: eventRepo,
        },
      ],
    }).compile();

    // 获取服务实例
    processDefinitionService = module.get<ProcessDefinitionService>(ProcessDefinitionService);
    processInstanceService = module.get<ProcessInstanceService>(ProcessInstanceService);
    taskService = module.get<TaskService>(TaskService);
    eventSubscriptionService = module.get<EventSubscriptionService>(EventSubscriptionService);
    historyService = module.get<HistoryService>(HistoryService);
    eventBusService = module.get<EventBusService>(EventBusService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.11 信号事件测试', () => {
    describe('信号开始事件', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '信号开始事件流程',
          key: 'signalStartProcess',
          bpmnXml: SIGNAL_START_EVENT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带信号开始事件的流程', async () => {
        const definition = await processDefinitionService.findByKey('signalStartProcess');
        expect(definition).toBeDefined();
      });

      it('应该能够通过信号触发启动流程', async () => {
        // 触发信号事件
        const startResult = await eventBusService.emit('SIGNAL_RECEIVED', {
          signalName: 'alertSignal',
          variables: {
            assignee: 'user001',
          },
        });

        // 验证流程实例已创建
        expect(startResult).toBeDefined();
      });
    });

    describe('信号中间捕获事件', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '信号捕获流程',
          key: 'signalCatchProcess',
          bpmnXml: SIGNAL_CATCH_EVENT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带信号捕获事件的流程', async () => {
        const definition = await processDefinitionService.findByKey('signalCatchProcess');
        expect(definition).toBeDefined();
      });

      it('应该在任务完成后等待信号', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'signalCatchProcess',
          businessKey: 'SIGNAL-CATCH-001',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const task1 = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task1!.id, {});

        // 验证事件订阅已创建
        const subscriptions = await eventSubscriptionService.findByProcessInstance(
          startResult.id
        );
        const signalSubscriptions = subscriptions.filter(
          (s: any) => s.eventType === 'signal' && s.eventName === 'waitSignal'
        );
        expect(signalSubscriptions.length).toBeGreaterThan(0);
      });

      it('应该在收到信号后继续流程', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'signalCatchProcess',
          businessKey: 'SIGNAL-CATCH-002',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        let task = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task!.id, {});

        // 触发信号
        await eventBusService.emit('SIGNAL_RECEIVED', {
          signalName: 'waitSignal',
          processInstanceId: startResult.id,
        });

        // 验证任务2已创建
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const task2 = allTasks.find((t: any) => t.taskDefinitionKey === 'task2');
        expect(task2).toBeDefined();
      });

      it('应该能够完成带信号捕获事件的流程', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'signalCatchProcess',
          businessKey: 'SIGNAL-CATCH-003',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        let task = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task!.id, {});

        // 触发信号
        await eventBusService.emit('SIGNAL_RECEIVED', {
          signalName: 'waitSignal',
          processInstanceId: startResult.id,
        });

        // 完成任务2
        allTasks = await taskService.findByProcessInstance(startResult.id);
        task = allTasks.find((t: any) => t.taskDefinitionKey === 'task2');
        await taskService.complete(task!.id, {});

        // 验证流程完成
        const instance = await processInstanceService.findById(startResult.id);
        expect(instance?.status).toBe('COMPLETED');
      });
    });

    describe('信号抛出事件', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '信号抛出流程',
          key: 'signalThrowProcess',
          bpmnXml: SIGNAL_THROW_EVENT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带信号抛出事件的流程', async () => {
        const definition = await processDefinitionService.findByKey('signalThrowProcess');
        expect(definition).toBeDefined();
      });

      it('应该在任务完成后抛出信号', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'signalThrowProcess',
          businessKey: 'SIGNAL-THROW-001',
          variables: {
            assignee: 'user001',
          },
        });

        // 完成任务
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const task1 = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task1!.id, {});

        // 验证信号已抛出（流程应该结束）
        const instance = await processInstanceService.findById(startResult.id);
        expect(instance?.status).toBe('COMPLETED');
      });
    });

    describe('边界信号事件', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '边界信号事件流程',
          key: 'boundarySignalProcess',
          bpmnXml: BOUNDARY_SIGNAL_EVENT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带边界信号事件的流程', async () => {
        const definition = await processDefinitionService.findByKey('boundarySignalProcess');
        expect(definition).toBeDefined();
      });

      it('应该在收到信号后触发边界事件', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'boundarySignalProcess',
          businessKey: 'BOUNDARY-SIGNAL-001',
          variables: {
            assignee: 'user001',
            cancelHandler: 'cancelUser',
          },
        });

        // 触发取消信号
        await eventBusService.emit('SIGNAL_RECEIVED', {
          signalName: 'cancelSignal',
          processInstanceId: startResult.id,
        });

        // 验证取消处理任务已创建
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const cancelTask = allTasks.find((t: any) => t.taskDefinitionKey === 'cancelTask');
        expect(cancelTask).toBeDefined();
      });

      it('信号触发后应该取消原任务', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'boundarySignalProcess',
          businessKey: 'BOUNDARY-SIGNAL-002',
          variables: {
            assignee: 'user002',
            cancelHandler: 'cancelUser',
          },
        });

        // 触发取消信号
        await eventBusService.emit('SIGNAL_RECEIVED', {
          signalName: 'cancelSignal',
          processInstanceId: startResult.id,
        });

        // 验证原任务被取消
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const userTask = allTasks.find(
          (t: any) => t.taskDefinitionKey === 'userTask' && t.status === 'ACTIVE'
        );
        expect(userTask).toBeUndefined();
      });
    });
  });

  describe('6.3.11 消息事件测试', () => {
    describe('消息开始事件', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '消息开始事件流程',
          key: 'messageStartProcess',
          bpmnXml: MESSAGE_START_EVENT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带消息开始事件的流程', async () => {
        const definition = await processDefinitionService.findByKey('messageStartProcess');
        expect(definition).toBeDefined();
      });

      it('应该能够通过消息触发启动流程', async () => {
        // 触发消息事件
        const startResult = await eventBusService.emit('MESSAGE_RECEIVED', {
          messageName: 'startMessage',
          variables: {
            assignee: 'user001',
          },
        });

        expect(startResult).toBeDefined();
      });
    });

    describe('消息中间捕获事件', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '消息捕获流程',
          key: 'messageCatchProcess',
          bpmnXml: MESSAGE_CATCH_EVENT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带消息捕获事件的流程', async () => {
        const definition = await processDefinitionService.findByKey('messageCatchProcess');
        expect(definition).toBeDefined();
      });

      it('应该在任务完成后等待消息', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'messageCatchProcess',
          businessKey: 'MSG-CATCH-001',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const task1 = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task1!.id, {});

        // 验证事件订阅已创建
        const subscriptions = await eventSubscriptionService.findByProcessInstance(
          startResult.id
        );
        const messageSubscriptions = subscriptions.filter(
          (s: any) => s.eventType === 'message' && s.eventName === 'waitMessage'
        );
        expect(messageSubscriptions.length).toBeGreaterThan(0);
      });

      it('应该在收到消息后继续流程', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'messageCatchProcess',
          businessKey: 'MSG-CATCH-002',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        let task = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task!.id, {});

        // 触发消息
        await eventBusService.emit('MESSAGE_RECEIVED', {
          messageName: 'waitMessage',
          processInstanceId: startResult.id,
        });

        // 验证任务2已创建
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const task2 = allTasks.find((t: any) => t.taskDefinitionKey === 'task2');
        expect(task2).toBeDefined();
      });

      it('应该能够完成带消息捕获事件的流程', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'messageCatchProcess',
          businessKey: 'MSG-CATCH-003',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        let task = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task!.id, {});

        // 触发消息
        await eventBusService.emit('MESSAGE_RECEIVED', {
          messageName: 'waitMessage',
          processInstanceId: startResult.id,
        });

        // 完成任务2
        allTasks = await taskService.findByProcessInstance(startResult.id);
        task = allTasks.find((t: any) => t.taskDefinitionKey === 'task2');
        await taskService.complete(task!.id, {});

        // 验证流程完成
        const instance = await processInstanceService.findById(startResult.id);
        expect(instance?.status).toBe('COMPLETED');
      });
    });

    describe('消息与信号的区别', () => {
      it('信号应该广播给所有订阅的流程实例', async () => {
        // 部署信号捕获流程
        await processDefinitionService.deploy({
          name: '信号捕获流程',
          key: 'signalCatchProcess',
          bpmnXml: SIGNAL_CATCH_EVENT_BPMN_XML,
          generateDiagram: false,
        });

        // 启动多个流程实例
        const instance1 = await processInstanceService.start({
          processDefinitionKey: 'signalCatchProcess',
          businessKey: 'BROADCAST-001',
          variables: { assignee1: 'user1', assignee2: 'user2' },
        });

        const instance2 = await processInstanceService.start({
          processDefinitionKey: 'signalCatchProcess',
          businessKey: 'BROADCAST-002',
          variables: { assignee1: 'user1', assignee2: 'user2' },
        });

        // 完成两个实例的任务1
        let tasks1 = await taskService.findByProcessInstance(instance1.id);
        await taskService.complete(tasks1.find((t: any) => t.taskDefinitionKey === 'task1')!.id, {});

        let tasks2 = await taskService.findByProcessInstance(instance2.id);
        await taskService.complete(tasks2.find((t: any) => t.taskDefinitionKey === 'task1')!.id, {});

        // 广播信号
        await eventBusService.emit('SIGNAL_BROADCAST', {
          signalName: 'waitSignal',
        });

        // 验证两个实例都被触发
        tasks1 = await taskService.findByProcessInstance(instance1.id);
        tasks2 = await taskService.findByProcessInstance(instance2.id);

        const task2Instance1 = tasks1.find((t: any) => t.taskDefinitionKey === 'task2');
        const task2Instance2 = tasks2.find((t: any) => t.taskDefinitionKey === 'task2');

        expect(task2Instance1).toBeDefined();
        expect(task2Instance2).toBeDefined();
      });

      it('消息应该只发送给指定的流程实例', async () => {
        // 部署消息捕获流程
        await processDefinitionService.deploy({
          name: '消息捕获流程',
          key: 'messageCatchProcess',
          bpmnXml: MESSAGE_CATCH_EVENT_BPMN_XML,
          generateDiagram: false,
        });

        // 启动多个流程实例
        const instance1 = await processInstanceService.start({
          processDefinitionKey: 'messageCatchProcess',
          businessKey: 'TARGET-001',
          variables: { assignee1: 'user1', assignee2: 'user2' },
        });

        const instance2 = await processInstanceService.start({
          processDefinitionKey: 'messageCatchProcess',
          businessKey: 'TARGET-002',
          variables: { assignee1: 'user1', assignee2: 'user2' },
        });

        // 完成两个实例的任务1
        let tasks1 = await taskService.findByProcessInstance(instance1.id);
        await taskService.complete(tasks1.find((t: any) => t.taskDefinitionKey === 'task1')!.id, {});

        let tasks2 = await taskService.findByProcessInstance(instance2.id);
        await taskService.complete(tasks2.find((t: any) => t.taskDefinitionKey === 'task1')!.id, {});

        // 发送消息给特定实例
        await eventBusService.emit('MESSAGE_RECEIVED', {
          messageName: 'waitMessage',
          processInstanceId: instance1.id,
        });

        // 验证只有instance1被触发
        tasks1 = await taskService.findByProcessInstance(instance1.id);
        tasks2 = await taskService.findByProcessInstance(instance2.id);

        const task2Instance1 = tasks1.find((t: any) => t.taskDefinitionKey === 'task2');
        const task2Instance2 = tasks2.find((t: any) => t.taskDefinitionKey === 'task2');

        expect(task2Instance1).toBeDefined();
        expect(task2Instance2).toBeUndefined(); // instance2不应该被触发
      });
    });
  });
});
