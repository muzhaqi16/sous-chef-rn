import { MembershipRole } from '#generated';

/**
 * Permission flags for pantry operations
 */
export interface PantryPermissions {
  canView: boolean;
  canAddItems: boolean;
  canEditItems: boolean; // covers edit/consume/restock/remove
  canManagePantry: boolean; // create/delete pantry
}

/**
 * Home membership shape needed for pantry permission calculation
 */
interface HomeMembership {
  role: MembershipRole;
  canViewPantry?: boolean;
  canEditPantry?: boolean;
  canAddItems?: boolean;
  canManageHome?: boolean;
}

const NO_PERMISSIONS: PantryPermissions = {
  canView: false,
  canAddItems: false,
  canEditItems: false,
  canManagePantry: false,
};

const FULL_PERMISSIONS: PantryPermissions = {
  canView: true,
  canAddItems: true,
  canEditItems: true,
  canManagePantry: true,
};

/**
 * Get pantry permissions based on home membership.
 *
 * Rules per API sharing guide:
 * - OWNER/ADMIN: Full permissions always
 * - MEMBER: Permissive defaults (!== false) — has access unless explicitly denied
 * - GUEST: Restrictive defaults (=== true) — no access unless explicitly granted
 */
export function getPantryPermissions(
  membership: HomeMembership | null | undefined,
): PantryPermissions {
  if (!membership) {
    return NO_PERMISSIONS;
  }

  const { role } = membership;

  // OWNER/ADMIN always get full permissions
  if (role === MembershipRole.Owner || role === MembershipRole.Admin) {
    return FULL_PERMISSIONS;
  }

  // GUEST: restrictive defaults — only allowed if explicitly granted
  if (role === MembershipRole.Guest) {
    return {
      canView: membership.canViewPantry === true,
      canAddItems: membership.canAddItems === true,
      canEditItems: membership.canEditPantry === true,
      canManagePantry: false, // Guests can never manage pantries
    };
  }

  // MEMBER: permissive defaults — allowed unless explicitly denied
  return {
    canView: membership.canViewPantry !== false,
    canAddItems: membership.canAddItems !== false,
    canEditItems: membership.canEditPantry !== false,
    canManagePantry: membership.canManageHome === true,
  };
}
