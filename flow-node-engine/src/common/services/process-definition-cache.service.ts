import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable, Logger, OnModuleInit , Inject } from '@nestjs/common';

import { Cache } from 'cache-manager';

/**
 * 缓存的流程定义数据
 */
export interface CachedProcessDefinition {
  /** 流程定义ID */
  id: string;
  /** 流程键 */
  key: string;
  /** 版本号 */
  version: number;
  /** 流程名称 */
  name: string;
  /** 分类 */
  category?: string;
  /** 描述 */
  description?: string;
  /** 是否挂起 */
  isSuspended: boolean;
  /** BPMN XML */
  bpmnXml: string;
  /** 流程图SVG */
  diagramSvg?: string;
  /** 部署ID */
  deploymentId: string;
  /** 资源名称 */
  resourceName: string;
  /** 租户ID */
  tenantId?: string;
  /** 缓存时间 */
  cachedAt: number;
}

/**
 * 缓存的BPMN解析结果
 */
export interface CachedBpmnParseResult {
  /** 流程元素列表 */
  processElements: any[];
  /** 开始事件列表 */
  startEvents: any[];
  /** 结束事件列表 */
  endEvents: any[];
  /** 用户任务列表 */
  userTasks: any[];
  /** 服务任务列表 */
  serviceTasks: any[];
  /** 网关列表 */
  gateways: any[];
  /** 序列流列表 */
  sequenceFlows: any[];
  /** 缓存时间 */
  cachedAt: number;
}

/**
 * 流程定义缓存配置
 */
export interface ProcessDefinitionCacheConfig {
  /** 是否启用缓存，默认true */
  enabled: boolean;
  /** 流程定义缓存TTL（秒），默认3600（1小时） */
  definitionTtl: number;
  /** 解析结果缓存TTL（秒），默认7200（2小时） */
  parseResultTtl: number;
  /** 最大缓存数量，默认1000 */
  maxDefinitions: number;
  /** 是否启用本地缓存作为L1缓存，默认true */
  enableLocalCache: boolean;
  /** 本地缓存最大数量，默认100 */
  localCacheMaxSize: number;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 总命中次数 */
  hits: number;
  /** 总未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 当前缓存数量 */
  currentSize: number;
  /** 本地缓存数量 */
  localCacheSize: number;
  /** 按Key查询命中次数 */
  hitsByKey: number;
  /** 按ID查询命中次数 */
  hitsById: number;
  /** 解析结果命中次数 */
  parseResultHits: number;
}

/**
 * 流程定义缓存服务
 * 
 * 提供流程定义的多级缓存能力：
 * - L1: 本地内存缓存（进程内，最快）
 * - L2: Redis分布式缓存（跨进程共享）
 * 
 * 缓存内容：
 * - 流程定义实体数据
 * - BPMN解析结果
 */
@Injectable()
export class ProcessDefinitionCacheService implements OnModuleInit {
  private readonly logger = new Logger(ProcessDefinitionCacheService.name);
  
  /** 缓存键前缀 */
  private readonly KEY_PREFIX = 'flow:process-definition:';
  private readonly PARSE_RESULT_PREFIX = 'flow:bpmn-parse:';
  
  /** 默认配置 */
  private config: ProcessDefinitionCacheConfig = {
    enabled: true,
    definitionTtl: 3600,
    parseResultTtl: 7200,
    maxDefinitions: 1000,
    enableLocalCache: true,
    localCacheMaxSize: 100,
  };
  
  /** 本地缓存（L1） */
  private localCache: Map<string, CachedProcessDefinition> = new Map();
  
  /** 本地解析结果缓存 */
  private localParseResultCache: Map<string, CachedBpmnParseResult> = new Map();
  
