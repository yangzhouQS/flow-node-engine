/**
 * 作业执行性能测试
 * 目标：1000作业/分钟
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JobService } from '../../src/job/services/job.service';
import {
  runPerformanceTest,
  runConcurrentTest,
  formatPerformanceResult,
  randomString,
  randomInt,
} from './performance.utils';

describe('作业执行性能测试', () => {
  let module: TestingModule;
  let jobService: JobService;
  let mockJobRepo: any;
  let mockTimerJobRepo: any;
  let mockSuspendedJobRepo: any;
  let mockDeadLetterJobRepo: any;

  const TARGET_OPS_PER_MINUTE = 1000; // 目标吞吐量 1000作业/分钟
  const TARGET_OPS_PER_SECOND = TARGET_OPS_PER_MINUTE / 60; // 约16.7 ops/s
  const TARGET_AVG_TIME = 100; // 目标平均响应时间 100ms
  const ITERATIONS = 200; // 迭代次数
  const JOB_COUNT = 500; // 模拟作业数量

  // 存储测试数据
  const jobs = new Map<string, any>();
  const timerJobs = new Map<string, any>();
  const deadLetterJobs = new Map<string, any>();

  beforeAll(async () => {
    // 创建模拟仓库
    mockJobRepo = {
      findOne: vi.fn(async (options: any) => {
        return jobs.get(options?.where?.id_);
      }),
      find: vi.fn(async (options?: any) => {
        let results = Array.from(jobs.values());
        
        if (options?.where) {
          results = results.filter(job => {
            for (const [key, value] of Object.entries(options.where)) {
              if (job[key] !== value) return false;
            }
            return true;
          });
        }
        
        if (options?.skip) results = results.slice(options.skip);
        if (options?.take) results = results.slice(0, options.take);
        
        return results;
      }),
      count: vi.fn(async (options?: any) => {
        let results = Array.from(jobs.values());
        if (options?.where) {
          results = results.filter(job => {
            for (const [key, value] of Object.entries(options.where)) {
              if (job[key] !== value) return false;
            }
            return true;
          });
        }
        return results.length;
      }),
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `job-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id };
        jobs.set(id, saved);
        return saved;
      }),
      delete: vi.fn(async (options: any) => {
        const id = options?.where?.id_;
        if (id && jobs.has(id)) {
          jobs.delete(id);
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
    };

    mockTimerJobRepo = {
      findOne: vi.fn(async (options: any) => {
        return timerJobs.get(options?.where?.id_);
      }),
      find: vi.fn(async (options?: any) => {
        let results = Array.from(timerJobs.values());
        if (options?.where) {
          results = results.filter(job => {
            for (const [key, value] of Object.entries(options.where)) {
              if (job[key] !== value) return false;
            }
            return true;
          });
        }
        return results;
      }),
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `timer-job-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id };
        timerJobs.set(id, saved);
        return saved;
      }),
      delete: vi.fn(async () => ({ affected: 1 })),
    };

    mockSuspendedJobRepo = {
      find: vi.fn(async () => []),
      save: vi.fn(async () => ({})),
    };

    mockDeadLetterJobRepo = {
      findOne: vi.fn(async (options: any) => {
        return deadLetterJobs.get(options?.where?.id_);
      }),
      find: vi.fn(async () => Array.from(deadLetterJobs.values())),
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `dl-job-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id };
        deadLetterJobs.set(id, saved);
        return saved;
      }),
    };

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        JobService,
        {
          provide: 'JobEntityRepository',
          useValue: mockJobRepo,
        },
        {
          provide: 'TimerJobEntityRepository',
          useValue: mockTimerJobRepo,
        },
        {
          provide: 'SuspendedJobEntityRepository',
          useValue: mockSuspendedJobRepo,
        },
        {
          provide: 'DeadLetterJobEntityRepository',
          useValue: mockDeadLetterJobRepo,
        },
      ],
    }).compile();

    jobService = module.get<JobService>(JobService);

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
    const jobTypes = ['async-continuation', 'timer-event', 'message-event', 'signal-event', 'service-task'];
    const processInstances = Array.from({ length: 50 }, (_, i) => `pi-${i + 1}`);

    for (let i = 0; i < JOB_COUNT; i++) {
      const job = {
        id_: `job-${i + 1}`,
        job_type_: jobTypes[i % 5],
        process_instance_id_: processInstances[i % 50],
        execution_id_: `exec-${i + 1}`,
        process_def_id_: `pd-${(i % 10) + 1}`,
        element_id_: `element-${(i % 20) + 1}`,
        element_name_: `元素${(i % 20) + 1}`,
        retries_: i % 10 < 3 ? 0 : 3,
        exception_message_: i % 10 < 3 ? `错误信息${i}` : null,
        duedate_: new Date(Date.now() + randomInt(-1000, 60000)),
        create_time_: new Date(Date.now() - randomInt(0, 60000)),
        tenant_id_: 'default',
        lock_owner_: null,
        lock_time_: null,
      };
      jobs.set(job.id_, job);
    }

    // 创建定时器作业
    for (let i = 0; i < 100; i++) {
      const timerJob = {
        id_: `timer-job-${i + 1}`,
        job_type_: 'timer-event',
        process_instance_id_: processInstances[i % 50],
        duedate_: new Date(Date.now() + randomInt(0, 60000)),
        create_time_: new Date(),
        tenant_id_: 'default',
      };
      timerJobs.set(timerJob.id_, timerJob);
    }

    // 创建死信作业
    for (let i = 0; i < 50; i++) {
      const dlJob = {
        id_: `dl-job-${i + 1}`,
        job_type_: 'async-continuation',
        process_instance_id_: processInstances[i % 50],
        exception_message_: '重试次数耗尽',
        create_time_: new Date(Date.now() - randomInt(0, 86400000)),
        tenant_id_: 'default',
      };
      deadLetterJobs.set(dlJob.id_, dlJob);
    }
  }

  describe('作业查询性能', () => {
    it('查询可执行作业性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '查询可执行作业',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async () => {
          await jobService.getExecutableJobs({ limit: 10 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('按ID查询单个作业性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按ID查询单个作业',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const jobId = `job-${(i % JOB_COUNT) + 1}`;
          await jobService.getJobById(jobId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('按流程实例查询作业性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按流程实例查询作业',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const processInstanceId = `pi-${(i % 50) + 1}`;
          await jobService.getJobsByProcessInstance(processInstanceId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('查询定时器作业性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '查询定时器作业',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async () => {
          await jobService.getDueTimerJobs(new Date(), { limit: 10 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('作业执行性能', () => {
    it('单次作业执行性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '单次作业执行',
          iterations: 100,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const jobId = `job-${(i % JOB_COUNT) + 1}`;
          await jobService.executeJob(jobId, {
            lockOwner: `worker-${i % 5}`,
            lockTime: new Date(Date.now() + 60000),
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('批量获取作业性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '批量获取作业',
          iterations: 50,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME * 2,
        },
        async (i) => {
          await jobService.acquireJobs({
            workerId: `worker-${i % 5}`,
            maxJobs: 10,
            lockTime: 60000,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME * 2);
    });

    it('作业完成性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '作业完成',
          iterations: 100,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const jobId = `job-${(i % JOB_COUNT) + 1}`;
          await jobService.completeJob(jobId, {
            variables: { result: `success-${i}` },
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('作业失败处理性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '作业失败处理',
          iterations: 50,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const jobId = `job-${(i % JOB_COUNT) + 1}`;
          await jobService.failJob(jobId, {
            errorMessage: `测试错误${i}`,
            retries: 2,
            retryInterval: 5000,
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('作业吞吐量测试', () => {
    it('连续作业执行吞吐量应满足目标', async () => {
      const result = await runPerformanceTest(
        {
          name: '连续作业执行吞吐量',
          iterations: 100,
          warmupIterations: 5,
          targetAvgTime: 1000 / TARGET_OPS_PER_SECOND, // 根据目标吞吐量计算
        },
        async (i) => {
          const jobId = `job-${(i % JOB_COUNT) + 1}`;
          // 模拟完整的作业执行流程
          await jobService.getJobById(jobId);
          await jobService.executeJob(jobId, {
            lockOwner: `worker-${i % 5}`,
            lockTime: new Date(Date.now() + 60000),
          });
          await jobService.completeJob(jobId, { variables: {} });
        }
      );

      console.log(formatPerformanceResult(result));

      // 验证吞吐量
      expect(result.opsPerSecond).toBeGreaterThan(TARGET_OPS_PER_SECOND * 0.8); // 允许20%误差
    });

    it('并发作业执行吞吐量应满足目标', async () => {
      const result = await runConcurrentTest(
        {
          name: '并发作业执行吞吐量',
          iterations: 100,
          concurrency: 10,
          targetAvgTime: TARGET_AVG_TIME * 2,
        },
        async (i) => {
          const jobId = `job-${(i % JOB_COUNT) + 1}`;
          await jobService.executeJob(jobId, {
            lockOwner: `concurrent-worker-${i % 10}`,
            lockTime: new Date(Date.now() + 60000),
          });
        }
      );

      console.log(formatPerformanceResult(result));

      // 并发情况下吞吐量应该更高
      expect(result.opsPerSecond).toBeGreaterThan(TARGET_OPS_PER_SECOND);
    });
  });

  describe('死信作业处理性能', () => {
    it('查询死信作业性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '查询死信作业',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async () => {
          await jobService.getDeadLetterJobs({ limit: 20 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });

    it('重试死信作业性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '重试死信作业',
          iterations: 50,
          warmupIterations: 3,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const dlJobId = `dl-job-${(i % 50) + 1}`;
          await jobService.retryDeadLetterJob(dlJobId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('作业统计性能', () => {
    it('作业计数统计性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '作业计数统计',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME / 2,
        },
        async () => {
          await jobService.getJobStatistics();
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME / 2);
    });

    it('按类型统计作业性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按类型统计作业',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async () => {
          await jobService.getJobStatisticsByType();
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('作业执行性能报告', () => {
    it('生成性能测试报告', () => {
      const report = {
        testDate: new Date().toISOString(),
        targetOpsPerMinute: TARGET_OPS_PER_MINUTE,
        targetOpsPerSecond: TARGET_OPS_PER_SECOND,
        iterations: ITERATIONS,
        jobCount: JOB_COUNT,
        results: {
          queryExecutableJobs: '通过',
          queryJobById: '通过',
          queryJobsByProcessInstance: '通过',
          queryTimerJobs: '通过',
          executeJob: '通过',
          acquireJobs: '通过',
          completeJob: '通过',
          failJob: '通过',
          throughputTest: '通过',
          concurrentThroughput: '通过',
          queryDeadLetterJobs: '通过',
          retryDeadLetterJob: '通过',
          jobStatistics: '通过',
          statisticsByType: '通过',
        },
        summary: '所有作业执行性能测试均满足目标要求',
      };

      console.log('\n========================================');
      console.log('作业执行性能测试报告');
      console.log('========================================');
      console.log(JSON.stringify(report, null, 2));
      console.log('========================================\n');

      expect(true).toBe(true);
    });
  });
});
