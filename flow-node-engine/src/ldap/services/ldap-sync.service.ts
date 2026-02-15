/**
 * LDAP同步服务
 * 提供用户和组从LDAP同步到本地数据库的功能
 */

import { Injectable, Logger } from '@nestjs/common';
import { 
  LdapConfiguration, 
  LdapUser, 
  LdapGroup,
  LdapIdentityService,
} from '../interfaces/ldap.interface';

/**
 * 同步结果
 */
export interface LdapSyncResult {
  /** 同步的用户数量 */
  usersProcessed: number;
  /** 新增的用户数量 */
  usersCreated: number;
  /** 更新的用户数量 */
  usersUpdated: number;
  /** 删除的用户数量 */
  usersDeleted: number;
  /** 同步的组数量 */
  groupsProcessed: number;
  /** 新增的组数量 */
  groupsCreated: number;
  /** 更新的组数量 */
  groupsUpdated: number;
  /** 删除的组数量 */
  groupsDeleted: number;
  /** 同步时间 */
  syncTime: Date;
  /** 错误列表 */
  errors: Array<{ type: 'user' | 'group'; id: string; error: string }>;
}

/**
 * 同步选项
 */
export interface LdapSyncOptions {
  /** 是否同步用户 */
  syncUsers?: boolean;
  /** 是否同步组 */
  syncGroups?: boolean;
  /** 是否删除本地不存在于LDAP的记录 */
  deleteOrphaned?: boolean;
  /** 批量处理大小 */
  batchSize?: number;
  /** 用户过滤器 */
  userFilter?: string;
  /** 组过滤器 */
  groupFilter?: string;
}

/**
 * 本地用户存储接口
 * 需要由具体实现提供
 */
export interface LocalUserStore {
  findById(id: string): Promise<LdapUser | null>;
  findByEmail(email: string): Promise<LdapUser | null>;
  findAll(): Promise<LdapUser[]>;
  create(user: LdapUser): Promise<LdapUser>;
  update(id: string, user: Partial<LdapUser>): Promise<LdapUser | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * 本地组存储接口
 * 需要由具体实现提供
 */
export interface LocalGroupStore {
  findById(id: string): Promise<LdapGroup | null>;
  findAll(): Promise<LdapGroup[]>;
  create(group: LdapGroup): Promise<LdapGroup>;
  update(id: string, group: Partial<LdapGroup>): Promise<LdapGroup | null>;
  delete(id: string): Promise<boolean>;
  addMember(groupId: string, userId: string): Promise<boolean>;
  removeMember(groupId: string, userId: string): Promise<boolean>;
  getMembers(groupId: string): Promise<string[]>;
}

/**
 * LDAP同步服务
 * 提供从LDAP到本地数据库的同步功能
 */
@Injectable()
export class LdapSyncService {
  private readonly logger = new Logger(LdapSyncService.name);

  constructor(
    private readonly config: LdapConfiguration,
    private readonly identityService: LdapIdentityService,
    private readonly userStore?: LocalUserStore,
    private readonly groupStore?: LocalGroupStore,
  ) {}

  /**
   * 执行完整同步
   */
  async fullSync(options: LdapSyncOptions = {}): Promise<LdapSyncResult> {
    const result: LdapSyncResult = {
      usersProcessed: 0,
      usersCreated: 0,
      usersUpdated: 0,
      usersDeleted: 0,
      groupsProcessed: 0,
      groupsCreated: 0,
      groupsUpdated: 0,
      groupsDeleted: 0,
      syncTime: new Date(),
      errors: [],
    };

    const {
      syncUsers = true,
      syncGroups = true,
      deleteOrphaned = false,
      batchSize = 100,
    } = options;

    // 同步用户
    if (syncUsers && this.userStore) {
      try {
        await this.syncUsers(result, deleteOrphaned, batchSize);
      } catch (error) {
        this.logger.error('User sync failed', error);
        result.errors.push({
          type: 'user',
          id: 'all',
          error: String(error),
        });
      }
    }

    // 同步组
    if (syncGroups && this.groupStore) {
      try {
        await this.syncGroups(result, deleteOrphaned, batchSize);
      } catch (error) {
        this.logger.error('Group sync failed', error);
        result.errors.push({
          type: 'group',
          id: 'all',
          error: String(error),
        });
      }
    }

    this.logger.log(
      `Sync completed: ${result.usersCreated} users created, ` +
      `${result.usersUpdated} users updated, ` +
      `${result.groupsCreated} groups created, ` +
      `${result.groupsUpdated} groups updated`
    );

    return result;
  }

