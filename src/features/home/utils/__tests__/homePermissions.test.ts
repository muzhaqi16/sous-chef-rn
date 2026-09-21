import { MembershipRole } from '#/graphql/generated/schemaTypes';
import {
  getInvitableRoles,
  canInviteToHome,
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

  it('Admin can invite Members but not Admins', () => {
    // Conferring ADMIN is the home owner's alone: a non-owner who could grant
    // it would escalate by inviting a second address of their own.
    expect(getInvitableRoles(MembershipRole.Admin)).toEqual([
      MembershipRole.Member,
    ]);
  });

  it('never offers OWNER, whoever is asking', () => {
    for (const role of [
      MembershipRole.Guest,
      MembershipRole.Member,
      MembershipRole.Admin,
      MembershipRole.Owner,
    ]) {
      expect(getInvitableRoles(role, true)).not.toContain(MembershipRole.Owner);
    }
  });

  it('offers ADMIN to the owner alone', () => {
    expect(getInvitableRoles(MembershipRole.Owner)).toContain(
      MembershipRole.Admin,
    );
    for (const role of [
      MembershipRole.Guest,
      MembershipRole.Member,
      MembershipRole.Admin,
    ]) {
      expect(getInvitableRoles(role, true)).not.toContain(MembershipRole.Admin);
    }
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
