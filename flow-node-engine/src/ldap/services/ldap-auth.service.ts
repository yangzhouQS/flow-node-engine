/**
 * LDAP认证集成服务
 * 提供与流程引擎集成的认证功能
 */

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { 
  LdapConfiguration,
  LdapUser,
  LdapIdentityService,
} from '../interfaces/ldap.interface';

/**
 * 认证结果
 */
export interface AuthenticationResult {
  /** 是否认证成功 */
  success: boolean;
  /** 用户信息 */
  user?: LdapUser;
  /** 错误信息 */
  error?: string;
  /** 认证时间 */
  authenticatedAt?: Date;
}

/**
 * 认证策略类型
 */
export enum AuthenticationStrategy {
  /** 仅LDAP认证 */
  LDAP_ONLY = 'LDAP_ONLY',
  /** 仅本地认证 */
  LOCAL_ONLY = 'LOCAL_ONLY',
  /** 优先LDAP，失败后本地 */
  LDAP_FALLBACK_LOCAL = 'LDAP_FALLBACK_LOCAL',
  /** 优先本地，失败后LDAP */
  LOCAL_FALLBACK_LDAP = 'LOCAL_FALLBACK_LDAP',
}

/**
 * 认证选项
 */
export interface AuthenticationOptions {
  /** 认证策略 */
  strategy?: AuthenticationStrategy;
  /** 是否缓存认证结果 */
  cacheCredentials?: boolean;
  /** 认证缓存过期时间（毫秒） */
  cacheExpirationTime?: number;
}

/**
 * 本地认证服务接口
 */
export interface LocalAuthenticationService {
  checkPassword(userId: string, password: string): Promise<boolean>;
  getUser(userId: string): Promise<LdapUser | null>;
}

/**
 * 认证缓存条目
 */
interface AuthenticationCacheEntry {
  userId: string;
  passwordHash: string;
  result: AuthenticationResult;
  expiresAt: number;
}

/**
 * LDAP认证服务
 * 提供与流程引擎集成的认证功能
 */
@Injectable()
export class LdapAuthenticationService {
  private readonly logger = new Logger(LdapAuthenticationService.name);
  private readonly authCache: Map<string, AuthenticationCacheEntry> = new Map();
  private readonly defaultOptions: AuthenticationOptions;

  constructor(
    private readonly config: LdapConfiguration,
    private readonly identityService: LdapIdentityService,
    private readonly localAuthService?: LocalAuthenticationService,
  ) {
    this.defaultOptions = {
      strategy: AuthenticationStrategy.LDAP_ONLY,
      cacheCredentials: false,
      cacheExpirationTime: 300000, // 5分钟
    };
  }

  /**
   * 认证用户
   * 对应Flowable的身份认证集成
   */
  async authenticate(
    userId: string,
    password: string,
    options?: AuthenticationOptions
  ): Promise<AuthenticationResult> {
    const opts = { ...this.defaultOptions, ...options };

    this.logger.debug(`Authenticating user: ${userId} with strategy: ${opts.strategy}`);

    // 检查缓存
    if (opts.cacheCredentials) {
      const cachedResult = this.getCachedAuthentication(userId, password);
      if (cachedResult) {
        this.logger.debug(`Using cached authentication for user: ${userId}`);
        return cachedResult;
      }
    }

    let result: AuthenticationResult;

    switch (opts.strategy) {
      case AuthenticationStrategy.LDAP_ONLY:
        result = await this.authenticateLdap(userId, password);
        break;

      case AuthenticationStrategy.LOCAL_ONLY:
        result = await this.authenticateLocal(userId, password);
        break;

      case AuthenticationStrategy.LDAP_FALLBACK_LOCAL:
        result = await this.authenticateLdap(userId, password);
        if (!result.success) {
          this.logger.debug(`LDAP auth failed, falling back to local for user: ${userId}`);
          result = await this.authenticateLocal(userId, password);
        }
        break;

      case AuthenticationStrategy.LOCAL_FALLBACK_LDAP:
        result = await this.authenticateLocal(userId, password);
        if (!result.success) {
          this.logger.debug(`Local auth failed, falling back to LDAP for user: ${userId}`);
          result = await this.authenticateLdap(userId, password);
        }
        break;

      default:
        result = await this.authenticateLdap(userId, password);
    }

    // 缓存结果
    if (opts.cacheCredentials && result.success) {
      this.cacheAuthentication(userId, password, result, opts.cacheExpirationTime!);
    }

    return result;
  }

