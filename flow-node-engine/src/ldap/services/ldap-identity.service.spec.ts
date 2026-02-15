/**
 * LDAP身份服务测试
 * 对应Flowable LDAPIdentityServiceImpl测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  LdapIdentityServiceImpl, 
  LdapUserQueryImpl, 
  LdapGroupQueryImpl 
} from './ldap-identity.service';
import { LdapConfiguration, DefaultLdapQueryBuilder } from '../interfaces/ldap.interface';
import { LdapTemplateService } from './ldap-template.service';

// Mock LdapTemplateService
const createMockTemplate = () => ({
  execute: vi.fn(),
  search: vi.fn(),
  authenticate: vi.fn(),
  getUserDn: vi.fn(),
});

describe('LdapUserQueryImpl', () => {
  let mockTemplate: ReturnType<typeof createMockTemplate>;
  let config: LdapConfiguration;

  beforeEach(() => {
    mockTemplate = createMockTemplate();
    config = new LdapConfiguration({
      serverUrl: 'ldap://localhost:389',
      baseDn: 'dc=example,dc=com',
      userBaseDn: 'ou=users,dc=example,dc=com',
      userIdAttribute: 'uid',
      userFirstNameAttribute: 'givenName',
      userLastNameAttribute: 'sn',
      userEmailAttribute: 'mail',
      queryAllUsers: '(objectClass=person)',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('userId', () => {
    it('should build query for specific user id', async () => {
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'uid=testuser,ou=users,dc=example,dc=com',
          attributes: {
            uid: 'testuser',
            givenName: 'Test',
            sn: 'User',
            mail: 'test@example.com',
          },
        },
      ]);

      const query = new LdapUserQueryImpl(config, mockTemplate as any);
      const result = await query.userId('testuser').list();

      expect(mockTemplate.search).toHaveBeenCalledWith(
        config,
        expect.objectContaining({
          baseDn: 'ou=users,dc=example,dc=com',
          filter: expect.stringContaining('testuser'),
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('testuser');
      expect(result[0].firstName).toBe('Test');
      expect(result[0].lastName).toBe('User');
      expect(result[0].email).toBe('test@example.com');
    });
  });

  describe('userFullNameLike', () => {
    it('should build query for full name like', async () => {
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'uid=johndoe,ou=users,dc=example,dc=com',
          attributes: {
            uid: 'johndoe',
            givenName: 'John',
            sn: 'Doe',
          },
        },
      ]);

      const query = new LdapUserQueryImpl(config, mockTemplate as any);
      const result = await query.userFullNameLike('John*').list();

      expect(mockTemplate.search).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('userEmail', () => {
    it('should build query for email', async () => {
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'uid=testuser,ou=users,dc=example,dc=com',
          attributes: {
            uid: 'testuser',
            mail: 'test@example.com',
          },
        },
      ]);

      const query = new LdapUserQueryImpl(config, mockTemplate as any);
      const result = await query.userEmail('test@example.com').list();

      expect(mockTemplate.search).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].email).toBe('test@example.com');
    });
  });

  describe('listPage', () => {
    it('should return paginated results', async () => {
      const users = Array.from({ length: 25 }, (_, i) => ({
        dn: `uid=user${i},ou=users,dc=example,dc=com`,
        attributes: {
          uid: `user${i}`,
          givenName: `First${i}`,
          sn: `Last${i}`,
        },
      }));

      mockTemplate.search.mockResolvedValueOnce(users);

      const query = new LdapUserQueryImpl(config, mockTemplate as any);
      const result = await query.listPage(10, 5);

      expect(result).toHaveLength(5);
      expect(result[0].id).toBe('user10');
      expect(result[4].id).toBe('user14');
    });
  });

  describe('singleResult', () => {
    it('should return first result', async () => {
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'uid=testuser,ou=users,dc=example,dc=com',
          attributes: {
            uid: 'testuser',
          },
        },
      ]);

      const query = new LdapUserQueryImpl(config, mockTemplate as any);
      const result = await query.userId('testuser').singleResult();

      expect(result).not.toBeNull();
      expect(result?.id).toBe('testuser');
    });

    it('should return null when no results', async () => {
      mockTemplate.search.mockResolvedValueOnce([]);

      const query = new LdapUserQueryImpl(config, mockTemplate as any);
      const result = await query.userId('nonexistent').singleResult();

      expect(result).toBeNull();
    });
  });

  describe('count', () => {
    it('should return count of results', async () => {
      mockTemplate.search.mockResolvedValueOnce([
        { dn: 'uid=user1,ou=users,dc=example,dc=com', attributes: { uid: 'user1' } },
        { dn: 'uid=user2,ou=users,dc=example,dc=com', attributes: { uid: 'user2' } },
        { dn: 'uid=user3,ou=users,dc=example,dc=com', attributes: { uid: 'user3' } },
      ]);

      const query = new LdapUserQueryImpl(config, mockTemplate as any);
      const result = await query.count();

      expect(result).toBe(3);
    });
  });
});

describe('LdapGroupQueryImpl', () => {
  let mockTemplate: ReturnType<typeof createMockTemplate>;
  let config: LdapConfiguration;

  beforeEach(() => {
    mockTemplate = createMockTemplate();
    config = new LdapConfiguration({
      serverUrl: 'ldap://localhost:389',
      baseDn: 'dc=example,dc=com',
      groupBaseDn: 'ou=groups,dc=example,dc=com',
      groupIdAttribute: 'cn',
      groupNameAttribute: 'cn',
      groupTypeAttribute: 'objectClass',
      groupMemberAttribute: 'member',
      queryAllGroups: '(objectClass=groupOfNames)',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('groupId', () => {
    it('should build query for specific group id', async () => {
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'cn=admins,ou=groups,dc=example,dc=com',
          attributes: {
            cn: 'admins',
            objectClass: 'groupOfNames',
          },
        },
      ]);

      const query = new LdapGroupQueryImpl(config, mockTemplate as any, null);
      const result = await query.groupId('admins').list();

      expect(mockTemplate.search).toHaveBeenCalledWith(
        config,
        expect.objectContaining({
          baseDn: 'ou=groups,dc=example,dc=com',
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('admins');
    });
  });

  describe('groupMember', () => {
    it('should query groups for user', async () => {
      mockTemplate.getUserDn.mockResolvedValueOnce('uid=testuser,ou=users,dc=example,dc=com');
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'cn=admins,ou=groups,dc=example,dc=com',
          attributes: {
            cn: 'admins',
          },
        },
        {
          dn: 'cn=developers,ou=groups,dc=example,dc=com',
          attributes: {
            cn: 'developers',
          },
        },
      ]);

      const query = new LdapGroupQueryImpl(config, mockTemplate as any, null);
      const result = await query.groupMember('testuser').list();

      expect(mockTemplate.getUserDn).toHaveBeenCalledWith(config, 'testuser');
      expect(mockTemplate.search).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('admins');
      expect(result[1].id).toBe('developers');
    });
  });

  describe('groupNameLike', () => {
    it('should filter groups by name pattern', async () => {
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'cn=admin-users,ou=groups,dc=example,dc=com',
          attributes: {
            cn: 'admin-users',
          },
        },
        {
          dn: 'cn=admin-systems,ou=groups,dc=example,dc=com',
          attributes: {
            cn: 'admin-systems',
          },
        },
        {
          dn: 'cn=developers,ou=groups,dc=example,dc=com',
          attributes: {
            cn: 'developers',
          },
        },
      ]);

      const query = new LdapGroupQueryImpl(config, mockTemplate as any, null);
      const result = await query.groupNameLike('admin*').list();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('admin-users');
      expect(result[1].name).toBe('admin-systems');
    });
  });
});

describe('LdapIdentityServiceImpl', () => {
  let mockTemplate: ReturnType<typeof createMockTemplate>;
  let config: LdapConfiguration;
  let service: LdapIdentityServiceImpl;

  beforeEach(() => {
    mockTemplate = createMockTemplate();
    config = new LdapConfiguration({
      serverUrl: 'ldap://localhost:389',
      baseDn: 'dc=example,dc=com',
      userBaseDn: 'ou=users,dc=example,dc=com',
      groupBaseDn: 'ou=groups,dc=example,dc=com',
      userIdAttribute: 'uid',
      groupIdAttribute: 'cn',
      groupMemberAttribute: 'member',
      queryAllUsers: '(objectClass=person)',
      queryAllGroups: '(objectClass=groupOfNames)',
      groupCacheSize: 100,
      groupCacheExpirationTime: 300000,
    });
    service = new LdapIdentityServiceImpl(config, mockTemplate as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createUserQuery', () => {
    it('should return LdapUserQueryImpl instance', () => {
      const query = service.createUserQuery();
      expect(query).toBeInstanceOf(LdapUserQueryImpl);
    });
  });

  describe('createGroupQuery', () => {
    it('should return LdapGroupQueryImpl instance', () => {
      const query = service.createGroupQuery();
      expect(query).toBeInstanceOf(LdapGroupQueryImpl);
    });
  });

  describe('checkPassword', () => {
    it('should return true for valid credentials', async () => {
      mockTemplate.execute.mockImplementation(async (cfg, options) => {
        return options.execute({
          search: vi.fn().mockResolvedValue([
            {
              dn: 'uid=testuser,ou=users,dc=example,dc=com',
              attributes: { uid: 'testuser' },
            },
          ]),
        });
      });
      mockTemplate.authenticate.mockResolvedValueOnce(true);

      const result = await service.checkPassword('testuser', 'password123');

      expect(result).toBe(true);
    });

    it('should return false for invalid credentials', async () => {
      mockTemplate.execute.mockImplementation(async (cfg, options) => {
        return options.execute({
          search: vi.fn().mockResolvedValue([
            {
              dn: 'uid=testuser,ou=users,dc=example,dc=com',
              attributes: { uid: 'testuser' },
            },
          ]),
        });
      });
      mockTemplate.authenticate.mockResolvedValueOnce(false);

      const result = await service.checkPassword('testuser', 'wrongpassword');

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockTemplate.execute.mockImplementation(async (cfg, options) => {
        return options.execute({
          search: vi.fn().mockResolvedValue([]),
        });
      });

      const result = await service.checkPassword('nonexistent', 'password');

      expect(result).toBe(false);
    });

    it('should throw error for empty password', async () => {
      await expect(service.checkPassword('testuser', '')).rejects.toThrow(
        'Null or empty passwords are not allowed!'
      );
    });
  });

  describe('authenticate', () => {
    it('should delegate to checkPassword', async () => {
      mockTemplate.execute.mockImplementation(async (cfg, options) => {
        return options.execute({
          search: vi.fn().mockResolvedValue([
            {
              dn: 'uid=testuser,ou=users,dc=example,dc=com',
              attributes: { uid: 'testuser' },
            },
          ]),
        });
      });
      mockTemplate.authenticate.mockResolvedValueOnce(true);

      const result = await service.authenticate('testuser', 'password123');

      expect(result).toBe(true);
    });
  });

  describe('getGroupsForUser', () => {
    it('should return groups from cache if available', async () => {
      // First call to populate cache
      mockTemplate.getUserDn.mockResolvedValueOnce('uid=testuser,ou=users,dc=example,dc=com');
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'cn=admins,ou=groups,dc=example,dc=com',
          attributes: { cn: 'admins' },
        },
      ]);

      const result1 = await service.getGroupsForUser('testuser');
      expect(result1).toHaveLength(1);

      // Second call should use cache
      const result2 = await service.getGroupsForUser('testuser');
      expect(result2).toHaveLength(1);
      expect(mockTemplate.search).toHaveBeenCalledTimes(1); // Should not call again
    });
  });

  describe('clearGroupCache', () => {
    it('should clear the group cache', async () => {
      // Populate cache
      mockTemplate.getUserDn.mockResolvedValueOnce('uid=testuser,ou=users,dc=example,dc=com');
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'cn=admins,ou=groups,dc=example,dc=com',
          attributes: { cn: 'admins' },
        },
      ]);

      await service.getGroupsForUser('testuser');

      // Clear cache
      service.clearGroupCache();

      // Next call should hit LDAP again
      mockTemplate.getUserDn.mockResolvedValueOnce('uid=testuser,ou=users,dc=example,dc=com');
      mockTemplate.search.mockResolvedValueOnce([
        {
          dn: 'cn=admins,ou=groups,dc=example,dc=com',
          attributes: { cn: 'admins' },
        },
      ]);

      await service.getGroupsForUser('testuser');

      expect(mockTemplate.search).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshUserGroupCache', () => {
    it('should remove specific user from cache', async () => {
      // Populate cache for two users
      mockTemplate.getUserDn
        .mockResolvedValueOnce('uid=user1,ou=users,dc=example,dc=com')
        .mockResolvedValueOnce('uid=user2,ou=users,dc=example,dc=com')
        .mockResolvedValueOnce('uid=user1,ou=users,dc=example,dc=com');
      mockTemplate.search
        .mockResolvedValueOnce([{ dn: 'cn=group1', attributes: { cn: 'group1' } }])
        .mockResolvedValueOnce([{ dn: 'cn=group2', attributes: { cn: 'group2' } }])
        .mockResolvedValueOnce([{ dn: 'cn=group1', attributes: { cn: 'group1' } }]);

      await service.getGroupsForUser('user1');
      await service.getGroupsForUser('user2');

      // Refresh user1's cache
      service.refreshUserGroupCache('user1');

      // user1 should hit LDAP again
      await service.getGroupsForUser('user1');

      expect(mockTemplate.search).toHaveBeenCalledTimes(3);
    });
  });
});
