/**
 * E2E 测试 - WebSocket 进度推送
 * 测试WebSocket进度推送相关的HTTP接口
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
import { Task } from '../../src/task/entities/task.entity';
import { ProgressSubscription } from '../../src/progress-tracking/entities/progress-subscription.entity';

// Module
import { ProgressTrackingModule } from '../../src/progress-tracking/progress-tracking.module';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { TaskModule } from '../../src/task/task.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - WebSocket 进度推送 API', () => {
  let app: INestApplication;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let progressSubscriptionRepo: vi.Mocked<Repository<ProgressSubscription>>;

  // 测试数据存储
  let processInstances: Map<string, ProcessInstance>;
  let processDefinitions: Map<string, ProcessDefinition>;
  let tasks: Map<string, Task>;
  let progressSubscriptions: Map<string, ProgressSubscription>;

  let definitionId: string;
  let instanceId: string;

  beforeEach(async () => {
    // 初始化数据存储
    processInstances = new Map();
    processDefinitions = new Map();
    tasks = new Map();
    progressSubscriptions = new Map();

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
          if (options?.where?.userId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.userId === options.where.userId
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
    taskRepo = createMockRepo(tasks);
    progressSubscriptionRepo = createMockRepo(progressSubscriptions);

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
      .overrideProvider(getRepositoryToken(Task))
      .useValue(taskRepo)
      .overrideProvider(getRepositoryToken(ProgressSubscription))
      .useValue(progressSubscriptionRepo)
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
      name: 'WebSocket进度测试流程',
      key: 'wsProgressTestProcess',
      version: 1,
      isActive: true,
    } as any);
    definitionId = definition.id;

    // 预先创建流程实例
    const instance = await processInstanceRepo.save({
      processDefinitionId: definitionId,
      businessKey: 'ws-progress-test-biz-001',
      status: 'ACTIVE',
      startTime: new Date(),
    } as any);
    instanceId = instance.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/websocket/subscriptions', () => {
    it('应该成功创建WebSocket订阅', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/websocket/subscriptions')
        .send({
          userId: 'user1',
          processInstanceId: instanceId,
          events: ['TASK_CREATED', 'TASK_COMPLETED', 'PROCESS_COMPLETED'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('userId', 'user1');
    });

    it('应该拒绝缺少必要字段的请求', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/websocket/subscriptions')
        .send({
          // 缺少 userId 和 events
          processInstanceId: instanceId,
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('应该拒绝无效的事件类型', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/websocket/subscriptions')
        .send({
          userId: 'user1',
          processInstanceId: instanceId,
          events: ['INVALID_EVENT'],
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /api/v1/websocket/subscriptions', () => {
    const userId = 'user1';

    beforeEach(async () => {
      await progressSubscriptionRepo.save({
        userId: userId,
        processInstanceId: instanceId,
        events: ['TASK_CREATED', 'TASK_COMPLETED'],
        isActive: true,
      } as any);

      await progressSubscriptionRepo.save({
        userId: userId,
        processDefinitionId: definitionId,
        events: ['PROCESS_STARTED', 'PROCESS_COMPLETED'],
        isActive: true,
      } as any);
    });

    it('应该返回用户的订阅列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/websocket/subscriptions')
        .set('X-User-Id', userId)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/websocket/subscriptions')
        .set('X-User-Id', userId)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('meta');
    });
  });

  describe('GET /api/v1/websocket/subscriptions/:id', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const result = await progressSubscriptionRepo.save({
        userId: 'user1',
        processInstanceId: instanceId,
        events: ['TASK_CREATED'],
        isActive: true,
      } as any);
      subscriptionId = result.id;
    });

    it('应该返回指定订阅详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/websocket/subscriptions/${subscriptionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('id', subscriptionId);
    });

    it('应该返回404当订阅不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/websocket/subscriptions/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('PUT /api/v1/websocket/subscriptions/:id', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const result = await progressSubscriptionRepo.save({
        userId: 'user1',
        processInstanceId: instanceId,
        events: ['TASK_CREATED'],
        isActive: true,
      } as any);
      subscriptionId = result.id;
    });

    it('应该成功更新订阅', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/websocket/subscriptions/${subscriptionId}`)
        .send({
          events: ['TASK_CREATED', 'TASK_COMPLETED', 'PROCESS_COMPLETED'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data.events.length).toBe(3);
    });
  });

  describe('DELETE /api/v1/websocket/subscriptions/:id', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const result = await progressSubscriptionRepo.save({
        userId: 'user1',
        processInstanceId: instanceId,
        events: ['TASK_CREATED'],
        isActive: true,
      } as any);
      subscriptionId = result.id;
    });

    it('应该成功删除订阅', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/websocket/subscriptions/${subscriptionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });

  describe('PUT /api/v1/websocket/subscriptions/:id/deactivate', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const result = await progressSubscriptionRepo.save({
        userId: 'user1',
        processInstanceId: instanceId,
        events: ['TASK_CREATED'],
        isActive: true,
      } as any);
      subscriptionId = result.id;
    });

    it('应该成功停用订阅', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/websocket/subscriptions/${subscriptionId}/deactivate`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('isActive', false);
    });
  });

  describe('PUT /api/v1/websocket/subscriptions/:id/activate', () => {
    let subscriptionId: string;

    beforeEach(async () => {
      const result = await progressSubscriptionRepo.save({
        userId: 'user1',
        processInstanceId: instanceId,
        events: ['TASK_CREATED'],
        isActive: false,
      } as any);
      subscriptionId = result.id;
    });

    it('应该成功激活订阅', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/websocket/subscriptions/${subscriptionId}/activate`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('isActive', true);
    });
  });

  describe('GET /api/v1/websocket/events', () => {
    it('应该返回可用的事件类型列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/websocket/events')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toContain('TASK_CREATED');
      expect(response.body.data).toContain('TASK_COMPLETED');
      expect(response.body.data).toContain('PROCESS_STARTED');
      expect(response.body.data).toContain('PROCESS_COMPLETED');
    });
  });

  describe('POST /api/v1/websocket/broadcast', () => {
    it('应该成功发送广播消息', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/websocket/broadcast')
        .send({
          event: 'SYSTEM_NOTIFICATION',
          payload: {
            message: '系统维护通知',
            level: 'warning',
          },
          targetUsers: ['user1', 'user2'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('sent', true);
    });

    it('应该拒绝缺少必要字段的请求', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/websocket/broadcast')
        .send({
          // 缺少 event 和 payload
          targetUsers: ['user1'],
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('POST /api/v1/websocket/notify/process-instance/:id', () => {
    it('应该成功发送流程实例通知', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/websocket/notify/process-instance/${instanceId}`)
        .send({
          event: 'PROCESS_PROGRESS',
          message: '流程进度更新',
          progress: 50,
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('notified', true);
    });

    it('应该返回404当流程实例不存在时', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/websocket/notify/process-instance/non-existent-id')
        .send({
          event: 'PROCESS_PROGRESS',
          message: '测试通知',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('POST /api/v1/websocket/notify/task/:id', () => {
    let taskId: string;

    beforeEach(async () => {
      const result = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'task1',
        name: '测试任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      taskId = result.id;
    });

    it('应该成功发送任务通知', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/websocket/notify/task/${taskId}`)
        .send({
          event: 'TASK_DUE_REMINDER',
          message: '任务即将到期',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('notified', true);
    });

    it('应该返回404当任务不存在时', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/websocket/notify/task/non-existent-id')
        .send({
          event: 'TASK_REMINDER',
          message: '测试通知',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/websocket/connection-status', () => {
    it('应该返回WebSocket连接状态', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/websocket/connection-status')
        .set('X-User-Id', 'user1')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('connected');
    });
  });

  describe('GET /api/v1/websocket/stats', () => {
    it('应该返回WebSocket统计信息', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/websocket/stats')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('totalConnections');
      expect(response.body.data).toHaveProperty('activeSubscriptions');
    });
  });
});
