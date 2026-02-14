/**
 * E2E 测试 - 流程定义 API
 * 测试流程定义相关的HTTP接口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule, INestApplication } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

// Entities
import { ProcessDefinition } from '../../src/process-definition/entities/process-definition.entity';
import { Deployment } from '../../src/process-definition/entities/deployment.entity';

// Module
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { CoreModule } from '../../src/core/core.module';

// 测试用BPMN XML
const TEST_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  targetNamespace="http://flowable.org/test">
  <process id="testProcess" name="测试流程" isExecutable="true">
    <startEvent id="start" name="开始"/>
    <sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <userTask id="task1" name="用户任务">
      <extensionElements>
        <flowable:assignee>${assignee}</flowable:assignee>
      </extensionElements>
    </userTask>
    <sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
    <endEvent id="end" name="结束"/>
  </process>
</definitions>`;

describe('E2E 测试 - 流程定义 API', () => {
  let app: INestApplication;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let deploymentRepo: vi.Mocked<Repository<Deployment>>;

  // 测试数据存储
  let processDefinitions: Map<string, ProcessDefinition>;
  let deployments: Map<string, Deployment>;

  beforeEach(async () => {
    // 初始化数据存储
    processDefinitions = new Map();
    deployments = new Map();

    // 创建mock repositories
    const createMockRepo = <T>(storage: Map<string, T>): vi.Mocked<Repository<T>> => {
      return {
        find: vi.fn(async () => Array.from(storage.values())),
        findOne: vi.fn(async (options: any) => {
          if (options?.where?.id) {
            return storage.get(options.where.id) || null;
          }
          if (options?.where?.key) {
            return (
              Array.from(storage.values()).find((item: any) => item.key === options.where.key) ||
              null
            );
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

    processDefinitionRepo = createMockRepo(processDefinitions);
    deploymentRepo = createMockRepo(deployments);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CoreModule, ProcessDefinitionModule],
    })
      .overrideProvider(getRepositoryToken(ProcessDefinition))
      .useValue(processDefinitionRepo)
      .overrideProvider(getRepositoryToken(Deployment))
      .useValue(deploymentRepo)
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

  describe('POST /api/v1/process-definitions', () => {
    it('应该成功部署流程定义', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/process-definitions')
        .send({
          name: '测试流程',
          key: 'testProcess',
          bpmnXml: TEST_BPMN_XML,
          generateDiagram: false,
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body).toHaveProperty('message', '部署成功');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name', '测试流程');
      expect(response.body.data).toHaveProperty('key', 'testProcess');
    });

    it('应该拒绝缺少必要字段的请求', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/process-definitions')
        .send({
          name: '测试流程',
          // 缺少 key 和 bpmnXml
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('应该拒绝无效的BPMN XML', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/process-definitions')
        .send({
          name: '测试流程',
          key: 'testProcess',
          bpmnXml: '<invalid>xml</invalid>',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /api/v1/process-definitions', () => {
    beforeEach(async () => {
      // 预先创建一些测试数据
      await processDefinitionRepo.save({
        name: '流程1',
        key: 'process1',
        version: 1,
        bpmnXml: TEST_BPMN_XML,
        isActive: true,
      } as any);

      await processDefinitionRepo.save({
        name: '流程2',
        key: 'process2',
        version: 1,
        bpmnXml: TEST_BPMN_XML,
        isActive: true,
      } as any);
    });

    it('应该返回流程定义列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-definitions')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-definitions')
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('page', 1);
      expect(response.body.meta).toHaveProperty('pageSize', 10);
    });

    it('应该支持按key过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-definitions')
        .query({ key: 'process1' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].key).toBe('process1');
    });

    it('应该支持按状态过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-definitions')
        .query({ isActive: true })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      response.body.data.forEach((item: any) => {
        expect(item.isActive).toBe(true);
      });
    });
  });

  describe('GET /api/v1/process-definitions/:id', () => {
    let definitionId: string;

    beforeEach(async () => {
      const result = await processDefinitionRepo.save({
        name: '查询测试流程',
        key: 'queryTestProcess',
        version: 1,
        bpmnXml: TEST_BPMN_XML,
        isActive: true,
      } as any);
      definitionId = result.id;
    });

    it('应该返回指定流程定义', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/process-definitions/${definitionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('id', definitionId);
      expect(response.body.data).toHaveProperty('name', '查询测试流程');
    });

    it('应该返回404当流程定义不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-definitions/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/process-definitions/key/:key', () => {
    beforeEach(async () => {
      await processDefinitionRepo.save({
        name: '按键查询流程',
        key: 'keyTestProcess',
        version: 1,
        bpmnXml: TEST_BPMN_XML,
        isActive: true,
      } as any);
    });

    it('应该按key返回最新版本的流程定义', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-definitions/key/keyTestProcess')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('key', 'keyTestProcess');
    });

    it('应该返回404当key不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/process-definitions/key/non-existent-key')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('PUT /api/v1/process-definitions/:id/activate', () => {
    let definitionId: string;

    beforeEach(async () => {
      const result = await processDefinitionRepo.save({
        name: '激活测试流程',
        key: 'activateTestProcess',
        version: 1,
        bpmnXml: TEST_BPMN_XML,
        isActive: false,
      } as any);
      definitionId = result.id;
    });

    it('应该成功激活流程定义', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/process-definitions/${definitionId}/activate`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('isActive', true);
    });
  });

  describe('PUT /api/v1/process-definitions/:id/suspend', () => {
    let definitionId: string;

    beforeEach(async () => {
      const result = await processDefinitionRepo.save({
        name: '挂起测试流程',
        key: 'suspendTestProcess',
        version: 1,
        bpmnXml: TEST_BPMN_XML,
        isActive: true,
      } as any);
      definitionId = result.id;
    });

    it('应该成功挂起流程定义', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/process-definitions/${definitionId}/suspend`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('isActive', false);
    });
  });

  describe('DELETE /api/v1/process-definitions/:id', () => {
    let definitionId: string;

    beforeEach(async () => {
      const result = await processDefinitionRepo.save({
        name: '删除测试流程',
        key: 'deleteTestProcess',
        version: 1,
        bpmnXml: TEST_BPMN_XML,
        isActive: true,
      } as any);
      definitionId = result.id;
    });

    it('应该成功删除流程定义', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/process-definitions/${definitionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });

    it('应该返回404当删除不存在的流程定义时', async () => {
      const response = await request(app.getHttpServer())
        .delete('/api/v1/process-definitions/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /api/v1/process-definitions/:id/bpmn-xml', () => {
    let definitionId: string;

    beforeEach(async () => {
      const result = await processDefinitionRepo.save({
        name: 'XML查询测试流程',
        key: 'xmlTestProcess',
        version: 1,
        bpmnXml: TEST_BPMN_XML,
        isActive: true,
      } as any);
      definitionId = result.id;
    });

    it('应该返回流程定义的BPMN XML', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/process-definitions/${definitionId}/bpmn-xml`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('bpmnXml');
      expect(response.body.data.bpmnXml).toContain('testProcess');
    });
  });

  describe('GET /api/v1/process-definitions/:id/diagram', () => {
    let definitionId: string;

    beforeEach(async () => {
      const result = await processDefinitionRepo.save({
        name: '图示查询测试流程',
        key: 'diagramTestProcess',
        version: 1,
        bpmnXml: TEST_BPMN_XML,
        diagramSvg: '<svg>test</svg>',
        isActive: true,
      } as any);
      definitionId = result.id;
    });

    it('应该返回流程定义的流程图SVG', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/process-definitions/${definitionId}/diagram`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('diagramSvg');
    });
  });
});
