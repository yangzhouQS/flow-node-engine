/**
 * LDAP模板服务
 * 对应Flowable LDAPTemplate
 * 提供LDAP操作的模板模式
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  LdapConfiguration,
  LdapCallback,
  LdapContext,
  LdapSearchOptions,
  LdapSearchResult,
} from '../interfaces/ldap.interface';
import { LdapConnectionService, LdapContextImpl } from './ldap-connection.service';

/**
 * LDAP模板服务
 * 封装LDAP连接管理和操作执行
 */
@Injectable()
export class LdapTemplateService {
  private readonly logger = new Logger(LdapTemplateService.name);

  constructor(private readonly connectionService: LdapConnectionService) {}

  /**
   * 执行LDAP操作
   * 对应Flowable LDAPTemplate.execute
   * 自动管理连接的创建和关闭
   */
  async execute<T>(config: LdapConfiguration, callback: LdapCallback<T>): Promise<T> {
    let context: LdapContext | null = null;

    try {
      // 创建连接
      const client = await this.connectionService.createClient(config);
      context = new LdapContextImpl(client, this.connectionService);

      // 执行回调
      const result = await callback.execute(context);
      return result;
    } catch (error) {
      this.logger.error(`LDAP operation failed: ${error}`);
      throw error;
    } finally {
      // 关闭连接（如果不是连接池模式）
      if (context && !config.connectionPooling) {
        context.close();
      }
    }
  }

  /**
   * 搜索LDAP
   * 便捷方法，直接执行搜索
   */
  async search(
    config: LdapConfiguration,
    options: LdapSearchOptions
  ): Promise<LdapSearchResult[]> {
    return this.execute(config, {
      execute: async (context) => {
        return context.search(options);
      },
    });
  }

  /**
   * 查找单个结果
   */
  async searchOne(
    config: LdapConfiguration,
    options: LdapSearchOptions
  ): Promise<LdapSearchResult | null> {
    const results = await this.search(config, { ...options, sizeLimit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  /**
   * 验证用户凭据
   */
  async authenticate(
    config: LdapConfiguration,
    userDn: string,
    password: string
  ): Promise<boolean> {
    return this.connectionService.authenticate(config, userDn, password);
  }

  /**
   * 检查用户是否存在
   */
  async userExists(config: LdapConfiguration, userId: string): Promise<boolean> {
    const baseDn = config.getUserBaseDnOrBaseDn();
    if (!baseDn) {
      throw new Error('No base DN configured for user search');
    }

    const filter = config.ldapQueryBuilder.buildQueryByUserId(config, userId);
    const result = await this.searchOne(config, {
      baseDn,
      filter,
      scope: 'sub',
    });

    return result !== null;
  }

  /**
   * 获取用户的DN
   */
  async getUserDn(config: LdapConfiguration, userId: string): Promise<string | null> {
    const baseDn = config.getUserBaseDnOrBaseDn();
    if (!baseDn) {
      throw new Error('No base DN configured for user search');
    }

    const filter = config.ldapQueryBuilder.buildQueryByUserId(config, userId);
    const result = await this.searchOne(config, {
      baseDn,
      filter,
      scope: 'sub',
    });

    return result?.dn ?? null;
  }
}
