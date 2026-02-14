/**
 * 集成测试 - 多人任务退回
 * 测试场景：多实例任务的退回操作
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
import { MultiInstanceRejectService } from '../../src/task/services/multi-instance-reject.service';
import { TaskRejectService } from '../../src/task/services/task-reject.service';
import { HistoryService } from '../../src/history/services/history.service';
import { EventBusService } from '../../src/core/services/event-bus.service';

// 并行多实例审批流程
const PARALLEL_MULTI_INSTANCE_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="parallelMultiInstance" name="并行多实例审批" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="submitTask"/>
    
    <userTask id="submitTask" name="提交申请">
      <extensionElements>
        <flowable:assignee>${applicant}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="submitTask" targetRef="parallelReview"/>
    
    <userTask id="parallelReview" name="并行审批">
      <multiInstanceLoopCharacteristics isSequential="false">
        <loopCardinality>${reviewers.size()}</loopCardinality>
        <inputItem name="reviewer">${reviewers}</inputItem>
        <completionCondition>${nrOfCompletedInstances/nrOfInstances >= 0.6}</completionCondition>
      </multiInstanceLoopCharacteristics>
      <extensionElements>
        <flowable:assignee>${reviewer}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow3" sourceRef="parallelReview" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 串行多实例审批流程
const SEQUENTIAL_MULTI_INSTANCE_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="sequentialMultiInstance" name="串行多实例审批" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="submitTask"/>
    
    <userTask id="submitTask" name="提交申请">
      <extensionElements>
        <flowable:assignee>${applicant}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="submitTask" targetRef="sequentialReview"/>
    
    <userTask id="sequentialReview" name="串行审批">
      <multiInstanceLoopCharacteristics isSequential="true">
        <loopCardinality>${approvers.size()}</loopCardinality>
        <inputItem name="approver">${approvers}</inputItem>
      </multiInstanceLoopCharacteristics>
      <extensionElements>
        <flowable:assignee>${approver}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow3" sourceRef="sequentialReview" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

// 带驳回的多实例流程
const MULTI_INSTANCE_WITH_REJECT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="multiInstanceWithReject" name="带驳回的多实例流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="submitTask"/>
    
    <userTask id="submitTask" name="提交申请">
      <extensionElements>
        <flowable:assignee>${applicant}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow2" sourceRef="submitTask" targetRef="multiApproval"/>
    
    <userTask id="multiApproval" name="多人审批">
      <multiInstanceLoopCharacteristics isSequential="false">
        <loopCardinality>${approvers.size()}</loopCardinality>
        <inputItem name="approver">${approvers}</inputItem>
        <completionCondition>${nrOfCompletedInstances == nrOfInstances}</completionCondition>
      </multiInstanceLoopCharacteristics>
      <extensionElements>
        <flowable:assignee>${approver}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow3" sourceRef="multiApproval" targetRef="finalTask"/>
    
    <userTask id="finalTask" name="最终确认">
      <extensionElements>
        <flowable:assignee>${finalApprover}</flowable:assignee>
      </extensionElements>
    </userTask>
    
    <sequenceFlow id="flow4" sourceRef="finalTask" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('集成测试 - 多人任务退回', () => {
  let module: TestingModule;
  let processDefinitionService: ProcessDefinitionService;
  let processInstanceService: ProcessInstanceService;
  let taskService: TaskService;
  let multiInstanceRejectService: MultiInstanceRejectService;
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
        MultiInstanceRejectService,
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
    multiInstanceRejectService = module.get<MultiInstanceRejectService>(MultiInstanceRejectService);
    taskRejectService = module.get<TaskRejectService>(TaskRejectService);
    historyService = module.get<HistoryService>(HistoryService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('6.3.9 多人任务退回测试', () => {
    describe('并行多实例退回', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '并行多实例审批',
          key: 'parallelMultiInstance',
          bpmnXml: PARALLEL_MULTI_INSTANCE_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够创建并行多实例任务', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'parallelMultiInstance',
          businessKey: 'PARALLEL-001',
          variables: {
            applicant: 'applicant001',
            reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
          },
        });

        // 完成提交任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        // 验证创建了多个并行审批任务
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const reviewTasks = allTasks.filter((t: any) => t.taskDefinitionKey === 'parallelReview');
        expect(reviewTasks.length).toBe(3);
      });

      it('应该能够退回并行多实例任务到发起人', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'parallelMultiInstance',
          businessKey: 'PARALLEL-002',
          variables: {
            applicant: 'applicant002',
            reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
          },
        });

        // 完成提交任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        // 获取一个审批任务并退回
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'parallelReview');

        await multiInstanceRejectService.reject({
          taskId: reviewTask!.id,
          targetNodeKey: 'submitTask',
          reason: '需要补充材料',
          rejectType: 'RETURN',
        });

        // 验证提交任务重新创建
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const newSubmitTask = allTasks.find(
          (t: any) => t.taskDefinitionKey === 'submitTask' && t.status === 'ACTIVE'
        );
        expect(newSubmitTask).toBeDefined();
      });

      it('退回后应该取消其他并行任务', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'parallelMultiInstance',
          businessKey: 'PARALLEL-003',
          variables: {
            applicant: 'applicant003',
            reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
          },
        });

        // 完成提交任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        // 获取所有审批任务
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const reviewTasks = allTasks.filter((t: any) => t.taskDefinitionKey === 'parallelReview');
        expect(reviewTasks.length).toBe(3);

        // 退回其中一个任务
        await multiInstanceRejectService.reject({
          taskId: reviewTasks[0]!.id,
          targetNodeKey: 'submitTask',
          reason: '退回测试',
          rejectType: 'RETURN',
        });

        // 验证其他并行任务被取消
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const activeReviewTasks = allTasks.filter(
          (t: any) => t.taskDefinitionKey === 'parallelReview' && t.status === 'ACTIVE'
        );
        expect(activeReviewTasks.length).toBe(0);
      });

      it('应该能够部分完成后退回', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'parallelMultiInstance',
          businessKey: 'PARALLEL-004',
          variables: {
            applicant: 'applicant004',
            reviewers: ['reviewer1', 'reviewer2', 'reviewer3'],
          },
        });

        // 完成提交任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        // 完成一个审批任务
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const reviewTasks = allTasks.filter((t: any) => t.taskDefinitionKey === 'parallelReview');
        await taskService.complete(reviewTasks[0]!.id, { approved: true });

        // 退回另一个任务
        await multiInstanceRejectService.reject({
          taskId: reviewTasks[1]!.id,
          targetNodeKey: 'submitTask',
          reason: '部分完成后退回',
          rejectType: 'RETURN',
        });

        // 验证退回成功
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const newSubmitTask = allTasks.find(
          (t: any) => t.taskDefinitionKey === 'submitTask' && t.status === 'ACTIVE'
        );
        expect(newSubmitTask).toBeDefined();
      });
    });

    describe('串行多实例退回', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '串行多实例审批',
          key: 'sequentialMultiInstance',
          bpmnXml: SEQUENTIAL_MULTI_INSTANCE_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该能够创建串行多实例任务', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'sequentialMultiInstance',
          businessKey: 'SEQUENTIAL-001',
          variables: {
            applicant: 'applicant001',
            approvers: ['approver1', 'approver2', 'approver3'],
          },
        });

        // 完成提交任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        // 验证只创建了一个审批任务（串行）
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const activeReviewTasks = allTasks.filter(
          (t: any) => t.taskDefinitionKey === 'sequentialReview' && t.status === 'ACTIVE'
        );
        expect(activeReviewTasks.length).toBe(1);
        expect(activeReviewTasks[0]?.assignee).toBe('approver1');
      });

      it('应该能够退回串行多实例任务', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'sequentialMultiInstance',
          businessKey: 'SEQUENTIAL-002',
          variables: {
            applicant: 'applicant002',
            approvers: ['approver1', 'approver2', 'approver3'],
          },
        });

        // 完成提交任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        // 获取第一个审批任务并退回
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'sequentialReview');

        await multiInstanceRejectService.reject({
          taskId: reviewTask!.id,
          targetNodeKey: 'submitTask',
          reason: '串行审批退回',
          rejectType: 'RETURN',
        });

        // 验证提交任务重新创建
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const newSubmitTask = allTasks.find(
          (t: any) => t.taskDefinitionKey === 'submitTask' && t.status === 'ACTIVE'
        );
        expect(newSubmitTask).toBeDefined();
      });

      it('退回后重新提交应该重新开始串行审批', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'sequentialMultiInstance',
          businessKey: 'SEQUENTIAL-003',
          variables: {
            applicant: 'applicant003',
            approvers: ['approver1', 'approver2', 'approver3'],
          },
        });

        // 完成提交任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        let submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        // 完成第一个审批
        allTasks = await taskService.findByProcessInstance(startResult.id);
        let reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'sequentialReview');
        await taskService.complete(reviewTask!.id, { approved: true });

        // 第二个审批退回
        allTasks = await taskService.findByProcessInstance(startResult.id);
        reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'sequentialReview');
        await multiInstanceRejectService.reject({
          taskId: reviewTask!.id,
          targetNodeKey: 'submitTask',
          reason: '需要修改',
          rejectType: 'RETURN',
        });

        // 重新提交
        allTasks = await taskService.findByProcessInstance(startResult.id);
        submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        // 验证从第一个审批重新开始
        allTasks = await taskService.findByProcessInstance(startResult.id);
        reviewTask = allTasks.find((t: any) => t.taskDefinitionKey === 'sequentialReview');
        expect(reviewTask?.assignee).toBe('approver1');
      });
    });

    describe('带驳回的多实例流程', () => {
      beforeEach(async () => {
        await processDefinitionService.deploy({
          name: '带驳回的多实例流程',
          key: 'multiInstanceWithReject',
          bpmnXml: MULTI_INSTANCE_WITH_REJECT_BPMN_XML,
          generateDiagram: false,
        });
      });

      it('应该记录多实例任务的驳回历史', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'multiInstanceWithReject',
          businessKey: 'REJECT-001',
          variables: {
            applicant: 'applicant001',
            approvers: ['approver1', 'approver2', 'approver3'],
            finalApprover: 'finalUser',
          },
        });

        // 完成提交任务
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        const submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        // 退回
        allTasks = await taskService.findByProcessInstance(startResult.id);
        const approvalTask = allTasks.find((t: any) => t.taskDefinitionKey === 'multiApproval');
        await multiInstanceRejectService.reject({
          taskId: approvalTask!.id,
          targetNodeKey: 'submitTask',
          reason: '多实例驳回测试',
          rejectType: 'RETURN',
        });

        // 验证驳回记录
        const rejectRecords = await taskRejectService.findByProcessInstance(startResult.id);
        expect(rejectRecords.length).toBe(1);
        expect(rejectRecords[0].reason).toBe('多实例驳回测试');
      });

      it('应该能够多次退回和重新提交', async () => {
        const startResult = await processInstanceService.start({
          processDefinitionKey: 'multiInstanceWithReject',
          businessKey: 'REJECT-002',
          variables: {
            applicant: 'applicant002',
            approvers: ['approver1', 'approver2'],
            finalApprover: 'finalUser',
          },
        });

        // 第一次提交和退回
        let allTasks = await taskService.findByProcessInstance(startResult.id);
        let submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        allTasks = await taskService.findByProcessInstance(startResult.id);
        let approvalTask = allTasks.find((t: any) => t.taskDefinitionKey === 'multiApproval');
        await multiInstanceRejectService.reject({
          taskId: approvalTask!.id,
          targetNodeKey: 'submitTask',
          reason: '第一次退回',
          rejectType: 'RETURN',
        });

        // 第二次提交和退回
        allTasks = await taskService.findByProcessInstance(startResult.id);
        submitTask = allTasks.find((t: any) => t.taskDefinitionKey === 'submitTask');
        await taskService.complete(submitTask!.id, {});

        allTasks = await taskService.findByProcessInstance(startResult.id);
        approvalTask = allTasks.find((t: any) => t.taskDefinitionKey === 'multiApproval');
        await multiInstanceRejectService.reject({
          taskId: approvalTask!.id,
          targetNodeKey: 'submitTask',
          reason: '第二次退回',
          rejectType: 'RETURN',
        });

        // 验证驳回历史
        const rejectRecords = await taskRejectService.findByProcessInstance(startResult.id);
        expect(rejectRecords.length).toBe(2);
      });
    });
  });
});
