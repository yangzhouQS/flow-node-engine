import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProcessDefinitionCacheService, CachedProcessDefinition, CachedBpmnParseResult } from './process-definition-cache.service';

describe('ProcessDefinitionCacheService', () => {
  let service: ProcessDefinitionCacheService;
  let mockCacheManager: any;

  beforeEach(async () => {
    // 创建模拟的缓存管理器
    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessDefinitionCacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<ProcessDefinitionCacheService>(ProcessDefinitionCacheService);
    await service.onModuleInit();
  });

  afterEach(() => {
    service.clearAll();
    service.resetStats();
  });

  // ========== 基础功能测试 ==========

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have default config', () => {
      const config = service.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.definitionTtl).toBe(3600);
      expect(config.parseResultTtl).toBe(7200);
      expect(config.enableLocalCache).toBe(true);
    });
  });

  // ========== getByKey 测试 ==========

  describe('getByKey', () => {
    it('should return null when cache is disabled', async () => {
      service.updateConfig({ enabled: false });

      const result = await service.getByKey('test-key');

      expect(result).toBeNull();
      expect(mockCacheManager.get).not.toHaveBeenCalled();
    });

    it('should return null when cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getByKey('test-key');

      expect(result).toBeNull();
      expect(mockCacheManager.get).toHaveBeenCalled();
    });

    it('should return cached data when local cache hit', async () => {
      const cachedData: CachedProcessDefinition = {
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
        cachedAt: Date.now(),
      };

      // 先设置本地缓存
      await service.set(cachedData);

      // 清除Redis调用记录
      mockCacheManager.get.mockClear();

      const result = await service.getByKey('test-key');

      expect(result).not.toBeNull();
      expect(result?.key).toBe('test-key');
    });

    it('should return cached data when Redis cache hit', async () => {
      const cachedData: CachedProcessDefinition = {
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
        cachedAt: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getByKey('test-key');

      expect(result).not.toBeNull();
      expect(result?.key).toBe('test-key');
    });

    it('should handle tenantId in cache key', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      await service.getByKey('test-key', 'tenant-1');

      // 验证缓存键包含租户ID
      expect(mockCacheManager.get).toHaveBeenCalledWith(
        expect.stringContaining('tenant-1')
      );
    });

    it('should update stats on cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      await service.getByKey('test-key');

      const stats = service.getStats();
      expect(stats.misses).toBe(1);
    });

    it('should update stats on cache hit', async () => {
      const cachedData: CachedProcessDefinition = {
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
        cachedAt: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      await service.getByKey('test-key');

      const stats = service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.hitsByKey).toBe(1);
    });
  });

  // ========== getById 测试 ==========

  describe('getById', () => {
    it('should return null when cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getById('test-id');

      expect(result).toBeNull();
    });

    it('should return cached data when hit', async () => {
      const cachedData: CachedProcessDefinition = {
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
        cachedAt: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getById('test-id');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-id');
    });

    it('should update hitsById stat', async () => {
      const cachedData: CachedProcessDefinition = {
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
        cachedAt: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      await service.getById('test-id');

      const stats = service.getStats();
      expect(stats.hitsById).toBe(1);
    });
  });

  // ========== getParseResult 测试 ==========

  describe('getParseResult', () => {
    it('should return null when cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getParseResult('proc-def-id');

      expect(result).toBeNull();
    });

    it('should return cached parse result when hit', async () => {
      const cachedData: CachedBpmnParseResult = {
        processElements: [{ id: 'element1' }],
        startEvents: [{ id: 'start1' }],
        endEvents: [{ id: 'end1' }],
        userTasks: [],
        serviceTasks: [],
        gateways: [],
        sequenceFlows: [],
        cachedAt: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      const result = await service.getParseResult('proc-def-id');

      expect(result).not.toBeNull();
      expect(result?.processElements).toHaveLength(1);
    });

    it('should update parseResultHits stat', async () => {
      const cachedData: CachedBpmnParseResult = {
        processElements: [],
        startEvents: [],
        endEvents: [],
        userTasks: [],
        serviceTasks: [],
        gateways: [],
        sequenceFlows: [],
        cachedAt: Date.now(),
      };

      mockCacheManager.get.mockResolvedValue(cachedData);

      await service.getParseResult('proc-def-id');

      const stats = service.getStats();
      expect(stats.parseResultHits).toBe(1);
    });
  });

  // ========== set 测试 ==========

  describe('set', () => {
    it('should not cache when disabled', async () => {
      service.updateConfig({ enabled: false });

      await service.set({
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
      });

      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });

    it('should cache process definition by key and id', async () => {
      await service.set({
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
      });

      // 应该调用两次set：一次按key，一次按id
      expect(mockCacheManager.set).toHaveBeenCalledTimes(2);
    });

    it('should include tenantId in cache key', async () => {
      await service.set(
        {
          id: 'test-id',
          key: 'test-key',
          version: 1,
          name: 'Test Process',
          isSuspended: false,
          bpmnXml: '<xml></xml>',
          deploymentId: 'deploy-1',
          resourceName: 'test.bpmn',
        },
        'tenant-1'
      );

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        expect.stringContaining('tenant-1'),
        expect.any(Object),
        expect.any(Number)
      );
    });

    it('should set cachedAt timestamp', async () => {
      await service.set({
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
      });

      const call = mockCacheManager.set.mock.calls[0];
      const cachedData = call[1] as CachedProcessDefinition;
      expect(cachedData.cachedAt).toBeDefined();
      expect(cachedData.cachedAt).toBeLessThanOrEqual(Date.now());
    });
  });

  // ========== setParseResult 测试 ==========

  describe('setParseResult', () => {
    it('should cache parse result', async () => {
      await service.setParseResult('proc-def-id', {
        processElements: [],
        startEvents: [],
        endEvents: [],
        userTasks: [],
        serviceTasks: [],
        gateways: [],
        sequenceFlows: [],
      });

      expect(mockCacheManager.set).toHaveBeenCalledTimes(1);
    });

    it('should set cachedAt timestamp', async () => {
      await service.setParseResult('proc-def-id', {
        processElements: [],
        startEvents: [],
        endEvents: [],
        userTasks: [],
        serviceTasks: [],
        gateways: [],
        sequenceFlows: [],
      });

      const call = mockCacheManager.set.mock.calls[0];
      const cachedData = call[1] as CachedBpmnParseResult;
      expect(cachedData.cachedAt).toBeDefined();
    });
  });

  // ========== invalidate 测试 ==========

  describe('invalidate', () => {
    it('should delete all related cache entries', async () => {
      await service.invalidate('test-key', 'test-id');

      // 应该删除3个缓存条目：key、id、parseResult
      expect(mockCacheManager.del).toHaveBeenCalledTimes(3);
    });

    it('should delete from local cache', async () => {
      // 先设置缓存
      await service.set({
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
      });

      // 然后失效
      await service.invalidate('test-key', 'test-id');

      // 验证本地缓存被清除
      const result = await service.getByKey('test-key');
      expect(result).toBeNull();
    });

    it('should include tenantId in invalidation', async () => {
      await service.invalidate('test-key', 'test-id', 'tenant-1');

      expect(mockCacheManager.del).toHaveBeenCalledWith(
        expect.stringContaining('tenant-1')
      );
    });
  });

  // ========== invalidateByKey 测试 ==========

  describe('invalidateByKey', () => {
    it('should delete cache by key only', async () => {
      await service.invalidateByKey('test-key');

      expect(mockCacheManager.del).toHaveBeenCalledTimes(1);
    });

    it('should include tenantId in invalidation', async () => {
      await service.invalidateByKey('test-key', 'tenant-1');

      expect(mockCacheManager.del).toHaveBeenCalledWith(
        expect.stringContaining('tenant-1')
      );
    });
  });

  // ========== clearAll 测试 ==========

  describe('clearAll', () => {
    it('should clear local cache', async () => {
      // 先设置一些缓存
      await service.set({
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
      });

      await service.clearAll();

      const stats = service.getStats();
      expect(stats.localCacheSize).toBe(0);
    });
  });

  // ========== 统计功能测试 ==========

  describe('stats', () => {
    it('should track hits and misses', async () => {
      const cachedData: CachedProcessDefinition = {
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
        cachedAt: Date.now(),
      };

      // 一次命中
      mockCacheManager.get.mockResolvedValueOnce(cachedData);
      await service.getByKey('test-key');

      // 一次未命中
      mockCacheManager.get.mockResolvedValueOnce(null);
      await service.getByKey('other-key');

      const stats = service.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it('should reset stats', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      await service.getByKey('test-key');

      service.resetStats();

      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  // ========== 配置更新测试 ==========

  describe('updateConfig', () => {
    it('should update config', () => {
      service.updateConfig({
        definitionTtl: 7200,
        enableLocalCache: false,
      });

      const config = service.getConfig();
      expect(config.definitionTtl).toBe(7200);
      expect(config.enableLocalCache).toBe(false);
      // 其他配置应保持不变
      expect(config.enabled).toBe(true);
    });
  });

  // ========== 本地缓存LRU测试 ==========

  describe('local cache LRU', () => {
    it('should evict oldest entry when max size reached', async () => {
      service.updateConfig({ localCacheMaxSize: 3 });

      // 添加3个缓存条目
      for (let i = 1; i <= 3; i++) {
        await service.set({
          id: `id-${i}`,
          key: `key-${i}`,
          version: 1,
          name: `Process ${i}`,
          isSuspended: false,
          bpmnXml: '<xml></xml>',
          deploymentId: `deploy-${i}`,
          resourceName: `test${i}.bpmn`,
        });
      }

      // 添加第4个条目，应该淘汰第1个
      await service.set({
        id: 'id-4',
        key: 'key-4',
        version: 1,
        name: 'Process 4',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-4',
        resourceName: 'test4.bpmn',
      });

      const stats = service.getStats();
      // 本地缓存应该不超过最大数量（每个条目有key和id两个缓存键）
      expect(stats.localCacheSize).toBeLessThanOrEqual(6);
    });
  });

  // ========== 缓存过期测试 ==========

  describe('cache expiration', () => {
    it('should consider local cache invalid when expired', async () => {
      const cachedData: CachedProcessDefinition = {
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
        cachedAt: Date.now() - 4000 * 1000, // 4000秒前（超过默认TTL）
      };

      // 直接设置本地缓存（绕过TTL检查）
      service['localCache'].set('flow:process-definition:key:default:test-key', cachedData);

      // Redis返回null
      mockCacheManager.get.mockResolvedValue(null);

      const result = await service.getByKey('test-key');

      // 由于本地缓存已过期，应该返回null
      expect(result).toBeNull();
    });
  });

  // ========== 错误处理测试 ==========

  describe('error handling', () => {
    it('should handle Redis get error gracefully', async () => {
      mockCacheManager.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.getByKey('test-key');

      expect(result).toBeNull();
    });

    it('should handle Redis set error gracefully', async () => {
      mockCacheManager.set.mockRejectedValue(new Error('Redis error'));

      // 不应该抛出异常
      await expect(service.set({
        id: 'test-id',
        key: 'test-key',
        version: 1,
        name: 'Test Process',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
      })).resolves.not.toThrow();
    });

    it('should handle Redis del error gracefully', async () => {
      mockCacheManager.del.mockRejectedValue(new Error('Redis error'));

      // 不应该抛出异常
      await expect(service.invalidate('test-key', 'test-id')).resolves.not.toThrow();
    });
  });

  // ========== 多租户测试 ==========

  describe('multi-tenancy', () => {
    it('should cache separately for different tenants', async () => {
      const data1: CachedProcessDefinition = {
        id: 'id-1',
        key: 'test-key',
        version: 1,
        name: 'Process Tenant 1',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-1',
        resourceName: 'test.bpmn',
        cachedAt: Date.now(),
      };

      const data2: CachedProcessDefinition = {
        id: 'id-2',
        key: 'test-key',
        version: 1,
        name: 'Process Tenant 2',
        isSuspended: false,
        bpmnXml: '<xml></xml>',
        deploymentId: 'deploy-2',
        resourceName: 'test.bpmn',
        cachedAt: Date.now(),
      };

      // 为不同租户设置缓存
      await service.set(data1, 'tenant-1');
      await service.set(data2, 'tenant-2');

      // 验证缓存键不同
      const calls = mockCacheManager.set.mock.calls;
      const keys = calls.map(call => call[0]);
      
      expect(keys.some(k => k.includes('tenant-1'))).toBe(true);
      expect(keys.some(k => k.includes('tenant-2'))).toBe(true);
    });
  });
});
