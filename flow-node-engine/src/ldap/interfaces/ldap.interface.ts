/**
 * LDAP集成模块接口定义
 * 与Flowable LDAP模块完全一致的设计
 */

/**
 * LDAP用户接口
 * 对应Flowable org.flowable.idm.api.User
 */
export interface LdapUser {
  id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  password?: string;
  dn?: string; // Distinguished Name
}

/**
 * LDAP组接口
 * 对应Flowable org.flowable.idm.api.Group
 */
export interface LdapGroup {
  id: string;
  name?: string;
  type?: string;
  dn?: string; // Distinguished Name
}

/**
 * LDAP配置接口
 * 对应Flowable LDAPConfiguration
 */
export interface LdapConfigOptions {
  // 服务器连接参数
  server: string; // 例如 'ldap://localhost'
  port: number; // 例如 389 或 636 (LDAPS)
  user?: string; // 绑定用户DN
  password?: string; // 绑定密码
  initialContextFactory?: string; // 默认 'com.sun.jndi.ldap.LdapCtxFactory'
  securityAuthentication?: string; // 默认 'simple'

  // 自定义连接参数
  customConnectionParameters?: Record<string, string>;

  // 查询配置
  baseDn?: string; // 基础DN
  userBaseDn?: string; // 用户基础DN
  groupBaseDn?: string; // 组基础DN
  searchTimeLimit?: number; // 搜索超时(毫秒), 默认0表示无限等待

  // 查询语句
  queryUserByUserId?: string; // 例如 '(&(objectClass=inetOrgPerson)(uid={0}))'
  queryGroupsForUser?: string; // 例如 '(&(objectClass=groupOfUniqueNames)(uniqueMember={0}))'
  queryUserByFullNameLike?: string; // 例如 '(&(objectClass=inetOrgPerson)(|({0}=*{1}*)({2}={3})))'
  queryAllUsers?: string; // 例如 '(objectClass=inetOrgPerson)'
  queryAllGroups?: string; // 例如 '(objectClass=groupOfUniqueNames)'
  queryGroupByGroupId?: string; // 例如 '(&(objectClass=groupOfUniqueNames)(cn={0}))'

  // 属性名称映射
  userIdAttribute?: string; // 例如 'uid'
  userFirstNameAttribute?: string; // 例如 'givenName'
  userLastNameAttribute?: string; // 例如 'sn'
  userEmailAttribute?: string; // 例如 'mail'

  groupIdAttribute?: string; // 例如 'cn'
  groupNameAttribute?: string; // 例如 'cn'
  groupTypeAttribute?: string; // 例如 'objectClass'

  // 组缓存配置
  groupCacheSize?: number; // 默认-1表示不缓存
  groupCacheExpirationTime?: number; // 默认3600000 (1小时)

  // 连接池
  connectionPooling?: boolean; // 默认true
}

/**
 * LDAP配置类
 * 对应Flowable LDAPConfiguration
 */
export class LdapConfiguration {
  // 服务器连接参数
  server: string;
  port: number;
  user?: string;
  password?: string;
  initialContextFactory: string = 'com.sun.jndi.ldap.LdapCtxFactory';
  securityAuthentication: string = 'simple';

  // 自定义连接参数
  customConnectionParameters: Record<string, string> = {};

  // 查询配置
  baseDn?: string;
  userBaseDn?: string;
  groupBaseDn?: string;
  searchTimeLimit: number = 0;

  // 查询语句
  queryUserByUserId?: string;
  queryGroupsForUser?: string;
  queryUserByFullNameLike?: string;
  queryAllUsers?: string;
  queryAllGroups?: string;
  queryGroupByGroupId?: string;

  // 用户属性名称
  userIdAttribute?: string;
  userFirstNameAttribute?: string;
  userLastNameAttribute?: string;
  userEmailAttribute?: string;

  // 组属性名称
  groupIdAttribute?: string;
  groupNameAttribute?: string;
  groupTypeAttribute?: string;

  // 查询构建器
  ldapQueryBuilder: LdapQueryBuilder = new DefaultLdapQueryBuilder();

  // 组缓存配置
  groupCacheSize: number = -1;
  groupCacheExpirationTime: number = 3600000; // 1小时

