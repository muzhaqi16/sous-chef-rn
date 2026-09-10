import { MembershipRole } from '#/graphql/generated/schemaTypes';

/** Mirrors the API's PermissionLevel from HomeLinkedResourceAccessControl */
export type PermissionLevel = 'owner' | 'admin' | 'editor' | 'viewer' | 'none';

/** Minimal shape for any home-linked resource (MealPlan, MealTemplate, etc.) */
export interface HomeLinkedResource {
  homeId?: string | null;
  home?: {
    myMembership?: { role: MembershipRole } | null;
  } | null;
}

/** MEMBER maps to `editor` and GUEST to `viewer`; the rest map by name. */
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

/** A personal resource and a home resource's creator are both `owner`. */
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
