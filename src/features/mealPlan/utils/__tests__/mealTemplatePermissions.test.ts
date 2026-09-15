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

  // The API gates template delete on EDIT, not on the plan's ADMIN floor.
  it('lets a home MEMBER edit and delete', () => {
    expect(
      getMealTemplatePermissions(homeTemplate(MembershipRole.Member), 'u1'),
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
