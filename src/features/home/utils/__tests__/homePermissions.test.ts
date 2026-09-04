import { MembershipRole } from '#/graphql/generated/schemaTypes';
import {
  getInvitableRoles,
  canInviteToHome,
  findUserMembership,
} from '#features/home/utils/homePermissions';

describe('getInvitableRoles', () => {
  it('Guest cannot invite anyone', () => {
    expect(getInvitableRoles(MembershipRole.Guest)).toEqual([]);
  });

  it('Member can only invite Members', () => {
    expect(getInvitableRoles(MembershipRole.Member)).toEqual([
      MembershipRole.Member,
    ]);
  });

  it('Admin can invite Members and Admins', () => {
    expect(getInvitableRoles(MembershipRole.Admin)).toEqual([
      MembershipRole.Member,
      MembershipRole.Admin,
    ]);
  });

  it('Owner can invite Guests, Members, and Admins', () => {
    expect(getInvitableRoles(MembershipRole.Owner)).toEqual([
      MembershipRole.Guest,
      MembershipRole.Member,
      MembershipRole.Admin,
    ]);
  });

  it('returns empty array for unknown role', () => {
    expect(getInvitableRoles('UNKNOWN' as MembershipRole)).toEqual([]);
  });

  // Mirrors the API's invite rule: OWNER/ADMIN may always invite; the
  // canInviteOthers flag only escalates (or blocks) MEMBER.
  describe('canInviteOthers flag', () => {
    it('explicitly false blocks Member invites', () => {
      expect(getInvitableRoles(MembershipRole.Member, false)).toEqual([]);
    });

    it('explicitly false does NOT block Admin invites', () => {
      expect(getInvitableRoles(MembershipRole.Admin, false)).toEqual([
        MembershipRole.Member,
        MembershipRole.Admin,
      ]);
    });

    it('explicitly false does NOT block Owner invites', () => {
      expect(getInvitableRoles(MembershipRole.Owner, false)).toEqual([
        MembershipRole.Guest,
        MembershipRole.Member,
        MembershipRole.Admin,
      ]);
    });

    it('true grants Member invites', () => {
      expect(getInvitableRoles(MembershipRole.Member, true)).toEqual([
        MembershipRole.Member,
      ]);
    });

    it('never grants Guest invites', () => {
      expect(getInvitableRoles(MembershipRole.Guest, true)).toEqual([]);
    });
  });
});

describe('canInviteToHome', () => {
  it('returns false for Guest', () => {
    expect(canInviteToHome(MembershipRole.Guest)).toBe(false);
  });

  it('returns true for Member', () => {
    expect(canInviteToHome(MembershipRole.Member)).toBe(true);
  });

  it('returns true for Admin', () => {
    expect(canInviteToHome(MembershipRole.Admin)).toBe(true);
  });

  it('returns true for Owner', () => {
    expect(canInviteToHome(MembershipRole.Owner)).toBe(true);
  });
});

describe('findUserMembership', () => {
  const members = [
    { id: 'm1', userId: 'u1', role: 'OWNER', status: 'ACTIVE' },
    { id: 'm2', userId: 'u2', role: 'MEMBER', status: 'ACTIVE' },
    { id: 'm3', userId: 'u3', role: 'ADMIN', status: 'ACTIVE' },
  ];

  it('finds membership by userId', () => {
    const result = findUserMembership(members, 'u2');
    expect(result).toEqual({
      id: 'm2',
      role: MembershipRole.Member,
      status: 'ACTIVE',
    });
  });

  it('returns null when user not found', () => {
    expect(findUserMembership(members, 'u99')).toBeNull();
  });

  it('returns null for undefined members', () => {
    expect(findUserMembership(undefined, 'u1')).toBeNull();
  });

  it('returns null for undefined userId', () => {
    expect(findUserMembership(members, undefined)).toBeNull();
  });
});
