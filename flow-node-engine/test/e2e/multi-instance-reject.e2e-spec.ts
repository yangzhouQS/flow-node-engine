/**
 * E2E 测试 - 多人退回策略 API
 * 测试多人任务退回策略相关的HTTP接口
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
import { MultiInstanceRejectConfig } from '../../src/task/entities/multi-instance-reject-config.entity';

// Module
import { TaskModule } from '../../src/task/task.module';
import { ProcessInstanceModule } from '../../src/process-instance/process-instance.module';
import { ProcessDefinitionModule } from '../../src/process-definition/process-definition.module';
import { CoreModule } from '../../src/core/core.module';

describe('E2E 测试 - 多人退回策略 API', () => {
  let app: INestApplication;
  let taskRepo: vi.Mocked<Repository<Task>>;
  let processInstanceRepo: vi.Mocked<Repository<ProcessInstance>>;
  let processDefinitionRepo: vi.Mocked<Repository<ProcessDefinition>>;
  let miRejectConfigRepo: vi.Mocked<Repository<MultiInstanceRejectConfig>>;

  // 测试数据存储
  let tasks: Map<string, Task>;
  let processInstances: Map<string, ProcessInstance>;
  let processDefinitions: Map<string, ProcessDefinition>;
  let miRejectConfigs: Map<string, MultiInstanceRejectConfig>;

  let definitionId: string;
  let instanceId: string;
  let miTaskId: string;

  beforeEach(async () => {
    // 初始化数据存储
    tasks = new Map();
    processInstances = new Map();
    processDefinitions = new Map();
    miRejectConfigs = new Map();

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
          if (options?.where?.parentTaskId) {
            return Array.from(storage.values()).filter(
              (item: any) => item.parentTaskId === options.where.parentTaskId
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
    miRejectConfigRepo = createMockRepo(miRejectConfigs);

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
      .overrideProvider(getRepositoryToken(MultiInstanceRejectConfig))
      .useValue(miRejectConfigRepo)
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
      name: '多人退回策略测试流程',
      key: 'miRejectTestProcess',
      version: 1,
      isActive: true,
    } as any);
    definitionId = definition.id;

    // 预先创建流程实例
    const instance = await processInstanceRepo.save({
      processDefinitionId: definitionId,
      businessKey: 'mi-reject-test-biz-001',
      status: 'ACTIVE',
      startTime: new Date(),
    } as any);
    instanceId = instance.id;

    // 创建多人任务父任务
    const miTask = await taskRepo.save({
      processInstanceId: instanceId,
      taskDefinitionKey: 'multiApproveTask',
      name: '多人审批任务',
      isMultiInstance: true,
      multiInstanceType: 'PARALLEL',
      status: 'PENDING',
      createTime: new Date(),
    } as any);
    miTaskId = miTask.id;

    // 创建子任务
    await taskRepo.save({
      id: 'mi-sub-task-1',
      processInstanceId: instanceId,
      parentTaskId: miTaskId,
      taskDefinitionKey: 'multiApproveTask',
      name: '审批任务-用户1',
      assignee: 'user1',
      status: 'PENDING',
      createTime: new Date(),
    } as any);

    await taskRepo.save({
      id: 'mi-sub-task-2',
      processInstanceId: instanceId,
      parentTaskId: miTaskId,
      taskDefinitionKey: 'multiApproveTask',
      name: '审批任务-用户2',
      assignee: 'user2',
      status: 'PENDING',
      createTime: new Date(),
    } as any);

    await taskRepo.save({
      id: 'mi-sub-task-3',
      processInstanceId: instanceId,
      parentTaskId: miTaskId,
      taskDefinitionKey: 'multiApproveTask',
      name: '审批任务-用户3',
      assignee: 'user3',
      status: 'COMPLETED',
      createTime: new Date(),
      endTime: new Date(),
    } as any);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/v1/multi-instance-reject/configs', () => {
    it('应该成功创建多人退回配置', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/multi-instance-reject/configs')
        .send({
          processDefinitionId: definitionId,
          activityId: 'multiApproveTask',
          rejectStrategy: 'ALL_BACK',
          completeCondition: '${nrOfCompletedInstances/nrOfInstances >= 0.5}',
          config: {
            allowPartialReject: true,
            notifyOnReject: true,
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('code', 201);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('rejectStrategy', 'ALL_BACK');
    });

    it('应该拒绝无效的退回策略', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/multi-instance-reject/configs')
        .send({
          processDefinitionId: definitionId,
          activityId: 'multiApproveTask',
          rejectStrategy: 'INVALID_STRATEGY',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /api/v1/multi-instance-reject/configs', () => {
    beforeEach(async () => {
      await miRejectConfigRepo.save({
        processDefinitionId: definitionId,
        activityId: 'multiApproveTask',
        rejectStrategy: 'ALL_BACK',
      } as any);

      await miRejectConfigRepo.save({
        processDefinitionId: definitionId,
        activityId: 'multiReviewTask',
        rejectStrategy: 'ONLY_REJECTOR',
      } as any);
    });

    it('应该返回多人退回配置列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/multi-instance-reject/configs')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/v1/multi-instance-reject/strategies', () => {
    it('应该返回可用的多人退回策略列表', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/multi-instance-reject/strategies')
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data).toContain('ALL_BACK');
      expect(response.body.data).toContain('ONLY_REJECTOR');
      expect(response.body.data).toContain('COMPLETED_BACK');
    });
  });

  describe('PUT /api/v1/multi-instance-reject/tasks/:id/reject', () => {
    it('应该成功退回多人任务', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/multi-instance-reject/tasks/mi-sub-task-1/reject')
        .send({
          reason: '材料不完整，需要重新审批',
          strategy: 'ALL_BACK',
          variables: {
            rejectReason: '材料不完整',
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('rejected', true);
    });

    it('应该拒绝退回不存在的任务', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/multi-instance-reject/tasks/non-existent-task/reject')
        .send({
          reason: '测试',
          strategy: 'ALL_BACK',
        })
        .expect(404);

      expect(response.body).toHaveProperty('statusCode', 404);
    });

    it('应该拒绝退回非多人实例任务', async () => {
      // 创建普通任务
      const normalTask = await taskRepo.save({
        processInstanceId: instanceId,
        taskDefinitionKey: 'normalTask',
        name: '普通任务',
        assignee: 'user1',
        status: 'PENDING',
        createTime: new Date(),
      } as any);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/multi-instance-reject/tasks/${normalTask.id}/reject`)
        .send({
          reason: '测试',
          strategy: 'ALL_BACK',
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });
  });

  describe('GET /api/v1/multi-instance-reject/tasks/:id/status', () => {
    it('应该返回多人任务的退回状态', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/multi-instance-reject/tasks/${miTaskId}/status`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('totalInstances');
      expect(response.body.data).toHaveProperty('completedInstances');
      expect(response.body.data).toHaveProperty('pendingInstances');
    });
  });

  describe('POST /api/v1/multi-instance-reject/tasks/:id/reassign', () => {
    it('应该成功重新分配多人任务', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/multi-instance-reject/tasks/${miTaskId}/reassign`)
        .send({
          newUserIds: ['user4', 'user5'],
          reason: '原审批人无法处理',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('reassigned', true);
    });
  });

  describe('PUT /api/v1/multi-instance-reject/tasks/:id/add-assignees', () => {
    it('应该成功添加审批人', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/multi-instance-reject/tasks/${miTaskId}/add-assignees`)
        .send({
          userIds: ['user6', 'user7'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('addedCount', 2);
    });
  });

  describe('PUT /api/v1/multi-instance-reject/tasks/:id/remove-assignees', () => {
    it('应该成功移除审批人', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/multi-instance-reject/tasks/${miTaskId}/remove-assignees`)
        .send({
          userIds: ['user1'],
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('removedCount', 1);
    });
  });

  describe('GET /api/v1/multi-instance-reject/tasks/:id/sub-tasks', () => {
    it('应该返回多人任务的所有子任务', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/multi-instance-reject/tasks/${miTaskId}/sub-tasks`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('POST /api/v1/multi-instance-reject/preview', () => {
    it('应该成功预览退回影响', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/multi-instance-reject/preview')
        .send({
          taskId: 'mi-sub-task-1',
          strategy: 'ALL_BACK',
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('affectedTasks');
      expect(response.body.data).toHaveProperty('affectedUsers');
    });
  });

  describe('GET /api/v1/multi-instance-reject/process-instances/:id/mi-tasks', () => {
    it('应该返回流程实例中的所有多人任务', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/multi-instance-reject/process-instances/${instanceId}/mi-tasks`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('PUT /api/v1/multi-instance-reject/configs/:id', () => {
    let configId: string;

    beforeEach(async () => {
      const result = await miRejectConfigRepo.save({
        processDefinitionId: definitionId,
        activityId: 'multiApproveTask',
        rejectStrategy: 'ALL_BACK',
      } as any);
      configId = result.id;
    });

    it('应该成功更新多人退回配置', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/multi-instance-reject/configs/${configId}`)
        .send({
          rejectStrategy: 'ONLY_REJECTOR',
          config: {
            allowPartialReject: false,
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
      expect(response.body.data).toHaveProperty('rejectStrategy', 'ONLY_REJECTOR');
    });
  });

  describe('DELETE /api/v1/multi-instance-reject/configs/:id', () => {
    let configId: string;

    beforeEach(async () => {
      const result = await miRejectConfigRepo.save({
        processDefinitionId: definitionId,
        activityId: 'multiApproveTask',
        rejectStrategy: 'ALL_BACK',
      } as any);
      configId = result.id;
    });

    it('应该成功删除多人退回配置', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/api/v1/multi-instance-reject/configs/${configId}`)
        .expect(200);

      expect(response.body).toHaveProperty('code', 200);
    });
  });
});
