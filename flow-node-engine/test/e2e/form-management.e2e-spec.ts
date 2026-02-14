/**
 * E2E 测试 - 表单管理 API
 * 测试表单管理相关的HTTP接口
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule, INestApplication } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import request from 'supertest';

// Entities
import { Form } from '../../src/form/entities/form.entity';

// Module
import { FormModule } from '../../src/form/form.module';
import { CoreModule } from '../../src/core/core.module';

// 测试用表单定义
const TEST_FORM_DEFINITION = {
  fields: [
    {
      id: 'fieldName',
      type: 'text',
      name: '姓名',
      required: true,
      validation: {
        minLength: 2,
        maxLength: 50,
      },
    },
    {
      id: 'fieldEmail',
      type: 'email',
      name: '邮箱',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      },
    },
    {
      id: 'fieldAge',
      type: 'number',
      name: '年龄',
      required: false,
      validation: {
        min: 0,
        max: 150,
      },
    },
  ],
};

describe('E2E 测试 - 表单管理 API', () => {
  let app: INestApplication;
  let formRepo: vi.Mocked<Repository<Form>>;

  // 测试数据存储
  let forms: Map<string, Form>;

  beforeEach(async () => {
    // 初始化数据存储
    forms = new Map();

    // 创建mock repository
    const createMockRepo = <T>(storage: Map<string, T>): vi.Mocked<Repository<T>> => {
      return {
        find: vi.fn(async (options?: any) => {
          let items = Array.from(storage.values());
          if (options?.where) {
            if (options.where.formKey) {
              items = items.filter((item: any) => item.formKey === options.where.formKey);
            }
            if (options.where.tenantId) {
              items = items.filter((item: any) => item.tenantId === options.where.tenantId);
            }
            if (options.where.deploymentId) {
              items = items.filter((item: any) => item.deploymentId === options.where.deploymentId);
            }
          }
          return items;
        }),
        findOne: vi.fn(async (options: any) => {
          if (options?.where?.id) {
            return storage.get(options.where.id) || null;
          }
          if (options?.where?.formKey) {
            return (
              Array.from(storage.values()).find((item: any) => item.formKey === options.where.formKey) ||
              null
            );
          }
          return Array.from(storage.values())[0] || null;
        }),
        save: vi.fn(async (entity: any) => {
          const id = entity.id || `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
            if (options.where.formKey) {
              items = items.filter((item: any) => item.formKey === options.where.formKey);
            }
            if (options.where.tenantId) {
              items = items.filter((item: any) => item.tenantId === options.where.tenantId);
            }
          }
          return items.length;
        }),
      } as any;
    };

    formRepo = createMockRepo(forms);

    // 创建测试模块
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CoreModule, FormModule],
    })
      .overrideProvider(getRepositoryToken(Form))
      .useValue(formRepo)
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

  describe('POST /forms', () => {
    it('应该成功创建表单', async () => {
      const response = await request(app.getHttpServer())
        .post('/forms')
        .send({
          formKey: 'testForm',
          name: '测试表单',
          formDefinition: TEST_FORM_DEFINITION,
          description: '这是一个测试表单',
          version: 1,
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body).toHaveProperty('message', '创建成功');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('formKey', 'testForm');
      expect(response.body.data).toHaveProperty('name', '测试表单');
    });

    it('应该拒绝缺少必要字段的请求', async () => {
      const response = await request(app.getHttpServer())
        .post('/forms')
        .send({
          name: '测试表单',
          // 缺少 formKey 和 formDefinition
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /forms', () => {
    beforeEach(async () => {
      // 预先创建一些测试数据
      await formRepo.save({
        formKey: 'form1',
        name: '表单1',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);

      await formRepo.save({
        formKey: 'form2',
        name: '表单2',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
    });

    it('应该返回表单列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/forms')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app.getHttpServer())
        .get('/forms')
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body).toHaveProperty('data');
    });

    it('应该支持按formKey过滤', async () => {
      const response = await request(app.getHttpServer())
        .get('/forms')
        .query({ formKey: 'form1' })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /forms/:id', () => {
    let formId: string;

    beforeEach(async () => {
      const result = await formRepo.save({
        formKey: 'queryTestForm',
        name: '查询测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
      formId = result.id;
    });

    it('应该返回指定表单', async () => {
      const response = await request(app.getHttpServer())
        .get(`/forms/${formId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('id', formId);
      expect(response.body.data).toHaveProperty('name', '查询测试表单');
    });

    it('应该返回404当表单不存在时', async () => {
      const response = await request(app.getHttpServer())
        .get('/forms/non-existent-id')
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });
  });

  describe('GET /forms/form-key/:formKey', () => {
    beforeEach(async () => {
      await formRepo.save({
        formKey: 'keyTestForm',
        name: '按键查询表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
    });

    it('应该按formKey返回表单', async () => {
      const response = await request(app.getHttpServer())
        .get('/forms/form-key/keyTestForm')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('formKey', 'keyTestForm');
    });
  });

  describe('GET /forms/latest/:formKey', () => {
    beforeEach(async () => {
      // 创建多个版本的表单
      await formRepo.save({
        formKey: 'versionTestForm',
        name: '版本测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);

      await formRepo.save({
        formKey: 'versionTestForm',
        name: '版本测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 2,
        createTime: new Date(),
      } as any);
    });

    it('应该返回最新版本的表单', async () => {
      const response = await request(app.getHttpServer())
        .get('/forms/latest/versionTestForm')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('formKey', 'versionTestForm');
    });
  });

  describe('PUT /forms/:id', () => {
    let formId: string;

    beforeEach(async () => {
      const result = await formRepo.save({
        formKey: 'updateTestForm',
        name: '更新测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
      formId = result.id;
    });

    it('应该成功更新表单', async () => {
      const response = await request(app.getHttpServer())
        .put(`/forms/${formId}`)
        .send({
          name: '更新后的表单名',
          description: '更新后的描述',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('name', '更新后的表单名');
    });
  });

  describe('PUT /forms/:id/definition', () => {
    let formId: string;

    beforeEach(async () => {
      const result = await formRepo.save({
        formKey: 'defUpdateTestForm',
        name: '定义更新测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
      formId = result.id;
    });

    it('应该成功更新表单定义', async () => {
      const newDefinition = {
        fields: [
          {
            id: 'newField',
            type: 'text',
            name: '新字段',
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .put(`/forms/${formId}/definition`)
        .send({ formDefinition: newDefinition })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });

  describe('DELETE /forms/:id', () => {
    let formId: string;

    beforeEach(async () => {
      const result = await formRepo.save({
        formKey: 'deleteTestForm',
        name: '删除测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
      formId = result.id;
    });

    it('应该成功删除表单', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/forms/${formId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });

  describe('GET /forms/count', () => {
    beforeEach(async () => {
      await formRepo.save({
        formKey: 'countTestForm',
        name: '计数测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
    });

    it('应该返回表单数量', async () => {
      const response = await request(app.getHttpServer())
        .get('/forms/count')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('count');
      expect(response.body.data.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /forms/validate', () => {
    let formId: string;

    beforeEach(async () => {
      const result = await formRepo.save({
        formKey: 'validateTestForm',
        name: '验证测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
      formId = result.id;
    });

    it('应该成功验证有效表单数据', async () => {
      const response = await request(app.getHttpServer())
        .post('/forms/validate')
        .send({
          formId,
          data: {
            fieldName: '张三',
            fieldEmail: 'zhangsan@example.com',
            fieldAge: 25,
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('valid');
    });

    it('应该检测无效表单数据', async () => {
      const response = await request(app.getHttpServer())
        .post('/forms/validate')
        .send({
          formId,
          data: {
            fieldName: '张', // 太短
            fieldEmail: 'invalid-email', // 无效邮箱
            fieldAge: 200, // 超出范围
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.errors)).toBe(true);
    });
  });

  describe('POST /forms/validate/field', () => {
    let formId: string;

    beforeEach(async () => {
      const result = await formRepo.save({
        formKey: 'fieldValidateTestForm',
        name: '字段验证测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
      formId = result.id;
    });

    it('应该成功验证单个字段', async () => {
      const response = await request(app.getHttpServer())
        .post('/forms/validate/field')
        .send({
          formId,
          fieldId: 'fieldName',
          value: '张三',
        })
        .expect(200);

      expect(response.body).toHaveProperty('valid');
    });

    it('应该检测无效字段值', async () => {
      const response = await request(app.getHttpServer())
        .post('/forms/validate/field')
        .send({
          formId,
          fieldId: 'fieldAge',
          value: 200, // 超出最大值
        })
        .expect(200);

      expect(response.body).toHaveProperty('valid', false);
    });
  });

  describe('GET /forms/:id/json-schema', () => {
    let formId: string;

    beforeEach(async () => {
      const result = await formRepo.save({
        formKey: 'schemaTestForm',
        name: 'Schema测试表单',
        formDefinition: TEST_FORM_DEFINITION,
        version: 1,
        createTime: new Date(),
      } as any);
      formId = result.id;
    });

    it('应该返回表单的JSON Schema', async () => {
      const response = await request(app.getHttpServer())
        .get(`/forms/${formId}/json-schema`)
        .expect(200);

      expect(response.body).toHaveProperty('schema');
      expect(response.body.schema).toHaveProperty('type');
      expect(response.body.schema).toHaveProperty('properties');
    });
  });
});
