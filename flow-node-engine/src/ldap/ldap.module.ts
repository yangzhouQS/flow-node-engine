/**
 * LDAP模块
 * 提供与Flowable LDAP集成完全一致的功能
 */

import { DynamicModule, Module, Provider } from '@nestjs/common';
import { LdapConfigOptions, LdapConfiguration } from './interfaces/ldap.interface';
import { LdapConnectionService } from './services/ldap-connection.service';
import { LdapTemplateService } from './services/ldap-template.service';
import { LdapIdentityServiceImpl } from './services/ldap-identity.service';

/**
 * LDAP模块配置选项
 */
export interface LdapModuleOptions {
  config: LdapConfigOptions;
  isGlobal?: boolean;
}

/**
 * LDAP异步配置选项
 */
export interface LdapModuleAsyncOptions {
  useFactory: (...args: any[]) => Promise<LdapConfigOptions> | LdapConfigOptions;
  inject?: any[];
  isGlobal?: boolean;
}

/**
 * LDAP模块
 */
@Module({})
export class LdapModule {
  /**
   * 注册LDAP模块（同步配置）
   */
  static forRoot(options: LdapModuleOptions): DynamicModule {
    const configProvider: Provider = {
      provide: 'LDAP_CONFIGURATION',
      useValue: new LdapConfiguration(options.config),
    };

    return {
      module: LdapModule,
      global: options.isGlobal,
      providers: [
        configProvider,
        LdapConnectionService,
        LdapTemplateService,
        {
          provide: 'LDAP_IDENTITY_SERVICE',
          useFactory: (config: LdapConfiguration, template: LdapTemplateService) => {
            return new LdapIdentityServiceImpl(config, template);
          },
          inject: ['LDAP_CONFIGURATION', LdapTemplateService],
        },
      ],
      exports: [
        'LDAP_CONFIGURATION',
        LdapConnectionService,
        LdapTemplateService,
        'LDAP_IDENTITY_SERVICE',
      ],
    };
  }

  /**
   * 注册LDAP模块（异步配置）
   */
  static forRootAsync(options: LdapModuleAsyncOptions): DynamicModule {
    const configProvider: Provider = {
      provide: 'LDAP_CONFIGURATION',
      useFactory: async (...args: any[]) => {
        const configOptions = await options.useFactory(...args);
        return new LdapConfiguration(configOptions);
      },
      inject: options.inject || [],
    };

    return {
      module: LdapModule,
      global: options.isGlobal,
      providers: [
        configProvider,
        LdapConnectionService,
        LdapTemplateService,
        {
          provide: 'LDAP_IDENTITY_SERVICE',
          useFactory: (config: LdapConfiguration, template: LdapTemplateService) => {
            return new LdapIdentityServiceImpl(config, template);
          },
          inject: ['LDAP_CONFIGURATION', LdapTemplateService],
        },
      ],
      exports: [
        'LDAP_CONFIGURATION',
        LdapConnectionService,
        LdapTemplateService,
        'LDAP_IDENTITY_SERVICE',
      ],
    };
  }

  /**
   * 注册LDAP模块（无配置，用于测试）
   */
  static forTest(): DynamicModule {
    return {
      module: LdapModule,
      providers: [
        LdapConnectionService,
        LdapTemplateService,
      ],
      exports: [
        LdapConnectionService,
        LdapTemplateService,
      ],
    };
  }
}
