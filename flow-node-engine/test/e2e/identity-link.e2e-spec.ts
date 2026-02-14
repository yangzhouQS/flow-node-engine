/**
 * E2E 测试 - 身份链接 API
 * 测试身份链接相关的HTTP接口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule, INestApplication } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

// Entities
import { IdentityLink } from '../../src/identity-link/entities/identity-link.entity';
import { Task } from '../../src/task/entities/task.entity';
import { ProcessInstance } from '../../src/process-instance/entities/process-instance.entity';
import { ProcessDefinition } from '../../src/process-definition/entities/process-definition.entity';

// Module
import { IdentityLinkModule } from '../../src/identity-link/identity-link.module';
import { TaskModule } from '../../src/task/task.module';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - 身份链接 API', () => {
  let app: INestApplication;
  let identityLinkRepo: vi.Mocked<Repository<IdentityLink>>;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;

  // 测试数据存储
  let identityLinks: Map<string, IdentityLink>;
  let tasks: Map<string, Task>;
  let processInstances: Map<string, ProcessInstance>;
  let processDefinitions: Map<string, ProcessDefinition>;

  let definitionId: string;
  let instanceId: string;
  let taskId: string;

  beforeEach(async () => {
    // 初始化数据存储
    identityLinks = new Map();
    tasks = new Map();
    processInstances = new Map();
    processDefinitions = new Map();

    // 创建mock repositories
    const createMockRepo = <T>(storage: Map<string, T>): vi.Mocked<Repository<T>> => {
      return {
        find: vi.fn(async () => Array.from(storage.values())),
        findOne: vi.fn(async (options: any) => {
          if (options?.where?.id) {
            return storage.get(options.where.id) || null;
          }
          if (options?.where?.taskId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.taskId === options.where.taskId
            ) as any;
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

    identityLinkRepo = createMockRepo(identityLinks);
    taskRepo = createMockRepo(tasks);
    processInstanceRepo = createMockRepo(processInstances);
    processDefinitionRepo = createMockRepo(processDefinitions);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        CoreModule,
        ProcessDefinitionModule,
        ProcessInstanceModule,
        TaskModule,
        IdentityLinkModule,
      ],
    })
      .overrideProvider(getRepositoryToken(IdentityLink))
      .useValue(identityLinkRepo)
      .overrideProvider(getRepositoryToken(Task))
      .useValue(taskRepo)
      .overrideProvider(getRepositoryToken(ProcessInstance))
      .useValue(processInstanceRepo)
      .overrideProvider(getRepositoryToken(ProcessDefinition))
      .useValue(processDefinitionRepo)
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
      name: '身份链接测试流程',
      key: 'identityLinkTestProcess',
      version: 1,
      isActive: true,
    } as any);
    definitionId = definition.id;

    // 预先创建流程实例
    const instance = await processInstanceRepo.save({
      processDefinitionId: definitionId,
      businessKey: 'identity-link-test-biz-001',
      status: 'ACTIVE',
      startTime: new Date(),
    } as any);
    instanceId = instance.id;

    // 预先创建任务
    const task = await taskRepo.save({
      processInstanceId: instanceId,
      taskDefinitionKey: 'task1',
      name: '测试任务',
      status: 'PENDING',
      createTime: new Date(),
    } as any);
    taskId = task.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/identity-links/task/:taskId', () => {
    it('应该成功添加任务候选人', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/identity-links/task/${taskId}`)
        .send({
          type: 'candidate',
          userType: 'user',
          userId: 'user1',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('taskId', taskId);
      expect(response.body.data).toHaveProperty('type', 'candidate');
      expect(response.body.data).toHaveProperty('userId', 'user1');
    });

    it('应该成功添加任务候选组', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/identity-links/task/${taskId}`)
        .send({
          type: 'candidate',
          userType: 'group',
          groupId: 'group1',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('taskId', taskId);
      expect(response.body.data).toHaveProperty('type', 'candidate');
      expect(response.body.data).toHaveProperty('groupId', 'group1');
    });

    it('应该拒绝缺少必要字段的请求', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/identity-links/task/${taskId}`)
        .send({
          type: 'candidate',
          // 缺少 userType 和 userId/groupId
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('应该返回404当任务不存在时', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/identity-links/task/non-existent-task-id')
        .send({
          type: 'candidate',
          userType: 'user',
          userId: 'user1',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/identity-links/task/:taskId', () => {
    beforeEach(async () => {
      // 添加身份链接
      await identityLinkRepo.save({
        taskId: taskId,
        type: 'candidate',
        userType: 'user',
        userId: 'user1',
      } as any);

      await identityLinkRepo.save({
        taskId: taskId,
        type: 'candidate',
        userType: 'group',
        groupId: 'group1',
      } as any);
    });

    it('应该返回任务的身份链接列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/identity-links/task/${taskId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持按类型过滤', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/identity-links/task/${taskId}`)
        .query({ type: 'candidate' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.type).toBe('candidate');
      });
    });
  });

  describe('DELETE /api/v1/identity-links/task/:taskId', () => {
    let linkId: string;

    beforeEach(async () => {
      const result = await identityLinkRepo.save({
        taskId: taskId,
        type: 'candidate',
        userType: 'user',
        userId: 'user1',
      } as any);
      linkId = result.id;
    });

    it('应该成功删除任务身份链接', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/identity-links/task/${taskId}`)
        .send({
          type: 'candidate',
          userType: 'user',
          userId: 'user1',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });

  describe('POST /api/v1/identity-links/process-instance/:processInstanceId', () => {
    it('应该成功添加流程实例参与者', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/identity-links/process-instance/${instanceId}`)
        .send({
          type: 'participant',
          userType: 'user',
          userId: 'user1',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('processInstanceId', instanceId);
      expect(response.body.data).toHaveProperty('type', 'participant');
    });

    it('应该返回404当流程实例不存在时', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/identity-links/process-instance/non-existent-id')
        .send({
          type: 'participant',
          userType: 'user',
          userId: 'user1',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/identity-links/process-instance/:processInstanceId', () => {
    beforeEach(async () => {
      // 添加流程实例身份链接
      await identityLinkRepo.save({
        processInstanceId: instanceId,
        type: 'participant',
        userType: 'user',
        userId: 'user1',
      } as any);

      await identityLinkRepo.save({
        processInstanceId: instanceId,
        type: 'participant',
        userType: 'user',
        userId: 'user2',
      } as any);
    });

    it('应该返回流程实例的身份链接列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/identity-links/process-instance/${instanceId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('DELETE /api/v1/identity-links/process-instance/:processInstanceId', () => {
    beforeEach(async () => {
      await identityLinkRepo.save({
        processInstanceId: instanceId,
        type: 'participant',
        userType: 'user',
        userId: 'user1',
      } as any);
    });

    it('应该成功删除流程实例身份链接', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/identity-links/process-instance/${instanceId}`)
        .send({
          type: 'participant',
          userType: 'user',
          userId: 'user1',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });

  describe('POST /api/v1/identity-links/process-definition/:processDefinitionId', () => {
    it('应该成功添加流程定义候选人', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/identity-links/process-definition/${definitionId}`)
        .send({
          type: 'candidate_starter',
          userType: 'user',
          userId: 'user1',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('processDefinitionId', definitionId);
      expect(response.body.data).toHaveProperty('type', 'candidate_starter');
    });
  });

  describe('GET /api/v1/identity-links/process-definition/:processDefinitionId', () => {
    beforeEach(async () => {
      await identityLinkRepo.save({
        processDefinitionId: definitionId,
        type: 'candidate_starter',
        userType: 'user',
        userId: 'user1',
      } as any);

      await identityLinkRepo.save({
        processDefinitionId: definitionId,
        type: 'candidate_starter',
        userType: 'group',
        groupId: 'group1',
      } as any);
    });

    it('应该返回流程定义的身份链接列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/identity-links/process-definition/${definitionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('DELETE /api/v1/identity-links/process-definition/:processDefinitionId', () => {
    beforeEach(async () => {
      await identityLinkRepo.save({
        processDefinitionId: definitionId,
        type: 'candidate_starter',
        userType: 'user',
        userId: 'user1',
      } as any);
    });

    it('应该成功删除流程定义身份链接', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/identity-links/process-definition/${definitionId}`)
        .send({
          type: 'candidate_starter',
          userType: 'user',
          userId: 'user1',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });

  describe('GET /api/v1/identity-links/users/:userId/tasks', () => {
    const userId = 'user1';

    beforeEach(async () => {
      // 创建用户作为候选人的身份链接
      await identityLinkRepo.save({
        taskId: taskId,
        type: 'candidate',
        userType: 'user',
        userId: userId,
      } as any);
    });

    it('应该返回用户可认领的任务列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/identity-links/users/${userId}/tasks`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/identity-links/users/${userId}/tasks`)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('meta');
    });
  });

  describe('GET /api/v1/identity-links/groups/:groupId/tasks', () => {
    const groupId = 'group1';

    beforeEach(async () => {
      // 创建组作为候选人的身份链接
      await identityLinkRepo.save({
        taskId: taskId,
        type: 'candidate',
        userType: 'group',
        groupId: groupId,
      } as any);
    });

    it('应该返回组可认领的任务列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/identity-links/groups/${groupId}/tasks`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
