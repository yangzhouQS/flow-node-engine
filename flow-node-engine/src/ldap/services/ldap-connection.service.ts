/**
 * LDAP连接服务
 * 对应Flowable LDAPConnectionUtil
 * 提供LDAP连接管理功能
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  LdapConfiguration,
  LdapContext,
  LdapSearchOptions,
  LdapSearchResult,
} from '../interfaces/ldap.interface';
import * as ldap from 'ldapjs';

/**
 * LDAP连接配置
 */
export interface LdapConnectionOptions {
  url: string;
  bindDN?: string;
  bindCredentials?: string;
  tlsOptions?: Record<string, unknown>;
  connectTimeout?: number;
  idleTimeout?: number;
  reconnect?: boolean;
}

/**
 * LDAP连接服务
 * 管理LDAP连接池和连接生命周期
 */
@Injectable()
export class LdapConnectionService {
  private readonly logger = new Logger(LdapConnectionService.name);
  private clients: Map<string, ldap.Client> = new Map();

  constructor() {}

  /**
   * 创建LDAP客户端连接
   * 对应Flowable LDAPConnectionUtil.createDirectoryContext
   */
  async createClient(config: LdapConfiguration): Promise<ldap.Client> {
    const connectionKey = this.getConnectionKey(config);

    // 检查是否已有连接
    const existingClient = this.clients.get(connectionKey);
    if (existingClient) {
      try {
        // 测试连接是否有效
        await this.testConnection(existingClient);
        return existingClient;
      } catch {
        // 连接无效，移除并创建新连接
        this.clients.delete(connectionKey);
      }
    }

    const url = `${config.server}:${config.port}`;
    const options: ldap.ClientOptions = {
      url,
      connectTimeout: config.searchTimeLimit || 30000,
      idleTimeout: 30000,
      reconnect: config.connectionPooling,
    };

    const client = ldap.createClient(options);

    // 设置错误处理
    client.on('error', (err) => {
      this.logger.error(`LDAP client error: ${err.message}`);
    });

    client.on('connectError', (err) => {
      this.logger.error(`LDAP connection error: ${err.message}`);
    });

    client.on('connect', () => {
      this.logger.debug(`LDAP connected to ${url}`);
    });

    // 如果配置了绑定用户，进行绑定
    if (config.user && config.password) {
      await this.bindClient(client, config.user, config.password);
    }

    // 缓存连接
    if (config.connectionPooling) {
      this.clients.set(connectionKey, client);
    }

    return client;
  }