  // 缓存监听器
  groupCacheListener?: LdapGroupCacheListener;

  // 连接池
  connectionPooling: boolean = true;

  constructor(options: LdapConfigOptions) {
    this.server = options.server;
    this.port = options.port;
    this.user = options.user;
    this.password = options.password;

    if (options.initialContextFactory) {
      this.initialContextFactory = options.initialContextFactory;
    }
    if (options.securityAuthentication) {
      this.securityAuthentication = options.securityAuthentication;
    }
    if (options.customConnectionParameters) {
      this.customConnectionParameters = options.customConnectionParameters;
    }

    this.baseDn = options.baseDn;
    this.userBaseDn = options.userBaseDn;
    this.groupBaseDn = options.groupBaseDn;
    if (options.searchTimeLimit !== undefined) {
      this.searchTimeLimit = options.searchTimeLimit;
    }

    this.queryUserByUserId = options.queryUserByUserId;
    this.queryGroupsForUser = options.queryGroupsForUser;
    this.queryUserByFullNameLike = options.queryUserByFullNameLike;
    this.queryAllUsers = options.queryAllUsers;
    this.queryAllGroups = options.queryAllGroups;
    this.queryGroupByGroupId = options.queryGroupByGroupId;

    this.userIdAttribute = options.userIdAttribute;
    this.userFirstNameAttribute = options.userFirstNameAttribute;
    this.userLastNameAttribute = options.userLastNameAttribute;
    this.userEmailAttribute = options.userEmailAttribute;

    this.groupIdAttribute = options.groupIdAttribute;
    this.groupNameAttribute = options.groupNameAttribute;
    this.groupTypeAttribute = options.groupTypeAttribute;

    if (options.groupCacheSize !== undefined) {
      this.groupCacheSize = options.groupCacheSize;
    }
    if (options.groupCacheExpirationTime !== undefined) {
      this.groupCacheExpirationTime = options.groupCacheExpirationTime;
    }

    if (options.connectionPooling !== undefined) {
      this.connectionPooling = options.connectionPooling;
    }
  }

  /**
   * 获取用户基础DN
   */
  getUserBaseDnOrBaseDn(): string | undefined {
    return this.userBaseDn ?? this.baseDn;
  }

  /**
   * 获取组基础DN
   */
  getGroupBaseDnOrBaseDn(): string | undefined {
    return this.groupBaseDn ?? this.baseDn;
  }
}

/**
 * LDAP查询构建器接口
 * 对应Flowable LDAPQueryBuilder
 */
export interface LdapQueryBuilder {
  /**
   * 构建按用户ID查询的表达式
   */
  buildQueryByUserId(config: LdapConfiguration, userId: string): string;

  /**
   * 构建查询用户所属组的表达式
   */
  buildQueryGroupsForUser(
    config: LdapConfiguration,
    userId: string,
    userDn?: string
  ): string;

  /**
   * 构建按全名模糊查询的表达式
   */
  buildQueryByFullNameLike(config: LdapConfiguration, searchText: string): string;

  /**
   * 构建按组ID查询的表达式
   */
  buildQueryGroupsById(config: LdapConfiguration, groupId: string): string;
}

/**
 * 默认LDAP查询构建器
 * 对应Flowable LDAPQueryBuilder默认实现
 */
export class DefaultLdapQueryBuilder implements LdapQueryBuilder {
  buildQueryByUserId(config: LdapConfiguration, userId: string): string {
    if (config.queryUserByUserId) {
      return this.formatMessage(config.queryUserByUserId, [userId]);
    }
    return userId;
  }

  buildQueryGroupsForUser(
    config: LdapConfiguration,
    userId: string,
    userDn?: string
  ): string {
    if (config.queryGroupsForUser) {
      const dn = userDn ?? userId;
      const escapedDn = this.escapeRdnValue(dn);
      return this.formatMessage(config.queryGroupsForUser, [escapedDn]);
    }
    return userId;
  }

  buildQueryByFullNameLike(config: LdapConfiguration, searchText: string): string {
    if (config.queryUserByFullNameLike) {
      return this.formatMessage(config.queryUserByFullNameLike, [
        config.userFirstNameAttribute ?? '',
        searchText,
        config.userLastNameAttribute ?? '',
        searchText,
      ]);
    }
    throw new Error("No 'queryUserByFullNameLike' configured");
  }

