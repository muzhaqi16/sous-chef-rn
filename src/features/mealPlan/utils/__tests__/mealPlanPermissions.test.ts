import { MembershipRole } from '#/graphql/generated/schemaTypes';
import {
  isMealPlanOwner,
  isPersonalPlan,
  getMealPlanPermissions,
} from '../mealPlanPermissions';

const FULL = {
  canEdit: true,
  canDelete: true,
  canDuplicate: true,
  canGenerateShoppingList: true,
  canSaveAsTemplate: true,
};

const NONE = {
  canEdit: false,
  canDelete: false,
  canDuplicate: false,
  canGenerateShoppingList: false,
  canSaveAsTemplate: false,
};

const EDITOR = {
  canEdit: true,
  canDelete: false,
  canDuplicate: true,
  canGenerateShoppingList: true,
  canSaveAsTemplate: true,
};

const VIEWER = {
  canEdit: false,
  canDelete: false,
  canDuplicate: false,
  canGenerateShoppingList: true,
  canSaveAsTemplate: false,
};

describe('mealPlanPermissions', () => {
  describe('isMealPlanOwner', () => {
    it('returns true when userId matches user.id', () => {
      expect(isMealPlanOwner({ user: { id: 'u1' } }, 'u1')).toBe(true);
    });

    it('returns false when userId does not match', () => {
      expect(isMealPlanOwner({ user: { id: 'u1' } }, 'u2')).toBe(false);
    });

    it('returns false when user is null', () => {
      expect(isMealPlanOwner({ user: null }, 'u1')).toBe(false);
    });

    it('returns false when userId is undefined', () => {
      expect(isMealPlanOwner({ user: { id: 'u1' } })).toBe(false);
    });

    it('returns false when user is missing', () => {
      expect(isMealPlanOwner({}, 'u1')).toBe(false);
    });

    it('ignores createdBy — owner is keyed off user, not creator', () => {
      // Home/legacy plan where the creator differs from the owner.
      const plan = { user: { id: 'owner' }, createdBy: { id: 'creator' } };
      expect(isMealPlanOwner(plan, 'creator')).toBe(false);
      expect(isMealPlanOwner(plan, 'owner')).toBe(true);
    });
  });

  describe('isPersonalPlan', () => {
    it('returns true when homeId is absent', () => {
      expect(isPersonalPlan({})).toBe(true);
    });

    it('returns true when homeId is null', () => {
      expect(isPersonalPlan({ homeId: null })).toBe(true);
    });

    it('returns false when homeId is present', () => {
      expect(isPersonalPlan({ homeId: 'h1' })).toBe(false);
    });
  });

  describe('getMealPlanPermissions', () => {
    it('returns full permissions for personal plans', () => {
      expect(getMealPlanPermissions({}, 'u1')).toEqual(FULL);
    });

    it('returns full permissions when user is the owner of a home plan', () => {
      const plan = { homeId: 'h1', user: { id: 'u1' } };
      expect(getMealPlanPermissions(plan, 'u1')).toEqual(FULL);
    });

    it('does not grant owner permissions to the creator when they are not the owner', () => {
      const plan = {
        homeId: 'h1',
        user: { id: 'owner' },
        createdBy: { id: 'creator' },
        home: { myMembership: { role: MembershipRole.Guest } },
      };
      // Creator is only a GUEST member → viewer, not owner.
      expect(getMealPlanPermissions(plan, 'creator')).toEqual(VIEWER);
    });

    it('returns no permissions when home plan has no membership', () => {
      const plan = { homeId: 'h1', home: { myMembership: null } };
      expect(getMealPlanPermissions(plan, 'u2')).toEqual(NONE);
    });

    it('returns no permissions when home is null', () => {
      const plan = { homeId: 'h1', home: null };
      expect(getMealPlanPermissions(plan, 'u2')).toEqual(NONE);
    });

    it('returns viewer permissions for GUEST role', () => {
      const plan = {
        homeId: 'h1',
        home: { myMembership: { role: MembershipRole.Guest } },
      };
      expect(getMealPlanPermissions(plan, 'u2')).toEqual(VIEWER);
    });

    it.each([MembershipRole.Owner, MembershipRole.Admin])(
      'returns full permissions for %s role',
      role => {
        const plan = {
          homeId: 'h1',
          home: { myMembership: { role } },
        };
        expect(getMealPlanPermissions(plan, 'u2')).toEqual(FULL);
      },
    );

    it('returns editor permissions (no delete) for MEMBER role', () => {
      const plan = {
        homeId: 'h1',
        home: { myMembership: { role: MembershipRole.Member } },
      };
      expect(getMealPlanPermissions(plan, 'u2')).toEqual(EDITOR);
    });

    it('returns full permissions for personal plans even without userId', () => {
      expect(getMealPlanPermissions({})).toEqual(FULL);
    });
  });
});
