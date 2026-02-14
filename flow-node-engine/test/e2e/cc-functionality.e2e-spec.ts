/**
 * E2E 测试 - 抄送功能 API
 * 测试抄送功能相关的HTTP接口
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
import { CcRecord } from '../../src/task/entities/cc-record.entity';

// Module
import { TaskModule } from '../../src/task/task.module';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - 抄送功能 API', () => {
  let app: INestApplication;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let ccRecordRepo: vi.Mocked<Repository<CcRecord>>;

  // 测试数据存储
  let tasks: Map<string, Task>;
  let processInstances: Map<string, ProcessInstance>;
  let processDefinitions: Map<string, ProcessDefinition>;
  let ccRecords: Map<string, CcRecord>;

  let definitionId: string;
  let instanceId: string;
  let taskId: string;

  beforeEach(async () => {
    // 初始化数据存储
    tasks = new Map();
    processInstances = new Map();
    processDefinitions = new Map();
    ccRecords = new Map();

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
          if (options?.where?.ccUserId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.ccUserId === options.where.ccUserId
            ) as any;
          }
          if (options?.where?.taskId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.taskId === options.where.taskId
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
    ccRecordRepo = createMockRepo(ccRecords);

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
      .overrideProvider(getRepositoryToken(CcRecord))
      .useValue(ccRecordRepo)
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
      name: '抄送测试流程',
      key: 'ccTestProcess',
      version: 1,
      isActive: true,
    } as any);
    definitionId = definition.id;

    // 预先创建流程实例
    const instance = await processInstanceRepo.save({
      processDefinitionId: definitionId,
      businessKey: 'cc-test-biz-001',
      status: 'ACTIVE',
      startTime: new Date(),
    } as any);
    instanceId = instance.id;

    // 创建任务
    const task = await taskRepo.save({
      processInstanceId: instanceId,
      taskDefinitionKey: 'approveTask',
      name: '审批任务',
      assignee: 'approver1',
      status: 'PENDING',
      createTime: new Date(),
    } as any);
    taskId = task.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/tasks/:id/cc', () => {
    it('应该成功抄送任务给单个用户', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/cc`)
        .send({
          ccUserIds: ['user1'],
          message: '请查阅此任务',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('ccCount', 1);
    });

    it('应该成功抄送任务给多个用户', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/cc`)
        .send({
          ccUserIds: ['user1', 'user2', 'user3'],
          message: '请查阅此任务',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('ccCount', 3);
    });

    it('应该拒绝空的用户列表', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/tasks/${taskId}/cc`)
        .send({
          ccUserIds: [],
          message: '请查阅此任务',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('应该返回404当任务不存在时', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tasks/non-existent-task-id/cc')
        .send({
          ccUserIds: ['user1'],
          message: '请查阅此任务',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('POST /api/v1/process-instances/:id/cc', () => {
    it('应该成功抄送流程实例给用户', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/process-instances/${instanceId}/cc`)
        .send({
          ccUserIds: ['user1', 'user2'],
          message: '请关注此流程',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('ccCount', 2);
    });

    it('应该返回404当流程实例不存在时', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/process-instances/non-existent-id/cc')
        .send({
          ccUserIds: ['user1'],
          message: '请关注此流程',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/cc/my', () => {
    const userId = 'user1';

    beforeEach(async () => {
      // 创建抄送记录
      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: userId,
        ccUserName: '测试用户1',
        message: '请查阅',
        createTime: new Date(),
        isRead: false,
      } as any);

      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: userId,
        ccUserName: '测试用户1',
        message: '请关注',
        createTime: new Date(),
        isRead: true,
      } as any);
    });

    it('应该返回当前用户的抄送列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cc/my')
        .set('X-User-Id', userId)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cc/my')
        .set('X-User-Id', userId)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('page', 1);
    });

    it('应该支持按已读/未读过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cc/my')
        .set('X-User-Id', userId)
        .query({ isRead: false })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.isRead).toBe(false);
      });
    });
  });

  describe('GET /api/v1/cc/unread-count', () => {
    const userId = 'user1';

    beforeEach(async () => {
      // 创建已读和未读抄送记录
      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: userId,
        isRead: false,
        createTime: new Date(),
      } as any);

      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: userId,
        isRead: false,
        createTime: new Date(),
      } as any);

      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: userId,
        isRead: true,
        createTime: new Date(),
      } as any);
    });

    it('应该返回未读抄送数量', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/cc/unread-count')
        .set('X-User-Id', userId)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('unreadCount');
      expect(response.body.data.unreadCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('PUT /api/v1/cc/:id/read', () => {
    let ccId: string;

    beforeEach(async () => {
      const result = await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: 'user1',
        isRead: false,
        createTime: new Date(),
      } as any);
      ccId = result.id;
    });

    it('应该成功标记抄送为已读', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/cc/${ccId}/read`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('isRead', true);
    });

    it('应该返回404当抄送记录不存在时', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/cc/non-existent-id/read')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('PUT /api/v1/cc/batch-read', () => {
    let ccIds: string[];

    beforeEach(async () => {
      const result1 = await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: 'user1',
        isRead: false,
        createTime: new Date(),
      } as any);

      const result2 = await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: 'user1',
        isRead: false,
        createTime: new Date(),
      } as any);

      ccIds = [result1.id, result2.id];
    });

    it('应该成功批量标记抄送为已读', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/cc/batch-read')
        .send({
          ccIds: ccIds,
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('updatedCount', 2);
    });

    it('应该拒绝空的ID列表', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/cc/batch-read')
        .send({
          ccIds: [],
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('PUT /api/v1/cc/read-all', () => {
    const userId = 'user1';

    beforeEach(async () => {
      // 创建多个未读抄送记录
      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: userId,
        isRead: false,
        createTime: new Date(),
      } as any);

      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: userId,
        isRead: false,
        createTime: new Date(),
      } as any);
    });

    it('应该成功标记所有抄送为已读', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/cc/read-all')
        .set('X-User-Id', userId)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('updatedCount');
    });
  });

  describe('DELETE /api/v1/cc/:id', () => {
    let ccId: string;

    beforeEach(async () => {
      const result = await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: 'user1',
        isRead: true,
        createTime: new Date(),
      } as any);
      ccId = result.id;
    });

    it('应该成功删除抄送记录', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/cc/${ccId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });

    it('应该返回404当抄送记录不存在时', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/cc/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/tasks/:id/cc-records', () => {
    beforeEach(async () => {
      // 创建任务的抄送记录
      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: 'user1',
        ccUserName: '用户1',
        message: '请查阅',
        createTime: new Date(),
      } as any);

      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: 'user2',
        ccUserName: '用户2',
        message: '请关注',
        createTime: new Date(),
      } as any);
    });

    it('应该返回任务的抄送记录列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskId}/cc-records`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该返回404当任务不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/tasks/non-existent-task-id/cc-records')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/process-instances/:id/cc-records', () => {
    beforeEach(async () => {
      // 创建流程实例的抄送记录
      await ccRecordRepo.save({
        taskId: taskId,
        processInstanceId: instanceId,
        ccUserId: 'user1',
        message: '流程抄送',
        createTime: new Date(),
      } as any);
    });

    it('应该返回流程实例的抄送记录列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/process-instances/${instanceId}/cc-records`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });
});
