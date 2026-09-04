import { MembershipRole } from '#/graphql/generated/schemaTypes';

/**
 * Mirrors the API's invite check: OWNER/ADMIN always may, so `canInviteOthers`
 * gates MEMBER only. Two ceilings on what may be CONFERRED — OWNER never, ADMIN
 * only by the owner, or a member could invite a second address of their own as
 * ADMIN and escalate.
 */
export function getInvitableRoles(
  userRole: MembershipRole,
  canInviteOthers?: boolean,
): MembershipRole[] {
  switch (userRole) {
    case MembershipRole.Guest:
      // Guests cannot invite anyone
      return [];

    case MembershipRole.Member:
      // The flag is a MEMBER escalator: explicitly false blocks member invites
      return canInviteOthers === false ? [] : [MembershipRole.Member];

    case MembershipRole.Admin:
      // Admins invite members; conferring ADMIN is the owner's alone. The flag
      // is ignored for admins — the capability comes with the role.
      return [MembershipRole.Member];

    case MembershipRole.Owner:
      // Owners can invite anyone except another owner
      return [
        MembershipRole.Guest,
        MembershipRole.Member,
        MembershipRole.Admin,
      ];

    default:
      return [];
  }
}

export function canInviteToHome(
  userRole: MembershipRole,
  canInviteOthers?: boolean,
): boolean {
  return getInvitableRoles(userRole, canInviteOthers).length > 0;
}

/** null when the user is not a member. */
export function findUserMembership(
  members:
    | Array<{ id: string; userId?: string; role: string; status: string }>
    | undefined,
  currentUserId: string | undefined,
): { id: string; role: MembershipRole; status: string } | null {
  if (!members || !currentUserId) {
    return null;
  }

  const membership = members.find(m => m.userId === currentUserId);

  if (!membership) {
    return null;
  }

  return {
    id: membership.id,
    role: membership.role as MembershipRole,
    status: membership.status,
  };
}