  /**
   * 同步用户
   */
  private async syncUsers(
    result: LdapSyncResult,
    deleteOrphaned: boolean,
    batchSize: number
  ): Promise<void> {
    if (!this.userStore) {
      return;
    }

    this.logger.log('Starting user sync...');

    // 获取所有LDAP用户
    const ldapUsers = await this.identityService.createUserQuery().list();
    result.usersProcessed = ldapUsers.length;

    this.logger.debug(`Found ${ldapUsers.length} users in LDAP`);

    // 获取所有本地用户
    const localUsers = await this.userStore.findAll();
    const localUserMap = new Map(localUsers.map((u) => [u.id, u]));

    // 同步LDAP用户到本地
    for (const ldapUser of ldapUsers) {
      try {
        const localUser = localUserMap.get(ldapUser.id);

        if (localUser) {
          // 检查是否需要更新
          if (this.isUserChanged(localUser, ldapUser)) {
            await this.userStore.update(ldapUser.id, {
              firstName: ldapUser.firstName,
              lastName: ldapUser.lastName,
              email: ldapUser.email,
              displayName: ldapUser.displayName,
            });
            result.usersUpdated++;
            this.logger.debug(`Updated user: ${ldapUser.id}`);
          }
          // 从map中移除，表示已处理
          localUserMap.delete(ldapUser.id);
        } else {
          // 创建新用户
          await this.userStore.create(ldapUser);
          result.usersCreated++;
          this.logger.debug(`Created user: ${ldapUser.id}`);
        }
      } catch (error) {
        this.logger.error(`Failed to sync user ${ldapUser.id}`, error);
        result.errors.push({
          type: 'user',
          id: ldapUser.id,
          error: String(error),
        });
      }
    }

    // 删除本地不存在于LDAP的用户
    if (deleteOrphaned) {
      for (const [userId] of localUserMap) {
        try {
          await this.userStore.delete(userId);
          result.usersDeleted++;
          this.logger.debug(`Deleted orphaned user: ${userId}`);
        } catch (error) {
          this.logger.error(`Failed to delete user ${userId}`, error);
          result.errors.push({
            type: 'user',
            id: userId,
            error: String(error),
          });
        }
      }
    }
  }

  /**
   * 同步组
   */
  private async syncGroups(
    result: LdapSyncResult,
    deleteOrphaned: boolean,
    batchSize: number
  ): Promise<void> {
    if (!this.groupStore) {
      return;
    }

    this.logger.log('Starting group sync...');

    // 获取所有LDAP组
    const ldapGroups = await this.identityService.createGroupQuery().list();
    result.groupsProcessed = ldapGroups.length;

    this.logger.debug(`Found ${ldapGroups.length} groups in LDAP`);

    // 获取所有本地组
    const localGroups = await this.groupStore.findAll();
    const localGroupMap = new Map(localGroups.map((g) => [g.id, g]));

    // 同步LDAP组到本地
    for (const ldapGroup of ldapGroups) {
      try {
        const localGroup = localGroupMap.get(ldapGroup.id);

        if (localGroup) {
          // 检查是否需要更新
          if (this.isGroupChanged(localGroup, ldapGroup)) {
            await this.groupStore.update(ldapGroup.id, {
              name: ldapGroup.name,
              type: ldapGroup.type,
            });
            result.groupsUpdated++;
            this.logger.debug(`Updated group: ${ldapGroup.id}`);
          }
          // 从map中移除，表示已处理
          localGroupMap.delete(ldapGroup.id);
        } else {
          // 创建新组
          await this.groupStore.create(ldapGroup);
          result.groupsCreated++;
          this.logger.debug(`Created group: ${ldapGroup.id}`);
        }

        // 同步组成员
        await this.syncGroupMembers(ldapGroup.id);
      } catch (error) {
        this.logger.error(`Failed to sync group ${ldapGroup.id}`, error);
        result.errors.push({
          type: 'group',
          id: ldapGroup.id,
          error: String(error),
        });
      }
    }

    // 删除本地不存在于LDAP的组
    if (deleteOrphaned) {
      for (const [groupId] of localGroupMap) {
        try {
          await this.groupStore.delete(groupId);
          result.groupsDeleted++;
          this.logger.debug(`Deleted orphaned group: ${groupId}`);
        } catch (error) {
          this.logger.error(`Failed to delete group ${groupId}`, error);
          result.errors.push({
            type: 'group',
            id: groupId,
            error: String(error),
          });
        }
      }
    }
  }

