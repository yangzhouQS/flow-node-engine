/**
 * 集成测试 - 定时器事件触发
 * 测试场景：定时器开始事件、定时器边界事件、定时器中间事件
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
import { Job } from '../../src/job/entities/job.entity';

// Services
import { ProcessDefinitionService } from '../../src/process-definition/services/process-definition.service';
import { ProcessInstanceService } from '../../src/process-instance/services/process-instance.service';
import { TaskService } from '../../src/task/services/task.service';
import { JobService } from '../../src/job/services/job.service';
import { HistoryService } from '../../src/history/services/history.service';
import { EventBusService } from '../../src/core/services/event-bus.service';

// 定时器开始事件流程
const TIMER_START_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="timerStartProcess" name="定时器开始流程" isExecutable="true">
    <startEvent id="timerStart" name="定时开始">
      <timerEventDefinition>
        <timeCycle>0 0 12 * * ?</timeCycle>
      </timerEventDefinition>
    </startEvent>
    <sequenceFlow id="flow1" sourceRef="timerStart" targetRef="task1"/>
    
    <userTask id="task1" name="每日任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 定时器边界事件流程
const TIMER_BOUNDARY_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="timerBoundaryProcess" name="定时器边界事件流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="userTask"/>
    
    <userTask id="userTask" name="用户任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <!-- 边界定时器事件 -->
    <boundaryEvent id="timerBoundary" attachedToRef="userTask" cancelActivity="true">
      <timerEventDefinition>
        <timeDuration>PT30M</timeDuration>
      </timerEventDefinition>
    </boundaryEvent>
    
    <sequenceFlow id="flow2" sourceRef="userTask" targetRef="normalEnd"/>
    <endEvent id="normalEnd" name="正常结束"/>
    
    <sequenceFlow id="timeoutFlow" sourceRef="timerBoundary" targetRef="timeoutTask"/>
    <userTask id="timeoutTask" name="超时处理">
      <extensionElements>
        <flowable:assignee>${timeoutHandler}</flowable:assignee>
      </extensionElements>
    </userTask>
    <sequenceFlow id="flow3" sourceRef="timeoutTask" targetRef="timeoutEnd"/>
    <endEvent id="timeoutEnd" name="超时结束"/>
  </process>
</definitions>`;

// 定时器中间事件流程
const TIMER_INTERMEDIATE_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="timerIntermediateProcess" name="定时器中间事件流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    
    <userTask id="task1" name="任务1">
      <extensionElements>
        <flowable:assignee>${assignee1}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="timerWait"/>
    
    <!-- 中间定时器事件 - 等待 -->
    <intermediateCatchEvent id="timerWait" name="等待3天">
      <timerEventDefinition>
        <timeDuration>P3D</timeDuration>
      </timerEventDefinition>
    </intermediateCatchEvent>
    
    <sequenceFlow id="flow3" sourceRef="timerWait" targetRef="task2"/>
    
    <userTask id="task2" name="任务2">
      <extensionElements>
        <flowable:assignee>${assignee2}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow4" sourceRef="task2" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 带循环定时器的流程
const TIMER_CYCLE_EVENT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="timerCycleProcess" name="循环定时器流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    
    <userTask id="task1" name="周期任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="cycleTimer"/>
    
    <!-- 循环定时器 -->
    <intermediateCatchEvent id="cycleTimer" name="每小时触发">
      <timerEventDefinition>
        <timeCycle>0 0 * * * ?</timeCycle>
      </timerEventDefinition>
    </intermediateCatchEvent>
    
    <sequenceFlow id="flow3" sourceRef="cycleTimer" targetRef="task1"/>
  </process>
</definitions>`;

describe('集成测试 - 定时器事件触发', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let taskService: TaskService;
  let jobService: JobService;
  let historyService: HistoryService;
  let eventBusService: EventBusService;

  // Mock repositories
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let executionRepo: vi.Mocked<Repository<Execution>>;
  let variableRepo: vi.Mocked<Repository<Variable>>;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let jobRepo: vi.Mocked<Repository<Job>>;

  // 测试数据存储
  let processDefinitions: Map<string, ProcessDefinition>;
  let processInstances: Map<string, ProcessInstance>;
  let executions: Map<string, Execution>;
  let variables: Map<string, Variable>;
  let tasks: Map<string, Task>;
  let jobs: Map<string, Job>;

  beforeEach(async () => {
    // 初始化数据存储
    processDefinitions = new Map();
    processInstances = new Map();
    executions = new Map();
    variables = new Map();
    tasks = new Map();
    jobs = new Map();

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
    jobRepo = createMockRepo(jobs);

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        ProcessDefinitionService,
        ProcessInstanceService,
        TaskService,
        JobService,
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
          provide: getRepositoryToken(Job),
          useValue: jobRepo,
        },
      ],
    }).compile();

    // 获取服务实例
    processDefinitionService = module.get<ProcessDefinitionService>(ProcessDefinitionService);
    processInstanceService = module.get<ProcessInstanceService>(ProcessInstanceService);
    taskService = module.get<TaskService>(TaskService);
    jobService = module.get<JobService>(JobService);
    historyService = module.get<HistoryService>(HistoryService);
    eventBusService = module.get<EventBusService>(EventBusService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.10 定时器事件触发测试', () => {
    describe('定时器边界事件', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '定时器边界事件流程',
          key: 'timerBoundaryProcess',
          bpmnXml: TIMER_BOUNDARY_EVENT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带定时器边界事件的流程', async () => {
        const definition = await processDefinitionService.findByKey('timerBoundaryProcess');
        expect(definition).toBeDefined();
      });

      it('应该能够启动带定时器边界事件的流程', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerBoundaryProcess',
          businessKey: 'TIMER-001',
          variables: {
            assignee: 'user001',
            timeoutHandler: 'timeoutUser',
          },
        });

        expect(startResult).toBeDefined();

        // 验证用户任务已创建
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const userTask = allTasks.find((t: any) => t.taskDefinitionKey === 'userTask');
        expect(userTask).toBeDefined();
      });

      it('应该在任务超时后触发边界事件', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerBoundaryProcess',
          businessKey: 'TIMER-002',
          variables: {
            assignee: 'user002',
            timeoutHandler: 'timeoutUser',
          },
        });

        // 模拟定时器触发
        await eventBusService.emit('TIMER_FIRED', {
          processInstanceId: startResult.id,
          timerId: 'timerBoundary',
        });

        // 验证超时处理任务已创建
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const timeoutTask = allTasks.find((t: any) => t.taskDefinitionKey === 'timeoutTask');
        expect(timeoutTask).toBeDefined();
      });

      it('超时后应该取消原任务', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerBoundaryProcess',
          businessKey: 'TIMER-003',
          variables: {
            assignee: 'user003',
            timeoutHandler: 'timeoutUser',
          },
        });

        // 模拟定时器触发
        await eventBusService.emit('TIMER_FIRED', {
          processInstanceId: startResult.id,
          timerId: 'timerBoundary',
        });

        // 验证原任务被取消
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const userTask = allTasks.find(
          (t: any) => t.taskDefinitionKey === 'userTask' && t.status === 'ACTIVE'
        );
        expect(userTask).toBeUndefined();
      });

      it('任务完成后定时器应该被取消', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerBoundaryProcess',
          businessKey: 'TIMER-004',
          variables: {
            assignee: 'user004',
            timeoutHandler: 'timeoutUser',
          },
        });

        // 完成用户任务
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const userTask = allTasks.find((t: any) => t.taskDefinitionKey === 'userTask');
        await taskService.complete(userTask!.id, {});

        // 验证流程正常结束
        const instance = await processInstanceService.findById(startResult.id);
        expect(instance?.status).toBe('COMPLETED');
      });
    });

    describe('定时器中间事件', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '定时器中间事件流程',
          key: 'timerIntermediateProcess',
          bpmnXml: TIMER_INTERMEDIATE_EVENT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够部署带定时器中间事件的流程', async () => {
        const definition = await processDefinitionService.findByKey('timerIntermediateProcess');
        expect(definition).toBeDefined();
      });

      it('应该在任务完成后创建定时器等待', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerIntermediateProcess',
          businessKey: 'INTER-001',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const task1 = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task1!.id, {});

        // 验证定时器作业已创建
        const allJobs = await jobRepo.find();
        const timerJobs = allJobs.filter(
          (j: any) => j.processInstanceId === startResult.id && j.jobType === 'TIMER'
        );
        expect(timerJobs.length).toBeGreaterThan(0);
      });

      it('应该等待定时器触发后继续流程', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerIntermediateProcess',
          businessKey: 'INTER-002',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        let task1 = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task1!.id, {});

        // 模拟定时器触发
        await eventBusService.emit('TIMER_FIRED', {
          processInstanceId: startResult.id,
          timerId: 'timerWait',
        });

        // 验证任务2已创建
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const task2 = allTasks.find((t: any) => t.taskDefinitionKey === 'task2');
        expect(task2).toBeDefined();
      });

      it('应该能够完成带中间定时器的流程', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerIntermediateProcess',
          businessKey: 'INTER-003',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        let task = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task!.id, {});

        // 模拟定时器触发
        await eventBusService.emit('TIMER_FIRED', {
          processInstanceId: startResult.id,
          timerId: 'timerWait',
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

    describe('定时器作业管理', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '定时器中间事件流程',
          key: 'timerIntermediateProcess',
          bpmnXml: TIMER_INTERMEDIATE_EVENT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够查询待执行的定时器作业', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerIntermediateProcess',
          businessKey: 'JOB-001',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1，触发定时器
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const task1 = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task1!.id, {});

        // 查询定时器作业
        const pendingJobs = await jobService.findPendingJobs();
        expect(pendingJobs.length).toBeGreaterThan(0);
      });

      it('应该能够取消定时器作业', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'timerIntermediateProcess',
          businessKey: 'JOB-002',
          variables: {
            assignee1: 'user1',
            assignee2: 'user2',
          },
        });

        // 完成任务1，触发定时器
        const allTasks = await taskService.findByProcessInstance(startResult.id);
        const task1 = allTasks.find((t: any) => t.taskDefinitionKey === 'task1');
        await taskService.complete(task1!.id, {});

        // 取消流程实例
        await processInstanceService.cancel(startResult.id);

        // 验证定时器作业被删除
        const allJobs = await jobRepo.find();
        const instanceJobs = allJobs.filter(
          (j: any) => j.processInstanceId === startResult.id
        );
        expect(instanceJobs.length).toBe(0);
      });
    });
  });
});
