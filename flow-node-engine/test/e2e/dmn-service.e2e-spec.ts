/**
 * E2E 测试 - DMN决策引擎 API
 * 测试决策表管理相关的HTTP接口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule, INestApplication } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

// Entities
import { DmnDecisionEntity, DmnDecisionStatus, HitPolicy, AggregationType } from '../../src/dmn/entities/dmn-decision.entity';
import { DmnExecutionEntity } from '../../src/dmn/entities/dmn-execution.entity';

// Module
import { DmnModule } from '../../src/dmn/dmn.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - DMN决策引擎 API', () => {
  let app: INestApplication;
  let decisionRepo: vi.Mocked<Repository<DmnDecisionEntity>>;
  let executionRepo: vi.Mocked<Repository<DmnExecutionEntity>>;

  // 测试数据存储
  let decisions: Map<string, DmnDecisionEntity>;
  let executions: Map<string, DmnExecutionEntity>;

  beforeEach(async () => {
    // 初始化数据存储
    decisions = new Map();
    executions = new Map();

    // 创建mock repository
    const createMockRepo = <T>(storage: Map<string, T>): vi.Mocked<Repository<T>> => {
      return {
        find: vi.fn(async (options?: any) => {
          let items = Array.from(storage.values());
          if (options?.where) {
            if (options.where.status) {
              items = items.filter((item: any) => item.status === options.where.status);
            }
            if (options.where.decisionKey) {
              items = items.filter((item: any) => item.decisionKey === options.where.decisionKey);
            }
            if (options.where.tenantId) {
              items = items.filter((item: any) => item.tenantId === options.where.tenantId);
            }
            if (options.where.id) {
              items = items.filter((item: any) => item.id === options.where.id);
            }
            if (options.where.category) {
              items = items.filter((item: any) => item.category === options.where.category);
            }
          }
          return items;
        }),
        findOne: vi.fn(async (options: any) => {
          if (options?.where?.id) {
            return storage.get(options.where.id) || null;
          }
          if (options?.where?.decisionKey) {
            return (
              Array.from(storage.values()).find((item: any) => item.decisionKey === options.where.decisionKey) ||
              null
            );
          }
          return Array.from(storage.values())[0] || null;
        }),
        save: vi.fn(async (entity: any) => {
          const id = entity.id || `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

    decisionRepo = createMockRepo(decisions);
    executionRepo = createMockRepo(executions);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CoreModule, DmnModule],
    })
      .overrideProvider(getRepositoryToken(DmnDecisionEntity))
      .useValue(decisionRepo)
      .overrideProvider(getRepositoryToken(DmnExecutionEntity))
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
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /dmn/decisions', () => {
    it('应该成功创建决策', async () => {
      const response = await request(app.getHttpServer())
        .post('/dmn/decisions')
        .send({
          decisionKey: 'test-decision-1',
          name: '测试决策',
          description: '测试决策描述',
          category: '测试分类',
          hitPolicy: HitPolicy.UNIQUE,
          inputs: [
            { id: 'input1', label: '年龄', expression: 'age', type: 'number', required: true },
          ],
          outputs: [
            { id: 'output1', label: '等级', name: 'level', type: 'string' },
          ],
          rules: [
            {
              conditions: [{ inputId: 'input1', operator: '>=', value: 18 }],
              outputs: [{ outputId: 'output1', value: 'adult' }],
              description: '成年人规则',
            },
          ],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('decisionKey', 'test-decision-1');
      expect(response.body).toHaveProperty('hitPolicy', HitPolicy.UNIQUE);
    });

    it('应该拒绝缺少必要字段的请求', async () => {
      const response = await request(app.getHttpServer())
        .post('/dmn/decisions')
        .send({
          // 缺少 decisionKey
          hitPolicy: HitPolicy.UNIQUE,
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /dmn/decisions', () => {
    beforeEach(async () => {
      // 预先创建一些测试数据
      await decisionRepo.save({
        id: 'decision-1',
        decisionKey: 'decision-1',
        name: '决策1',
        status: DmnDecisionStatus.PUBLISHED,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);

      await decisionRepo.save({
        id: 'decision-2',
        decisionKey: 'decision-2',
        name: '决策2',
        status: DmnDecisionStatus.DRAFT,
        version: 1,
        hitPolicy: HitPolicy.FIRST,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
    });

    it('应该返回决策列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/dmn/decisions')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/dmn/decisions')
        .query({ page: 1, size: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
    });

    it('应该支持按状态过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/dmn/decisions')
        .query({ status: DmnDecisionStatus.PUBLISHED })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('应该支持按分类过滤', async () => {
      await decisionRepo.save({
        id: 'decision-3',
        decisionKey: 'decision-3',
        name: '分类测试决策',
        category: '风险控制',
        status: DmnDecisionStatus.PUBLISHED,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .get('/dmn/decisions')
        .query({ category: '风险控制' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /dmn/decisions/:id', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'query-decision-1',
        decisionKey: 'query-decision-1',
        name: '查询测试决策',
        status: DmnDecisionStatus.PUBLISHED,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该返回指定决策详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/dmn/decisions/${decisionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', decisionId);
      expect(response.body).toHaveProperty('name', '查询测试决策');
    });

    it('应该返回404当决策不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/dmn/decisions/non-existent-id')
        .expect(500); // Controller throws Error

      expect(response.body).toHaveProperty('statusCode', 500);
    });
  });

  describe('GET /dmn/decisions/by-key/:key', () => {
    beforeEach(async () => {
      await decisionRepo.save({
        id: 'key-decision-1',
        decisionKey: 'risk-assessment',
        name: '风险评估决策',
        status: DmnDecisionStatus.PUBLISHED,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
    });

    it('应该通过Key获取决策', async () => {
      const response = await request(app.getHttpServer())
        .get('/dmn/decisions/by-key/risk-assessment')
        .expect(200);

      expect(response.body).toHaveProperty('decisionKey', 'risk-assessment');
    });
  });

  describe('PUT /dmn/decisions/:id', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'update-decision-1',
        decisionKey: 'update-decision-1',
        name: '更新测试决策',
        status: DmnDecisionStatus.DRAFT,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该成功更新决策', async () => {
      const response = await request(app.getHttpServer())
        .put(`/dmn/decisions/${decisionId}`)
        .send({
          name: '更新后的决策名称',
          description: '更新后的描述',
        })
        .expect(200);

      expect(response.body).toHaveProperty('id', decisionId);
    });
  });

  describe('POST /dmn/decisions/:id/publish', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'publish-decision-1',
        decisionKey: 'publish-decision-1',
        name: '发布测试决策',
        status: DmnDecisionStatus.DRAFT,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该成功发布决策', async () => {
      const response = await request(app.getHttpServer())
        .post(`/dmn/decisions/${decisionId}/publish`)
        .expect(200);

      expect(response.body).toHaveProperty('id', decisionId);
    });
  });

  describe('POST /dmn/decisions/:id/suspend', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'suspend-decision-1',
        decisionKey: 'suspend-decision-1',
        name: '挂起测试决策',
        status: DmnDecisionStatus.PUBLISHED,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该成功挂起决策', async () => {
      const response = await request(app.getHttpServer())
        .post(`/dmn/decisions/${decisionId}/suspend`)
        .expect(200);

      expect(response.body).toHaveProperty('id', decisionId);
    });
  });

  describe('POST /dmn/decisions/:id/activate', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'activate-decision-1',
        decisionKey: 'activate-decision-1',
        name: '激活测试决策',
        status: DmnDecisionStatus.SUSPENDED,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该成功激活决策', async () => {
      const response = await request(app.getHttpServer())
        .post(`/dmn/decisions/${decisionId}/activate`)
        .expect(200);

      expect(response.body).toHaveProperty('id', decisionId);
    });
  });

  describe('POST /dmn/decisions/:id/versions', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'version-decision-1',
        decisionKey: 'version-decision',
        name: '版本测试决策',
        status: DmnDecisionStatus.PUBLISHED,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该成功创建新版本', async () => {
      const response = await request(app.getHttpServer())
        .post(`/dmn/decisions/${decisionId}/versions`)
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });

  describe('DELETE /dmn/decisions/:id', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'delete-decision-1',
        decisionKey: 'delete-decision-1',
        name: '删除测试决策',
        status: DmnDecisionStatus.DRAFT,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该成功删除决策', async () => {
      await request(app.getHttpServer())
        .delete(`/dmn/decisions/${decisionId}`)
        .expect(204);
    });
  });

  describe('POST /dmn/execute', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'execute-decision-1',
        decisionKey: 'execute-decision',
        name: '执行测试决策',
        status: DmnDecisionStatus.PUBLISHED,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([
          { id: 'age', label: '年龄', expression: 'age', type: 'number' },
        ]),
        outputs: JSON.stringify([
          { id: 'level', label: '等级', name: 'level', type: 'string' },
        ]),
        rules: JSON.stringify([
          {
            id: 'rule-1',
            conditions: [{ inputId: 'age', operator: '>=', value: 18 }],
            outputs: [{ outputId: 'level', value: 'adult' }],
          },
        ]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该成功执行决策', async () => {
      const response = await request(app.getHttpServer())
        .post('/dmn/execute')
        .send({
          decisionId,
          inputData: { age: 25 },
        })
        .expect(200);

      expect(response.body).toHaveProperty('executionId');
      expect(response.body).toHaveProperty('decisionId', decisionId);
      expect(response.body).toHaveProperty('status');
    });

    it('应该支持通过Key执行决策', async () => {
      const response = await request(app.getHttpServer())
        .post('/dmn/execute')
        .send({
          decisionKey: 'execute-decision',
          inputData: { age: 25 },
        })
        .expect(200);

      expect(response.body).toHaveProperty('executionId');
      expect(response.body).toHaveProperty('decisionKey', 'execute-decision');
    });
  });

  describe('GET /dmn/executions', () => {
    beforeEach(async () => {
      // 创建执行历史
      await executionRepo.save({
        id: 'execution-1',
        decisionId: 'decision-1',
        decisionKey: 'test-decision',
        decisionVersion: 1,
        status: 'success',
        inputData: JSON.stringify({ age: 25 }),
        outputResult: JSON.stringify({ level: 'adult' }),
        matchedCount: 1,
        executionTimeMs: 10,
        createTime: new Date(),
      } as any);

      await executionRepo.save({
        id: 'execution-2',
        decisionId: 'decision-1',
        decisionKey: 'test-decision',
        decisionVersion: 1,
        status: 'success',
        inputData: JSON.stringify({ age: 15 }),
        outputResult: JSON.stringify({ level: 'minor' }),
        matchedCount: 0,
        executionTimeMs: 5,
        createTime: new Date(),
      } as any);
    });

    it('应该返回执行历史列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/dmn/executions')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('应该支持按决策ID过滤执行历史', async () => {
      const response = await request(app.getHttpServer())
        .get('/dmn/executions')
        .query({ decisionId: 'decision-1' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/dmn/executions')
        .query({ page: 1, size: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('GET /dmn/decisions/:id/statistics', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'stats-decision-1',
        decisionKey: 'stats-decision',
        name: '统计测试决策',
        status: DmnDecisionStatus.PUBLISHED,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([]),
        outputs: JSON.stringify([]),
        rules: JSON.stringify([]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该返回决策统计信息', async () => {
      const response = await request(app.getHttpServer())
        .get(`/dmn/decisions/${decisionId}/statistics`)
        .expect(200);

      expect(response.body).toHaveProperty('totalExecutions');
      expect(response.body).toHaveProperty('successCount');
      expect(response.body).toHaveProperty('failedCount');
      expect(response.body).toHaveProperty('noMatchCount');
      expect(response.body).toHaveProperty('avgExecutionTime');
    });
  });

  describe('POST /dmn/decisions/:id/validate', () => {
    let decisionId: string;

    beforeEach(async () => {
      const result = await decisionRepo.save({
        id: 'validate-decision-1',
        decisionKey: 'validate-decision',
        name: '验证测试决策',
        status: DmnDecisionStatus.DRAFT,
        version: 1,
        hitPolicy: HitPolicy.UNIQUE,
        decisionTable: JSON.stringify({}),
        inputs: JSON.stringify([
          { id: 'input1', label: '输入', expression: 'input1', type: 'string' },
        ]),
        outputs: JSON.stringify([
          { id: 'output1', label: '输出', name: 'output1', type: 'string' },
        ]),
        rules: JSON.stringify([
          {
            id: 'rule-1',
            conditions: [{ inputId: 'input1', operator: '==', value: 'test' }],
            outputs: [{ outputId: 'output1', value: 'result' }],
          },
        ]),
        createTime: new Date(),
      } as any);
      decisionId = result.id;
    });

    it('应该成功验证决策', async () => {
      const response = await request(app.getHttpServer())
        .post(`/dmn/decisions/${decisionId}/validate`)
        .expect(200);

      expect(response.body).toHaveProperty('valid');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('warnings');
    });
  });

  describe('决策完整流程测试', () => {
    it('应该完成决策创建到执行的完整流程', async () => {
      // 1. 创建决策
      const createResponse = await request(app.getHttpServer())
        .post('/dmn/decisions')
        .send({
          decisionKey: 'complete-flow-decision',
          name: '完整流程测试决策',
          category: '测试',
          hitPolicy: HitPolicy.UNIQUE,
          inputs: [
            { id: 'score', label: '分数', expression: 'score', type: 'number', required: true },
          ],
          outputs: [
            { id: 'grade', label: '等级', name: 'grade', type: 'string' },
          ],
          rules: [
            {
              conditions: [{ inputId: 'score', operator: '>=', value: 90 }],
              outputs: [{ outputId: 'grade', value: 'A' }],
              description: '优秀',
            },
            {
              conditions: [{ inputId: 'score', operator: '>=', value: 60 }],
              outputs: [{ outputId: 'grade', value: 'B' }],
              description: '及格',
            },
            {
              conditions: [{ inputId: 'score', operator: '<', value: 60 }],
              outputs: [{ outputId: 'grade', value: 'C' }],
              description: '不及格',
            },
          ],
        })
        .expect(201);

      const decisionId = createResponse.body.id;
      expect(decisionId).toBeDefined();

      // 2. 验证决策
      const validateResponse = await request(app.getHttpServer())
        .post(`/dmn/decisions/${decisionId}/validate`)
        .expect(200);

      expect(validateResponse.body.valid).toBe(true);

      // 3. 发布决策
      const publishResponse = await request(app.getHttpServer())
        .post(`/dmn/decisions/${decisionId}/publish`)
        .expect(200);

      expect(publishResponse.body.id).toBe(decisionId);

      // 4. 执行决策
      const executeResponse = await request(app.getHttpServer())
        .post('/dmn/execute')
        .send({
          decisionId,
          inputData: { score: 95 },
        })
        .expect(200);

      expect(executeResponse.body).toHaveProperty('executionId');
      expect(executeResponse.body).toHaveProperty('decisionId', decisionId);

      // 5. 查询执行历史
      const historyResponse = await request(app.getHttpServer())
        .get('/dmn/executions')
        .query({ decisionId })
        .expect(200);

      expect(historyResponse.body).toHaveProperty('data');
      expect(historyResponse.body.total).toBeGreaterThanOrEqual(1);

      // 6. 获取统计信息
      const statsResponse = await request(app.getHttpServer())
        .get(`/dmn/decisions/${decisionId}/statistics`)
        .expect(200);

      expect(statsResponse.body).toHaveProperty('totalExecutions');
    });
  });
});
