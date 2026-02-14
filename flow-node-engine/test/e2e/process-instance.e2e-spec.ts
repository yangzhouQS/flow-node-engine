/**
 * E2E 测试 - 流程实例 API
 * 测试流程实例相关的HTTP接口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule, INestApplication } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

// Entities
import { ProcessInstance } from '../../src/process-instance/entities/process-instance.entity';
import { Execution } from '../../src/process-instance/entities/execution.entity';
import { Variable } from '../../src/process-instance/entities/variable.entity';
import { ProcessDefinition } from '../../src/process-definition/entities/process-definition.entity';

// Module
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { CoreModule } from '../../src/core/core.module';

// 测试用BPMN XML
const TEST_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="instanceTestProcess" name="实例测试流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <userTask id="task1" name="用户任务"/>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('E2E 测试 - 流程实例 API', () => {
  let app: INestApplication;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let executionRepo: vi.Mocked<Repository<Execution>>;
  let variableRepo: vi.Mocked<Repository<Variable>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;

  // 测试数据存储
  let processInstances: Map<string, ProcessInstance>;
  let executions: Map<string, Execution>;
  let variables: Map<string, Variable>;
  let processDefinitions: Map<string, ProcessDefinition>;

  let definitionId: string;

  beforeEach(async () => {
    // 初始化数据存储
    processInstances = new Map();
    executions = new Map();
    variables = new Map();
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
          if (options?.where?.processDefinitionId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.processDefinitionId === options.where.processDefinitionId
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
    executionRepo = createMockRepo(executions);
    variableRepo = createMockRepo(variables);
    processDefinitionRepo = createMockRepo(processDefinitions);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CoreModule, ProcessDefinitionModule, ProcessInstanceModule],
    })
      .overrideProvider(getRepositoryToken(ProcessInstance))
      .useValue(processInstanceRepo)
      .overrideProvider(getRepositoryToken(Execution))
      .useValue(executionRepo)
      .overrideProvider(getRepositoryToken(Variable))
      .useValue(variableRepo)
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
      name: '实例测试流程',
      key: 'instanceTestProcess',
      version: 1,
      bpmnXml: TEST_BPMN_XML,
      isActive: true,
    } as any);
    definitionId = definition.id;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/process-instances', () => {
    it('应该成功启动流程实例', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/process-instances')
        .send({
          processDefinitionKey: 'instanceTestProcess',
          businessKey: 'biz-001',
          variables: {
            applicant: 'user1',
            amount: 1000,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body).toHaveProperty('message', '流程启动成功');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('businessKey', 'biz-001');
      expect(response.body.data).toHaveProperty('status', 'ACTIVE');
    });

    it('应该支持通过流程定义ID启动流程实例', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/process-instances')
        .send({
          processDefinitionId: definitionId,
          businessKey: 'biz-002',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('businessKey', 'biz-002');
    });

    it('应该拒绝缺少流程定义标识的请求', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/process-instances')
        .send({
          businessKey: 'biz-003',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('应该拒绝启动不存在的流程定义', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/process-instances')
        .send({
          processDefinitionKey: 'non-existent-process',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/process-instances', () => {
    beforeEach(async () => {
      // 预先创建一些测试数据
      await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'list-biz-001',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);

      await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'list-biz-002',
        status: 'COMPLETED',
        startTime: new Date(),
        endTime: new Date(),
      } as any);
    });

    it('应该返回流程实例列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-instances')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-instances')
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('pageSize', 10);
    });

    it('应该支持按状态过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-instances')
        .query({ status: 'ACTIVE' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.status).toBe('ACTIVE');
      });
    });

    it('应该支持按businessKey过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-instances')
        .query({ businessKey: 'list-biz-001' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].businessKey).toBe('list-biz-001');
    });
  });

  describe('GET /api/v1/process-instances/:id', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'detail-biz-001',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);
      instanceId = result.id;
    });

    it('应该返回指定流程实例详情', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/process-instances/${instanceId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('id', instanceId);
      expect(response.body.data).toHaveProperty('businessKey', 'detail-biz-001');
    });

    it('应该返回404当流程实例不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-instances/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('PUT /api/v1/process-instances/:id/suspend', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'suspend-biz-001',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);
      instanceId = result.id;
    });

    it('应该成功挂起流程实例', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/process-instances/${instanceId}/suspend`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('status', 'SUSPENDED');
    });
  });

  describe('PUT /api/v1/process-instances/:id/activate', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'activate-biz-001',
        status: 'SUSPENDED',
        startTime: new Date(),
      } as any);
      instanceId = result.id;
    });

    it('应该成功激活流程实例', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/process-instances/${instanceId}/activate`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('status', 'ACTIVE');
    });
  });

  describe('DELETE /api/v1/process-instances/:id', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'delete-biz-001',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);
      instanceId = result.id;
    });

    it('应该成功删除流程实例', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/process-instances/${instanceId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });

    it('应该返回404当删除不存在的流程实例时', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/process-instances/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/process-instances/:id/variables', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'var-biz-001',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);
      instanceId = result.id;

      // 添加变量
      await variableRepo.save({
        processInstanceId: instanceId,
        name: 'applicant',
        value: 'user1',
        type: 'string',
      } as any);

      await variableRepo.save({
        processInstanceId: instanceId,
        name: 'amount',
        value: 1000,
        type: 'number',
      } as any);
    });

    it('应该返回流程实例的变量列表', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/process-instances/${instanceId}/variables`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/v1/process-instances/:id/variables', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'add-var-biz-001',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);
      instanceId = result.id;
    });

    it('应该成功添加流程变量', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/process-instances/${instanceId}/variables`)
        .send({
          name: 'newVariable',
          value: 'test-value',
          type: 'string',
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('name', 'newVariable');
      expect(response.body.data).toHaveProperty('value', 'test-value');
    });
  });

  describe('GET /api/v1/process-instances/:id/executions', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'exec-biz-001',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);
      instanceId = result.id;

      // 添加执行记录
      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'start',
        activityName: '开始',
        isActive: false,
      } as any);

      await executionRepo.save({
        processInstanceId: instanceId,
        activityId: 'task1',
        activityName: '用户任务',
        isActive: true,
      } as any);
    });

    it('应该返回流程实例的执行记录', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/process-instances/${instanceId}/executions`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('POST /api/v1/process-instances/:id/signal', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'signal-biz-001',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);
      instanceId = result.id;
    });

    it('应该成功发送信号到流程实例', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/process-instances/${instanceId}/signal`)
        .send({
          signalName: 'testSignal',
          payload: { data: 'test' },
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });

  describe('POST /api/v1/process-instances/:id/message', () => {
    let instanceId: string;

    beforeEach(async () => {
      const result = await processInstanceRepo.save({
        processDefinitionId: definitionId,
        businessKey: 'message-biz-001',
        status: 'ACTIVE',
        startTime: new Date(),
      } as any);
      instanceId = result.id;
    });

    it('应该成功发送消息到流程实例', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/process-instances/${instanceId}/message`)
        .send({
          messageName: 'testMessage',
          payload: { data: 'test' },
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });
});