  buildQueryGroupsById(config: LdapConfiguration, groupId: string): string {
    if (config.queryGroupByGroupId) {
      return this.formatMessage(config.queryGroupByGroupId, [groupId]);
    }
    return groupId;
  }

  /**
   * 格式化消息，类似Java MessageFormat
   */
  protected formatMessage(pattern: string, args: (string | number)[]): string {
    let result = pattern;
    args.forEach((arg, index) => {
      result = result.replace(new RegExp(`\\{${index}\\}`, 'g'), String(arg));
    });
    return result;
  }

  /**
   * 转义RDN值
   * 对应Java Rdn.escapeValue
   */
  protected escapeRdnValue(value: string): string {
    // LDAP特殊字符转义: \ , + " < > ;
    let escaped = value;
    const specialChars = ['\\', ',', '+', '"', '<', '>', ';'];
    for (const char of specialChars) {
      escaped = escaped.replace(new RegExp(`\\${char}`, 'g'), `\\${char}`);
    }
    return escaped;
  }
}

/**
 * LDAP组缓存监听器接口
 * 对应Flowable LDAPGroupCacheListener
 */
export interface LdapGroupCacheListener {
  cacheHit(userId: string): void;
  cacheMiss(userId: string): void;
  cacheEviction(userId: string): void;
  cacheExpired(userId: string): void;
}

/**
 * LDAP搜索结果接口
 */
export interface LdapSearchResult {
  dn: string;
  attributes: Record<string, string | string[]>;
}

/**
 * LDAP搜索选项
 */
export interface LdapSearchOptions {
  baseDn: string;
  filter: string;
  scope?: 'base' | 'one' | 'sub'; // 默认 'sub'
  attributes?: string[];
  timeLimit?: number;
  sizeLimit?: number;
}

/**
 * 用户查询接口
 * 对应Flowable UserQuery
 */
export interface LdapUserQuery {
  userId(userId: string): LdapUserQuery;
  userFullNameLike(fullName: string): LdapUserQuery;
  userEmail(email: string): LdapUserQuery;
  userEmailLike(emailLike: string): LdapUserQuery;
  list(): Promise<LdapUser[]>;
  listPage(firstResult: number, maxResults: number): Promise<LdapUser[]>;
  singleResult(): Promise<LdapUser | null>;
  count(): Promise<number>;
}

/**
 * 组查询接口
 * 对应Flowable GroupQuery
 */
export interface LdapGroupQuery {
  groupId(groupId: string): LdapGroupQuery;
  groupName(name: string): LdapGroupQuery;
  groupNameLike(nameLike: string): LdapGroupQuery;
  groupType(type: string): LdapGroupQuery;
  groupMember(userId: string): LdapGroupQuery;
  list(): Promise<LdapGroup[]>;
  listPage(firstResult: number, maxResults: number): Promise<LdapGroup[]>;
  singleResult(): Promise<LdapGroup | null>;
  count(): Promise<number>;
}

/**
 * LDAP身份服务接口
 * 对应Flowable LDAPIdentityServiceImpl
 */
export interface LdapIdentityService {
  /**
   * 创建用户查询
   */
  createUserQuery(): LdapUserQuery;

  /**
   * 创建组查询
   */
  createGroupQuery(): LdapGroupQuery;

  /**
   * 检查密码
   */
  checkPassword(userId: string, password: string): Promise<boolean>;

  /**
   * 用户鉴权
   */
  authenticate(userId: string, password: string): Promise<boolean>;

  /**
   * 获取用户所属组
   */
  getGroupsForUser(userId: string): Promise<LdapGroup[]>;
}

/**
 * LDAP模板回调接口
 * 对应Flowable LDAPCallBack
 */
export interface LdapCallback<T> {
  execute(context: LdapContext): T | Promise<T>;
}

/**
 * LDAP上下文接口
 */
export interface LdapContext {
  /**
   * 搜索LDAP
   */
  search(options: LdapSearchOptions): Promise<LdapSearchResult[]>;

  /**
   * 绑定验证
   */
  bind(dn: string, password: string): Promise<boolean>;

  /**
   * 关闭连接
   */
  close(): void;
}
