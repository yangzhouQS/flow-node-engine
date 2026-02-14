/**
 * E2E 测试 - 作业服务 API
 * 测试作业服务相关的HTTP接口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule, INestApplication } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

// Entities
import { Job } from '../../src/job/entities/job.entity';
import { ProcessInstance } from '../../src/process-instance/entities/process-instance.entity';
import { ProcessDefinition } from '../../src/process-definition/entities/process-definition.entity';

// Module
import { JobModule } from '../../src/job/job.module';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - 作业服务 API', () => {
  let app: INestApplication;
  let jobRepo: vi.Mocked<Repository<Job>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;

  // 测试数据存储
  let jobs: Map<string, Job>;
  let processInstances: Map<string, ProcessInstance>;
  let processDefinitions: Map<string, ProcessDefinition>;

  let definitionId: string;
  let instanceId: string;

  beforeEach(async () => {
    // 初始化数据存储
    jobs = new Map();
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

    jobRepo = createMockRepo(jobs);
    processInstanceRepo = createMockRepo(processInstances);
    processDefinitionRepo = createMockRepo(processDefinitions);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CoreModule, ProcessDefinitionModule, ProcessInstanceModule, JobModule],
    })
      .overrideProvider(getRepositoryToken(Job))
      .useValue(jobRepo)
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
      name: '作业测试流程',
      key: 'jobTestProcess',
      version: 1,
      isActive: true,
    } as any);
    definitionId = definition.id;

    // 预先创建流程实例
    const instance = await processInstanceRepo.save({
      processDefinitionId: definitionId,
      businessKey: 'job-test-biz-001',
      status: 'ACTIVE',
      startTime: new Date(),
    } as any);
    instanceId = instance.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/jobs', () => {
    beforeEach(async () => {
      // 预先创建一些测试作业
      await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        dueDate: new Date(Date.now() + 3600000),
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'MESSAGE',
        jobHandlerType: 'message-event',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
    });

    it('应该返回作业列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('pageSize', 10);
    });

    it('应该支持按作业类型过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .query({ jobType: 'TIMER' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.jobType).toBe('TIMER');
      });
    });

    it('应该支持按状态过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .query({ status: 'PENDING' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.status).toBe('PENDING');
      });
    });

    it('应该支持按流程实例ID过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .query({ processInstanceId: instanceId })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.processInstanceId).toBe(instanceId);
      });
    });
  });

  describe('GET /api/v1/jobs/:id', () => {
    let jobId: string;

    beforeEach(async () => {
      const result = await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        dueDate: new Date(Date.now() + 3600000),
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      jobId = result.id;
    });

    it('应该返回指定作业详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('id', jobId);
      expect(response.body.data).toHaveProperty('jobType', 'TIMER');
    });

    it('应该返回404当作业不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('POST /api/v1/jobs/:id/execute', () => {
    let jobId: string;

    beforeEach(async () => {
      const result = await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      jobId = result.id;
    });

    it('应该成功执行作业', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${jobId}/execute`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('status', 'COMPLETED');
    });

    it('应该拒绝执行已完成的作业', async () => {
      // 先完成作业
      await jobRepo.save({
        id: jobId,
        status: 'COMPLETED',
      } as any);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${jobId}/execute`)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('DELETE /api/v1/jobs/:id', () => {
    let jobId: string;

    beforeEach(async () => {
      const result = await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      jobId = result.id;
    });

    it('应该成功删除作业', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/jobs/${jobId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });

    it('应该返回404当删除不存在的作业时', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/jobs/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('PUT /api/v1/jobs/:id/retry', () => {
    let jobId: string;

    beforeEach(async () => {
      const result = await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        status: 'FAILED',
        exceptionMessage: '执行失败',
        retryCount: 2,
        createTime: new Date(),
      } as any);
      jobId = result.id;
    });

    it('应该成功重试失败的作业', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobId}/retry`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('status', 'PENDING');
    });

    it('应该拒绝重试非失败状态的作业', async () => {
      // 更新作业状态为已完成
      await jobRepo.save({
        id: jobId,
        status: 'COMPLETED',
      } as any);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobId}/retry`)
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('PUT /api/v1/jobs/:id/suspend', () => {
    let jobId: string;

    beforeEach(async () => {
      const result = await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
      jobId = result.id;
    });

    it('应该成功挂起作业', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobId}/suspend`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('status', 'SUSPENDED');
    });
  });

  describe('PUT /api/v1/jobs/:id/activate', () => {
    let jobId: string;

    beforeEach(async () => {
      const result = await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        status: 'SUSPENDED',
        createTime: new Date(),
      } as any);
      jobId = result.id;
    });

    it('应该成功激活作业', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${jobId}/activate`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('status', 'PENDING');
    });
  });

  describe('GET /api/v1/jobs/timer', () => {
    beforeEach(async () => {
      // 创建定时器作业
      await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        dueDate: new Date(Date.now() + 3600000),
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      // 创建其他类型作业
      await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'MESSAGE',
        jobHandlerType: 'message-event',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
    });

    it('应该返回定时器作业列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs/timer')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((item: any) => {
        expect(item.jobType).toBe('TIMER');
      });
    });
  });

  describe('GET /api/v1/jobs/due', () => {
    beforeEach(async () => {
      // 创建已到期作业
      await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        dueDate: new Date(Date.now() - 3600000), // 1小时前到期
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      // 创建未到期作业
      await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        dueDate: new Date(Date.now() + 3600000), // 1小时后到期
        status: 'PENDING',
        createTime: new Date(),
      } as any);
    });

    it('应该返回已到期作业列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs/due')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/jobs/failed', () => {
    beforeEach(async () => {
      // 创建失败作业
      await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        status: 'FAILED',
        exceptionMessage: '执行失败',
        createTime: new Date(),
      } as any);

      // 创建正常作业
      await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        status: 'PENDING',
        createTime: new Date(),
      } as any);
    });

    it('应该返回失败作业列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs/failed')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      response.body.data.forEach((item: any) => {
        expect(item.status).toBe('FAILED');
      });
    });
  });

  describe('GET /api/v1/jobs/:id/exception-stacktrace', () => {
    let jobId: string;

    beforeEach(async () => {
      const result = await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        status: 'FAILED',
        exceptionMessage: '执行失败',
        exceptionStacktrace: 'Error: 执行失败\n    at JobService.execute',
        createTime: new Date(),
      } as any);
      jobId = result.id;
    });

    it('应该返回作业异常堆栈', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobId}/exception-stacktrace`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('exceptionStacktrace');
    });

    it('应该返回404当作业没有异常时', async () => {
      // 创建没有异常的作业
      const normalJob = await jobRepo.save({
        processInstanceId: instanceId,
        jobType: 'TIMER',
        jobHandlerType: 'timer-event',
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${normalJob.id}/exception-stacktrace`)
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });
});
