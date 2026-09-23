import {
  getShoppingListOwnerInfo,
  getShoppingListDisplayAvatarInfo,
  isShoppingListOwner,
  getShoppingListRole,
  getHomeOwnerInfo,
  getInitials,
  formatRoleDisplay,
} from '#features/shoppingList/utils/ownershipHelpers';
import {
  CollaboratorRole,
  MembershipRole,
} from '#/graphql/generated/schemaTypes';

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
  role: MembershipRole,
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
          members: [makeMember('u2', MembershipRole.Owner)],
        },
      };
      const info = getShoppingListDisplayAvatarInfo(list);
      expect(info?.id).toBe('u2');
    });

    it('falls back to list owner when home has no owner', () => {
      const list = {
        ownerships: [makeOwnership('u1')],
        home: { members: [makeMember('u2', MembershipRole.Member)] },
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
      expect(getShoppingListRole(list, 'u1')).toBe(CollaboratorRole.Owner);
    });

    it('returns collaborator role', () => {
      const list = {
        ownerships: [],
        collaboratorsConnection: {
          edges: [
            {
              node: {
                collaboratorId: 'u1',
                role: CollaboratorRole.Editor,
                status: 'ACTIVE',
              },
            },
          ],
        },
      };
      expect(getShoppingListRole(list, 'u1')).toBe(CollaboratorRole.Editor);
    });

    it('falls back to home membership role', () => {
      const list = { ownerships: [] };
      expect(
        getShoppingListRole(list, 'u1', { role: MembershipRole.Member }),
      ).toBe(MembershipRole.Member);
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
      const home = { members: [makeMember('u1', MembershipRole.Owner)] };
      const info = getHomeOwnerInfo(home);
      expect(info?.id).toBe('u1');
    });

    it('finds owner from membersConnection', () => {
      const home = {
        membersConnection: {
          edges: [{ node: makeMember('u1', MembershipRole.Owner) }],
        },
      };
      const info = getHomeOwnerInfo(home);
      expect(info?.id).toBe('u1');
    });

    it('returns null when no owner found', () => {
      const home = { members: [makeMember('u1', MembershipRole.Member)] };
      expect(getHomeOwnerInfo(home)).toBeNull();
    });

    it('returns null when owner has no user', () => {
      const home = {
        members: [{ userId: 'u1', role: MembershipRole.Owner, user: null }],
      };
      expect(getHomeOwnerInfo(home)).toBeNull();
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
      [CollaboratorRole.Owner, 'Owner'],
      [CollaboratorRole.Admin, 'Admin'],
      [CollaboratorRole.Editor, 'Editor'],
      [CollaboratorRole.Viewer, 'Viewer'],
      [MembershipRole.Member, 'Member'],
      [MembershipRole.Guest, 'Guest'],
    ])('formats %s as %s', (input, expected) => {
      expect(formatRoleDisplay(input)).toBe(expected);
    });

    it('returns Unknown for null', () => {
      expect(formatRoleDisplay(null)).toBe('Unknown');
    });
  });
});
