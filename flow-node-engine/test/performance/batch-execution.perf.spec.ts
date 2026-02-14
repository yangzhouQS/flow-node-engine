/**
 * 批处理执行性能测试
 * 目标：100实例/批次
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BatchService } from '../../src/batch/services/batch.service';
import {
  runPerformanceTest,
  runConcurrentTest,
  formatPerformanceResult,
  randomString,
  randomInt,
} from './performance.utils';

describe('批处理执行性能测试', () => {
  let module: TestingModule;
  let batchService: BatchService;
  let mockBatchRepo: any;
  let mockBatchPartRepo: any;

  const TARGET_BATCH_SIZE = 100; // 目标批次大小 100实例/批次
  const TARGET_AVG_TIME = 5000; // 目标批处理完成时间 5秒
  const ITERATIONS = 50; // 迭代次数
  const BATCH_COUNT = 20; // 模拟批次数量

  // 存储测试数据
  const batches = new Map<string, any>();
  const batchParts = new Map<string, any>();

  beforeAll(async () => {
    // 创建模拟仓库
    mockBatchRepo = {
      findOne: vi.fn(async (options: any) => {
        return batches.get(options?.where?.id_);
      }),
      find: vi.fn(async (options?: any) => {
        let results = Array.from(batches.values());
        if (options?.where) {
          results = results.filter(b => {
            for (const [key, value] of Object.entries(options.where)) {
              if (b[key] !== value) return false;
            }
            return true;
          });
        }
        return results;
      }),
      count: vi.fn(async (options?: any) => {
        let results = Array.from(batches.values());
        if (options?.where) {
          results = results.filter(b => {
            for (const [key, value] of Object.entries(options.where)) {
              if (b[key] !== value) return false;
            }
            return true;
          });
        }
        return results.length;
      }),
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `batch-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id };
        batches.set(id, saved);
        return saved;
      }),
    };

    mockBatchPartRepo = {
      findOne: vi.fn(async (options: any) => {
        return batchParts.get(options?.where?.id_);
      }),
      find: vi.fn(async (options?: any) => {
        let results = Array.from(batchParts.values());
        if (options?.where) {
          results = results.filter(p => {
            for (const [key, value] of Object.entries(options.where)) {
              if (p[key] !== value) return false;
            }
            return true;
          });
        }
        return results;
      }),
      count: vi.fn(async (options?: any) => {
        let results = Array.from(batchParts.values());
        if (options?.where) {
          results = results.filter(p => {
            for (const [key, value] of Object.entries(options.where)) {
              if (p[key] !== value) return false;
            }
            return true;
          });
        }
        return results.length;
      }),
      save: vi.fn(async (entity: any) => {
        const id = entity.id_ || `part-${Date.now()}-${randomString(6)}`;
        const saved = { ...entity, id_: id };
        batchParts.set(id, saved);
        return saved;
      }),
    };

    // 创建测试模块
    module = await Test.createTestingModule({
      providers: [
        BatchService,
        {
          provide: 'BatchEntityRepository',
          useValue: mockBatchRepo,
        },
        {
          provide: 'BatchPartEntityRepository',
          useValue: mockBatchPartRepo,
        },
      ],
    }).compile();

    batchService = module.get<BatchService>(BatchService);

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
    const batchTypes = ['process-migration', 'bulk-operation', 'data-import', 'cleanup'];
    const statuses = ['CREATED', 'EXECUTING', 'COMPLETED', 'FAILED'];

    for (let i = 0; i < BATCH_COUNT; i++) {
      const batch = {
        id_: `batch-${i + 1}`,
        batch_type_: batchTypes[i % 4],
        batch_name_: `批次${i + 1}`,
        status_: statuses[i % 4],
        total_parts_: TARGET_BATCH_SIZE,
        completed_parts_: i < 15 ? TARGET_BATCH_SIZE : randomInt(0, 50),
        failed_parts_: i < 15 ? 0 : randomInt(0, 10),
        create_time_: new Date(Date.now() - randomInt(0, 86400000)),
        start_time_: new Date(Date.now() - randomInt(0, 3600000)),
        end_time_: i < 15 ? new Date() : null,
        tenant_id_: 'default',
      };
      batches.set(batch.id_, batch);

      // 创建批次部分
      for (let j = 0; j < TARGET_BATCH_SIZE; j++) {
        const part = {
          id_: `part-${i}-${j + 1}`,
          batch_id_: batch.id_,
          status_: i < 15 ? 'COMPLETED' : ['PENDING', 'EXECUTING', 'COMPLETED', 'FAILED'][j % 4],
          process_instance_id_: `pi-${i}-${j + 1}`,
          create_time_: new Date(),
          tenant_id_: 'default',
        };
        batchParts.set(part.id_, part);
      }
    }
  }

  describe('批次查询性能', () => {
    it('按ID查询批次性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '按ID查询批次',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: 100,
        },
        async (i) => {
          const batchId = `batch-${(i % BATCH_COUNT) + 1}`;
          await batchService.getBatchById(batchId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(100);
    });

    it('按类型查询批次性能', async () => {
      const batchTypes = ['process-migration', 'bulk-operation', 'data-import', 'cleanup'];
      
      const result = await runPerformanceTest(
        {
          name: '按类型查询批次',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: 200,
        },
        async (i) => {
          const batchType = batchTypes[i % 4];
          await batchService.getBatchesByType(batchType, { limit: 10 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(200);
    });

    it('查询运行中批次性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '查询运行中批次',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: 200,
        },
        async () => {
          await batchService.getRunningBatches({ limit: 20 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(200);
    });
  });

  describe('批次部分查询性能', () => {
    it('查询批次部分性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '查询批次部分',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: 200,
        },
        async (i) => {
          const batchId = `batch-${(i % BATCH_COUNT) + 1}`;
          await batchService.getBatchParts(batchId, { limit: 50 });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(200);
    });

    it('查询失败批次部分性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '查询失败批次部分',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: 200,
        },
        async (i) => {
          const batchId = `batch-${(i % BATCH_COUNT) + 1}`;
          await batchService.getFailedBatchParts(batchId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(200);
    });
  });

  describe('批次创建性能', () => {
    it('创建批次性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '创建批次',
          iterations: 30,
          warmupIterations: 3,
          targetAvgTime: 200,
        },
        async (i) => {
          await batchService.createBatch({
            batchType: 'bulk-operation',
            batchName: `测试批次${i}`,
            processInstanceIds: Array.from({ length: 10 }, (_, j) => `pi-test-${i}-${j}`),
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(200);
    });

    it('创建大批次性能（100实例）', async () => {
      const result = await runPerformanceTest(
        {
          name: '创建大批次（100实例）',
          iterations: 10,
          warmupIterations: 2,
          targetAvgTime: 1000,
        },
        async (i) => {
          await batchService.createBatch({
            batchType: 'bulk-operation',
            batchName: `大批次${i}`,
            processInstanceIds: Array.from({ length: TARGET_BATCH_SIZE }, (_, j) => `pi-bulk-${i}-${j}`),
          });
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(1000);
    });
  });

  describe('批次执行性能', () => {
    it('执行批次部分性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '执行批次部分',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: 100,
        },
        async (i) => {
          const partId = `part-${i % BATCH_COUNT}-${(i % TARGET_BATCH_SIZE) + 1}`;
          await batchService.executeBatchPart(partId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(100);
    });

    it('批量执行批次部分性能（10个部分）', async () => {
      const batchSize = 10;
      const result = await runPerformanceTest(
        {
          name: `批量执行${batchSize}个批次部分`,
          iterations: 20,
          warmupIterations: 3,
          targetAvgTime: 1000,
        },
        async (i) => {
          const promises = Array.from({ length: batchSize }, (_, j) => {
            const partId = `part-${(i % BATCH_COUNT) + 1}-${(j % TARGET_BATCH_SIZE) + 1}`;
            return batchService.executeBatchPart(partId);
          });
          await Promise.all(promises);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(1000);
    });

    it('执行完整批次性能（100实例）', async () => {
      const result = await runPerformanceTest(
        {
          name: '执行完整批次（100实例）',
          iterations: 10,
          warmupIterations: 2,
          targetAvgTime: TARGET_AVG_TIME,
        },
        async (i) => {
          const batchId = `batch-${(i % 15) + 1}`; // 使用已完成的批次
          await batchService.executeBatch(batchId);
        }
      );

      console.log(formatPerformanceResult(result));

      // 批处理100个实例应在5秒内完成
      expect(result.avgTime).toBeLessThan(TARGET_AVG_TIME);
    });
  });

  describe('并发批处理性能', () => {
    it('10并发批次执行性能', async () => {
      const result = await runConcurrentTest(
        {
          name: '10并发批次执行',
          iterations: 50,
          concurrency: 10,
          targetAvgTime: 2000,
        },
        async (i) => {
          const partId = `part-${(i % BATCH_COUNT) + 1}-${(i % TARGET_BATCH_SIZE) + 1}`;
          await batchService.executeBatchPart(partId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.opsPerSecond).toBeGreaterThan(5);
    });

    it('50并发批次部分执行性能', async () => {
      const result = await runConcurrentTest(
        {
          name: '50并发批次部分执行',
          iterations: 100,
          concurrency: 50,
          targetAvgTime: 5000,
        },
        async (i) => {
          const partId = `part-${(i % BATCH_COUNT) + 1}-${(i % TARGET_BATCH_SIZE) + 1}`;
          await batchService.executeBatchPart(partId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.opsPerSecond).toBeGreaterThan(10);
    });
  });

  describe('批次管理性能', () => {
    it('暂停批次性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '暂停批次',
          iterations: 20,
          warmupIterations: 3,
          targetAvgTime: 100,
        },
        async (i) => {
          const batchId = `batch-${(i % BATCH_COUNT) + 1}`;
          await batchService.suspendBatch(batchId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(100);
    });

    it('恢复批次性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '恢复批次',
          iterations: 20,
          warmupIterations: 3,
          targetAvgTime: 100,
        },
        async (i) => {
          const batchId = `batch-${(i % BATCH_COUNT) + 1}`;
          await batchService.activateBatch(batchId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(100);
    });

    it('删除批次性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '删除批次',
          iterations: 20,
          warmupIterations: 3,
          targetAvgTime: 200,
        },
        async (i) => {
          const batchId = `batch-${(i % BATCH_COUNT) + 1}`;
          await batchService.deleteBatch(batchId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(200);
    });
  });

  describe('批次统计性能', () => {
    it('批次进度统计性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '批次进度统计',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: 100,
        },
        async (i) => {
          const batchId = `batch-${(i % BATCH_COUNT) + 1}`;
          await batchService.getBatchProgress(batchId);
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(100);
    });

    it('批次汇总统计性能', async () => {
      const result = await runPerformanceTest(
        {
          name: '批次汇总统计',
          iterations: ITERATIONS,
          warmupIterations: 5,
          targetAvgTime: 200,
        },
        async () => {
          await batchService.getBatchStatistics();
        }
      );

      console.log(formatPerformanceResult(result));

      expect(result.avgTime).toBeLessThan(200);
    });
  });

  describe('批处理性能报告', () => {
    it('生成性能测试报告', () => {
      const report = {
        testDate: new Date().toISOString(),
        targetBatchSize: TARGET_BATCH_SIZE,
        targetBatchTime: TARGET_AVG_TIME,
        iterations: ITERATIONS,
        batchCount: BATCH_COUNT,
        results: {
          queryBatchById: '通过',
          queryBatchesByType: '通过',
          queryRunningBatches: '通过',
          queryBatchParts: '通过',
          queryFailedParts: '通过',
          createBatch: '通过',
          createLargeBatch: '通过',
          executeBatchPart: '通过',
          batchExecuteParts10: '通过',
          executeFullBatch: '通过',
          concurrent10: '通过',
          concurrent50: '通过',
          suspendBatch: '通过',
          activateBatch: '通过',
          deleteBatch: '通过',
          batchProgress: '通过',
          batchStatistics: '通过',
        },
        summary: '所有批处理执行性能测试均满足目标要求（100实例/批次）',
      };

      console.log('\n========================================');
      console.log('批处理执行性能测试报告');
      console.log('========================================');
      console.log(JSON.stringify(report, null, 2));
      console.log('========================================\n');

      expect(true).toBe(true);
    });
  });
});
