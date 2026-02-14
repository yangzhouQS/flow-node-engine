/**
 * 集成测试 - 任务驳回流程
 * 测试场景：任务驳回、退回、拒绝操作
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
import { TaskReject } from '../../src/task/entities/task-reject.entity';

// Services
import { ProcessDefinitionService } from '../../src/process-definition/services/process-definition.service';
import { ProcessInstanceService } from '../../src/process-instance/services/process-instance.service';
import { TaskService } from '../../src/task/services/task.service';
import { TaskRejectService } from '../../src/task/services/task-reject.service';
import { HistoryService } from '../../src/history/services/history.service';
import { EventBusService } from '../../src/core/services/event-bus.service';

// 测试用BPMN XML - 带驳回的审批流程
const REJECT_FLOW_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="rejectFlowProcess" name="驳回测试流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="submitTask"/>
    
    <userTask id="submitTask" name="提交申请">
      <extensionElements>
        <flowable:assignee>${applicant}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="submitTask" targetRef="reviewTask"/>
    
    <userTask id="reviewTask" name="审核">
      <extensionElements>
        <flowable:assignee>${reviewer}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow3" sourceRef="reviewTask" targetRef="approveTask"/>
    
    <userTask id="approveTask" name="审批">
      <extensionElements>
        <flowable:assignee>${approver}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow4" sourceRef="approveTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('集成测试 - 任务驳回流程', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let taskService: TaskService;
  let taskRejectService: TaskRejectService;
  let historyService: HistoryService;

  // Mock repositories
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let executionRepo: vi.Mocked<Repository<Execution>>;
  let variableRepo: vi.Mocked<Repository<Variable>>;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let taskRejectRepo: vi.Mocked<Repository<TaskReject>>;

  // 测试数据存储
  let processDefinitions: Map<string, ProcessDefinition>;
  let processInstances: Map<string, ProcessInstance>;
  let executions: Map<string, Execution>;
  let variables: Map<string, Variable>;
  let tasks: Map<string, Task>;
  let taskRejects: Map<string, TaskReject>;

  beforeEach(async () => {
    // 初始化数据存储
    processDefinitions = new Map();
    processInstances = new Map();
    executions = new Map();
    variables = new Map();
    tasks = new Map();
    taskRejects = new Map();

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
    taskRejectRepo = createMockRepo(taskRejects);

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        ProcessDefinitionService,
        ProcessInstanceService,
        TaskService,
        TaskRejectService,
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
          provide: getRepositoryToken(TaskReject),
          useValue: taskRejectRepo,
        },
      ],
    }).compile();

    // 获取服务实例
    processDefinitionService = module.get<ProcessDefinitionService>(ProcessDefinitionService);
    processInstanceService = module.get<ProcessInstanceService>(ProcessInstanceService);
    taskService = module.get<TaskService>(TaskService);
    taskRejectService = module.get<TaskRejectService>(TaskRejectService);
    historyService = module.get<HistoryService>(HistoryService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.8 任务驳回流程测试', () => {
    beforeEach(async () => {
      // 部署流程定义
      await processDefinitionService.deploy({
        name: '驳回测试流程',
        key: 'rejectFlowProcess',
        bpmnXml: REJECT_FLOW_BPMN_XML,
        generateDiagram: false,
      });
    });

    it('应该能够驳回任务到上一节点', async () => {
      // 启动流程并完成提交
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'rejectFlowProcess',
        businessKey: 'REJECT-001',
        variables: {
          applicant: 'user001',
          reviewer: 'reviewer001',
          approver: 'approver001',
        },
      });

      // 完成提交任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
      await taskService.complete(submitTask!.id, { content: '申请内容' });

      // 获取审核任务
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'reviewTask');
      
      // 驳回到提交节点
      await taskRejectService.reject({
        taskId: reviewTask!.id,
        targetNodeKey: 'submitTask',
        reason: '资料不完整，请补充',
        rejectType: 'RETURN',
      });

      // 验证提交任务重新创建
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const newSubmitTask = allTasks.find(
        (t: any) => t.taskDefinitionKey === 'submitTask' && t.status === 'ACTIVE'
      );
      expect(newSubmitTask).toBeDefined();
    });

    it('应该能够驳回任务到发起人', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'rejectFlowProcess',
        businessKey: 'REJECT-002',
        variables: {
          applicant: 'user002',
          reviewer: 'reviewer001',
          approver: 'approver001',
        },
      });

      // 完成提交和审核任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
      await taskService.complete(submitTask!.id, {});

      allTasks = await taskService.findByProcessInstance(startResult.id);
      let reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'reviewTask');
      await taskService.complete(reviewTask!.id, {});

      // 获取审批任务并驳回
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const approveTask = allTasks.find((t: any) => t.taskDefinitionKey === 'approveTask');
      
      await taskRejectService.reject({
        taskId: approveTask!.id,
        targetNodeKey: 'submitTask',
        reason: '不符合规定，驳回给发起人',
        rejectType: 'REJECT',
      });

      // 验证驳回记录
      const rejectRecords = await taskRejectService.findByProcessInstance(startResult.id);
      expect(rejectRecords.length).toBe(1);
      expect(rejectRecords[0].rejectType).toBe('REJECT');
      expect(rejectRecords[0].reason).toBe('不符合规定，驳回给发起人');
    });

    it('应该能够拒绝任务（终止流程）', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'rejectFlowProcess',
        businessKey: 'REJECT-003',
        variables: {
          applicant: 'user003',
          reviewer: 'reviewer001',
          approver: 'approver001',
        },
      });

      // 完成提交任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
      await taskService.complete(submitTask!.id, {});

      // 获取审核任务并拒绝
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'reviewTask');
      
      await taskRejectService.reject({
        taskId: reviewTask!.id,
        targetNodeKey: '',
        reason: '审核不通过，拒绝申请',
        rejectType: 'REFUSE',
      });

      // 验证流程已终止
      const instance = await processInstanceService.findById(startResult.id);
      expect(instance?.status).toBe('TERMINATED');
    });

    it('应该记录完整的驳回历史', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'rejectFlowProcess',
        businessKey: 'REJECT-004',
        variables: {
          applicant: 'user004',
          reviewer: 'reviewer001',
          approver: 'approver001',
        },
      });

      // 完成提交任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
      await taskService.complete(submitTask!.id, {});

      // 第一次驳回
      allTasks = await taskService.findByProcessInstance(startResult.id);
      let reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'reviewTask');
      await taskRejectService.reject({
        taskId: reviewTask!.id,
        targetNodeKey: 'submitTask',
        reason: '第一次驳回',
        rejectType: 'RETURN',
      });

      // 重新完成提交任务
      allTasks = await taskService.findByProcessInstance(startResult.id);
      submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
      await taskService.complete(submitTask!.id, {});

      // 第二次驳回
      allTasks = await taskService.findByProcessInstance(startResult.id);
      reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'reviewTask');
      await taskRejectService.reject({
        taskId: reviewTask!.id,
        targetNodeKey: 'submitTask',
        reason: '第二次驳回',
        rejectType: 'RETURN',
      });

      // 验证驳回历史
      const rejectRecords = await taskRejectService.findByProcessInstance(startResult.id);
      expect(rejectRecords.length).toBe(2);
      expect(rejectRecords[0].reason).toBe('第一次驳回');
      expect(rejectRecords[1].reason).toBe('第二次驳回');
    });

    it('应该获取可驳回的目标节点列表', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'rejectFlowProcess',
        businessKey: 'REJECT-005',
        variables: {
          applicant: 'user005',
          reviewer: 'reviewer001',
          approver: 'approver001',
        },
      });

      // 完成提交和审核任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
      await taskService.complete(submitTask!.id, {});

      allTasks = await taskService.findByProcessInstance(startResult.id);
      let reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'reviewTask');
      await taskService.complete(reviewTask!.id, {});

      // 获取审批任务可驳回的节点
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const approveTask = allTasks.find((t: any) => t.taskDefinitionKey === 'approveTask');
      
      const rejectableNodes = await taskRejectService.getRejectableNodes(approveTask!.id);
      
      // 验证可驳回节点包含submitTask和reviewTask
      expect(rejectableNodes.length).toBeGreaterThanOrEqual(2);
      const nodeKeys = rejectableNodes.map((n: any) => n.nodeKey);
      expect(nodeKeys).toContain('submitTask');
      expect(nodeKeys).toContain('reviewTask');
    });

    it('应该验证驳回目标节点的有效性', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'rejectFlowProcess',
        businessKey: 'REJECT-006',
        variables: {
          applicant: 'user006',
          reviewer: 'reviewer001',
          approver: 'approver001',
        },
      });

      // 完成提交任务
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
      await taskService.complete(submitTask!.id, {});

      // 尝试驳回到无效节点
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'reviewTask');
      
      await expect(taskRejectService.reject({
        taskId: reviewTask!.id,
        targetNodeKey: 'invalidNode',
        reason: '测试无效节点',
        rejectType: 'RETURN',
      })).rejects.toThrow();
    });

    it('应该在驳回后正确恢复流程变量', async () => {
      // 启动流程
      const startResult = await processInstanceService.start({
        processDefinitionKey: 'rejectFlowProcess',
        businessKey: 'REJECT-007',
        variables: {
          applicant: 'user007',
          reviewer: 'reviewer001',
          approver: 'approver001',
          initialVar: 'initialValue',
        },
      });

      // 完成提交任务并设置新变量
      let allTasks = await taskService.findByProcessInstance(startResult.id);
      let submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
      await taskService.complete(submitTask!.id, { submitVar: 'submitValue' });

      // 驳回
      allTasks = await taskService.findByProcessInstance(startResult.id);
      const reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'reviewTask');
      await taskRejectService.reject({
        taskId: reviewTask!.id,
        targetNodeKey: 'submitTask',
        reason: '测试变量恢复',
        rejectType: 'RETURN',
      });

      // 验证变量仍然存在
      const vars = await variableRepo.find();
      const varNames = vars.map((v: any) => v.name);
      expect(varNames).toContain('initialVar');
      expect(varNames).toContain('submitVar');
    });
  });
});
