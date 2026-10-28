import { MembershipRole } from '#/graphql/generated/schemaTypes';
import {
  getInvitableRoles,
  canInviteToHome,
  canManageHome,
  getAssignableRoles,
  type HomeViewer,
} from '#features/home/utils/homePermissions';

const EVERY_ROLE = [
  MembershipRole.Guest,
  MembershipRole.Member,
  MembershipRole.Admin,
  MembershipRole.Owner,
];

describe('getInvitableRoles', () => {
  it('lets a Guest invite only Guests', () => {
    expect(getInvitableRoles(MembershipRole.Guest, true)).toEqual([
      MembershipRole.Guest,
    ]);
  });

  it('lets a Member invite Members and Guests', () => {
    expect(getInvitableRoles(MembershipRole.Member, true)).toEqual([
      MembershipRole.Member,
      MembershipRole.Guest,
    ]);
  });

  it('lets an Admin invite Members and Guests but not Admins', () => {
    // Conferring ADMIN is the home owner's alone: a non-owner who could grant
    // it would escalate by inviting a second address of their own.
    expect(getInvitableRoles(MembershipRole.Admin, false)).toEqual([
      MembershipRole.Member,
      MembershipRole.Guest,
    ]);
  });

  it('lets the Owner invite Guests, Members and Admins', () => {
    expect(getInvitableRoles(MembershipRole.Owner, false)).toEqual([
      MembershipRole.Guest,
      MembershipRole.Member,
      MembershipRole.Admin,
    ]);
  });

  it('never offers OWNER, whoever is asking', () => {
    for (const role of EVERY_ROLE) {
      expect(getInvitableRoles(role, true)).not.toContain(MembershipRole.Owner);
    }
  });

  it('offers ADMIN to the owner alone', () => {
    for (const role of EVERY_ROLE.filter(r => r !== MembershipRole.Owner)) {
      expect(getInvitableRoles(role, true)).not.toContain(MembershipRole.Admin);
    }
  });

  // The API admits OWNER/ADMIN outright; below them the flag alone decides.
  it.each([MembershipRole.Guest, MembershipRole.Member])(
    'offers a %s nothing without canInviteOthers',
    role => {
      expect(getInvitableRoles(role, false)).toEqual([]);
    },
  );
});

describe('canInviteToHome', () => {
  it.each([MembershipRole.Admin, MembershipRole.Owner])(
    'lets a %s invite without canInviteOthers',
    role => {
      expect(canInviteToHome(role, false)).toBe(true);
    },
  );

  it.each([MembershipRole.Guest, MembershipRole.Member])(
    'lets a %s invite only with canInviteOthers',
    role => {
      expect(canInviteToHome(role, true)).toBe(true);
      expect(canInviteToHome(role, false)).toBe(false);
    },
  );
});

const viewerAs = (
  role: MembershipRole,
  canManageHomeFlag = false,
): HomeViewer => ({
  role,
  canManageHome: canManageHomeFlag,
  canViewPantry: true,
  canEditPantry: true,
  canAddItems: true,
  canRemoveItems: true,
  canInviteOthers: true,
});

describe('canManageHome', () => {
  it.each([MembershipRole.Owner, MembershipRole.Admin])(
    'lets a %s manage without the flag',
    role => {
      expect(canManageHome(viewerAs(role))).toBe(true);
    },
  );

  it.each([MembershipRole.Member, MembershipRole.Guest])(
    'lets a %s manage only with canManageHome',
    role => {
      expect(canManageHome(viewerAs(role, true))).toBe(true);
      expect(canManageHome(viewerAs(role))).toBe(false);
    },
  );
});

describe('getAssignableRoles', () => {
  // OWNER moves only through transferHomeOwnership.
  it('offers the owner every role but OWNER', () => {
    expect(getAssignableRoles(MembershipRole.Owner)).toEqual([
      MembershipRole.Admin,
      MembershipRole.Member,
      MembershipRole.Guest,
    ]);
  });

  it('offers anyone below the owner only roles under their own', () => {
    expect(getAssignableRoles(MembershipRole.Admin)).toEqual([
      MembershipRole.Member,
      MembershipRole.Guest,
    ]);
    expect(getAssignableRoles(MembershipRole.Member)).toEqual([
      MembershipRole.Guest,
    ]);
    expect(getAssignableRoles(MembershipRole.Guest)).toEqual([]);
  });
});