  /**
   * LDAP认证
   */
  private async authenticateLdap(
    userId: string,
    password: string
  ): Promise<AuthenticationResult> {
    try {
      const isValid = await this.identityService.checkPassword(userId, password);

      if (isValid) {
        const user = await this.identityService
          .createUserQuery()
          .userId(userId)
          .singleResult();

        return {
          success: true,
          user: user || undefined,
          authenticatedAt: new Date(),
        };
      }

      return {
        success: false,
        error: 'Invalid credentials',
      };
    } catch (error) {
      this.logger.error(`LDAP authentication error for user ${userId}`, error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 本地认证
   */
  private async authenticateLocal(
    userId: string,
    password: string
  ): Promise<AuthenticationResult> {
    if (!this.localAuthService) {
      return {
        success: false,
        error: 'Local authentication service not configured',
      };
    }

    try {
      const isValid = await this.localAuthService.checkPassword(userId, password);

      if (isValid) {
        const user = await this.localAuthService.getUser(userId);

        return {
          success: true,
          user: user || undefined,
          authenticatedAt: new Date(),
        };
      }

      return {
        success: false,
        error: 'Invalid credentials',
      };
    } catch (error) {
      this.logger.error(`Local authentication error for user ${userId}`, error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * 获取缓存的认证结果
   */
  private getCachedAuthentication(
    userId: string,
    password: string
  ): AuthenticationResult | null {
    const cacheKey = this.getCacheKey(userId);
    const entry = this.authCache.get(cacheKey);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.authCache.delete(cacheKey);
      return null;
    }

    // 检查密码是否匹配（使用简单哈希）
    const passwordHash = this.hashPassword(password);
    if (entry.passwordHash !== passwordHash) {
      return null;
    }

    return entry.result;
  }

  /**
   * 缓存认证结果
   */
  private cacheAuthentication(
    userId: string,
    password: string,
    result: AuthenticationResult,
    expirationTime: number
  ): void {
    const cacheKey = this.getCacheKey(userId);
    const passwordHash = this.hashPassword(password);

    this.authCache.set(cacheKey, {
      userId,
      passwordHash,
      result,
      expiresAt: Date.now() + expirationTime,
    });
  }

  /**
   * 清除认证缓存
   */
  clearAuthenticationCache(userId?: string): void {
    if (userId) {
      this.authCache.delete(this.getCacheKey(userId));
    } else {
      this.authCache.clear();
    }
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(userId: string): string {
    return `auth:${userId}`;
  }

  /**
   * 简单密码哈希
   * 注意：这不是安全的哈希算法，仅用于缓存比较
   */
  private hashPassword(password: string): string {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 验证用户是否已认证
   * 用于流程引擎中的权限检查
   */
  async verifyAuthentication(userId: string): Promise<boolean> {
    const user = await this.identityService
      .createUserQuery()
      .userId(userId)
      .singleResult();

    return user !== null;
  }

  /**
   * 获取用户组
   * 用于流程引擎中的组权限检查
   */
  async getUserGroups(userId: string): Promise<string[]> {
    const groups = await this.identityService.getGroupsForUser(userId);
    return groups.map((g) => g.id);
  }

  /**
   * 检查用户是否属于指定组
   */
  async isUserInGroup(userId: string, groupId: string): Promise<boolean> {
    const groups = await this.getUserGroups(userId);
    return groups.includes(groupId);
  }

  /**
   * 检查用户是否具有指定权限
   * 对应Flowable的权限检查
   */
  async checkPermission(
    userId: string,
    permission: string,
    resourceId?: string
  ): Promise<boolean> {
    // 获取用户组
    const groups = await this.getUserGroups(userId);

    // 这里可以根据组和权限进行更复杂的权限检查
    // 目前简单实现：如果用户存在则允许
    const user = await this.identityService
      .createUserQuery()
      .userId(userId)
      .singleResult();

    return user !== null;
  }

  /**
   * 创建认证守卫
   * 用于NestJS路由保护
   */
  createAuthGuard() {
    return {
      canActivate: async (context: any): Promise<boolean> => {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id || request.headers['x-user-id'];
        const password = request.headers['x-user-password'];

        if (!userId || !password) {
          throw new UnauthorizedException('Missing credentials');
        }

        const result = await this.authenticate(userId, password);

        if (!result.success) {
          throw new UnauthorizedException(result.error || 'Authentication failed');
        }

        request.user = result.user;
        return true;
      },
    };
  }
}
