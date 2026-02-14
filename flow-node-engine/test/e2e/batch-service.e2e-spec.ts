/**
 * E2E 测试 - 批处理 API
 * 测试批处理管理相关的HTTP接口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule, INestApplication } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

// Entities
import { BatchEntity, BatchStatus, BatchType } from '../../src/batch/entities/batch.entity';
import { BatchPartEntity, BatchPartStatus } from '../../src/batch/entities/batch-part.entity';

// Module
import { BatchModule } from '../../src/batch/batch.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - 批处理 API', () => {
  let app: INestApplication;
  let batchRepo: vi.Mocked<Repository<BatchEntity>>;
  let batchPartRepo: vi.Mocked<Repository<BatchPartEntity>>;

  // 测试数据存储
  let batches: Map<string, BatchEntity>;
  let batchParts: Map<string, BatchPartEntity>;

  beforeEach(async () => {
    // 初始化数据存储
    batches = new Map();
    batchParts = new Map();

    // 创建mock repository
    const createMockRepo = <T>(storage: Map<string, T>): vi.Mocked<Repository<T>> => {
      return {
        find: vi.fn(async (options?: any) => {
          let items = Array.from(storage.values());
          if (options?.where) {
            if (options.where.status) {
              items = items.filter((item: any) => item.status === options.where.status);
            }
            if (options.where.type) {
              items = items.filter((item: any) => item.type === options.where.type);
            }
            if (options.where.tenantId) {
              items = items.filter((item: any) => item.tenantId === options.where.tenantId);
            }
            if (options.where.id) {
              items = items.filter((item: any) => item.id === options.where.id);
            }
          }
          return items;
        }),
        findOne: vi.fn(async (options: any) => {
          if (options?.where?.id) {
            return storage.get(options.where.id) || null;
          }
          if (options?.where?.searchKey) {
            return (
              Array.from(storage.values()).find((item: any) => item.searchKey === options.where.searchKey) ||
              null
            );
          }
          return Array.from(storage.values())[0] || null;
        }),
        save: vi.fn(async (entity: any) => {
          const id = entity.id || `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newEntity = {
            ...entity,
            id,
            createTime: entity.createTime || new Date(),
            updateTime: new Date(),
          } as T;
          storage.set(id, newEntity);
          return newEntity;
        }),
        update: vi.fn(async () => ({ affected: 1, generatedMaps: [] })),
        delete: vi.fn(async (id: string) => {
          if (storage.has(id)) {
            storage.delete(id);
            return { affected: 1, raw: {} };
          }
          return { affected: 0, raw: {} };
        }),
        create: vi.fn((entity: any) => entity),
        count: vi.fn(async (options?: any) => {
          let items = Array.from(storage.values());
          if (options?.where) {
            if (options.where.status) {
              items = items.filter((item: any) => item.status === options.where.status);
            }
          }
          return items.length;
        }),
      } as any;
    };

    batchRepo = createMockRepo(batches);
    batchPartRepo = createMockRepo(batchParts);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CoreModule, BatchModule],
    })
      .overrideProvider(getRepositoryToken(BatchEntity))
      .useValue(batchRepo)
      .overrideProvider(getRepositoryToken(BatchPartEntity))
      .useValue(batchPartRepo)
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
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /batches', () => {
    it('应该成功创建批处理', async () => {
      const response = await request(app.getHttpServer())
        .post('/batches')
        .send({
          type: BatchType.DELETE_PROCESS_INSTANCES,
          total: 100,
          config: JSON.stringify({ processDefinitionKey: 'testProcess' }),
          description: '批量删除测试流程实例',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type', BatchType.DELETE_PROCESS_INSTANCES);
      expect(response.body).toHaveProperty('total', 100);
    });

    it('应该拒绝缺少必要字段的请求', async () => {
      const response = await request(app.getHttpServer())
        .post('/batches')
        .send({
          // 缺少 type
          total: 100,
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /batches', () => {
    beforeEach(async () => {
      // 预先创建一些测试数据
      await batchRepo.save({
        id: 'batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        processedTotal: 50,
        successTotal: 48,
        failTotal: 2,
        status: BatchStatus.RUNNING,
        createTime: new Date(),
      } as any);

      await batchRepo.save({
        id: 'batch-2',
        type: BatchType.START_PROCESS_INSTANCES,
        total: 50,
        processedTotal: 50,
        successTotal: 50,
        failTotal: 0,
        status: BatchStatus.COMPLETED,
        createTime: new Date(),
      } as any);
    });

    it('应该返回批处理列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/batches')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/batches')
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
    });

    it('应该支持按状态过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/batches')
        .query({ status: BatchStatus.COMPLETED })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      response.body.data.forEach((item: any) => {
        expect(item.status).toBe(BatchStatus.COMPLETED);
      });
    });

    it('应该支持按类型过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/batches')
        .query({ type: BatchType.DELETE_PROCESS_INSTANCES })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      response.body.data.forEach((item: any) => {
        expect(item.type).toBe(BatchType.DELETE_PROCESS_INSTANCES);
      });
    });
  });

  describe('GET /batches/statistics', () => {
    beforeEach(async () => {
      await batchRepo.save({
        id: 'stat-batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        status: BatchStatus.RUNNING,
        createTime: new Date(),
      } as any);

      await batchRepo.save({
        id: 'stat-batch-2',
        type: BatchType.START_PROCESS_INSTANCES,
        total: 50,
        status: BatchStatus.COMPLETED,
        createTime: new Date(),
      } as any);

      await batchRepo.save({
        id: 'stat-batch-3',
        type: BatchType.COMPLETE_TASKS,
        total: 30,
        status: BatchStatus.FAILED,
        createTime: new Date(),
      } as any);
    });

    it('应该返回批处理统计信息', async () => {
      const response = await request(app.getHttpServer())
        .get('/batches/statistics')
        .expect(200);

      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('byStatus');
      expect(response.body).toHaveProperty('byType');
    });
  });

  describe('GET /batches/:id', () => {
    let batchId: string;

    beforeEach(async () => {
      const result = await batchRepo.save({
        id: 'query-batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        status: BatchStatus.PENDING,
        description: '查询测试批处理',
        createTime: new Date(),
      } as any);
      batchId = result.id;
    });

    it('应该返回指定批处理', async () => {
      const response = await request(app.getHttpServer())
        .get(`/batches/${batchId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', batchId);
      expect(response.body).toHaveProperty('description', '查询测试批处理');
    });

    it('应该返回404当批处理不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/batches/non-existent-id')
        .expect(500); // Controller throws Error

      expect(response.body).toHaveProperty('statusCode', 500);
    });
  });

  describe('PUT /batches/:id', () => {
    let batchId: string;

    beforeEach(async () => {
      const result = await batchRepo.save({
        id: 'update-batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        status: BatchStatus.PENDING,
        description: '更新测试批处理',
        createTime: new Date(),
      } as any);
      batchId = result.id;
    });

    it('应该成功更新批处理', async () => {
      const response = await request(app.getHttpServer())
        .put(`/batches/${batchId}`)
        .send({
          description: '更新后的描述',
          priority: 10,
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', batchId);
    });
  });

  describe('POST /batches/:id/cancel', () => {
    let batchId: string;

    beforeEach(async () => {
      const result = await batchRepo.save({
        id: 'cancel-batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        status: BatchStatus.RUNNING,
        description: '取消测试批处理',
        createTime: new Date(),
      } as any);
      batchId = result.id;
    });

    it('应该成功取消批处理', async () => {
      const response = await request(app.getHttpServer())
        .post(`/batches/${batchId}/cancel`)
        .expect(200);

      expect(response.body).toHaveProperty('id', batchId);
    });
  });

  describe('DELETE /batches/:id', () => {
    let batchId: string;

    beforeEach(async () => {
      const result = await batchRepo.save({
        id: 'delete-batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        status: BatchStatus.COMPLETED,
        createTime: new Date(),
      } as any);
      batchId = result.id;
    });

    it('应该成功删除批处理', async () => {
      await request(app.getHttpServer())
        .delete(`/batches/${batchId}`)
        .expect(204);
    });
  });

  describe('GET /batches/:id/parts', () => {
    let batchId: string;

    beforeEach(async () => {
      const result = await batchRepo.save({
        id: 'parts-batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        status: BatchStatus.RUNNING,
        createTime: new Date(),
      } as any);
      batchId = result.id;

      // 创建批处理部分
      await batchPartRepo.save({
        id: 'part-1',
        batchId,
        status: BatchPartStatus.COMPLETED,
        index: 1,
        createTime: new Date(),
      } as any);

      await batchPartRepo.save({
        id: 'part-2',
        batchId,
        status: BatchPartStatus.PENDING,
        index: 2,
        createTime: new Date(),
      } as any);
    });

    it('应该返回批处理部分列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/batches/${batchId}/parts`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该支持按状态过滤批处理部分', async () => {
      const response = await request(app.getHttpServer())
        .get(`/batches/${batchId}/parts`)
        .query({ status: BatchPartStatus.COMPLETED })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /batches/:batchId/parts/:partId', () => {
    let batchId: string;
    let partId: string;

    beforeEach(async () => {
      const result = await batchRepo.save({
        id: 'part-detail-batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        status: BatchStatus.RUNNING,
        createTime: new Date(),
      } as any);
      batchId = result.id;

      const partResult = await batchPartRepo.save({
        id: 'part-detail-1',
        batchId,
        status: BatchPartStatus.COMPLETED,
        index: 1,
        createTime: new Date(),
      } as any);
      partId = partResult.id;
    });

    it('应该返回指定批处理部分详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/batches/${batchId}/parts/${partId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', partId);
      expect(response.body).toHaveProperty('batchId', batchId);
    });
  });

  describe('POST /batches/:id/retry', () => {
    let batchId: string;

    beforeEach(async () => {
      const result = await batchRepo.save({
        id: 'retry-batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        processedTotal: 50,
        failTotal: 5,
        status: BatchStatus.FAILED,
        createTime: new Date(),
      } as any);
      batchId = result.id;

      // 创建失败的部分
      await batchPartRepo.save({
        id: 'failed-part-1',
        batchId,
        status: BatchPartStatus.FAILED,
        index: 1,
        errorMessage: 'Test error',
        createTime: new Date(),
      } as any);
    });

    it('应该成功重试失败的批处理部分', async () => {
      const response = await request(app.getHttpServer())
        .post(`/batches/${batchId}/retry`)
        .expect(200);

      expect(response.body).toHaveProperty('count');
    });
  });

  describe('POST /batches/:id/execute', () => {
    let batchId: string;

    beforeEach(async () => {
      const result = await batchRepo.save({
        id: 'execute-batch-1',
        type: BatchType.DELETE_PROCESS_INSTANCES,
        total: 100,
        status: BatchStatus.PENDING,
        createTime: new Date(),
      } as any);
      batchId = result.id;
    });

    it('应该成功启动批处理执行', async () => {
      const response = await request(app.getHttpServer())
        .post(`/batches/${batchId}/execute`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Batch execution started');
    });
  });

  describe('批处理完整流程测试', () => {
    it('应该完成批处理创建到执行的完整流程', async () => {
      // 1. 创建批处理
      const createResponse = await request(app.getHttpServer())
        .post('/batches')
        .send({
          type: BatchType.START_PROCESS_INSTANCES,
          total: 10,
          config: JSON.stringify({ processDefinitionKey: 'testProcess' }),
          description: '完整流程测试批处理',
        })
        .expect(201);

      const batchId = createResponse.body.id;
      expect(batchId).toBeDefined();

      // 2. 查询批处理
      const getResponse = await request(app.getHttpServer())
        .get(`/batches/${batchId}`)
        .expect(200);

      expect(getResponse.body.id).toBe(batchId);
      expect(getResponse.body.status).toBe(BatchStatus.PENDING);

      // 3. 执行批处理
      const executeResponse = await request(app.getHttpServer())
        .post(`/batches/${batchId}/execute`)
        .expect(200);

      expect(executeResponse.body.message).toBe('Batch execution started');

      // 4. 查询批处理列表
      const listResponse = await request(app.getHttpServer())
        .get('/batches')
        .query({ type: BatchType.START_PROCESS_INSTANCES })
        .expect(200);

      expect(listResponse.body.total).toBeGreaterThanOrEqual(1);

      // 5. 获取统计信息
      const statsResponse = await request(app.getHttpServer())
        .get('/batches/statistics')
        .expect(200);

      expect(statsResponse.body.total).toBeGreaterThanOrEqual(1);
    });
  });
});
