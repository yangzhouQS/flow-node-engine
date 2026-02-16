/**
 * LDAP模块导出
 * 提供与Flowable LDAP集成完全一致的功能
 */

// 模块
export { LdapModule, LdapModuleOptions, LdapModuleAsyncOptions } from './ldap.module';

// 接口
export {
  LdapUser,
  LdapGroup,
  LdapConfiguration,
  LdapConfigOptions,
  LdapQueryBuilder,
  DefaultLdapQueryBuilder,
  LdapUserQuery,
  LdapGroupQuery,
  LdapIdentityService,
  LdapSearchOptions,
  LdapSearchResult,
  LdapContext,
  LdapGroupCacheListener,
} from './interfaces/ldap.interface';

// 服务
export { LdapConnectionService } from './services/ldap-connection.service';
export { LdapTemplateService } from './services/ldap-template.service';
export {
  LdapGroupCacheService,
  createLdapGroupCache,
  LdapGroupCacheOptions
} from './services/ldap-group-cache.service';
export { 
  LdapIdentityServiceImpl,
  LdapUserQueryImpl,
  LdapGroupQueryImpl,
} from './services/ldap-identity.service';
export {
  LdapSyncService,
  LdapSyncResult,
  LdapSyncOptions,
  LocalUserStore,
  LocalGroupStore,
} from './services/ldap-sync.service';
export {
  LdapAuthenticationService,
  AuthenticationResult,
  AuthenticationStrategy,
  AuthenticationOptions,
  LocalAuthenticationService,
} from './services/ldap-auth.service';