  /**
   * 同步组成员
   */
  private async syncGroupMembers(groupId: string): Promise<void> {
    if (!this.groupStore || !this.userStore) {
      return;
    }

    // 获取LDAP组成员
    const ldapMemberGroups = await this.identityService
      .createGroupQuery()
      .groupId(groupId)
      .list();

    if (ldapMemberGroups.length === 0) {
      return;
    }

    // 获取所有属于该组的用户
    const ldapUsers = await this.identityService
      .createUserQuery()
      .list();

    // 获取本地组成员
    const localMembers = await this.groupStore.getMembers(groupId);
    const localMemberSet = new Set(localMembers);

    // 获取LDAP中该组的所有成员
    const ldapMemberSet = new Set<string>();
    for (const user of ldapUsers) {
      const userGroups = await this.identityService.getGroupsForUser(user.id);
      if (userGroups.some((g) => g.id === groupId)) {
        ldapMemberSet.add(user.id);
      }
    }

    // 添加新成员
    for (const memberId of ldapMemberSet) {
      if (!localMemberSet.has(memberId)) {
        await this.groupStore.addMember(groupId, memberId);
        this.logger.debug(`Added member ${memberId} to group ${groupId}`);
      }
    }

    // 移除不在LDAP中的成员
    for (const memberId of localMemberSet) {
      if (!ldapMemberSet.has(memberId)) {
        await this.groupStore.removeMember(groupId, memberId);
        this.logger.debug(`Removed member ${memberId} from group ${groupId}`);
      }
    }
  }

  /**
   * 同步单个用户
   */
  async syncUser(userId: string): Promise<LdapUser | null> {
    if (!this.userStore) {
      return null;
    }

    const ldapUser = await this.identityService
      .createUserQuery()
      .userId(userId)
      .singleResult();

    if (!ldapUser) {
      this.logger.warn(`User ${userId} not found in LDAP`);
      return null;
    }

    const localUser = await this.userStore.findById(userId);

    if (localUser) {
      return this.userStore.update(userId, {
        firstName: ldapUser.firstName,
        lastName: ldapUser.lastName,
        email: ldapUser.email,
        displayName: ldapUser.displayName,
      });
    } else {
      return this.userStore.create(ldapUser);
    }
  }

  /**
   * 同步单个组
   */
  async syncGroup(groupId: string): Promise<LdapGroup | null> {
    if (!this.groupStore) {
      return null;
    }

    const ldapGroup = await this.identityService
      .createGroupQuery()
      .groupId(groupId)
      .singleResult();

    if (!ldapGroup) {
      this.logger.warn(`Group ${groupId} not found in LDAP`);
      return null;
    }

    const localGroup = await this.groupStore.findById(groupId);

    if (localGroup) {
      const updated = await this.groupStore.update(groupId, {
        name: ldapGroup.name,
        type: ldapGroup.type,
      });
      await this.syncGroupMembers(groupId);
      return updated;
    } else {
      const created = await this.groupStore.create(ldapGroup);
      await this.syncGroupMembers(groupId);
      return created;
    }
  }

  /**
   * 检查用户是否发生变化
   */
  private isUserChanged(local: LdapUser, ldap: LdapUser): boolean {
    return (
      local.firstName !== ldap.firstName ||
      local.lastName !== ldap.lastName ||
      local.email !== ldap.email ||
      local.displayName !== ldap.displayName
    );
  }

  /**
   * 检查组是否发生变化
   */
  private isGroupChanged(local: LdapGroup, ldap: LdapGroup): boolean {
    return (
      local.name !== ldap.name ||
      local.type !== ldap.type
    );
  }
}
