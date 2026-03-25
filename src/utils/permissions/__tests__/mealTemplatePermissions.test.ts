import { MembershipRole } from '#generated';
import {
  isTemplateCreator,
  getMealTemplatePermissions,
} from '../mealTemplatePermissions';

const FULL = {
  canEdit: true,
  canDelete: true,
  canCreatePlanFromTemplate: true,
};

const NONE = {
  canEdit: false,
  canDelete: false,
  canCreatePlanFromTemplate: false,
};

const EDITOR = {
  canEdit: true,
  canDelete: false,
  canCreatePlanFromTemplate: true,
};

const VIEWER = {
  canEdit: false,
  canDelete: false,
  canCreatePlanFromTemplate: true,
};

describe('mealTemplatePermissions', () => {
  describe('isTemplateCreator', () => {
    it('returns true when userId matches user.id', () => {
      expect(isTemplateCreator({ user: { id: 'u1' } }, 'u1')).toBe(true);
    });

    it('returns false when userId does not match', () => {
      expect(isTemplateCreator({ user: { id: 'u1' } }, 'u2')).toBe(false);
    });

    it('returns false when user is null', () => {
      expect(isTemplateCreator({ user: null }, 'u1')).toBe(false);
    });

    it('returns false when userId is undefined', () => {
      expect(isTemplateCreator({ user: { id: 'u1' } })).toBe(false);
    });

    it('returns false when user is missing', () => {
      expect(isTemplateCreator({}, 'u1')).toBe(false);
    });
  });

  describe('getMealTemplatePermissions', () => {
    it('returns full permissions for personal templates', () => {
      expect(getMealTemplatePermissions({}, 'u1')).toEqual(FULL);
    });

    it('returns full permissions when user is the template creator', () => {
      const template = { homeId: 'h1', user: { id: 'u1' } };
      expect(getMealTemplatePermissions(template, 'u1')).toEqual(FULL);
    });

    it('returns no permissions when home template has no membership', () => {
      const template = { homeId: 'h1', home: { myMembership: null } };
      expect(getMealTemplatePermissions(template, 'u2')).toEqual(NONE);
    });

    it('returns no permissions when home is null', () => {
      const template = { homeId: 'h1', home: null };
      expect(getMealTemplatePermissions(template, 'u2')).toEqual(NONE);
    });

    it('returns viewer permissions for GUEST role', () => {
      const template = {
        homeId: 'h1',
        home: { myMembership: { role: MembershipRole.Guest } },
      };
      expect(getMealTemplatePermissions(template, 'u2')).toEqual(VIEWER);
    });

    it.each([MembershipRole.Owner, MembershipRole.Admin])(
      'returns full permissions for %s role',
      role => {
        const template = {
          homeId: 'h1',
          home: { myMembership: { role } },
        };
        expect(getMealTemplatePermissions(template, 'u2')).toEqual(FULL);
      },
    );

    it('returns editor permissions (no delete) for MEMBER role', () => {
      const template = {
        homeId: 'h1',
        home: { myMembership: { role: MembershipRole.Member } },
      };
      expect(getMealTemplatePermissions(template, 'u2')).toEqual(EDITOR);
    });

    it('returns full permissions for personal templates even without userId', () => {
      expect(getMealTemplatePermissions({})).toEqual(FULL);
    });
  });
});
