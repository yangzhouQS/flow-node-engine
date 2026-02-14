/**
 * E2E 测试 - 进度追踪 API
 * 测试进度追踪相关的HTTP接口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule, INestApplication } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

// Entities
import { ProcessInstance } from '../../src/process-instance/entities/process-instance.entity';
import { ProcessDefinition } from '../../src/process-definition/entities/process-definition.entity';
import { Execution } from '../../src/process-instance/entities/execution.entity';
import { Task } from '../../src/task/entities/task.entity';

// Module
import { ProgressTrackingModule } from '../../src/progress-tracking/progress-tracking.module';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { TaskModule } from '../../src/task/task.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - 进度追踪 API', () => {
  let app: INestApplication;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let executionRepo: vi.Mocked<Repository<Execution>>;
  let taskRepo: vi.Mocked<Repository<Task>>;

  // 测试数据存储
  let processInstances: Map<string, ProcessInstance>;
  let processDefinitions: Map<string, ProcessDefinition>;
  let executions: Map<string, Execution>;
  let tasks: Map<string, Task>;

  let definitionId: string;
  let instanceId: string;

  beforeEach(async () => {
    // 初始化数据存储
    processInstances = new Map();
    processDefinitions = new Map();
    executions = new Map();
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

    processInstanceRepo = createMockRepo(processInstances);
    processDefinitionRepo = createMockRepo(processDefinitions);
    executionRepo = createMockRepo(executions);
    taskRepo = createMockRepo(tasks);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        CoreModule,
        ProcessDefinitionModule,
        ProcessInstanceModule,
        TaskModule,
        ProgressTrackingModule,
      ],
    })
      .overrideProvider(getRepositoryToken(ProcessInstance))
      .useValue(processInstanceRepo)
      .overrideProvider(getRepositoryToken(ProcessDefinition))
      .useValue(processDefinitionRepo)
      .overrideProvider(getRepositoryToken(Execution))
      .useValue(executionRepo)
      .overrideProvider(getRepositoryToken(Task))
      .useValue(taskRepo)
      .compile();

    app = moduleFixture.createNestApplication();

    // 应用全局管道
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      })
    );

    await app.init();

    // 预先创建流程定义
    const definition = await processDefinitionRepo.save({
      name: '进度追踪测试流程',
      key: 'progressTestProcess',
      version: 1,
      isActive: true,
    } as any);
    definitionId = definition.id;

    // 预先创建流程实例
    const instance = await processInstanceRepo.save({
      processDefinitionId: definitionId,
      businessKey: 'progress-test-biz-001',
      status: 'ACTIVE',
      startTime: new Date(),
    } as any);
    instanceId = instance.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/progress/process-instances/:id', () => {
    beforeEach(async () => {
      // 添加执行记录
      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'start',
        activityName: '开始',
        activityType: 'startEvent',
        isActive: false,
        startTime: new Date(),
        endTime: new Date(),
      } as any);

      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'task1',
        activityName: '用户任务',
        activityType: 'userTask',
        isActive: true,
        startTime: new Date(),
      } as any);

      // 添加任务
      await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'task1',
        name: '用户任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
    });

    it('应该返回流程实例进度详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/progress/process-instances/${instanceId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('processInstanceId', instanceId);
      expect(response.body.data).toHaveProperty('progress');
      expect(response.body.data).toHaveProperty('completedActivities');
      expect(response.body.data).toHaveProperty('pendingActivities');
    });

    it('应该返回404当流程实例不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/progress/process-instances/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/progress/process-instances/:id/timeline', () => {
    beforeEach(async () => {
      // 添加执行记录模拟时间线
      const now = Date.now();
      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'start',
        activityName: '开始',
        activityType: 'startEvent',
        isActive: false,
        startTime: new Date(now - 3600000),
        endTime: new Date(now - 3500000),
      } as any);

      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'task1',
        activityName: '审批任务',
        activityType: 'userTask',
        isActive: false,
        startTime: new Date(now - 3500000),
        endTime: new Date(now - 1800000),
      } as any);

      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'task2',
        activityName: '复核任务',
        activityType: 'userTask',
        isActive: true,
        startTime: new Date(now - 1800000),
      } as any);
    });

    it('应该返回流程实例时间线', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/progress/process-instances/${instanceId}/timeline`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('应该按时间顺序返回时间线事件', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/progress/process-instances/${instanceId}/timeline`)
        .expect(200);

      const timeline = response.body.data;
      for (let i = 1; i < timeline.length; i++) {
        const prevTime = new Date(timeline[i - 1].timestamp).getTime();
        const currTime = new Date(timeline[i].timestamp).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });
  });

  describe('GET /api/v1/progress/process-instances/:id/statistics', () => {
    beforeEach(async () => {
      // 添加执行记录
      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'start',
        activityType: 'startEvent',
        isActive: false,
      } as any);

      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'task1',
        activityType: 'userTask',
        isActive: false,
      } as any);

      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'task2',
        activityType: 'userTask',
        isActive: true,
      } as any);

      // 添加任务
      await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'task1',
        status: 'COMPLETED',
      } as any);

      await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'task2',
        status: 'PENDING',
      } as any);
    });

    it('应该返回流程实例统计信息', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/progress/process-instances/${instanceId}/statistics`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('totalActivities');
      expect(response.body.data).toHaveProperty('completedActivities');
      expect(response.body.data).toHaveProperty('pendingActivities');
      expect(response.body.data).toHaveProperty('completionRate');
    });
  });

  describe('GET /api/v1/progress/process-definitions/:id/overview', () => {
    beforeEach(async () => {
      // 创建多个流程实例
      await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'overview-biz-001',
        status: 'COMPLETED',
        startTime: new Date(),
        endTime: new Date(),
      } as any);

      await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'overview-biz-002',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);

      await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'overview-biz-003',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);
    });

    it('应该返回流程定义的进度概览', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/progress/process-definitions/${definitionId}/overview`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('totalInstances');
      expect(response.body.data).toHaveProperty('activeInstances');
      expect(response.body.data).toHaveProperty('completedInstances');
      expect(response.body.data).toHaveProperty('averageDuration');
    });
  });

  describe('GET /api/v1/progress/users/:userId/tasks', () => {
    const userId = 'user1';

    beforeEach(async () => {
      // 创建用户任务
      await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'userTask1',
        name: '待办任务1',
        assignee: userId,
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'userTask2',
        name: '待办任务2',
        assignee: userId,
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'userTask3',
        name: '已完成任务',
        assignee: userId,
        status: 'COMPLETED',
        createTime: new Date(),
        endTime: new Date(),
      } as any);
    });

    it('应该返回用户任务进度', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/progress/users/${userId}/tasks`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('totalTasks');
      expect(response.body.data).toHaveProperty('pendingTasks');
      expect(response.body.data).toHaveProperty('completedTasks');
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/progress/users/${userId}/tasks`)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('meta');
    });
  });

  describe('GET /api/v1/progress/dashboard', () => {
    beforeEach(async () => {
      // 创建多个流程实例用于仪表板统计
      await processInstanceRepo.save({
        processDefinitionId: definitionId,
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);

      await processInstanceRepo.save({
        processDefinitionId: definitionId,
        status: 'COMPLETED',
        startTime: new Date(),
        endTime: new Date(),
      } as any);

      // 添加任务
      await taskRepo.save({
        processInstanceId: instanceId,
        status: 'PENDING',
        assignee: 'user1',
      } as any);

      await taskRepo.save({
        processInstanceId: instanceId,
        status: 'COMPLETED',
        assignee: 'user2',
      } as any);
    });

    it('应该返回仪表板数据', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/progress/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('processInstanceStats');
      expect(response.body.data).toHaveProperty('taskStats');
    });

    it('应该支持按时间范围过滤', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-12-31');

      const response = await request(app.getHttpServer())
        .get('/api/v1/progress/dashboard')
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });

  describe('POST /api/v1/progress/subscriptions', () => {
    it('应该成功创建进度订阅', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/progress/subscriptions')
        .send({
          processInstanceId: instanceId,
          userId: 'user1',
          callbackUrl: 'https://example.com/callback',
          events: ['TASK_COMPLETED', 'PROCESS_COMPLETED'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('processInstanceId', instanceId);
    });

    it('应该拒绝缺少必要字段的请求', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/progress/subscriptions')
        .send({
          // 缺少 processInstanceId
          userId: 'user1',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('DELETE /api/v1/progress/subscriptions/:id', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      // 创建订阅
      subscriptionId = `sub-${Date.now()}`;
    });

    it('应该成功取消进度订阅', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/progress/subscriptions/${subscriptionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });
});
