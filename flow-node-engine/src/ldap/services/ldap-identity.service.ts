/**
 * LDAP身份服务
 * 对应Flowable LDAPIdentityServiceImpl
 * 提供用户和组的查询、认证功能
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  LdapConfiguration,
  LdapUser,
  LdapGroup,
  LdapUserQuery,
  LdapGroupQuery,
  LdapIdentityService,
  LdapSearchResult,
} from '../interfaces/ldap.interface';
import { LdapTemplateService } from './ldap-template.service';
import { LdapGroupCacheService, createLdapGroupCache } from './ldap-group-cache.service';

/**
 * 用户查询实现
 * 对应Flowable LDAPUserQueryImpl
 */
export class LdapUserQueryImpl implements LdapUserQuery {
  private userIdFilter?: string;
  private fullNameLikeFilter?: string;
  private emailFilter?: string;
  private emailLikeFilter?: string;

  constructor(
    private readonly config: LdapConfiguration,
    private readonly template: LdapTemplateService
  ) {}

  userId(userId: string): LdapUserQuery {
    this.userIdFilter = userId;
    return this;
  }

  userFullNameLike(fullName: string): LdapUserQuery {
    this.fullNameLikeFilter = fullName;
    return this;
  }

  userEmail(email: string): LdapUserQuery {
    this.emailFilter = email;
    return this;
  }

  userEmailLike(emailLike: string): LdapUserQuery {
    this.emailLikeFilter = emailLike;
    return this;
  }

  async list(): Promise<LdapUser[]> {
    return this.executeSearch();
  }

  async listPage(firstResult: number, maxResults: number): Promise<LdapUser[]> {
    const results = await this.executeSearch();
    return results.slice(firstResult, firstResult + maxResults);
  }

  async singleResult(): Promise<LdapUser | null> {
    const results = await this.executeSearch();
    return results.length > 0 ? results[0] : null;
  }

  async count(): Promise<number> {
    const results = await this.executeSearch();
    return results.length;
  }

  private async executeSearch(): Promise<LdapUser[]> {
    const baseDn = this.config.getUserBaseDnOrBaseDn();
    if (!baseDn) {
      throw new Error('No base DN configured for user search');
    }

    let filter: string;

    if (this.userIdFilter) {
      filter = this.config.ldapQueryBuilder.buildQueryByUserId(
        this.config,
        this.userIdFilter
      );
    } else if (this.fullNameLikeFilter) {
      filter = this.config.ldapQueryBuilder.buildQueryByFullNameLike(
        this.config,
        this.fullNameLikeFilter
      );
    } else if (this.config.queryAllUsers) {
      filter = this.config.queryAllUsers;
    } else {
      throw new Error('No valid query filter specified');
    }

    const results = await this.template.search(this.config, {
      baseDn,
      filter,
      scope: 'sub',
    });

    return results.map((result) => this.mapToUser(result));
  }

  private mapToUser(result: LdapSearchResult): LdapUser {
    const user: LdapUser = {
      id: this.getAttributeValue(result, this.config.userIdAttribute),
      dn: result.dn,
    };

    if (this.config.userFirstNameAttribute) {
      user.firstName = this.getAttributeValue(
        result,
        this.config.userFirstNameAttribute
      );
    }

    if (this.config.userLastNameAttribute) {
      user.lastName = this.getAttributeValue(
        result,
        this.config.userLastNameAttribute
      );
    }

    if (this.config.userEmailAttribute) {
      user.email = this.getAttributeValue(result, this.config.userEmailAttribute);
    }

    // 构建显示名称
    user.displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.id;

    return user;
  }

  private getAttributeValue(result: LdapSearchResult, attributeName?: string): string {
    if (!attributeName) {
      return '';
    }

    const value = result.attributes[attributeName];
    if (Array.isArray(value)) {
      return value[0] || '';
    }
    return value || '';
  }
}

/**
 * 组查询实现
 * 对应Flowable LDAPGroupQueryImpl
 */
