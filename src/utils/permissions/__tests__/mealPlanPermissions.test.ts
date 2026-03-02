import { MembershipRole } from '#generated';
import {
  isMealPlanCreator,
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

const GUEST = {
  canEdit: false,
  canDelete: false,
  canDuplicate: false,
  canGenerateShoppingList: true,
  canSaveAsTemplate: false,
};

describe('mealPlanPermissions', () => {
  describe('isMealPlanCreator', () => {
    it('returns true when userId matches createdBy.id', () => {
      expect(isMealPlanCreator({ createdBy: { id: 'u1' } }, 'u1')).toBe(true);
    });

    it('returns false when userId does not match', () => {
      expect(isMealPlanCreator({ createdBy: { id: 'u1' } }, 'u2')).toBe(false);
    });

    it('returns false when createdBy is null', () => {
      expect(isMealPlanCreator({ createdBy: null }, 'u1')).toBe(false);
    });

    it('returns false when userId is undefined', () => {
      expect(isMealPlanCreator({ createdBy: { id: 'u1' } })).toBe(false);
    });

    it('returns false when createdBy is missing', () => {
      expect(isMealPlanCreator({}, 'u1')).toBe(false);
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

    it('returns full permissions when user is the creator of a home plan', () => {
      const plan = { homeId: 'h1', createdBy: { id: 'u1' } };
      expect(getMealPlanPermissions(plan, 'u1')).toEqual(FULL);
    });

    it('returns no permissions when home plan has no membership', () => {
      const plan = { homeId: 'h1', home: { myMembership: null } };
      expect(getMealPlanPermissions(plan, 'u2')).toEqual(NONE);
    });

    it('returns no permissions when home is null', () => {
      const plan = { homeId: 'h1', home: null };
      expect(getMealPlanPermissions(plan, 'u2')).toEqual(NONE);
    });

    it('returns guest permissions for GUEST role', () => {
      const plan = {
        homeId: 'h1',
        home: { myMembership: { role: MembershipRole.Guest } },
      };
      expect(getMealPlanPermissions(plan, 'u2')).toEqual(GUEST);
    });

    it.each([MembershipRole.Owner, MembershipRole.Admin, MembershipRole.Member])(
      'returns full permissions for %s role',
      (role) => {
        const plan = {
          homeId: 'h1',
          home: { myMembership: { role } },
        };
        expect(getMealPlanPermissions(plan, 'u2')).toEqual(FULL);
      },
    );

    it('returns full permissions for personal plans even without userId', () => {
      expect(getMealPlanPermissions({})).toEqual(FULL);
    });
  });
});
