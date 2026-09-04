import {
  getShoppingListOwnerInfo,
  getShoppingListDisplayAvatarInfo,
  isShoppingListOwner,
  getShoppingListRole,
  getHomeOwnerInfo,
  isHomeOwner,
  getInitials,
  formatRoleDisplay,
} from '#features/shoppingList/utils/ownershipHelpers';

const makeOwnership = (userId: string, profile?: Record<string, unknown>) => ({
  userId,
  user: {
    id: userId,
    email: `${userId}@test.com`,
    profile: { displayName: 'Test User', avatar: 'avatar.jpg', ...profile },
  },
});

const makeMember = (
  userId: string,
  role: string,
  profile?: Record<string, unknown>,
) => ({
  userId,
  role,
  status: 'ACTIVE',
  user: {
    id: userId,
    email: `${userId}@test.com`,
    profile: { displayName: `User ${userId}`, avatar: null, ...profile },
  },
});

describe('ownershipHelpers', () => {
  describe('getShoppingListOwnerInfo', () => {
    it('extracts owner info from first ownership', () => {
      const list = { ownerships: [makeOwnership('u1')] };
      const info = getShoppingListOwnerInfo(list);
      expect(info).toEqual({
        id: 'u1',
        email: 'u1@test.com',
        displayName: 'Test User',
        avatar: 'avatar.jpg',
      });
    });

    it('returns null when ownerships is empty', () => {
      expect(getShoppingListOwnerInfo({ ownerships: [] })).toBeNull();
    });

    it('returns null when ownerships is null', () => {
      expect(getShoppingListOwnerInfo({ ownerships: null })).toBeNull();
    });

    it('returns null when ownership user is null', () => {
      const list = { ownerships: [{ userId: 'u1', user: null }] };
      expect(getShoppingListOwnerInfo(list)).toBeNull();
    });
  });

  describe('getShoppingListDisplayAvatarInfo', () => {
    it('prefers home owner when list has a home', () => {
      const list = {
        ownerships: [makeOwnership('u1')],
        home: {
          members: [makeMember('u2', 'OWNER')],
        },
      };
      const info = getShoppingListDisplayAvatarInfo(list);
      expect(info?.id).toBe('u2');
    });

    it('falls back to list owner when home has no owner', () => {
      const list = {
        ownerships: [makeOwnership('u1')],
        home: { members: [makeMember('u2', 'MEMBER')] },
      };
      const info = getShoppingListDisplayAvatarInfo(list);
      expect(info?.id).toBe('u1');
    });

    it('falls back to list owner when no home', () => {
      const list = { ownerships: [makeOwnership('u1')] };
      const info = getShoppingListDisplayAvatarInfo(list);
      expect(info?.id).toBe('u1');
    });

    it('returns null when no owner info available', () => {
      const list = { ownerships: [], home: null };
      expect(getShoppingListDisplayAvatarInfo(list)).toBeNull();
    });
  });

  describe('isShoppingListOwner', () => {
    it('returns true when user is in ownerships', () => {
      const list = { ownerships: [{ userId: 'u1' }] };
      expect(isShoppingListOwner(list, 'u1')).toBe(true);
    });

    it('returns false when user is not in ownerships', () => {
      const list = { ownerships: [{ userId: 'u2' }] };
      expect(isShoppingListOwner(list, 'u1')).toBe(false);
    });

    it('returns false when currentUserId is undefined', () => {
      const list = { ownerships: [{ userId: 'u1' }] };
      expect(isShoppingListOwner(list)).toBe(false);
    });

    it('returns false when ownerships is null', () => {
      const list = { ownerships: null };
      expect(isShoppingListOwner(list, 'u1')).toBe(false);
    });
  });

  describe('getShoppingListRole', () => {
    it('returns OWNER for list owner', () => {
      const list = { ownerships: [{ userId: 'u1' }] };
      expect(getShoppingListRole(list, 'u1')).toBe('OWNER');
    });

    it('returns collaborator role', () => {
      const list = {
        ownerships: [],
        collaboratorsConnection: {
          edges: [
            {
              node: { collaboratorId: 'u1', role: 'EDITOR', status: 'ACTIVE' },
            },
          ],
        },
      };
      expect(getShoppingListRole(list, 'u1')).toBe('EDITOR');
    });

    it('falls back to home membership role', () => {
      const list = { ownerships: [] };
      expect(getShoppingListRole(list, 'u1', { role: 'MEMBER' })).toBe(
        'MEMBER',
      );
    });

    it('returns null when no match found', () => {
      const list = { ownerships: [] };
      expect(getShoppingListRole(list, 'u1')).toBeNull();
    });

    it('returns null when currentUserId is undefined', () => {
      const list = { ownerships: [{ userId: 'u1' }] };
      expect(getShoppingListRole(list)).toBeNull();
    });
  });

  describe('getHomeOwnerInfo', () => {
    it('finds owner from members array', () => {
      const home = { members: [makeMember('u1', 'OWNER')] };
      const info = getHomeOwnerInfo(home);
      expect(info?.id).toBe('u1');
    });

    it('finds owner from membersConnection', () => {
      const home = {
        membersConnection: {
          edges: [{ node: makeMember('u1', 'OWNER') }],
        },
      };
      const info = getHomeOwnerInfo(home);
      expect(info?.id).toBe('u1');
    });

    it('returns null when no owner found', () => {
      const home = { members: [makeMember('u1', 'MEMBER')] };
      expect(getHomeOwnerInfo(home)).toBeNull();
    });

    it('returns null when owner has no user', () => {
      const home = { members: [{ userId: 'u1', role: 'OWNER', user: null }] };
      expect(getHomeOwnerInfo(home)).toBeNull();
    });
  });

  describe('isHomeOwner', () => {
    it('returns true when user is the owner', () => {
      const home = { members: [makeMember('u1', 'OWNER')] };
      expect(isHomeOwner(home, 'u1')).toBe(true);
    });

    it('returns false when user is not the owner', () => {
      const home = { members: [makeMember('u1', 'MEMBER')] };
      expect(isHomeOwner(home, 'u1')).toBe(false);
    });

    it('returns false without currentUserId', () => {
      const home = { members: [makeMember('u1', 'OWNER')] };
      expect(isHomeOwner(home)).toBe(false);
    });
  });

  describe('getInitials', () => {
    it('returns first letter uppercased', () => {
      expect(getInitials('John Doe')).toBe('J');
    });

    it('handles email addresses', () => {
      expect(getInitials('jane_smith@example.com')).toBe('J');
    });

    it('returns ? for null', () => {
      expect(getInitials(null)).toBe('?');
    });

    it('returns ? for undefined', () => {
      expect(getInitials()).toBe('?');
    });

    it('returns ? for empty string', () => {
      expect(getInitials('')).toBe('?');
    });

    it('handles lowercase input', () => {
      expect(getInitials('test')).toBe('T');
    });
  });

  describe('formatRoleDisplay', () => {
    it.each([
      ['OWNER', 'Owner'],
      ['ADMIN', 'Admin'],
      ['EDITOR', 'Editor'],
      ['VIEWER', 'Viewer'],
      ['MEMBER', 'Member'],
    ])('formats %s as %s', (input, expected) => {
      expect(formatRoleDisplay(input)).toBe(expected);
    });

    it('title-cases unknown roles', () => {
      expect(formatRoleDisplay('MODERATOR')).toBe('Moderator');
    });

    it('returns Unknown for null', () => {
      expect(formatRoleDisplay(null)).toBe('Unknown');
    });
  });
});
