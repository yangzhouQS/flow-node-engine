/**
 * 集成测试 - 完整流程流转
 * 测试场景：完整的请假流程从开始到结束
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
import { HistoricProcessInstance } from '../../src/history/entities/historic-process-instance.entity';
import { HistoricTask } from '../../src/history/entities/historic-task.entity';
import { HistoricVariable } from '../../src/history/entities/historic-variable.entity';

// Services
import { ProcessDefinitionService } from '../../src/process-definition/services/process-definition.service';
import { ProcessInstanceService } from '../../src/process-instance/services/process-instance.service';
import { ExecutionService } from '../../src/process-instance/services/execution.service';
import { VariableService } from '../../src/process-instance/services/variable.service';
import { TaskService } from '../../src/task/services/task.service';
import { HistoryService } from '../../src/history/services/history.service';
import { BpmnParserService } from '../../src/core/services/bpmn-parser.service';
import { ProcessExecutorService } from '../../src/core/services/process-executor.service';
import { EventBusService } from '../../src/core/services/event-bus.service';
import { ExpressionEvaluatorService } from '../../src/core/services/expression-evaluator.service';

// 测试用BPMN XML - 简单请假流程
const LEAVE_PROCESS_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="leaveProcess" name="请假流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="submitTask"/>
    <userTask id="submitTask" name="提交申请">
      <extensionElements>
        <flowable:assignee>${applicant}</flowable:assignee>
      </extensionElements>
    </userTask>
    <sequenceFlow id="flow2" sourceRef="submitTask" targetRef="approveTask"/>
    <userTask id="approveTask" name="审批">
      <extensionElements>
        <flowable:assignee>${approver}</flowable:assignee>
      </extensionElements>
    </userTask>
    <sequenceFlow id="flow3" sourceRef="approveTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('集成测试 - 完整流程流转', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let executionService: ExecutionService;
  let variableService: VariableService;
  let taskService: TaskService;
  let historyService: HistoryService;
  let processExecutorService: ProcessExecutorService;

  // Mock repositories
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let executionRepo: vi.Mocked<Repository<Execution>>;
  let variableRepo: vi.Mocked<Repository<Variable>>;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let historicProcessInstanceRepo: vi.Mocked<Repository<HistoricProcessInstance>>;
  let historicTaskRepo: vi.Mocked<Repository<HistoricTask>>;
  let historicVariableRepo: vi.Mocked<Repository<HistoricVariable>>;

  // 测试数据存储
  let processDefinitions: Map<string, ProcessDefinition>;
  let processInstances: Map<string, ProcessInstance>;
  let executions: Map<string, Execution>;
  let variables: Map<string, Variable>;
  let tasks: Map<string, Task>;
  let historicProcessInstances: Map<string, HistoricProcessInstance>;
  let historicTasks: Map<string, HistoricTask>;
  let historicVariables: Map<string, HistoricVariable>;

  beforeEach(async () => {
    // 初始化数据存储
    processDefinitions = new Map();
    processInstances = new Map();
    executions = new Map();
    variables = new Map();
    tasks = new Map();
    historicProcessInstances = new Map();
    historicTasks = new Map();
    historicVariables = new Map();

    // 创建mock repositories
    const createMockRepo = <T>(storage: Map<string, T>): vi.Mocked<Repository<T>> => {
      return {
        find: vi.fn(async () => Array.from(storage.values())),
        findOne: vi.fn(async (options: any) => {
          if (options?.where?.id) {
            return storage.get(options.where.id) || null;
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
    historicProcessInstanceRepo = createMockRepo(historicProcessInstances);
    historicTaskRepo = createMockRepo(historicTasks);
    historicVariableRepo = createMockRepo(historicVariables);

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        ProcessDefinitionService,
        ProcessInstanceService,
        ExecutionService,
        VariableService,
        TaskService,
        HistoryService,
        BpmnParserService,
        ProcessExecutorService,
        EventBusService,
        ExpressionEvaluatorService,
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
          provide: getRepositoryToken(HistoricProcessInstance),
          useValue: historicProcessInstanceRepo,
        },
        {
          provide: getRepositoryToken(HistoricTask),
          useValue: historicTaskRepo,
        },
        {
          provide: getRepositoryToken(HistoricVariable),
          useValue: historicVariableRepo,
        },
      ],
    }).compile();

    // 获取服务实例
    processDefinitionService = module.get<ProcessDefinitionService>(ProcessDefinitionService);
    processInstanceService = module.get<ProcessInstanceService>(ProcessInstanceService);
    executionService = module.get<ExecutionService>(ExecutionService);
    variableService = module.get<VariableService>(VariableService);
    taskService = module.get<TaskService>(TaskService);
    historyService = module.get<HistoryService>(HistoryService);
    processExecutorService = module.get<ProcessExecutorService>(ProcessExecutorService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.1 完整流程流转测试', () => {
    it('应该完成完整的请假流程：部署->启动->提交->审批->结束', async () => {
      // 步骤1: 部署流程定义
      const deployResult = await processDefinitionService.deploy({
        name: '请假流程',
        key: 'leaveProcess',
        bpmnXml: LEAVE_PROCESS_BPMN_XML,
        generateDiagram: false,
      });

      expect(deployResult).toBeDefined();
      expect(deployResult.key).toBe('leaveProcess');
      expect(deployResult.version).toBe(1);

      // 步骤2: 启动流程实例
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'leaveProcess',
        businessKey: 'LEAVE-2026-001',
        variables: {
          applicant: 'user001',
          approver: 'manager001',
          leaveDays: 3,
          leaveType: '年假',
        },
      });

      expect(startResult).toBeDefined();
      expect(startResult.businessKey).toBe('LEAVE-2026-001');
      expect(startResult.status).toBe('RUNNING');

      // 步骤3: 查询第一个任务（提交申请）
      const submitTasks = await taskService.findByAssignee('user001');
      expect(submitTasks.length).toBeGreaterThan(0);
      const submitTask = submitTasks[0];
      expect(submitTask.name).toBe('提交申请');

      // 步骤4: 完成提交申请任务
      await taskService.complete(submitTask.id, {
        reason: '个人事务',
        startDate: '2026-02-20',
        endDate: '2026-02-22',
      });

      // 步骤5: 查询第二个任务（审批）
      const approveTasks = await taskService.findByAssignee('manager001');
      expect(approveTasks.length).toBeGreaterThan(0);
      const approveTask = approveTasks[0];
      expect(approveTask.name).toBe('审批');

      // 步骤6: 完成审批任务
      await taskService.complete(approveTask.id, {
        approved: true,
        comment: '同意请假申请',
      });

      // 步骤7: 验证流程实例已完成
      const completedInstance = await processInstanceService.findById(startResult.id);
      expect(completedInstance?.status).toBe('COMPLETED');

      // 步骤8: 验证历史记录
      const historicInstance = await historyService.findHistoricProcessInstance(startResult.id);
      expect(historicInstance).toBeDefined();
      expect(historicInstance?.endTime).toBeDefined();

      const historicTasks = await historyService.findHistoricTasks({
        processInstanceId: startResult.id,
      });
      expect(historicTasks.length).toBe(2);
    });

    it('应该正确处理流程变量在整个流程中的传递', async () => {
      // 部署并启动流程
      await processDefinitionService.deploy({
        name: '请假流程',
        key: 'leaveProcess',
        bpmnXml: LEAVE_PROCESS_BPMN_XML,
        generateDiagram: false,
      });

      const startResult = await processInstanceService.start({
        processDefinitionKey: 'leaveProcess',
        businessKey: 'LEAVE-2026-002',
        variables: {
          applicant: 'user002',
          approver: 'manager002',
          leaveDays: 5,
          leaveType: '事假',
        },
      });

      // 验证初始变量
      const initialVars = await variableService.findByProcessInstance(startResult.id);
      expect(initialVars.find(v => v.name === 'leaveDays')?.value).toBe(5);
      expect(initialVars.find(v => v.name === 'leaveType')?.value).toBe('事假');

      // 完成第一个任务并添加新变量
      const submitTasks = await taskService.findByAssignee('user002');
      await taskService.complete(submitTasks[0].id, {
        submitTime: '2026-02-14T10:00:00Z',
      });

      // 验证新变量已添加
      const updatedVars = await variableService.findByProcessInstance(startResult.id);
      expect(updatedVars.find(v => v.name === 'submitTime')).toBeDefined();

      // 完成第二个任务
      const approveTasks = await taskService.findByAssignee('manager002');
      await taskService.complete(approveTasks[0].id, {
        approved: true,
        approveTime: '2026-02-14T14:00:00Z',
      });

      // 验证所有变量都记录到历史
      const historicVars = await historyService.findHistoricVariables({
        processInstanceId: startResult.id,
      });
      expect(historicVars.length).toBeGreaterThanOrEqual(4);
    });

    it('应该正确处理流程实例的中止操作', async () => {
      // 部署并启动流程
      await processDefinitionService.deploy({
        name: '请假流程',
        key: 'leaveProcess',
        bpmnXml: LEAVE_PROCESS_BPMN_XML,
        generateDiagram: false,
      });

      const startResult = await processInstanceService.start({
        processDefinitionKey: 'leaveProcess',
        businessKey: 'LEAVE-2026-003',
        variables: {
          applicant: 'user003',
          approver: 'manager003',
          leaveDays: 2,
        },
      });

      // 在任务完成前中止流程
      await processInstanceService.terminate(startResult.id, '用户取消申请');

      // 验证流程状态
      const terminatedInstance = await processInstanceService.findById(startResult.id);
      expect(terminatedInstance?.status).toBe('TERMINATED');

      // 验证任务被取消
      const remainingTasks = await taskService.findByProcessInstance(startResult.id);
      expect(remainingTasks.every(t => t.status === 'CANCELLED')).toBe(true);

      // 验证历史记录
      const historicInstance = await historyService.findHistoricProcessInstance(startResult.id);
      expect(historicInstance?.deleteReason).toBe('用户取消申请');
    });

    it('应该正确处理流程实例的挂起和恢复', async () => {
      // 部署并启动流程
      await processDefinitionService.deploy({
        name: '请假流程',
        key: 'leaveProcess',
        bpmnXml: LEAVE_PROCESS_BPMN_XML,
        generateDiagram: false,
      });

      const startResult = await processInstanceService.start({
        processDefinitionKey: 'leaveProcess',
        businessKey: 'LEAVE-2026-004',
        variables: {
          applicant: 'user004',
          approver: 'manager004',
          leaveDays: 1,
        },
      });

      // 挂起流程
      await processInstanceService.suspend(startResult.id, '等待补充材料');

      // 验证挂起状态
      const suspendedInstance = await processInstanceService.findById(startResult.id);
      expect(suspendedInstance?.status).toBe('SUSPENDED');

      // 尝试在挂起状态下完成任务应该失败
      const submitTasks = await taskService.findByAssignee('user004');
      await expect(taskService.complete(submitTasks[0].id, {})).rejects.toThrow();

      // 恢复流程
      await processInstanceService.resume(startResult.id);

      // 验证恢复状态
      const resumedInstance = await processInstanceService.findById(startResult.id);
      expect(resumedInstance?.status).toBe('RUNNING');

      // 恢复后应该可以正常完成任务
      const resumedTasks = await taskService.findByAssignee('user004');
      await expect(taskService.complete(resumedTasks[0].id, {})).resolves.not.toThrow();
    });

    it('应该正确记录流程执行的时间线', async () => {
      // 部署并启动流程
      await processDefinitionService.deploy({
        name: '请假流程',
        key: 'leaveProcess',
        bpmnXml: LEAVE_PROCESS_BPMN_XML,
        generateDiagram: false,
      });

      const startTime = new Date();
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'leaveProcess',
        businessKey: 'LEAVE-2026-005',
        variables: {
          applicant: 'user005',
          approver: 'manager005',
          leaveDays: 4,
        },
      });

      // 完成所有任务
      const submitTasks = await taskService.findByAssignee('user005');
      await taskService.complete(submitTasks[0].id, {});

      const approveTasks = await taskService.findByAssignee('manager005');
      await taskService.complete(approveTasks[0].id, {});
      const endTime = new Date();

      // 验证时间线
      const historicInstance = await historyService.findHistoricProcessInstance(startResult.id);
      expect(historicInstance?.startTime).toBeDefined();
      expect(historicInstance?.endTime).toBeDefined();
      expect(new Date(historicInstance!.startTime).getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      expect(new Date(historicInstance!.endTime).getTime()).toBeLessThanOrEqual(endTime.getTime());

      // 验证任务时间线
      const historicTasks = await historyService.findHistoricTasks({
        processInstanceId: startResult.id,
      });
      expect(historicTasks[0].startTime).toBeDefined();
      expect(historicTasks[0].endTime).toBeDefined();
      expect(new Date(historicTasks[0].endTime).getTime()).toBeLessThan(
        new Date(historicTasks[1].endTime).getTime()
      );
    });
  });
});
