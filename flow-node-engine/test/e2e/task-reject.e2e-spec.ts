/**
 * E2E 测试 - 任务驳回 API
 * 测试任务驳回相关的HTTP接口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule, INestApplication } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

// Entities
import { Task } from '../../src/task/entities/task.entity';
import { ProcessInstance } from '../../src/process-instance/entities/process-instance.entity';
import { ProcessDefinition } from '../../src/process-definition/entities/process-definition.entity';
import { Execution } from '../../src/process-instance/entities/execution.entity';

// Module
import { TaskModule } from '../../src/task/task.module';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - 任务驳回 API', () => {
  let app: INestApplication;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let executionRepo: vi.Mocked<Repository<Execution>>;

  // 测试数据存储
  let tasks: Map<string, Task>;
  let processInstances: Map<string, ProcessInstance>;
  let processDefinitions: Map<string, ProcessDefinition>;
  let executions: Map<string, Execution>;

  let definitionId: string;
  let instanceId: string;
  let currentTaskId: string;

  beforeEach(async () => {
    // 初始化数据存储
    tasks = new Map();
    processInstances = new Map();
    processDefinitions = new Map();
    executions = new Map();

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

    taskRepo = createMockRepo(tasks);
    processInstanceRepo = createMockRepo(processInstances);
    processDefinitionRepo = createMockRepo(processDefinitions);
    executionRepo = createMockRepo(executions);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CoreModule, ProcessDefinitionModule, ProcessInstanceModule, TaskModule],
    })
      .overrideProvider(getRepositoryToken(Task))
      .useValue(taskRepo)
      .overrideProvider(getRepositoryToken(ProcessInstance))
      .useValue(processInstanceRepo)
      .overrideProvider(getRepositoryToken(ProcessDefinition))
      .useValue(processDefinitionRepo)
      .overrideProvider(getRepositoryToken(Execution))
      .useValue(executionRepo)
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
      name: '任务驳回测试流程',
      key: 'taskRejectTestProcess',
      version: 1,
      isActive: true,
    } as any);
    definitionId = definition.id;

    // 预先创建流程实例
    const instance = await processInstanceRepo.save({
      processDefinitionId: definitionId,
      businessKey: 'task-reject-test-biz-001',
      status: 'ACTIVE',
      startTime: new Date(),
    } as any);
    instanceId = instance.id;

    // 创建历史任务（已完成的任务，用于驳回目标）
    await taskRepo.save({
      id: 'historical-task-1',
      processInstanceId: instanceId,
      taskDefinitionKey: 'approveTask',
      name: '审批任务',
      assignee: 'approver1',
      status: 'COMPLETED',
      createTime: new Date(Date.now() - 86400000),
      endTime: new Date(Date.now() - 43200000),
    } as any);

    // 创建当前活动任务
    const currentTask = await taskRepo.save({
      processInstanceId: instanceId,
      taskDefinitionKey: 'reviewTask',
      name: '复核任务',
      assignee: 'reviewer1',
      status: 'PENDING',
      createTime: new Date(),
    } as any);
    currentTaskId = currentTask.id;

    // 创建执行记录
    await executionRepo.save({
      id: 'exec-1',
      processInstanceId: instanceId,
      activityId: 'approveTask',
      activityName: '审批任务',
      isActive: false,
    } as any);

    await executionRepo.save({
      id: 'exec-2',
      processInstanceId: instanceId,
      activityId: 'reviewTask',
      activityName: '复核任务',
      isActive: true,
    } as any);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('PUT /api/v1/tasks/:id/reject', () => {
    it('应该成功驳回任务到指定节点', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${currentTaskId}/reject`)
        .send({
          targetActivityId: 'approveTask',
          reason: '需要重新审批',
          variables: {
            rejectReason: '材料不完整',
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('rejected', true);
      expect(response.body.data).toHaveProperty('targetActivityId', 'approveTask');
    });

    it('应该拒绝驳回不存在的任务', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/tasks/non-existent-task-id/reject')
        .send({
          targetActivityId: 'approveTask',
          reason: '需要重新审批',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });

    it('应该拒绝驳回已完成的任务', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/tasks/historical-task-1/reject')
        .send({
          targetActivityId: 'start',
          reason: '测试驳回已完成任务',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('应该拒绝驳回到无效的目标节点', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${currentTaskId}/reject`)
        .send({
          targetActivityId: 'non-existent-activity',
          reason: '测试无效目标',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('应该拒绝缺少驳回原因的请求', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${currentTaskId}/reject`)
        .send({
          targetActivityId: 'approveTask',
          // 缺少 reason
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /api/v1/tasks/:id/reject-targets', () => {
    it('应该返回可驳回的目标节点列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${currentTaskId}/reject-targets`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该返回404当任务不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tasks/non-existent-task-id/reject-targets')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('POST /api/v1/tasks/:id/reject-to-previous', () => {
    it('应该成功驳回任务到上一个节点', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${currentTaskId}/reject-to-previous`)
        .send({
          reason: '退回上一节点',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('rejected', true);
    });

    it('应该拒绝驳回没有上一个节点的任务', async () => {
      // 创建一个没有前置节点的任务
      const firstTask = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'firstTask',
        name: '第一个任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${firstTask.id}/reject-to-previous`)
        .send({
          reason: '退回上一节点',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('POST /api/v1/tasks/:id/reject-to-start', () => {
    it('应该成功驳回任务到开始节点', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${currentTaskId}/reject-to-start`)
        .send({
          reason: '退回发起人',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('rejected', true);
    });
  });

  describe('GET /api/v1/process-instances/:id/reject-history', () => {
    it('应该返回流程实例的驳回历史', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/process-instances/${instanceId}/reject-history`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该返回404当流程实例不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-instances/non-existent-id/reject-history')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('PUT /api/v1/tasks/:id/reject-with-strategy', () => {
    it('应该成功使用策略驳回任务', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${currentTaskId}/reject-with-strategy`)
        .send({
          strategy: 'SEQUENTIAL', // 串行退回
          targetActivityId: 'approveTask',
          reason: '按策略退回',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('rejected', true);
    });

    it('应该拒绝无效的驳回策略', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${currentTaskId}/reject-with-strategy`)
        .send({
          strategy: 'INVALID_STRATEGY',
          targetActivityId: 'approveTask',
          reason: '测试无效策略',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /api/v1/tasks/:id/reject-strategies', () => {
    it('应该返回可用的驳回策略列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${currentTaskId}/reject-strategies`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/tasks/batch-reject', () => {
    it('应该成功批量驳回任务', async () => {
      // 创建另一个任务用于批量驳回
      const anotherTask = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'anotherTask',
        name: '另一个任务',
        assignee: 'user2',
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .post('/api/v1/tasks/batch-reject')
        .send({
          taskIds: [currentTaskId, anotherTask.id],
          targetActivityId: 'approveTask',
          reason: '批量驳回',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('successCount');
      expect(response.body.data).toHaveProperty('failedCount');
    });

    it('应该拒绝空的任务ID列表', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tasks/batch-reject')
        .send({
          taskIds: [],
          targetActivityId: 'approveTask',
          reason: '批量驳回',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });
});
