import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { getMealTemplatePermissions } from '../mealTemplatePermissions';

const homeTemplate = (role: MembershipRole | null, creatorId = 'creator') => ({
  homeId: 'home-1',
  home: { myMembership: role ? { role } : null },
  user: { id: creatorId },
});

describe('getMealTemplatePermissions', () => {
  it('gives the owner of a personal template every action', () => {
    expect(
      getMealTemplatePermissions({ homeId: null, user: { id: 'u1' } }, 'u1'),
    ).toEqual({ canEdit: true, canDelete: true, canDuplicate: true });
  });

  it('gives a home template creator every action whatever their role', () => {
    expect(
      getMealTemplatePermissions(
        homeTemplate(MembershipRole.Guest, 'u1'),
        'u1',
      ),
    ).toEqual({ canEdit: true, canDelete: true, canDuplicate: true });
  });

  // Delete floors at ADMIN, as for a meal plan: EDIT is not enough.
  it('lets a home MEMBER edit but not delete', () => {
    expect(
      getMealTemplatePermissions(homeTemplate(MembershipRole.Member), 'u1'),
    ).toEqual({ canEdit: true, canDelete: false, canDuplicate: true });
  });

  it('lets a home ADMIN delete', () => {
    expect(
      getMealTemplatePermissions(homeTemplate(MembershipRole.Admin), 'u1'),
    ).toEqual({ canEdit: true, canDelete: true, canDuplicate: true });
  });

  it('lets a home GUEST only duplicate', () => {
    expect(
      getMealTemplatePermissions(homeTemplate(MembershipRole.Guest), 'u1'),
    ).toEqual({ canEdit: false, canDelete: false, canDuplicate: true });
  });

  it('offers nothing on a home template without a membership', () => {
    expect(getMealTemplatePermissions(homeTemplate(null), 'u1')).toEqual({
      canEdit: false,
      canDelete: false,
      canDuplicate: false,
    });
  });
});
