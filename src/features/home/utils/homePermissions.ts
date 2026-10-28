import { MembershipRole } from '#/graphql/generated/schemaTypes';
import type { MembershipPermissionKey } from '#features/home/types';

/** The viewer's own membership, as `myMembership` selects it. */
export interface HomeViewer extends Record<MembershipPermissionKey, boolean> {
  role: MembershipRole;
}

const ROLE_RANK: Record<MembershipRole, number> = {
  [MembershipRole.Guest]: 1,
  [MembershipRole.Member]: 2,
  [MembershipRole.Admin]: 3,
  [MembershipRole.Owner]: 4,
};

/** Editing the home and managing its roster: OWNER/ADMIN outright, below them `canManageHome`. */
export function canManageHome(viewer: HomeViewer | null | undefined): boolean {
  if (!viewer) return false;
  return (
    viewer.role === MembershipRole.Owner ||
    viewer.role === MembershipRole.Admin ||
    viewer.canManageHome
  );
}

/**
 * Re-roling, re-flagging or removing a member: never oneself or an owner, and
 * below OWNER only someone under the viewer's own role, so a manager can
 * neither reach a peer nor promote themselves.
 */
export function canManageMember(
  viewer: HomeViewer | null | undefined,
  memberRole: MembershipRole,
  isSelf: boolean,
): boolean {
  if (!viewer || !canManageHome(viewer)) return false;
  if (isSelf || memberRole === MembershipRole.Owner) return false;
  return (
    viewer.role === MembershipRole.Owner ||
    ROLE_RANK[memberRole] < ROLE_RANK[viewer.role]
  );
}

/** Ownership moves only by transfer, and below OWNER a role must sit under the viewer's own. */
export function getAssignableRoles(
  viewerRole: MembershipRole,
): MembershipRole[] {
  return [
    MembershipRole.Admin,
    MembershipRole.Member,
    MembershipRole.Guest,
  ].filter(
    role =>
      viewerRole === MembershipRole.Owner ||
      ROLE_RANK[role] < ROLE_RANK[viewerRole],
  );
}

/** Below OWNER, switching a flag on for someone else takes holding it. */
export function canGrantFlag(
  viewer: HomeViewer,
  flag: MembershipPermissionKey,
): boolean {
  return viewer.role === MembershipRole.Owner || viewer[flag];
}

/**
 * Mirrors the API's invite check: OWNER/ADMIN always may, a MEMBER or GUEST
 * only holding `canInviteOthers`. What may be CONFERRED is at most the
 * inviter's own role: OWNER never, and ADMIN only by the owner, or a member
 * could invite a second address of their own above themselves and escalate.
 */
export function getInvitableRoles(
  userRole: MembershipRole,
  canInviteOthers: boolean,
): MembershipRole[] {
  switch (userRole) {
    case MembershipRole.Guest:
      return canInviteOthers ? [MembershipRole.Guest] : [];

    case MembershipRole.Member:
      return canInviteOthers
        ? [MembershipRole.Member, MembershipRole.Guest]
        : [];

    case MembershipRole.Admin:
      return [MembershipRole.Member, MembershipRole.Guest];

    case MembershipRole.Owner:
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
  canInviteOthers: boolean,
): boolean {
  return getInvitableRoles(userRole, canInviteOthers).length > 0;
}
