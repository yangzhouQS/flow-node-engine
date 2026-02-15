/**
 * LDAP组缓存服务
 * 对应Flowable LDAPGroupCache
 * 提供用户组的LRU缓存，避免频繁查询LDAP
 */

import { Injectable, Logger } from '@nestjs/common';
import { LdapGroup, LdapGroupCacheListener } from '../interfaces/ldap.interface';

/**
 * 缓存条目
 */
interface LdapGroupCacheEntry {
  timestamp: Date;
  groups: LdapGroup[];
}

/**
 * LDAP组缓存配置
 */
export interface LdapGroupCacheOptions {
  cacheSize: number;
  expirationTime: number; // 毫秒
  listener?: LdapGroupCacheListener;
  clockReader?: () => Date;
}

/**
 * LDAP组缓存服务
 * 实现LRU缓存策略，避免频繁查询LDAP系统
 */
@Injectable()
export class LdapGroupCacheService {
  private readonly logger = new Logger(LdapGroupCacheService.name);

  private cache: Map<string, LdapGroupCacheEntry>;
  private readonly cacheSize: number;
  private readonly expirationTime: number;
  private readonly listener?: LdapGroupCacheListener;
  private readonly clockReader: () => Date;

  constructor(options: LdapGroupCacheOptions) {
    this.cacheSize = options.cacheSize;
    this.expirationTime = options.expirationTime;
    this.listener = options.listener;
    this.clockReader = options.clockReader || (() => new Date());

    // 使用LinkedHashMap实现LRU缓存
    this.cache = new Map<string, LdapGroupCacheEntry>();
  }

  /**
   * 添加用户组到缓存
   */
  add(userId: string, groups: LdapGroup[]): void {
    // 检查是否需要淘汰最老的条目
    if (this.cache.size >= this.cacheSize) {
      this.evictOldest();
    }

    this.cache.set(userId, {
      timestamp: this.clockReader(),
      groups,
    });

    this.logger.debug(`Added groups to cache for user: ${userId}`);
  }

  /**
   * 获取用户的缓存组
   * 如果缓存不存在或已过期，返回null
   */
  get(userId: string): LdapGroup[] | null {
    const entry = this.cache.get(userId);

    if (!entry) {
      this.listener?.cacheMiss(userId);
      return null;
    }

    const now = this.clockReader().getTime();
    const entryTime = entry.timestamp.getTime();

    // 检查是否过期
    if (now - entryTime >= this.expirationTime) {
      this.listener?.cacheExpired(userId);
      this.cache.delete(userId);
      this.listener?.cacheEviction(userId);
      this.listener?.cacheMiss(userId);
      return null;
    }

    // 缓存命中
    this.listener?.cacheHit(userId);

    // 更新访问顺序（LRU）
    this.cache.delete(userId);
    this.cache.set(userId, entry);

    this.logger.debug(`Cache hit for user: ${userId}`);
    return entry.groups;
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 检查缓存是否已启用
   */
  isEnabled(): boolean {
    return this.cacheSize > 0;
  }

  /**
   * 淘汰最老的条目
   */
  private evictOldest(): void {
    // Map的迭代顺序是插入顺序，所以第一个就是最老的
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.listener?.cacheEviction(oldestKey);
      this.logger.debug(`Evicted oldest cache entry for user: ${oldestKey}`);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    maxSize: number;
    expirationTime: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.cacheSize,
      expirationTime: this.expirationTime,
    };
  }

  /**
   * 移除指定用户的缓存
   */
  remove(userId: string): boolean {
    const existed = this.cache.has(userId);
    if (existed) {
      this.cache.delete(userId);
      this.listener?.cacheEviction(userId);
      this.logger.debug(`Removed cache entry for user: ${userId}`);
    }
    return existed;
  }

  /**
   * 刷新指定用户的缓存时间戳
   */
  refresh(userId: string): boolean {
    const entry = this.cache.get(userId);
    if (entry) {
      entry.timestamp = this.clockReader();
      // 更新访问顺序
      this.cache.delete(userId);
      this.cache.set(userId, entry);
      this.logger.debug(`Refreshed cache entry for user: ${userId}`);
      return true;
    }
    return false;
  }
}

/**
 * 创建LDAP组缓存工厂函数
 */
export function createLdapGroupCache(
  cacheSize: number,
  expirationTime: number,
  listener?: LdapGroupCacheListener
): LdapGroupCacheService | null {
  if (cacheSize <= 0) {
    return null;
  }

  return new LdapGroupCacheService({
    cacheSize,
    expirationTime,
    listener,
  });
}