export class LdapGroupQueryImpl implements LdapGroupQuery {
  private groupIdFilter?: string;
  private groupNameFilter?: string;
  private groupNameLikeFilter?: string;
  private groupTypeFilter?: string;
  private groupMemberFilter?: string;

  constructor(
    private readonly config: LdapConfiguration,
    private readonly template: LdapTemplateService,
    private readonly groupCache: LdapGroupCacheService | null
  ) {}

  groupId(groupId: string): LdapGroupQuery {
    this.groupIdFilter = groupId;
    return this;
  }

  groupName(name: string): LdapGroupQuery {
    this.groupNameFilter = name;
    return this;
  }

  groupNameLike(nameLike: string): LdapGroupQuery {
    this.groupNameLikeFilter = nameLike;
    return this;
  }

  groupType(type: string): LdapGroupQuery {
    this.groupTypeFilter = type;
    return this;
  }

  groupMember(userId: string): LdapGroupQuery {
    this.groupMemberFilter = userId;
    return this;
  }

  async list(): Promise<LdapGroup[]> {
    return this.executeSearch();
  }

  async listPage(firstResult: number, maxResults: number): Promise<LdapGroup[]> {
    const results = await this.executeSearch();
    return results.slice(firstResult, firstResult + maxResults);
  }

  async singleResult(): Promise<LdapGroup | null> {
    const results = await this.executeSearch();
    return results.length > 0 ? results[0] : null;
  }

  async count(): Promise<number> {
    const results = await this.executeSearch();
    return results.length;
  }

  private async executeSearch(): Promise<LdapGroup[]> {
    // 如果是按成员查询，先检查缓存
    if (this.groupMemberFilter && this.groupCache) {
      const cachedGroups = this.groupCache.get(this.groupMemberFilter);
      if (cachedGroups) {
        return this.applyFilters(cachedGroups);
      }
    }

    const baseDn = this.config.getGroupBaseDnOrBaseDn();
    if (!baseDn) {
      throw new Error('No base DN configured for group search');
    }

    let filter: string;

    if (this.groupMemberFilter) {
      // 按用户查询组
      const userDn = await this.template.getUserDn(this.config, this.groupMemberFilter);
      filter = this.config.ldapQueryBuilder.buildQueryGroupsForUser(
        this.config,
        this.groupMemberFilter,
        userDn || undefined
      );
    } else if (this.groupIdFilter) {
      filter = this.config.ldapQueryBuilder.buildQueryGroupsById(
        this.config,
        this.groupIdFilter
      );
    } else if (this.config.queryAllGroups) {
      filter = this.config.queryAllGroups;
    } else {
      throw new Error('No valid query filter specified');
    }

    const results = await this.template.search(this.config, {
      baseDn,
      filter,
      scope: 'sub',
    });

    const groups = results.map((result) => this.mapToGroup(result));

    // 如果是按成员查询，缓存结果
    if (this.groupMemberFilter && this.groupCache) {
      this.groupCache.add(this.groupMemberFilter, groups);
    }

    return this.applyFilters(groups);
  }

  private mapToGroup(result: LdapSearchResult): LdapGroup {
    const group: LdapGroup = {
      id: this.getAttributeValue(result, this.config.groupIdAttribute),
      dn: result.dn,
    };

    if (this.config.groupNameAttribute) {
      group.name = this.getAttributeValue(result, this.config.groupNameAttribute);
    }

    if (this.config.groupTypeAttribute) {
      group.type = this.getAttributeValue(result, this.config.groupTypeAttribute);
    }

    return group;
  }

  private getAttributeValue(result: LdapSearchResult, attributeName?: string): string {
    if (!attributeName) {
      return '';
    }

    const value = result.attributes[attributeName];
    if (Array.isArray(value)) {
      return value[0] || '';
    }
    return value || '';
  }

