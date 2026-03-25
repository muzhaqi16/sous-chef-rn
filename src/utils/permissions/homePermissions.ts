import { MembershipRole } from '#generated';

/**
 * Get the roles that a user can invite to a home based on their own role
 * and the granular `canInviteOthers` permission field.
 *
 * Permission rules:
 * - If `canInviteOthers` is explicitly false, the user cannot invite anyone
 * - GUEST: Cannot invite anyone (regardless of canInviteOthers)
 * - MEMBER: Can invite if canInviteOthers !== false (only MEMBER role)
 * - ADMIN: Can invite MEMBER or ADMIN
 * - OWNER: Can invite GUEST, MEMBER, or ADMIN (but not another OWNER)
 *
 * Note: OWNER role is reserved for home creators and cannot be assigned via invitation
 */
export function getInvitableRoles(
  userRole: MembershipRole,
  canInviteOthers?: boolean,
): MembershipRole[] {
  // If permission is explicitly denied, no invitations allowed
  if (canInviteOthers === false) {
    return [];
  }

  switch (userRole) {
    case MembershipRole.Guest:
      // Guests cannot invite anyone
      return [];

    case MembershipRole.Member:
      // Members can invite if canInviteOthers is not explicitly false
      return [MembershipRole.Member];

    case MembershipRole.Admin:
      // Admins can invite members and other admins
      return [MembershipRole.Member, MembershipRole.Admin];

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

/**
 * Check if a user can invite others to a home based on their role
 * and the granular `canInviteOthers` permission field.
 */
export function canInviteToHome(
  userRole: MembershipRole,
  canInviteOthers?: boolean,
): boolean {
  return getInvitableRoles(userRole, canInviteOthers).length > 0;
}

/**
 * Find the current user's membership in a home by matching userId
 * Returns null if the user is not a member
 */
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
