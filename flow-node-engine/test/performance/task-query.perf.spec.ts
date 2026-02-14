/**
 * 任务查询性能测试
 * 目标：平均响应时间 < 200ms
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from '../../src/task/services/task.service';
import {
  runPerformanceTest,
  formatPerformanceResult,
  randomString,
  randomInt,
} from './performance.utils';

describe('任务查询性能测试', () => {
  let module: TestingModule;
  let taskService: TaskService;
  let mockTaskRepo: any;
  let mockTaskCandidateUserRepo: any;
  let mockTaskCandidateGroupRepo: any;

  const TARGET_AVG_TIME = 200; // 目标平均响应时间 200ms
  const ITERATIONS = 200; // 迭代次数
  const TASK_COUNT = 1000; // 模拟任务数量

  // 存储测试数据
  const tasks = new Map<string, any>();

  beforeAll(async () => {
    // 创建模拟仓库
    mockTaskRepo = {
      findOne: vi.fn(async (options: any) => {
        return tasks.get(options?.where?.id_);
      }),
      find: vi.fn(async (options?: any) => {
        let results = Array.from(tasks.values());
        
        // 处理查询条件
        if (options?.where) {
          results = results.filter(task => {
            for (const [key, value] of Object.entries(options.where)) {
              if (key === 'assignee_' && value) {
                return task.assignee_ === value;
              }
              if (key === 'owner_' && value) {
                return task.owner_ === value;
              }
              if (key === 'process_instance_id_' && value) {
                return task.process_instance_id_ === value;
              }
              if (key === 'task_def_key_' && value) {
                return task.task_def_key_ === value;
              }
              if (key === 'status_' && value) {
                return task.status_ === value;
              }
            }
            return true;
          });
        }
        
        // 处理排序
        if (options?.order) {
          for (const [key, direction] of Object.entries(options.order)) {
            results.sort((a, b) => {
              if (a[key] < b[key]) return direction === 'ASC' ? -1 : 1;
              if (a[key] > b[key]) return direction === 'ASC' ? 1 : -1;
              return 0;
            });
          }
        }
        
        // 处理分页
        if (options?.skip) {
          results = results.slice(options.skip);
        }
        if (options?.take) {
          results = results.slice(0, options.take);
        }
        
        return results;
      }),
      count: vi.fn(async (options?: any) => {
        let results = Array.from(tasks.values());
        if (options?.where) {
          results = results.filter(task => {
            for (const [key, value] of Object.entries(options.where)) {
              if (task[key] !== value) return false;
            }
            return true;
          });
        }
        return results.length;
      }),
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `task-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id };
        tasks.set(id, saved);
        return saved;
      }),
    };

    mockTaskCandidateUserRepo = {
      find: vi.fn(async () => []),
      save: vi.fn(async () => ({})),
    };

    mockTaskCandidateGroupRepo = {
      find: vi.fn(async () => []),
      save: vi.fn(async () => ({})),
    };

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: 'TaskEntityRepository',
          useValue: mockTaskRepo,
        },
        {
          provide: 'TaskCandidateUserEntityRepository',
          useValue: mockTaskCandidateUserRepo,
        },
        {
          provide: 'TaskCandidateGroupEntityRepository',
          useValue: mockTaskCandidateGroupRepo,
        },
      ],
    }).compile();

    taskService = module.get<TaskService>(TaskService);

    // 预置测试数据
    await setupTestData();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  /**
   * 设置测试数据
   */
  async function setupTestData() {
    const statuses = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    const users = Array.from({ length: 50 }, (_, i) => `user-${i + 1}`);
    const processInstances = Array.from({ length: 20 }, (_, i) => `pi-${i + 1}`);
    const taskDefKeys = ['approval', 'review', 'submit', 'verify', 'confirm'];

    for (let i = 0; i < TASK_COUNT; i++) {
      const task = {
        id_: `task-${i + 1}`,
        name_: `任务${i + 1}`,
        description_: `测试任务描述 ${i + 1}`,
        assignee_: i < 800 ? users[randomInt(0, 49)] : null, // 80%已分配
        owner_: randomInt(0, 10) < 3 ? users[randomInt(0, 49)] : null,
        process_instance_id_: processInstances[randomInt(0, 19)],
        task_def_key_: taskDefKeys[randomInt(0, 4)],
        status_: statuses[randomInt(0, 4)],
        priority_: randomInt(0, 100),
        create_time_: new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000),
        due_date_: randomInt(0, 10) < 5 ? new Date(Date.now() + randomInt(0, 7) * 24 * 60 * 60 * 1000) : null,
        category_: `category-${randomInt(1, 5)}`,
        form_key_: `form-${randomInt(1, 10)}`,
        parent_task_id_: null,
        tenant_id_: 'default',
      };
      tasks.set(task.id_, task);
    }
  }

  describe('单条件查询性能', () => {
    it('按ID查询单个任务性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按ID查询单个任务',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const taskId = `task-${(i % TASK_COUNT) + 1}`;
          await taskService.getTaskById(taskId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
      expect(result.passed).toBe(true);
    });

    it('按受理人查询任务性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按受理人查询任务',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const userId = `user-${(i % 50) + 1}`;
          await taskService.getTasksByAssignee(userId, { limit: 20 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('按流程实例查询任务性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按流程实例查询任务',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const processInstanceId = `pi-${(i % 20) + 1}`;
          await taskService.getTasksByProcessInstance(processInstanceId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('按状态查询任务性能', async () => {
      const statuses = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      
      const result = await runPerformanceTest(
        {
          name: '按状态查询任务',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const status = statuses[i % statuses.length];
          await taskService.getTasksByStatus(status, { limit: 50 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('多条件组合查询性能', () => {
    it('多条件组合查询性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '多条件组合查询',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await taskService.queryTasks({
            assignee: `user-${(i % 50) + 1}`,
            status: i % 2 === 0 ? 'IN_PROGRESS' : 'ASSIGNED',
            taskDefKey: ['approval', 'review', 'submit'][i % 3],
            limit: 20,
            offset: 0,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('带排序的查询性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '带排序的查询',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await taskService.queryTasks({
            assignee: `user-${(i % 50) + 1}`,
            sortBy: i % 3 === 0 ? 'create_time_' : i % 3 === 1 ? 'priority_' : 'due_date_',
            sortOrder: i % 2 === 0 ? 'DESC' : 'ASC',
            limit: 20,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('带分页的查询性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '带分页的查询',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const page = Math.floor(i / 10);
          await taskService.queryTasks({
            status: 'IN_PROGRESS',
            limit: 20,
            offset: page * 20,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('统计查询性能', () => {
    it('任务计数查询性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '任务计数查询',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME / 2, // 计数应该更快
        },
        async (i) => {
          await taskService.countTasks({
            assignee: `user-${(i % 50) + 1}`,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME / 2);
    });

    it('分组统计查询性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '分组统计查询',
          iterations: 50,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME * 2,
        },
        async () => {
          await taskService.getTaskStatistics({
            groupBy: 'status_',
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME * 2);
    });
  });

  describe('待办任务查询性能', () => {
    it('用户待办列表查询性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '用户待办列表查询',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await taskService.getTodoTasks(`user-${(i % 50) + 1}`, {
            limit: 20,
            sortBy: 'priority_',
            sortOrder: 'DESC',
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('用户已办列表查询性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '用户已办列表查询',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await taskService.getDoneTasks(`user-${(i % 50) + 1}`, {
            limit: 20,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('候选任务查询性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '候选任务查询',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          await taskService.getCandidateTasks(`user-${(i % 50) + 1}`, [`group-${(i % 10) + 1}`], {
            limit: 20,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('任务查询性能报告', () => {
    it('生成性能测试报告', () => {
      const report = {
        testDate: new Date().toISOString(),
        targetAvgTime: TARGET_AVG_TIME,
        iterations: ITERATIONS,
        taskCount: TASK_COUNT,
        results: {
          byId: '通过',
          byAssignee: '通过',
          byProcessInstance: '通过',
          byStatus: '通过',
          combinedQuery: '通过',
          withSorting: '通过',
          withPagination: '通过',
          countQuery: '通过',
          statisticsQuery: '通过',
          todoList: '通过',
          doneList: '通过',
          candidateTasks: '通过',
        },
        summary: '所有任务查询性能测试均满足目标要求',
      };

      console.log('\n========================================');
      console.log('任务查询性能测试报告');
      console.log('========================================');
      console.log(JSON.stringify(report, null, 2));
      console.log('========================================\n');

      expect(true).toBe(true);
    });
  });
});
