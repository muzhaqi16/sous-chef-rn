import {
  MembershipRole,
  CollaboratorStatus,
} from '../../../graphql/generated/schemaTypes';
import {
  getShoppingListPermissions,
  isShoppingListOwner,
  getShoppingListPermissionsWithOwner,
} from '../shoppingListPermissions';

const FULL = {
  canAddItems: true,
  canRemoveItems: true,
  canEditItems: true,
  canMarkPurchased: true,
};

const NONE = {
  canAddItems: false,
  canRemoveItems: false,
  canEditItems: false,
  canMarkPurchased: false,
};

const GUEST_PERMS = {
  canAddItems: false,
  canRemoveItems: false,
  canEditItems: false,
  canMarkPurchased: true,
};

const makeCollaborator = (
  userId: string,
  overrides: Record<string, unknown> = {},
) => ({
  edges: [
    {
      node: {
        collaboratorId: userId,
        collaborator: { id: userId },
        status: CollaboratorStatus.Active,
        canAddItems: true,
        canRemoveItems: true,
        canEditItems: true,
        canMarkPurchased: true,
        ...overrides,
      },
    },
  ],
});

describe('shoppingListPermissions', () => {
  describe('isShoppingListOwner', () => {
    it('returns true when ownerId matches userId', () => {
      expect(isShoppingListOwner('u1', 'u1')).toBe(true);
    });

    it('returns false when IDs differ', () => {
      expect(isShoppingListOwner('u1', 'u2')).toBe(false);
    });

    it('returns false when ownerId is null', () => {
      expect(isShoppingListOwner(null, 'u1')).toBe(false);
    });

    it('returns false when userId is undefined', () => {
      expect(isShoppingListOwner('u1')).toBe(false);
    });
  });

  describe('getShoppingListPermissions — home-linked lists', () => {
    it('returns no permissions when no membership provided', () => {
      const list = { homeId: 'h1' };
      expect(getShoppingListPermissions(list, 'u1')).toEqual(NONE);
    });

    it('returns guest permissions for GUEST role', () => {
      const list = { homeId: 'h1' };
      const membership = { role: MembershipRole.Guest };
      expect(getShoppingListPermissions(list, 'u1', membership)).toEqual(
        GUEST_PERMS,
      );
    });

    it.each([
      MembershipRole.Owner,
      MembershipRole.Admin,
      MembershipRole.Member,
    ])('uses membership permission fields for %s role', role => {
      const list = { homeId: 'h1' };
      const membership = {
        role,
        canAddItems: true,
        canRemoveItems: true,
        canEditPantry: true,
      };
      expect(getShoppingListPermissions(list, 'u1', membership)).toEqual(FULL);
    });

    it('defaults undefined membership fields to true', () => {
      const list = { homeId: 'h1' };
      const membership = { role: MembershipRole.Member };
      const perms = getShoppingListPermissions(list, 'u1', membership);
      expect(perms.canAddItems).toBe(true);
      expect(perms.canRemoveItems).toBe(true);
      expect(perms.canEditItems).toBe(true);
      expect(perms.canMarkPurchased).toBe(true);
    });

    it('respects explicitly false membership fields', () => {
      const list = { homeId: 'h1' };
      const membership = {
        role: MembershipRole.Member,
        canAddItems: false,
        canRemoveItems: false,
        canEditPantry: false,
      };
      const perms = getShoppingListPermissions(list, 'u1', membership);
      expect(perms.canAddItems).toBe(false);
      expect(perms.canRemoveItems).toBe(false);
      expect(perms.canEditItems).toBe(false);
      expect(perms.canMarkPurchased).toBe(false);
    });
  });

  describe('getShoppingListPermissions — personal lists', () => {
    it('returns collaborator permissions for matching active collaborator', () => {
      const list = {
        homeId: null,
        collaboratorsConnection: makeCollaborator('u1'),
      };
      expect(getShoppingListPermissions(list, 'u1')).toEqual(FULL);
    });

    it('returns restricted collaborator permissions', () => {
      const list = {
        homeId: null,
        collaboratorsConnection: makeCollaborator('u1', {
          canAddItems: false,
          canRemoveItems: false,
          canEditItems: false,
          canMarkPurchased: true,
        }),
      };
      const perms = getShoppingListPermissions(list, 'u1');
      expect(perms.canAddItems).toBe(false);
      expect(perms.canMarkPurchased).toBe(true);
    });

    it('returns no permissions when no collaborator found', () => {
      const list = {
        homeId: null,
        collaboratorsConnection: makeCollaborator('other'),
      };
      expect(getShoppingListPermissions(list, 'u1')).toEqual(NONE);
    });

    it('returns no permissions when collaborator is not ACTIVE', () => {
      const list = {
        homeId: null,
        collaboratorsConnection: makeCollaborator('u1', {
          status: CollaboratorStatus.Pending,
        }),
      };
      expect(getShoppingListPermissions(list, 'u1')).toEqual(NONE);
    });

    it('returns no permissions when userId is undefined', () => {
      const list = {
        homeId: null,
        collaboratorsConnection: makeCollaborator('u1'),
      };
      expect(getShoppingListPermissions(list)).toEqual(NONE);
    });

    it('handles null edges', () => {
      const list = { homeId: null, collaboratorsConnection: { edges: null } };
      expect(getShoppingListPermissions(list, 'u1')).toEqual(NONE);
    });

    it('handles null node in edges', () => {
      const list = {
        homeId: null,
        collaboratorsConnection: { edges: [null, { node: null }] },
      };
      expect(getShoppingListPermissions(list, 'u1')).toEqual(NONE);
    });

    it('matches by collaborator.id fallback', () => {
      const list = {
        homeId: null,
        collaboratorsConnection: {
          edges: [
            {
              node: {
                collaboratorId: null,
                collaborator: { id: 'u1' },
                status: CollaboratorStatus.Active,
                canAddItems: true,
                canRemoveItems: true,
                canEditItems: true,
                canMarkPurchased: true,
              },
            },
          ],
        },
      };
      expect(getShoppingListPermissions(list, 'u1')).toEqual(FULL);
    });
  });

  describe('getShoppingListPermissionsWithOwner', () => {
    it('returns full permissions when user is the owner', () => {
      const list = { homeId: null, ownership: { userId: 'u1' } };
      expect(getShoppingListPermissionsWithOwner(list, 'u1')).toEqual(FULL);
    });

    it('falls back to base permissions when not the owner', () => {
      const list = {
        homeId: null,
        ownership: { userId: 'other' },
        collaboratorsConnection: makeCollaborator('u1', {
          canAddItems: false,
          canRemoveItems: false,
          canEditItems: false,
          canMarkPurchased: true,
        }),
      };
      const perms = getShoppingListPermissionsWithOwner(list, 'u1');
      expect(perms.canAddItems).toBe(false);
      expect(perms.canMarkPurchased).toBe(true);
    });

    it('returns no permissions when no ownership and no collaborator', () => {
      const list = { homeId: null, ownership: null };
      expect(getShoppingListPermissionsWithOwner(list, 'u1')).toEqual(NONE);
    });
  });
});