  /** 统计信息 */
  private stats = {
    hits: 0,
    misses: 0,
    hitsByKey: 0,
    hitsById: 0,
    parseResultHits: 0,
  };

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Process definition cache service initialized');
    this.logger.log(`Cache enabled: ${this.config.enabled}, Local cache: ${this.config.enableLocalCache}`);
  }

  /**
   * 根据流程键获取缓存的流程定义（最新版本）
   * @param key 流程键
   * @param tenantId 租户ID（可选）
   * @returns 缓存的流程定义，未命中返回null
   */
  async getByKey(key: string, tenantId?: string): Promise<CachedProcessDefinition | null> {
    if (!this.config.enabled) {
      return null;
    }

    const cacheKey = this.buildKeyCacheKey(key, tenantId);

    // 先查本地缓存
    if (this.config.enableLocalCache) {
      const localCached = this.localCache.get(cacheKey);
      if (localCached && this.isCacheValid(localCached.cachedAt, this.config.definitionTtl)) {
        this.stats.hits++;
        this.stats.hitsByKey++;
        this.logger.debug(`Local cache hit for process definition key: ${key}`);
        return localCached;
      }
    }

    // 查Redis缓存
    try {
      const cached = await this.cacheManager.get<CachedProcessDefinition>(cacheKey);
      if (cached) {
        this.stats.hits++;
        this.stats.hitsByKey++;
        
        // 回填本地缓存
        if (this.config.enableLocalCache) {
          this.setLocalCache(cacheKey, cached);
        }
        
        this.logger.debug(`Redis cache hit for process definition key: ${key}`);
        return cached;
      }
    } catch (error) {
      this.logger.error(`Failed to get from Redis cache: ${error.message}`);
    }

    this.stats.misses++;
    this.logger.debug(`Cache miss for process definition key: ${key}`);
    return null;
  }

  /**
   * 根据流程定义ID获取缓存
   * @param id 流程定义ID
   * @returns 缓存的流程定义，未命中返回null
   */
  async getById(id: string): Promise<CachedProcessDefinition | null> {
    if (!this.config.enabled) {
      return null;
    }

    const cacheKey = this.buildIdCacheKey(id);

    // 先查本地缓存
    if (this.config.enableLocalCache) {
      const localCached = this.localCache.get(cacheKey);
      if (localCached && this.isCacheValid(localCached.cachedAt, this.config.definitionTtl)) {
        this.stats.hits++;
        this.stats.hitsById++;
        this.logger.debug(`Local cache hit for process definition id: ${id}`);
        return localCached;
      }
    }

    // 查Redis缓存
    try {
      const cached = await this.cacheManager.get<CachedProcessDefinition>(cacheKey);
      if (cached) {
        this.stats.hits++;
        this.stats.hitsById++;
        
        // 回填本地缓存
        if (this.config.enableLocalCache) {
          this.setLocalCache(cacheKey, cached);
        }
        
        this.logger.debug(`Redis cache hit for process definition id: ${id}`);
        return cached;
      }
    } catch (error) {
      this.logger.error(`Failed to get from Redis cache: ${error.message}`);
    }

    this.stats.misses++;
    this.logger.debug(`Cache miss for process definition id: ${id}`);
    return null;
  }

  /**
   * 获取BPMN解析结果缓存
   * @param processDefinitionId 流程定义ID
   * @returns 缓存的解析结果，未命中返回null
   */
  async getParseResult(processDefinitionId: string): Promise<CachedBpmnParseResult | null> {
    if (!this.config.enabled) {
      return null;
    }

    const cacheKey = this.buildParseResultCacheKey(processDefinitionId);

    // 先查本地缓存
    if (this.config.enableLocalCache) {
      const localCached = this.localParseResultCache.get(cacheKey);
      if (localCached && this.isCacheValid(localCached.cachedAt, this.config.parseResultTtl)) {
        this.stats.hits++;
        this.stats.parseResultHits++;
        this.logger.debug(`Local cache hit for parse result: ${processDefinitionId}`);
        return localCached;
      }
    }

    // 查Redis缓存
    try {
      const cached = await this.cacheManager.get<CachedBpmnParseResult>(cacheKey);
      if (cached) {
        this.stats.hits++;
        this.stats.parseResultHits++;
        
        // 回填本地缓存
        if (this.config.enableLocalCache) {
          this.setLocalParseResultCache(cacheKey, cached);
        }
        
        this.logger.debug(`Redis cache hit for parse result: ${processDefinitionId}`);
        return cached;
      }
    } catch (error) {
      this.logger.error(`Failed to get parse result from Redis cache: ${error.message}`);
    }

    this.stats.misses++;
    return null;
  }

  /**
   * 缓存流程定义
   * @param definition 流程定义数据
   * @param tenantId 租户ID（可选）
   */
  async set(
    definition: Omit<CachedProcessDefinition, 'cachedAt'>,
    tenantId?: string,
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cachedData: CachedProcessDefinition = {
      ...definition,
      tenantId,
      cachedAt: Date.now(),
    };

    // 设置按Key缓存的键
    const keyCacheKey = this.buildKeyCacheKey(definition.key, tenantId);
    // 设置按ID缓存的键
    const idCacheKey = this.buildIdCacheKey(definition.id);

    try {
      // 写入Redis
      await Promise.all([
        this.cacheManager.set(keyCacheKey, cachedData, this.config.definitionTtl * 1000),
        this.cacheManager.set(idCacheKey, cachedData, this.config.definitionTtl * 1000),
      ]);

      // 写入本地缓存
      if (this.config.enableLocalCache) {
        this.setLocalCache(keyCacheKey, cachedData);
        this.setLocalCache(idCacheKey, cachedData);
      }

      this.logger.debug(`Cached process definition: ${definition.key} v${definition.version}`);
    } catch (error) {
      this.logger.error(`Failed to cache process definition: ${error.message}`);
    }
  }

  /**
   * 缓存BPMN解析结果
   * @param processDefinitionId 流程定义ID
   * @param parseResult 解析结果
   */
  async setParseResult(
    processDefinitionId: string,
    parseResult: Omit<CachedBpmnParseResult, 'cachedAt'>,
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.buildParseResultCacheKey(processDefinitionId);
    const cachedData: CachedBpmnParseResult = {
      ...parseResult,
      cachedAt: Date.now(),
    };

    try {
      // 写入Redis
      await this.cacheManager.set(cacheKey, cachedData, this.config.parseResultTtl * 1000);

      // 写入本地缓存
      if (this.config.enableLocalCache) {
        this.setLocalParseResultCache(cacheKey, cachedData);
      }

      this.logger.debug(`Cached parse result for: ${processDefinitionId}`);
    } catch (error) {
      this.logger.error(`Failed to cache parse result: ${error.message}`);
    }
  }

  /**
   * 使缓存失效
   * @param key 流程键
   * @param id 流程定义ID
   * @param tenantId 租户ID（可选）
   */
  async invalidate(key: string, id: string, tenantId?: string): Promise<void> {
    const keyCacheKey = this.buildKeyCacheKey(key, tenantId);
    const idCacheKey = this.buildIdCacheKey(id);
    const parseResultKey = this.buildParseResultCacheKey(id);

    try {
      // 清除Redis缓存
      await Promise.all([
        this.cacheManager.del(keyCacheKey),
        this.cacheManager.del(idCacheKey),
        this.cacheManager.del(parseResultKey),
      ]);

      // 清除本地缓存
      if (this.config.enableLocalCache) {
        this.localCache.delete(keyCacheKey);
        this.localCache.delete(idCacheKey);
        this.localParseResultCache.delete(parseResultKey);
      }

      this.logger.log(`Invalidated cache for process definition: ${key} (${id})`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache: ${error.message}`);
    }
  }

  /**
   * 使指定流程键的所有版本缓存失效
   * @param key 流程键
   * @param tenantId 租户ID（可选）
   */
  async invalidateByKey(key: string, tenantId?: string): Promise<void> {
    // 由于我们只缓存最新版本，这里只需要清除按key的缓存
    const keyCacheKey = this.buildKeyCacheKey(key, tenantId);

    try {
      await this.cacheManager.del(keyCacheKey);

      if (this.config.enableLocalCache) {
        this.localCache.delete(keyCacheKey);
      }

      this.logger.log(`Invalidated cache for process definition key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache by key: ${error.message}`);
    }
  }

  /**
   * 清除所有缓存
   */
  async clearAll(): Promise<void> {
    try {
      // 清除本地缓存
      this.localCache.clear();
      this.localParseResultCache.clear();

      // 注意：Redis缓存的清除需要通过键模式匹配，这里暂不实现
      // 可以通过设置较短的TTL让缓存自动过期
      this.logger.warn('Clear all cache: only local cache cleared. Redis cache will expire by TTL.');
    } catch (error) {
      this.logger.error(`Failed to clear all cache: ${error.message}`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      currentSize: this.localCache.size,
      localCacheSize: this.localCache.size + this.localParseResultCache.size,
      hitsByKey: this.stats.hitsByKey,
      hitsById: this.stats.hitsById,
      parseResultHits: this.stats.parseResultHits,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitsByKey: 0,
      hitsById: 0,
      parseResultHits: 0,
    };
  }

  /**
   * 更新配置
   * @param config 新配置（部分）
   */
  updateConfig(config: Partial<ProcessDefinitionCacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log(`Cache config updated: ${JSON.stringify(this.config)}`);
  }

  /**
   * 获取当前配置
   */
  getConfig(): ProcessDefinitionCacheConfig {
    return { ...this.config };
  }

  // ========== 私有方法 ==========

  /**
   * 构建按Key缓存的键
   */
  private buildKeyCacheKey(key: string, tenantId?: string): string {
    const tenant = tenantId || 'default';
    return `${this.KEY_PREFIX}key:${tenant}:${key}`;
  }

  /**
   * 构建按ID缓存的键
   */
  private buildIdCacheKey(id: string): string {
    return `${this.KEY_PREFIX}id:${id}`;
  }

  /**
   * 构建解析结果缓存的键
   */
  private buildParseResultCacheKey(processDefinitionId: string): string {
    return `${this.PARSE_RESULT_PREFIX}${processDefinitionId}`;
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid(cachedAt: number, ttlSeconds: number): boolean {
    return Date.now() - cachedAt < ttlSeconds * 1000;
  }

  /**
   * 设置本地缓存（带LRU淘汰）
   */
  private setLocalCache(key: string, value: CachedProcessDefinition): void {
    // 如果超过最大数量，删除最旧的条目
    if (this.localCache.size >= this.config.localCacheMaxSize) {
      const oldestKey = this.localCache.keys().next().value;
      if (oldestKey) {
        this.localCache.delete(oldestKey);
      }
    }
    this.localCache.set(key, value);
  }

  /**
   * 设置本地解析结果缓存（带LRU淘汰）
   */
  private setLocalParseResultCache(key: string, value: CachedBpmnParseResult): void {
    // 解析结果缓存使用相同的限制
    if (this.localParseResultCache.size >= this.config.localCacheMaxSize) {
      const oldestKey = this.localParseResultCache.keys().next().value;
      if (oldestKey) {
        this.localParseResultCache.delete(oldestKey);
      }
    }
    this.localParseResultCache.set(key, value);
  }
}
