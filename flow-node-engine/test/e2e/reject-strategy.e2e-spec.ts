/**
 * E2E 测试 - 退回策略 API
 * 测试退回策略相关的HTTP接口
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
import { RejectStrategy } from '../../src/task/entities/reject-strategy.entity';

// Module
import { TaskModule } from '../../src/task/task.module';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - 退回策略 API', () => {
  let app: INestApplication;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let rejectStrategyRepo: vi.Mocked<Repository<RejectStrategy>>;

  // 测试数据存储
  let tasks: Map<string, Task>;
  let processInstances: Map<string, ProcessInstance>;
  let processDefinitions: Map<string, ProcessDefinition>;
  let rejectStrategies: Map<string, RejectStrategy>;

  let definitionId: string;
  let instanceId: string;

  beforeEach(async () => {
    // 初始化数据存储
    tasks = new Map();
    processInstances = new Map();
    processDefinitions = new Map();
    rejectStrategies = new Map();

    // 创建mock repositories
    const createMockRepo = <T>(storage: Map<string, T>): vi.Mocked<Repository<T>> => {
      return {
        find: vi.fn(async () => Array.from(storage.values())),
        findOne: vi.fn(async (options: any) => {
          if (options?.where?.id) {
            return storage.get(options.where.id) || null;
          }
          if (options?.where?.processDefinitionId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.processDefinitionId === options.where.processDefinitionId
            ) as any;
          }
          if (options?.where?.activityId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.activityId === options.where.activityId
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
    rejectStrategyRepo = createMockRepo(rejectStrategies);

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
      .overrideProvider(getRepositoryToken(RejectStrategy))
      .useValue(rejectStrategyRepo)
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
      name: '退回策略测试流程',
      key: 'rejectStrategyTestProcess',
      version: 1,
      isActive: true,
    } as any);
    definitionId = definition.id;

    // 预先创建流程实例
    const instance = await processInstanceRepo.save({
      processDefinitionId: definitionId,
      businessKey: 'reject-strategy-test-biz-001',
      status: 'ACTIVE',
      startTime: new Date(),
    } as any);
    instanceId = instance.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/reject-strategies', () => {
    it('应该成功创建退回策略', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reject-strategies')
        .send({
          processDefinitionId: definitionId,
          activityId: 'reviewTask',
          strategyType: 'SEQUENTIAL',
          targetActivityId: 'approveTask',
          config: {
            allowMultiLevel: true,
            maxRetryCount: 3,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('strategyType', 'SEQUENTIAL');
    });

    it('应该拒绝缺少必要字段的请求', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reject-strategies')
        .send({
          processDefinitionId: definitionId,
          // 缺少 activityId 和 strategyType
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('应该拒绝无效的策略类型', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reject-strategies')
        .send({
          processDefinitionId: definitionId,
          activityId: 'reviewTask',
          strategyType: 'INVALID_TYPE',
          targetActivityId: 'approveTask',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /api/v1/reject-strategies', () => {
    beforeEach(async () => {
      await rejectStrategyRepo.save({
        processDefinitionId: definitionId,
        activityId: 'reviewTask',
        strategyType: 'SEQUENTIAL',
        targetActivityId: 'approveTask',
      } as any);

      await rejectStrategyRepo.save({
        processDefinitionId: definitionId,
        activityId: 'finalApproveTask',
        strategyType: 'PARALLEL',
        targetActivityId: 'start',
      } as any);
    });

    it('应该返回退回策略列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reject-strategies')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持按流程定义ID过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reject-strategies')
        .query({ processDefinitionId: definitionId })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.processDefinitionId).toBe(definitionId);
      });
    });

    it('应该支持按策略类型过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reject-strategies')
        .query({ strategyType: 'SEQUENTIAL' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.strategyType).toBe('SEQUENTIAL');
      });
    });
  });

  describe('GET /api/v1/reject-strategies/:id', () => {
    let strategyId: string;

    beforeEach(async () => {
      const result = await rejectStrategyRepo.save({
        processDefinitionId: definitionId,
        activityId: 'reviewTask',
        strategyType: 'SEQUENTIAL',
        targetActivityId: 'approveTask',
      } as any);
      strategyId = result.id;
    });

    it('应该返回指定退回策略详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reject-strategies/${strategyId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('id', strategyId);
      expect(response.body.data).toHaveProperty('strategyType', 'SEQUENTIAL');
    });

    it('应该返回404当策略不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reject-strategies/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('PUT /api/v1/reject-strategies/:id', () => {
    let strategyId: string;

    beforeEach(async () => {
      const result = await rejectStrategyRepo.save({
        processDefinitionId: definitionId,
        activityId: 'reviewTask',
        strategyType: 'SEQUENTIAL',
        targetActivityId: 'approveTask',
      } as any);
      strategyId = result.id;
    });

    it('应该成功更新退回策略', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/reject-strategies/${strategyId}`)
        .send({
          strategyType: 'PARALLEL',
          config: {
            allowMultiLevel: false,
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('strategyType', 'PARALLEL');
    });
  });

  describe('DELETE /api/v1/reject-strategies/:id', () => {
    let strategyId: string;

    beforeEach(async () => {
      const result = await rejectStrategyRepo.save({
        processDefinitionId: definitionId,
        activityId: 'reviewTask',
        strategyType: 'SEQUENTIAL',
        targetActivityId: 'approveTask',
      } as any);
      strategyId = result.id;
    });

    it('应该成功删除退回策略', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/reject-strategies/${strategyId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });

    it('应该返回404当删除不存在的策略时', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/reject-strategies/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/reject-strategies/process-definition/:processDefinitionId/activity/:activityId', () => {
    beforeEach(async () => {
      await rejectStrategyRepo.save({
        processDefinitionId: definitionId,
        activityId: 'reviewTask',
        strategyType: 'SEQUENTIAL',
        targetActivityId: 'approveTask',
      } as any);
    });

    it('应该返回指定活动的退回策略', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reject-strategies/process-definition/${definitionId}/activity/reviewTask`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('activityId', 'reviewTask');
    });

    it('应该返回404当策略不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reject-strategies/process-definition/${definitionId}/activity/non-existent-activity`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('POST /api/v1/reject-strategies/batch', () => {
    it('应该成功批量创建退回策略', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reject-strategies/batch')
        .send({
          processDefinitionId: definitionId,
          strategies: [
            {
              activityId: 'task1',
              strategyType: 'SEQUENTIAL',
              targetActivityId: 'start',
            },
            {
              activityId: 'task2',
              strategyType: 'PARALLEL',
              targetActivityId: 'task1',
            },
          ],
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('createdCount', 2);
    });

    it('应该拒绝空的策略列表', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reject-strategies/batch')
        .send({
          processDefinitionId: definitionId,
          strategies: [],
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /api/v1/reject-strategies/types', () => {
    it('应该返回可用的策略类型列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reject-strategies/types')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toContain('SEQUENTIAL');
      expect(response.body.data).toContain('PARALLEL');
    });
  });

  describe('POST /api/v1/reject-strategies/:id/validate', () => {
    let strategyId: string;

    beforeEach(async () => {
      const result = await rejectStrategyRepo.save({
        processDefinitionId: definitionId,
        activityId: 'reviewTask',
        strategyType: 'SEQUENTIAL',
        targetActivityId: 'approveTask',
      } as any);
      strategyId = result.id;
    });

    it('应该成功验证退回策略', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/reject-strategies/${strategyId}/validate`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('valid');
    });
  });

  describe('POST /api/v1/reject-strategies/preview', () => {
    it('应该成功预览退回路径', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/reject-strategies/preview')
        .send({
          processDefinitionId: definitionId,
          fromActivityId: 'reviewTask',
          toActivityId: 'approveTask',
          strategyType: 'SEQUENTIAL',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('path');
    });
  });
});
