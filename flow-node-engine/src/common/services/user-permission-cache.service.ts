import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * 缓存的用户权限信息
 */
export interface CachedUserPermission {
  /** 用户ID */
  userId: string;
  /** 租户ID */
  tenantId?: string;
  /** 用户角色列表 */
  roles: string[];
  /** 用户组列表 */
  groups: string[];
  /** 用户权限列表 */
  permissions: string[];
  /** 是否为管理员 */
  isAdmin: boolean;
  /** 缓存时间戳 */
  cachedAt: number;
}

/**
 * 缓存的用户信息
 */
export interface CachedUserInfo {
  /** 用户ID */
  userId: string;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email?: string;
  /** 租户ID */
  tenantId?: string;
  /** 是否激活 */
  isActive: boolean;
  /** 缓存时间戳 */
  cachedAt: number;
}

/**
 * 用户权限缓存配置
 */
export interface UserPermissionCacheConfig {
  /** 是否启用缓存 */
  enabled: boolean;
  /** 用户权限TTL（毫秒），默认30分钟 */
  permissionTtl: number;
  /** 用户信息TTL（毫秒），默认1小时 */
  userInfoTtl: number;
  /** 最大缓存用户数 */
  maxUsers: number;
  /** 是否启用本地缓存 */
  enableLocalCache: boolean;
  /** 本地缓存最大容量 */
  localCacheMaxSize: number;
}

/**
 * 缓存统计信息
 */
export interface UserPermissionCacheStats {
  /** 权限缓存命中数 */
  permissionHits: number;
  /** 权限缓存未命中数 */
  permissionMisses: number;
  /** 用户信息缓存命中数 */
  userInfoHits: number;
  /** 用户信息缓存未命中数 */
  userInfoMisses: number;
  /** 总命中数 */
  totalHits: number;
  /** 总未命中数 */
  totalMisses: number;
  /** 命中率 */
  hitRate: number;
  /** 本地缓存大小 */
  localCacheSize: number;
}

/**
 * 用户权限缓存服务
 * 提供两级缓存（L1: 本地内存, L2: Redis）用于缓存用户权限信息
 */
@Injectable()
export class UserPermissionCacheService implements OnModuleInit {
  private readonly logger = new Logger(UserPermissionCacheService.name);
  
  /** 本地权限缓存 */
  private localPermissionCache: Map<string, CachedUserPermission> = new Map();
  
  /** 本地用户信息缓存 */
  private localUserInfoCache: Map<string, CachedUserInfo> = new Map();
  
  /** 本地缓存访问顺序（用于LRU淘汰） */
  private permissionAccessOrder: string[] = [];
  private userInfoAccessOrder: string[] = [];
  
  /** 统计数据 */
  private stats = {
    permissionHits: 0,
    permissionMisses: 0,
    userInfoHits: 0,
    userInfoMisses: 0,
  };
  
