import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { 
  SlowQueryLogService, 
  SlowQueryLog, 
  SlowQueryStats, 
  SlowQueryConfig 
} from './slow-query-log.service';

describe('SlowQueryLogService', () => {
  let service: SlowQueryLogService;
  let dataSource: vi.Mocked<DataSource>;
  let configService: vi.Mocked<ConfigService>;
  let eventEmitter: vi.Mocked<EventEmitter2>;

  beforeEach(async () => {
    // 创建 mock DataSource
    dataSource = {
      isInitialized: true,
      logger: null,
    } as any;

    // 创建 mock ConfigService
    configService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          SLOW_QUERY_ENABLED: 'true',
          SLOW_QUERY_THRESHOLD: '500',
          SLOW_QUERY_LOG_CONSOLE: 'true',
          SLOW_QUERY_LOG_FILE: 'false',
          SLOW_QUERY_MAX_LOG_SIZE: '100',
          SLOW_QUERY_SAMPLE_RATE: '1',
          SLOW_QUERY_INCLUDE_STACK: 'false',
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    // 创建 mock EventEmitter2
    eventEmitter = {
      emit: vi.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlowQueryLogService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: configService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<SlowQueryLogService>(SlowQueryLogService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该正确初始化服务', () => {
      expect(service).toBeDefined();
    });

    it('应该从配置加载默认配置', () => {
      const config = service.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.threshold).toBe(500);
      expect(config.logToConsole).toBe(true);
      expect(config.maxLogSize).toBe(100);
    });

    it('应该在模块初始化时附加监听器', async () => {
      await service.onModuleInit();
      expect(dataSource.logger).toBeDefined();
    });

    it('应该在模块销毁时分离监听器', () => {
      service.onModuleDestroy();
      // 验证没有抛出异常
    });
  });

  describe('logSlowQuery', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('应该记录超过阈值的慢查询', () => {
      const query = 'SELECT * FROM task WHERE assignee = ?';
      const parameters = ['user1'];
      const duration = 600;

      service.logSlowQuery(query, parameters, duration);

      const logs = service.getRecentSlowQueries();
      expect(logs.length).toBe(1);
      expect(logs[0].query).toBe(query);
      expect(logs[0].duration).toBe(duration);
    });

    it('应该忽略低于阈值的查询', () => {
      const query = 'SELECT * FROM task WHERE id = ?';
      const duration = 300; // 低于阈值

      service.logSlowQuery(query, [], duration);

      const logs = service.getRecentSlowQueries();
      expect(logs.length).toBe(0);
    });

    it('应该排除匹配排除模式的查询', () => {
      const query = 'SELECT 1'; // 健康检查
      const duration = 600;

      service.logSlowQuery(query, [], duration);

      const logs = service.getRecentSlowQueries();
      expect(logs.length).toBe(0);
    });

    it('应该清理查询字符串中的多余空白', () => {
      const query = 'SELECT  *   FROM    task';
      const duration = 600;

      service.logSlowQuery(query, [], duration);

      const logs = service.getRecentSlowQueries();
      expect(logs[0].query).toBe('SELECT * FROM task');
    });

    it('应该截断过长的参数', () => {
      const query = 'SELECT * FROM task WHERE name = ?';
      const longParam = 'a'.repeat(300);
      const duration = 600;

      service.logSlowQuery(query, [longParam], duration);

      const logs = service.getRecentSlowQueries();
      expect(logs[0].parameters![0].length).toBeLessThan(250);
      expect(logs[0].parameters![0]).toContain('[truncated]');
    });

    it('应该发送慢查询事件', () => {
      const query = 'SELECT * FROM task';
      const duration = 600;

      service.logSlowQuery(query, [], duration);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'slow_query.detected',
        expect.objectContaining({
          query,
          duration,
        })
      );
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('无日志时应该返回空统计', () => {
      const stats = service.getStats();
      expect(stats.totalSlowQueries).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });

    it('应该正确计算统计数据', () => {
      // 添加一些慢查询
      service.logSlowQuery('SELECT * FROM task', [], 600);
      service.logSlowQuery('SELECT * FROM process_instance', [], 800);
      service.logSlowQuery('UPDATE task SET status = ?', [], 1000);

      const stats = service.getStats();
      expect(stats.totalSlowQueries).toBe(3);
      expect(stats.averageDuration).toBe(800);
      expect(stats.maxDuration).toBe(1000);
      expect(stats.minDuration).toBe(600);
    });

    it('应该正确统计表访问频率', () => {
      service.logSlowQuery('SELECT * FROM task WHERE id = ?', [], 600);
      service.logSlowQuery('SELECT * FROM task WHERE name = ?', [], 700);
      service.logSlowQuery('SELECT * FROM process_instance', [], 800);

      const stats = service.getStats();
      expect(stats.queriesByTable['task']).toBe(2);
      expect(stats.queriesByTable['process_instance']).toBe(1);
    });

    it('应该正确统计操作类型', () => {
      service.logSlowQuery('SELECT * FROM task', [], 600);
      service.logSlowQuery('SELECT * FROM process', [], 700);
      service.logSlowQuery('UPDATE task SET status = ?', [], 800);
      service.logSlowQuery('INSERT INTO log VALUES (?)', [], 900);

      const stats = service.getStats();
      expect(stats.queriesByOperation['SELECT']).toBe(2);
      expect(stats.queriesByOperation['UPDATE']).toBe(1);
      expect(stats.queriesByOperation['INSERT']).toBe(1);
    });
  });

  describe('getRecentSlowQueries', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('应该返回最近的慢查询', () => {
      for (let i = 0; i < 10; i++) {
        service.logSlowQuery(`SELECT ${i}`, [], 600 + i * 100);
      }

      const logs = service.getRecentSlowQueries(5);
      expect(logs.length).toBe(5);
      // 应该是倒序返回
      expect(logs[0].query).toBe('SELECT 9');
    });

    it('应该限制返回数量', () => {
      for (let i = 0; i < 100; i++) {
        service.logSlowQuery(`SELECT ${i}`, [], 600);
      }

      const logs = service.getRecentSlowQueries(10);
      expect(logs.length).toBe(10);
    });
  });

  describe('getSlowQueriesByTable', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('应该返回指定表的慢查询', () => {
      service.logSlowQuery('SELECT * FROM task WHERE id = ?', [], 600);
      service.logSlowQuery('SELECT * FROM process_instance', [], 700);
      service.logSlowQuery('UPDATE task SET status = ?', [], 800);

      const taskLogs = service.getSlowQueriesByTable('task');
      expect(taskLogs.length).toBe(2);
    });

    it('表名不存在时应该返回空数组', () => {
      service.logSlowQuery('SELECT * FROM task', [], 600);

      const logs = service.getSlowQueriesByTable('nonexistent');
      expect(logs.length).toBe(0);
    });
  });

  describe('getSlowQueriesAboveDuration', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('应该返回超过指定时间的查询', () => {
      service.logSlowQuery('SELECT 1', [], 600);
      service.logSlowQuery('SELECT 2', [], 1000);
      service.logSlowQuery('SELECT 3', [], 1500);

      const logs = service.getSlowQueriesAboveDuration(900);
      expect(logs.length).toBe(2);
    });
  });

  describe('clearLogs', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('应该清除所有日志', () => {
      service.logSlowQuery('SELECT * FROM task', [], 600);
      service.logSlowQuery('SELECT * FROM process', [], 700);

      service.clearLogs();

      const logs = service.getRecentSlowQueries();
      expect(logs.length).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('应该更新配置', () => {
      service.updateConfig({ threshold: 1000 });
      const config = service.getConfig();
      expect(config.threshold).toBe(1000);
    });

    it('应该保留未更新的配置', () => {
      const originalConfig = service.getConfig();
      service.updateConfig({ logToConsole: false });
      const newConfig = service.getConfig();
      expect(newConfig.threshold).toBe(originalConfig.threshold);
      expect(newConfig.logToConsole).toBe(false);
    });
  });

  describe('analyzeAndSuggest', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('无日志时应该返回默认建议', () => {
      const suggestions = service.analyzeAndSuggest();
      expect(suggestions).toContain('暂无慢查询记录');
    });

    it('应该检测高频慢查询表', () => {
      // 添加针对同一表的多个慢查询
      for (let i = 0; i < 15; i++) {
        service.logSlowQuery(`SELECT * FROM task WHERE id = ${i}`, [], 600);
      }

      const suggestions = service.analyzeAndSuggest();
      expect(suggestions.some(s => s.includes('task') && s.includes('索引'))).toBe(true);
    });

    it('应该检测高平均执行时间', () => {
      service.logSlowQuery('SELECT * FROM task', [], 3000);
      service.logSlowQuery('SELECT * FROM process', [], 4000);

      const suggestions = service.analyzeAndSuggest();
      expect(suggestions.some(s => s.includes('平均') && s.includes('优化'))).toBe(true);
    });

    it('应该检测超高执行时间', () => {
      service.logSlowQuery('SELECT * FROM large_table', [], 15000);

      const suggestions = service.analyzeAndSuggest();
      expect(suggestions.some(s => s.includes('10秒') || s.includes('立即'))).toBe(true);
    });

    it('应该检测 SELECT 操作占比较高', () => {
      for (let i = 0; i < 10; i++) {
        service.logSlowQuery(`SELECT * FROM table${i}`, [], 600);
      }
      service.logSlowQuery('UPDATE table SET x = 1', [], 600);

      const suggestions = service.analyzeAndSuggest();
      expect(suggestions.some(s => s.includes('SELECT') && s.includes('索引'))).toBe(true);
    });
  });

  describe('日志大小限制', () => {
    it('应该限制最大日志数量', async () => {
      await service.onModuleInit();
      
      // 添加超过最大限制的日志
      for (let i = 0; i < 150; i++) {
        service.logSlowQuery(`SELECT ${i}`, [], 600);
      }

      const stats = service.getStats();
      expect(stats.totalSlowQueries).toBeLessThanOrEqual(100);
    });
  });

  describe('采样率', () => {
    it('应该根据采样率过滤查询', async () => {
      service.updateConfig({ sampleRate: 0 }); // 0% 采样率
      await service.onModuleInit();

      service.logSlowQuery('SELECT * FROM task', [], 600);

      const logs = service.getRecentSlowQueries();
      expect(logs.length).toBe(0);
    });
  });
});