  private applyFilters(groups: LdapGroup[]): LdapGroup[] {
    let filtered = groups;

    if (this.groupNameFilter) {
      filtered = filtered.filter((g) => g.name === this.groupNameFilter);
    }

    if (this.groupNameLikeFilter) {
      const pattern = new RegExp(this.groupNameLikeFilter.replace(/\*/g, '.*'), 'i');
      filtered = filtered.filter((g) => g.name && pattern.test(g.name));
    }

    if (this.groupTypeFilter) {
      filtered = filtered.filter((g) => g.type === this.groupTypeFilter);
    }

    return filtered;
  }
}

/**
 * LDAP身份服务实现
 * 对应Flowable LDAPIdentityServiceImpl
 */
@Injectable()
export class LdapIdentityServiceImpl implements LdapIdentityService {
  private readonly logger = new Logger(LdapIdentityServiceImpl.name);
  private readonly config: LdapConfiguration;
  private readonly groupCache: LdapGroupCacheService | null;

  constructor(
    config: LdapConfiguration,
    private readonly template: LdapTemplateService
  ) {
    this.config = config;

    // 初始化组缓存
    this.groupCache = createLdapGroupCache(
      config.groupCacheSize,
      config.groupCacheExpirationTime,
      config.groupCacheListener
    );
  }

  /**
   * 创建用户查询
   */
  createUserQuery(): LdapUserQuery {
    return new LdapUserQueryImpl(this.config, this.template);
  }

  /**
   * 创建组查询
   */
  createGroupQuery(): LdapGroupQuery {
    return new LdapGroupQueryImpl(this.config, this.template, this.groupCache);
  }

  /**
   * 检查密码
   * 对应Flowable LDAPIdentityServiceImpl.checkPassword
   */
  async checkPassword(userId: string, password: string): Promise<boolean> {
    // 额外的密码检查
    if (!password || password.length === 0) {
      throw new Error('Null or empty passwords are not allowed!');
    }

    try {
      return await this.template.execute(this.config, {
        execute: async (context) => {
          // 搜索用户DN
          const baseDn = this.config.getUserBaseDnOrBaseDn();
          if (!baseDn) {
            return false;
          }

          const filter = this.config.ldapQueryBuilder.buildQueryByUserId(
            this.config,
            userId
          );

          const results = await context.search({
            baseDn,
            filter,
            scope: 'sub',
          });

          if (results.length === 0) {
            this.logger.debug(`User not found: ${userId}`);
            return false;
          }

          const userDn = results[0].dn;

          // 使用用户DN和密码尝试验证
          const authenticated = await this.template.authenticate(
            this.config,
            userDn,
            password
          );

          if (authenticated) {
            this.logger.debug(`User ${userId} authenticated successfully`);
          } else {
            this.logger.debug(`User ${userId} authentication failed`);
          }

          return authenticated;
        },
      });
    } catch (error) {
      this.logger.warn(`Could not authenticate user ${userId}: ${error}`);
      return false;
    }
  }

  /**
   * 用户鉴权
   * 与checkPassword相同
   */
  async authenticate(userId: string, password: string): Promise<boolean> {
    return this.checkPassword(userId, password);
  }

  /**
   * 获取用户所属组
   */
  async getGroupsForUser(userId: string): Promise<LdapGroup[]> {
    // 先检查缓存
    if (this.groupCache) {
      const cachedGroups = this.groupCache.get(userId);
      if (cachedGroups) {
        return cachedGroups;
      }
    }

    // 查询LDAP
    const groups = await this.createGroupQuery()
      .groupMember(userId)
      .list();

    // 缓存结果
    if (this.groupCache) {
      this.groupCache.add(userId, groups);
    }

    return groups;
  }

  /**
   * 获取组缓存
   */
  getGroupCache(): LdapGroupCacheService | null {
    return this.groupCache;
  }

  /**
   * 清除组缓存
   */
  clearGroupCache(): void {
    if (this.groupCache) {
      this.groupCache.clear();
    }
  }

  /**
   * 刷新用户组缓存
   */
  refreshUserGroupCache(userId: string): void {
    if (this.groupCache) {
      this.groupCache.remove(userId);
    }
  }
}