  /** 配置 */
  private config: UserPermissionCacheConfig = {
    enabled: true,
    permissionTtl: 30 * 60 * 1000, // 30分钟
    userInfoTtl: 60 * 60 * 1000, // 1小时
    maxUsers: 10000,
    enableLocalCache: true,
    localCacheMaxSize: 500,
  };

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('UserPermissionCacheService initialized');
  }

  /**
   * 生成权限缓存键
   */
  private getPermissionCacheKey(userId: string, tenantId?: string): string {
    return tenantId 
      ? `user:permission:${tenantId}:${userId}`
      : `user:permission:${userId}`;
  }

  /**
   * 生成用户信息缓存键
   */
  private getUserInfoCacheKey(userId: string, tenantId?: string): string {
    return tenantId
      ? `user:info:${tenantId}:${userId}`
      : `user:info:${userId}`;
  }

  /**
   * 更新LRU访问顺序
   */
  private updateAccessOrder(key: string, orderList: string[]): void {
    const index = orderList.indexOf(key);
    if (index > -1) {
      orderList.splice(index, 1);
    }
    orderList.push(key);
  }

  /**
   * 淘汰最旧的本地缓存条目
   */
  private evictOldestIfNeeded(orderList: string[], cache: Map<string, unknown>): void {
    const maxSize = this.config.localCacheMaxSize;
    while (orderList.length > maxSize) {
      const oldestKey = orderList.shift();
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
  }

  /**
   * 检查本地缓存是否过期
   */
  private isLocalCacheExpired(cachedAt: number, ttl: number): boolean {
    return Date.now() - cachedAt > ttl;
  }

  /**
   * 获取用户权限缓存
   * @param userId 用户ID
   * @param tenantId 租户ID（可选）
   * @returns 缓存的权限信息，如果不存在或已过期返回null
   */
  async getPermission(userId: string, tenantId?: string): Promise<CachedUserPermission | null> {
    if (!this.config.enabled) {
      return null;
    }

    const cacheKey = this.getPermissionCacheKey(userId, tenantId);

    // 先检查本地缓存
    if (this.config.enableLocalCache) {
      const localCached = this.localPermissionCache.get(cacheKey);
      if (localCached) {
        if (!this.isLocalCacheExpired(localCached.cachedAt, this.config.permissionTtl)) {
          this.updateAccessOrder(cacheKey, this.permissionAccessOrder);
          this.stats.permissionHits++;
          return localCached;
        }
        // 本地缓存已过期，删除
        this.localPermissionCache.delete(cacheKey);
        const index = this.permissionAccessOrder.indexOf(cacheKey);
        if (index > -1) {
          this.permissionAccessOrder.splice(index, 1);
        }
      }
    }

    // 检查Redis缓存
    try {
      const redisCached = await this.cacheManager.get<CachedUserPermission>(cacheKey);
      if (redisCached) {
        // 回填本地缓存
        if (this.config.enableLocalCache) {
          this.localPermissionCache.set(cacheKey, redisCached);
          this.updateAccessOrder(cacheKey, this.permissionAccessOrder);
          this.evictOldestIfNeeded(this.permissionAccessOrder, this.localPermissionCache);
        }
        this.stats.permissionHits++;
        return redisCached;
      }
    } catch (error) {
      this.logger.error(`Failed to get from Redis cache: ${(error as Error).message}`);
    }

    this.stats.permissionMisses++;
    return null;
  }

  /**
   * 获取用户信息缓存
   * @param userId 用户ID
   * @param tenantId 租户ID（可选）
   * @returns 缓存的用户信息，如果不存在或已过期返回null
   */
  async getUserInfo(userId: string, tenantId?: string): Promise<CachedUserInfo | null> {
    if (!this.config.enabled) {
      return null;
    }

    const cacheKey = this.getUserInfoCacheKey(userId, tenantId);

    // 先检查本地缓存
    if (this.config.enableLocalCache) {
      const localCached = this.localUserInfoCache.get(cacheKey);
      if (localCached) {
        if (!this.isLocalCacheExpired(localCached.cachedAt, this.config.userInfoTtl)) {
          this.updateAccessOrder(cacheKey, this.userInfoAccessOrder);
          this.stats.userInfoHits++;
          return localCached;
        }
        // 本地缓存已过期，删除
        this.localUserInfoCache.delete(cacheKey);
        const index = this.userInfoAccessOrder.indexOf(cacheKey);
        if (index > -1) {
          this.userInfoAccessOrder.splice(index, 1);
        }
      }
    }

    // 检查Redis缓存
    try {
      const redisCached = await this.cacheManager.get<CachedUserInfo>(cacheKey);
      if (redisCached) {
        // 回填本地缓存
        if (this.config.enableLocalCache) {
          this.localUserInfoCache.set(cacheKey, redisCached);
          this.updateAccessOrder(cacheKey, this.userInfoAccessOrder);
          this.evictOldestIfNeeded(this.userInfoAccessOrder, this.localUserInfoCache);
        }
        this.stats.userInfoHits++;
        return redisCached;
      }
    } catch (error) {
      this.logger.error(`Failed to get user info from Redis cache: ${(error as Error).message}`);
    }

    this.stats.userInfoMisses++;
    return null;
  }

  /**
   * 设置用户权限缓存
   * @param permission 用户权限信息
   */
  async setPermission(permission: CachedUserPermission): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.getPermissionCacheKey(permission.userId, permission.tenantId);
    const cachedPermission: CachedUserPermission = {
      ...permission,
      cachedAt: Date.now(),
    };

    // 设置本地缓存
    if (this.config.enableLocalCache) {
      this.localPermissionCache.set(cacheKey, cachedPermission);
      this.updateAccessOrder(cacheKey, this.permissionAccessOrder);
      this.evictOldestIfNeeded(this.permissionAccessOrder, this.localPermissionCache);
    }

    // 设置Redis缓存
    try {
      await this.cacheManager.set(cacheKey, cachedPermission, this.config.permissionTtl);
    } catch (error) {
      this.logger.error(`Failed to cache user permission: ${(error as Error).message}`);
    }
  }

  /**
   * 设置用户信息缓存
   * @param userInfo 用户信息
   */
  async setUserInfo(userInfo: CachedUserInfo): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const cacheKey = this.getUserInfoCacheKey(userInfo.userId, userInfo.tenantId);
    const cachedUserInfo: CachedUserInfo = {
      ...userInfo,
      cachedAt: Date.now(),
    };

    // 设置本地缓存
    if (this.config.enableLocalCache) {
      this.localUserInfoCache.set(cacheKey, cachedUserInfo);
      this.updateAccessOrder(cacheKey, this.userInfoAccessOrder);
      this.evictOldestIfNeeded(this.userInfoAccessOrder, this.localUserInfoCache);
    }

    // 设置Redis缓存
    try {
      await this.cacheManager.set(cacheKey, cachedUserInfo, this.config.userInfoTtl);
    } catch (error) {
      this.logger.error(`Failed to cache user info: ${(error as Error).message}`);
    }
  }

  /**
   * 使指定用户的权限缓存失效
   * @param userId 用户ID
   * @param tenantId 租户ID（可选）
   */
  async invalidate(userId: string, tenantId?: string): Promise<void> {
    const permissionKey = this.getPermissionCacheKey(userId, tenantId);
    const userInfoKey = this.getUserInfoCacheKey(userId, tenantId);

    // 清除本地缓存
    this.localPermissionCache.delete(permissionKey);
    this.localUserInfoCache.delete(userInfoKey);
    
    const permIndex = this.permissionAccessOrder.indexOf(permissionKey);
    if (permIndex > -1) {
      this.permissionAccessOrder.splice(permIndex, 1);
    }
    
    const infoIndex = this.userInfoAccessOrder.indexOf(userInfoKey);
    if (infoIndex > -1) {
      this.userInfoAccessOrder.splice(infoIndex, 1);
    }

    // 清除Redis缓存
    try {
      await this.cacheManager.del(permissionKey);
      await this.cacheManager.del(userInfoKey);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache: ${(error as Error).message}`);
    }
  }

  /**
   * 使指定用户的所有租户缓存失效
   * @param userId 用户ID
   */
  async invalidateAllTenants(userId: string): Promise<void> {
    // 清除本地缓存中该用户的所有条目
    for (const key of this.localPermissionCache.keys()) {
      if (key.endsWith(`:${userId}`) || key === `user:permission:${userId}`) {
        this.localPermissionCache.delete(key);
        const index = this.permissionAccessOrder.indexOf(key);
        if (index > -1) {
          this.permissionAccessOrder.splice(index, 1);
        }
      }
    }

    for (const key of this.localUserInfoCache.keys()) {
      if (key.endsWith(`:${userId}`) || key === `user:info:${userId}`) {
        this.localUserInfoCache.delete(key);
        const index = this.userInfoAccessOrder.indexOf(key);
        if (index > -1) {
          this.userInfoAccessOrder.splice(index, 1);
        }
      }
    }

    // 注意：Redis缓存需要使用通配符删除，这里简化处理
    // 实际生产环境可能需要使用Redis SCAN命令
    this.logger.warn(`invalidateAllTenants for user ${userId} - Redis wildcard deletion not implemented`);
  }

  /**
   * 清除所有缓存
   */
  async clearAll(): Promise<void> {
    // 清除本地缓存
    this.localPermissionCache.clear();
    this.localUserInfoCache.clear();
    this.permissionAccessOrder = [];
    this.userInfoAccessOrder = [];

    // 重置统计
    this.stats = {
      permissionHits: 0,
      permissionMisses: 0,
      userInfoHits: 0,
      userInfoMisses: 0,
    };

    this.logger.log('All user permission caches cleared');
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): UserPermissionCacheStats {
    const totalHits = this.stats.permissionHits + this.stats.userInfoHits;
    const totalMisses = this.stats.permissionMisses + this.stats.userInfoMisses;
    const totalRequests = totalHits + totalMisses;

    return {
      permissionHits: this.stats.permissionHits,
      permissionMisses: this.stats.permissionMisses,
      userInfoHits: this.stats.userInfoHits,
      userInfoMisses: this.stats.userInfoMisses,
      totalHits,
      totalMisses,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      localCacheSize: this.localPermissionCache.size + this.localUserInfoCache.size,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      permissionHits: 0,
      permissionMisses: 0,
      userInfoHits: 0,
      userInfoMisses: 0,
    };
  }

  /**
   * 更新配置
   * @param config 新配置（部分）
   */
  updateConfig(config: Partial<UserPermissionCacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.log(`Config updated: ${JSON.stringify(this.config)}`);
  }

  /**
   * 获取当前配置
   */
  getConfig(): UserPermissionCacheConfig {
    return { ...this.config };
  }

  /**
   * 检查用户是否有指定权限
   * @param userId 用户ID
   * @param permission 权限标识
   * @param tenantId 租户ID（可选）
   * @returns 是否有权限，如果缓存不存在返回null
   */
  async hasPermission(userId: string, permission: string, tenantId?: string): Promise<boolean | null> {
    const cached = await this.getPermission(userId, tenantId);
    if (!cached) {
      return null;
    }
    
    // 管理员拥有所有权限
    if (cached.isAdmin) {
      return true;
    }
    
    return cached.permissions.includes(permission);
  }

  /**
   * 检查用户是否有指定角色
   * @param userId 用户ID
   * @param role 角色标识
   * @param tenantId 租户ID（可选）
   * @returns 是否有角色，如果缓存不存在返回null
   */
  async hasRole(userId: string, role: string, tenantId?: string): Promise<boolean | null> {
    const cached = await this.getPermission(userId, tenantId);
    if (!cached) {
      return null;
    }
    
    return cached.roles.includes(role);
  }

  /**
   * 检查用户是否在指定组中
   * @param userId 用户ID
   * @param group 组标识
   * @param tenantId 租户ID（可选）
   * @returns 是否在组中，如果缓存不存在返回null
   */
  async isInGroup(userId: string, group: string, tenantId?: string): Promise<boolean | null> {
    const cached = await this.getPermission(userId, tenantId);
    if (!cached) {
      return null;
    }
    
    return cached.groups.includes(group);
  }

  /**
   * 批量获取用户权限
   * @param userIds 用户ID列表
   * @param tenantId 租户ID（可选）
   * @returns 用户权限映射
   */
  async getPermissionsBatch(
    userIds: string[], 
    tenantId?: string
  ): Promise<Map<string, CachedUserPermission | null>> {
    const result = new Map<string, CachedUserPermission | null>();
    
    await Promise.all(
      userIds.map(async (userId) => {
        const permission = await this.getPermission(userId, tenantId);
        result.set(userId, permission);
      })
    );
    
    return result;
  }

  /**
   * 批量设置用户权限
   * @param permissions 用户权限列表
   */
  async setPermissionsBatch(permissions: CachedUserPermission[]): Promise<void> {
    await Promise.all(
      permissions.map((permission) => this.setPermission(permission))
    );
  }

  /**
   * 批量使缓存失效
   * @param userIds 用户ID列表
   * @param tenantId 租户ID（可选）
   */
  async invalidateBatch(userIds: string[], tenantId?: string): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.invalidate(userId, tenantId))
    );
  }
}
