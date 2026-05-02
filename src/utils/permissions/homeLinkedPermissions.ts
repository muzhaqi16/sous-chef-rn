import { MembershipRole } from '../../graphql/generated/schemaTypes';

/** Mirrors the API's PermissionLevel from HomeLinkedResourceAccessControl */
export type PermissionLevel = 'owner' | 'admin' | 'editor' | 'viewer' | 'none';

/** Minimal shape for any home-linked resource (MealPlan, MealTemplate, etc.) */
export interface HomeLinkedResource {
  homeId?: string | null;
  home?: {
    myMembership?: { role: MembershipRole } | null;
  } | null;
}

/**
 * Map a home membership role to the corresponding permission level.
 *
 * | Home Role | PermissionLevel |
 * |-----------|-----------------|
 * | OWNER     | owner           |
 * | ADMIN     | admin           |
 * | MEMBER    | editor          |
 * | GUEST     | viewer          |
 */
export function mapRoleToPermissionLevel(
  role: MembershipRole,
): PermissionLevel {
  switch (role) {
    case MembershipRole.Owner:
      return 'owner';
    case MembershipRole.Admin:
      return 'admin';
    case MembershipRole.Member:
      return 'editor';
    case MembershipRole.Guest:
      return 'viewer';
    default:
      return 'none';
  }
}

/**
 * Get the user's permission level for a home-linked resource.
 *
 * Resolution order:
 * 1. Personal resource (no homeId) → 'owner'
 * 2. Creator of a home resource → 'owner'
 * 3. Home member → mapped from membership role
 * 4. No membership → 'none'
 */
export function getPermissionLevel(
  resource: HomeLinkedResource,
  isCreator: boolean,
): PermissionLevel {
  if (!resource.homeId) return 'owner';
  if (isCreator) return 'owner';

  const role = resource.home?.myMembership?.role;
  if (!role) return 'none';

  return mapRoleToPermissionLevel(role);
}

/** Can this level edit? (editor and above) */
export function canEdit(level: PermissionLevel): boolean {
  return level === 'owner' || level === 'admin' || level === 'editor';
}

/** Can this level delete? (admin and above) */
export function canDelete(level: PermissionLevel): boolean {
  return level === 'owner' || level === 'admin';
}

/** Can this level view? (any authenticated member) */
export function canView(level: PermissionLevel): boolean {
  return level !== 'none';
}
