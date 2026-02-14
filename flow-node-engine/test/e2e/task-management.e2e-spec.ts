/**
 * E2E 测试 - 任务管理 API
 * 测试任务管理相关的HTTP接口
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
import { IdentityLink } from '../../src/identity-link/entities/identity-link.entity';

// Module
import { TaskModule } from '../../src/task/task.module';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { IdentityLinkModule } from '../../src/identity-link/identity-link.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - 任务管理 API', () => {
  let app: INestApplication;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let identityLinkRepo: vi.Mocked<Repository<IdentityLink>>;

  // 测试数据存储
  let tasks: Map<string, Task>;
  let processInstances: Map<string, ProcessInstance>;
  let processDefinitions: Map<string, ProcessDefinition>;
  let identityLinks: Map<string, IdentityLink>;

  let definitionId: string;
  let instanceId: string;

  beforeEach(async () => {
    // 初始化数据存储
    tasks = new Map();
    processInstances = new Map();
    processDefinitions = new Map();
    identityLinks = new Map();

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
          if (options?.where?.taskId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.taskId === options.where.taskId
            ) as any;
          }
          if (options?.where?.assignee) {
            return Array.from(storage.values()).filter(
              (item: any) => item.assignee === options.where.assignee
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
    identityLinkRepo = createMockRepo(identityLinks);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CoreModule, ProcessDefinitionModule, ProcessInstanceModule, TaskModule, IdentityLinkModule],
    })
      .overrideProvider(getRepositoryToken(Task))
      .useValue(taskRepo)
      .overrideProvider(getRepositoryToken(ProcessInstance))
      .useValue(processInstanceRepo)
      .overrideProvider(getRepositoryToken(ProcessDefinition))
      .useValue(processDefinitionRepo)
      .overrideProvider(getRepositoryToken(IdentityLink))
      .useValue(identityLinkRepo)
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
      name: '任务测试流程',
      key: 'taskTestProcess',
      version: 1,
      isActive: true,
    } as any);
    definitionId = definition.id;

    // 预先创建流程实例
    const instance = await processInstanceRepo.save({
      processDefinitionId: definitionId,
      businessKey: 'task-test-biz-001',
      status: 'ACTIVE',
      startTime: new Date(),
    } as any);
    instanceId = instance.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/tasks', () => {
    beforeEach(async () => {
      // 预先创建一些测试任务
      await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'task1',
        name: '用户任务1',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'task2',
        name: '用户任务2',
        assignee: 'user2',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
    });

    it('应该返回任务列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('pageSize', 10);
    });

    it('应该支持按受理人过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ assignee: 'user1' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.assignee).toBe('user1');
      });
    });

    it('应该支持按流程实例ID过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ processInstanceId: instanceId })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.processInstanceId).toBe(instanceId);
      });
    });

    it('应该支持按状态过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ status: 'PENDING' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.status).toBe('PENDING');
      });
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'detailTask',
        name: '详情查询任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该返回指定任务详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('id', taskId);
      expect(response.body.data).toHaveProperty('name', '详情查询任务');
    });

    it('应该返回404当任务不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tasks/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('PUT /api/v1/tasks/:id/complete', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'completeTask',
        name: '完成测试任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功完成任务', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/complete`)
        .send({
          variables: {
            approved: true,
            comment: '同意',
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('status', 'COMPLETED');
    });

    it('应该拒绝完成已完成的任务', async () => {
      // 先完成任务
      await taskRepo.save({
        id: taskId,
        status: 'COMPLETED',
        endTime: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/complete`)
        .send({
          variables: { approved: true },
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('PUT /api/v1/tasks/:id/claim', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'claimTask',
        name: '认领测试任务',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功认领任务', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/claim`)
        .send({
          userId: 'user1',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('assignee', 'user1');
    });

    it('应该拒绝认领已被认领的任务', async () => {
      // 先认领任务
      await taskRepo.save({
        id: taskId,
        assignee: 'user2',
      } as any);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/claim`)
        .send({
          userId: 'user1',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('PUT /api/v1/tasks/:id/unclaim', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'unclaimTask',
        name: '取消认领测试任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功取消认领任务', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/unclaim`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data.assignee).toBeNull();
    });
  });

  describe('PUT /api/v1/tasks/:id/delegate', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'delegateTask',
        name: '委派测试任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功委派任务', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/delegate`)
        .send({
          userId: 'user2',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('delegate', 'user2');
      expect(response.body.data).toHaveProperty('owner', 'user1');
    });
  });

  describe('PUT /api/v1/tasks/:id/assign', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'assignTask',
        name: '转办测试任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功转办任务', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/assign`)
        .send({
          userId: 'user2',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('assignee', 'user2');
    });
  });

  describe('PUT /api/v1/tasks/:id/resolve', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'resolveTask',
        name: '归还测试任务',
        assignee: 'user2',
        owner: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功归还委派任务', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/resolve`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('assignee', 'user1');
    });
  });

  describe('POST /api/v1/tasks/:id/comments', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'commentTask',
        name: '评论测试任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功添加任务评论', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/comments`)
        .send({
          message: '这是一条评论',
          userId: 'user1',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('message', '这是一条评论');
    });
  });

  describe('GET /api/v1/tasks/:id/comments', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'listCommentTask',
        name: '评论列表测试任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该返回任务评论列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskId}/comments`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('PUT /api/v1/tasks/:id/priority', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'priorityTask',
        name: '优先级测试任务',
        assignee: 'user1',
        priority: 50,
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功更新任务优先级', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/priority`)
        .send({
          priority: 100,
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('priority', 100);
    });
  });

  describe('PUT /api/v1/tasks/:id/due-date', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'dueDateTask',
        name: '到期日测试任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功更新任务到期日', async () => {
      const dueDate = new Date('2026-12-31T23:59:59Z');
      const response = await request(app.getHttpServer())
        .put(`/api/v1/tasks/${taskId}/due-date`)
        .send({
          dueDate: dueDate.toISOString(),
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('dueDate');
    });
  });
});
