import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UserPermissionCacheService, CachedUserPermission, CachedUserInfo } from './user-permission-cache.service';

describe('UserPermissionCacheService', () => {
  let service: UserPermissionCacheService;
  let cacheManager: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> };

  const mockCacheManager = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserPermissionCacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<UserPermissionCacheService>(UserPermissionCacheService);
    cacheManager = mockCacheManager;
  });

  afterEach(async () => {
    await service.clearAll();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should have default config', () => {
      const config = service.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.permissionTtl).toBe(30 * 60 * 1000); // 30分钟
      expect(config.userInfoTtl).toBe(60 * 60 * 1000); // 1小时
      expect(config.enableLocalCache).toBe(true);
      expect(config.localCacheMaxSize).toBe(500);
    });
  });

  describe('getPermission', () => {
    it('should return null when cache is disabled', async () => {
      service.updateConfig({ enabled: false });
      
      const result = await service.getPermission('user1');
      
      expect(result).toBeNull();
    });

    it('should return null when cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      const result = await service.getPermission('user1');
      
      expect(result).toBeNull();
      expect(cacheManager.get).toHaveBeenCalled();
    });

    it('should return cached data when local cache hit', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: ['admin'],
        groups: ['group1'],
        permissions: ['read', 'write'],
        isAdmin: true,
        cachedAt: Date.now(),
      };
      
      // 先设置缓存
      await service.setPermission(permission);
      
      const result = await service.getPermission('user1');
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user1');
      expect(result?.roles).toContain('admin');
    });

    it('should return cached data when Redis cache hit', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        tenantId: 'tenant1',
        roles: ['user'],
        groups: ['group1'],
        permissions: ['read'],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      cacheManager.get.mockResolvedValue(permission);
      
      const result = await service.getPermission('user1', 'tenant1');
      
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user1');
      expect(result?.tenantId).toBe('tenant1');
    });

    it('should handle tenantId in cache key', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      await service.getPermission('user1', 'tenant1');
      
      expect(cacheManager.get).toHaveBeenCalledWith('user:permission:tenant1:user1');
    });

    it('should update stats on cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      await service.getPermission('user1');
      
      const stats = service.getStats();
      expect(stats.permissionMisses).toBe(1);
    });

    it('should update stats on cache hit', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: ['admin'],
        groups: [],
        permissions: [],
        isAdmin: true,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      await service.getPermission('user1');
      
      const stats = service.getStats();
      expect(stats.permissionHits).toBe(1);
    });
  });

  describe('getUserInfo', () => {
    it('should return null when cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      const result = await service.getUserInfo('user1');
      
      expect(result).toBeNull();
    });

    it('should return cached user info when hit', async () => {
      const userInfo: CachedUserInfo = {
        userId: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        isActive: true,
        cachedAt: Date.now(),
      };
      
      await service.setUserInfo(userInfo);
      
      const result = await service.getUserInfo('user1');
      
      expect(result).not.toBeNull();
      expect(result?.username).toBe('testuser');
      expect(result?.email).toBe('test@example.com');
    });

    it('should handle tenantId in user info cache key', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      await service.getUserInfo('user1', 'tenant1');
      
      expect(cacheManager.get).toHaveBeenCalledWith('user:info:tenant1:user1');
    });
  });

  describe('setPermission', () => {
    it('should not cache when disabled', async () => {
      service.updateConfig({ enabled: false });
      
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: ['admin'],
        groups: [],
        permissions: [],
        isAdmin: true,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      expect(cacheManager.set).not.toHaveBeenCalled();
    });

    it('should cache permission by userId', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: ['admin'],
        groups: ['group1'],
        permissions: ['read', 'write'],
        isAdmin: true,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      expect(cacheManager.set).toHaveBeenCalled();
      
      const result = await service.getPermission('user1');
      expect(result).not.toBeNull();
      expect(result?.roles).toContain('admin');
    });

    it('should include tenantId in cache key', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        tenantId: 'tenant1',
        roles: ['user'],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      expect(cacheManager.set).toHaveBeenCalledWith(
        'user:permission:tenant1:user1',
        expect.objectContaining({ userId: 'user1', tenantId: 'tenant1' }),
        expect.any(Number)
      );
    });

    it('should set cachedAt timestamp', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: 0, // 初始值
      };
      
      await service.setPermission(permission);
      
      const result = await service.getPermission('user1');
      expect(result?.cachedAt).toBeGreaterThan(0);
    });
  });

  describe('setUserInfo', () => {
    it('should cache user info', async () => {
      const userInfo: CachedUserInfo = {
        userId: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        isActive: true,
        cachedAt: Date.now(),
      };
      
      await service.setUserInfo(userInfo);
      
      const result = await service.getUserInfo('user1');
      expect(result).not.toBeNull();
      expect(result?.username).toBe('testuser');
    });
  });

  describe('invalidate', () => {
    it('should delete permission and user info cache', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      const userInfo: CachedUserInfo = {
        userId: 'user1',
        username: 'testuser',
        isActive: true,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      await service.setUserInfo(userInfo);
      
      await service.invalidate('user1');
      
      expect(cacheManager.del).toHaveBeenCalledWith('user:permission:user1');
      expect(cacheManager.del).toHaveBeenCalledWith('user:info:user1');
      
      const permResult = await service.getPermission('user1');
      const infoResult = await service.getUserInfo('user1');
      
      expect(permResult).toBeNull();
      expect(infoResult).toBeNull();
    });

    it('should include tenantId in invalidation', async () => {
      await service.invalidate('user1', 'tenant1');
      
      expect(cacheManager.del).toHaveBeenCalledWith('user:permission:tenant1:user1');
      expect(cacheManager.del).toHaveBeenCalledWith('user:info:tenant1:user1');
    });
  });

  describe('clearAll', () => {
    it('should clear all local caches', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      await service.clearAll();
      
      const result = await service.getPermission('user1');
      expect(result).toBeNull();
    });

    it('should reset stats', async () => {
      cacheManager.get.mockResolvedValue(null);
      await service.getPermission('user1');
      
      await service.clearAll();
      
      const stats = service.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });
  });

  describe('stats', () => {
    it('should track permission hits and misses', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      await service.getPermission('user1'); // hit
      cacheManager.get.mockResolvedValue(null);
      await service.getPermission('user2'); // miss
      
      const stats = service.getStats();
      expect(stats.permissionHits).toBe(1);
      expect(stats.permissionMisses).toBe(1);
    });

    it('should track user info hits and misses', async () => {
      const userInfo: CachedUserInfo = {
        userId: 'user1',
        username: 'test',
        isActive: true,
        cachedAt: Date.now(),
      };
      
      await service.setUserInfo(userInfo);
      await service.getUserInfo('user1'); // hit
      cacheManager.get.mockResolvedValue(null);
      await service.getUserInfo('user2'); // miss
      
      const stats = service.getStats();
      expect(stats.userInfoHits).toBe(1);
      expect(stats.userInfoMisses).toBe(1);
    });

    it('should calculate hit rate', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      await service.getPermission('user1'); // hit
      cacheManager.get.mockResolvedValue(null);
      await service.getPermission('user2'); // miss
      
      const stats = service.getStats();
      expect(stats.hitRate).toBe(0.5); // 1 hit / 2 total
    });

    it('should reset stats', () => {
      service.resetStats();
      
      const stats = service.getStats();
      expect(stats.permissionHits).toBe(0);
      expect(stats.permissionMisses).toBe(0);
      expect(stats.userInfoHits).toBe(0);
      expect(stats.userInfoMisses).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update config', () => {
      service.updateConfig({ permissionTtl: 60000 });
      
      const config = service.getConfig();
      expect(config.permissionTtl).toBe(60000);
    });
  });

  describe('local cache LRU', () => {
    it('should evict oldest entry when max size reached', async () => {
      service.updateConfig({ localCacheMaxSize: 3 });
      
      for (let i = 1; i <= 4; i++) {
        const permission: CachedUserPermission = {
          userId: `user${i}`,
          roles: [],
          groups: [],
          permissions: [],
          isAdmin: false,
          cachedAt: Date.now(),
        };
        await service.setPermission(permission);
      }
      
      const stats = service.getStats();
      // 本地缓存大小应该受限于localCacheMaxSize（permission + userInfo）
      expect(stats.localCacheSize).toBeLessThanOrEqual(3);
    });
  });

  describe('cache expiration', () => {
    it('should consider local cache invalid when expired', async () => {
      const shortTtl = 100; // 100ms
      service.updateConfig({ permissionTtl: shortTtl });
      
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 150));
      
      cacheManager.get.mockResolvedValue(null);
      
      const result = await service.getPermission('user1');
      
      // 本地缓存过期后应该返回null（Redis也没有）
      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle Redis get error gracefully', async () => {
      cacheManager.get.mockRejectedValue(new Error('Redis error'));
      
      const result = await service.getPermission('user1');
      
      expect(result).toBeNull();
    });

    it('should handle Redis set error gracefully', async () => {
      cacheManager.set.mockRejectedValue(new Error('Redis error'));
      
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      // 不应该抛出异常
      await expect(service.setPermission(permission)).resolves.not.toThrow();
    });

    it('should handle Redis del error gracefully', async () => {
      cacheManager.del.mockRejectedValue(new Error('Redis error'));
      
      // 不应该抛出异常
      await expect(service.invalidate('user1')).resolves.not.toThrow();
    });
  });

  describe('hasPermission', () => {
    it('should return null when cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      const result = await service.hasPermission('user1', 'read');
      
      expect(result).toBeNull();
    });

    it('should return true when user has permission', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: ['read', 'write'],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      const result = await service.hasPermission('user1', 'read');
      
      expect(result).toBe(true);
    });

    it('should return false when user does not have permission', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: ['read'],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      const result = await service.hasPermission('user1', 'delete');
      
      expect(result).toBe(false);
    });

    it('should return true for admin user', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: ['admin'],
        groups: [],
        permissions: [],
        isAdmin: true,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      const result = await service.hasPermission('user1', 'any-permission');
      
      expect(result).toBe(true);
    });
  });

  describe('hasRole', () => {
    it('should return null when cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      const result = await service.hasRole('user1', 'admin');
      
      expect(result).toBeNull();
    });

    it('should return true when user has role', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: ['admin', 'user'],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      const result = await service.hasRole('user1', 'admin');
      
      expect(result).toBe(true);
    });

    it('should return false when user does not have role', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: ['user'],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      const result = await service.hasRole('user1', 'admin');
      
      expect(result).toBe(false);
    });
  });

  describe('isInGroup', () => {
    it('should return null when cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      
      const result = await service.isInGroup('user1', 'developers');
      
      expect(result).toBeNull();
    });

    it('should return true when user is in group', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: ['developers', 'managers'],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      const result = await service.isInGroup('user1', 'developers');
      
      expect(result).toBe(true);
    });

    it('should return false when user is not in group', async () => {
      const permission: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: ['developers'],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission);
      
      const result = await service.isInGroup('user1', 'managers');
      
      expect(result).toBe(false);
    });
  });

  describe('batch operations', () => {
    it('should get permissions batch', async () => {
      const permission1: CachedUserPermission = {
        userId: 'user1',
        roles: ['admin'],
        groups: [],
        permissions: [],
        isAdmin: true,
        cachedAt: Date.now(),
      };
      
      const permission2: CachedUserPermission = {
        userId: 'user2',
        roles: ['user'],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission1);
      await service.setPermission(permission2);
      
      const result = await service.getPermissionsBatch(['user1', 'user2', 'user3']);
      
      expect(result.size).toBe(3);
      expect(result.get('user1')?.isAdmin).toBe(true);
      expect(result.get('user2')?.isAdmin).toBe(false);
      expect(result.get('user3')).toBeNull();
    });

    it('should set permissions batch', async () => {
      const permissions: CachedUserPermission[] = [
        { userId: 'user1', roles: [], groups: [], permissions: [], isAdmin: false, cachedAt: Date.now() },
        { userId: 'user2', roles: [], groups: [], permissions: [], isAdmin: false, cachedAt: Date.now() },
      ];
      
      await service.setPermissionsBatch(permissions);
      
      expect(cacheManager.set).toHaveBeenCalledTimes(2);
    });

    it('should invalidate batch', async () => {
      // 先设置缓存
      const permission1: CachedUserPermission = {
        userId: 'user1',
        roles: [],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      const permission2: CachedUserPermission = {
        userId: 'user2',
        roles: [],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission1);
      await service.setPermission(permission2);
      
      // 验证缓存存在
      const cached1 = await service.getPermission('user1');
      const cached2 = await service.getPermission('user2');
      expect(cached1).not.toBeNull();
      expect(cached2).not.toBeNull();
      
      // 批量失效
      await service.invalidateBatch(['user1', 'user2']);
      
      // 验证缓存已被清除
      mockCacheManager.get.mockResolvedValue(null);
      const afterInvalidate1 = await service.getPermission('user1');
      const afterInvalidate2 = await service.getPermission('user2');
      expect(afterInvalidate1).toBeNull();
      expect(afterInvalidate2).toBeNull();
    });
  });

  describe('multi-tenancy', () => {
    it('should cache separately for different tenants', async () => {
      const permission1: CachedUserPermission = {
        userId: 'user1',
        tenantId: 'tenant1',
        roles: ['admin'],
        groups: [],
        permissions: [],
        isAdmin: true,
        cachedAt: Date.now(),
      };
      
      const permission2: CachedUserPermission = {
        userId: 'user1',
        tenantId: 'tenant2',
        roles: ['user'],
        groups: [],
        permissions: [],
        isAdmin: false,
        cachedAt: Date.now(),
      };
      
      await service.setPermission(permission1);
      await service.setPermission(permission2);
      
      const result1 = await service.getPermission('user1', 'tenant1');
      const result2 = await service.getPermission('user1', 'tenant2');
      
      expect(result1?.isAdmin).toBe(true);
      expect(result2?.isAdmin).toBe(false);
    });
  });
});