  /**
   * 绑定客户端
   */
  private async bindClient(
    client: ldap.Client,
    dn: string,
    password: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      client.bind(dn, password, (err) => {
        if (err) {
          this.logger.warn(`LDAP bind failed: ${err.message}`);
          reject(new Error(`LDAP bind failed: ${err.message}`));
        } else {
          this.logger.debug('LDAP bind successful');
          resolve();
        }
      });
    });
  }

  /**
   * 测试连接是否有效
   */
  private async testConnection(client: ldap.Client): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 发送一个简单的搜索请求来测试连接
      const searchOptions: ldap.SearchOptions = {
        scope: 'base',
        filter: '(objectClass=*)',
        attributes: ['dn'],
        sizeLimit: 1,
        timeLimit: 5,
      };

      client.search('', searchOptions, (err, res) => {
        if (err) {
          reject(err);
          return;
        }

        let found = false;
        res.on('searchEntry', () => {
          found = true;
        });

        res.on('end', () => {
          resolve(found);
        });

        res.on('error', (searchErr) => {
          reject(searchErr);
        });

        // 设置超时
        setTimeout(() => {
          if (!found) {
            reject(new Error('Connection test timeout'));
          }
        }, 5000);
      });
    });
  }

  /**
   * 关闭LDAP客户端连接
   * 对应Flowable LDAPConnectionUtil.closeDirectoryContext
   */
  async closeClient(client: ldap.Client): Promise<void> {
    return new Promise((resolve) => {
      try {
        client.unbind((err) => {
          if (err) {
            this.logger.warn(`Could not close LDAP connection: ${err.message}`);
          } else {
            this.logger.debug('LDAP connection closed successfully');
          }
          resolve();
        });
      } catch (err) {
        this.logger.warn(`Error closing LDAP connection: ${err}`);
        resolve();
      }
    });
  }

  /**
   * 获取连接键
   */
  private getConnectionKey(config: LdapConfiguration): string {
    return `${config.server}:${config.port}:${config.user || 'anonymous'}`;
  }

  /**
   * 关闭所有连接
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.clients.values()).map((client) =>
      this.closeClient(client)
    );
    await Promise.all(closePromises);
    this.clients.clear();
  }

  /**
   * 执行LDAP搜索
   */
  async search(
    client: ldap.Client,
    options: LdapSearchOptions
  ): Promise<LdapSearchResult[]> {
    return new Promise((resolve, reject) => {
      const searchOptions: ldap.SearchOptions = {
        scope: options.scope || 'sub',
        filter: options.filter,
        attributes: options.attributes,
        timeLimit: options.timeLimit || 0,
        sizeLimit: options.sizeLimit || 0,
      };

      const results: LdapSearchResult[] = [];

      client.search(options.baseDn, searchOptions, (err, res) => {
        if (err) {
          this.logger.error(`LDAP search error: ${err.message}`);
          reject(new Error(`LDAP search failed: ${err.message}`));
          return;
        }

        res.on('searchEntry', (entry) => {
          const result: LdapSearchResult = {
            dn: entry.dn,
            attributes: {},
          };

          // 转换属性
          for (const attribute of entry.attributes) {
            const values = attribute.values;
            if (values.length === 1) {
              result.attributes[attribute.type] = values[0];
            } else {
              result.attributes[attribute.type] = values;
            }
          }

          results.push(result);
        });

        res.on('error', (searchErr) => {
          this.logger.error(`LDAP search error: ${searchErr.message}`);
          reject(new Error(`LDAP search failed: ${searchErr.message}`));
        });

        res.on('end', () => {
          resolve(results);
        });
      });
    });
  }

  /**
   * 验证用户凭据
   * 通过尝试使用用户DN绑定来验证
   */
  async authenticate(
    config: LdapConfiguration,
    userDn: string,
    password: string
  ): Promise<boolean> {
    // 创建新的客户端连接进行验证
    const url = `${config.server}:${config.port}`;
    const options: ldap.ClientOptions = {
      url,
      connectTimeout: 30000,
    };

    const client = ldap.createClient(options);

    return new Promise((resolve) => {
      client.bind(userDn, password, (err) => {
        if (err) {
          this.logger.debug(`Authentication failed for ${userDn}: ${err.message}`);
          resolve(false);
        } else {
          this.logger.debug(`Authentication successful for ${userDn}`);
          resolve(true);
        }

        // 关闭验证连接
        client.unbind(() => {});
      });
    });
  }
}

/**
 * LDAP上下文实现
 * 提供LDAP操作的上下文环境
 */
export class LdapContextImpl implements LdapContext {
  private readonly logger = new Logger(LdapContextImpl.name);

  constructor(
    private readonly client: ldap.Client,
    private readonly connectionService: LdapConnectionService
  ) {}

  /**
   * 搜索LDAP
   */
  async search(options: LdapSearchOptions): Promise<LdapSearchResult[]> {
    return this.connectionService.search(this.client, options);
  }

  /**
   * 绑定验证
   */
  async bind(dn: string, password: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.client.bind(dn, password, (err) => {
        if (err) {
          this.logger.debug(`Bind failed for ${dn}: ${err.message}`);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.connectionService.closeClient(this.client).catch((err) => {
      this.logger.warn(`Error closing LDAP context: ${err}`);
    });
  }
}
