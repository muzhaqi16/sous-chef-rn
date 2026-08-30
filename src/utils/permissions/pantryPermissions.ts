import { MembershipRole } from '#/graphql/generated/schemaTypes';

/**
 * Permission flags for pantry operations
 */
export interface PantryPermissions {
  canView: boolean;
  canAddItems: boolean;
  canEditItems: boolean; // covers edit/consume/restock/remove
  canCreatePantry: boolean; // API gate: ACTIVE membership with canEditPantry
  canDeletePantry: boolean; // API gate: OWNER || ADMIN || canManageHome
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
  canCreatePantry: false,
  canDeletePantry: false,
};

const FULL_PERMISSIONS: PantryPermissions = {
  canView: true,
  canAddItems: true,
  canEditItems: true,
  canCreatePantry: true,
  canDeletePantry: true,
};

/**
 * Per the API sharing guide: MEMBER defaults permissive (`!== false`), GUEST
 * restrictive (`=== true`). Creating and editing a pantry share ONE API gate —
 * an active membership with `canEditPantry` — so `canCreatePantry` tracks
 * `canEditItems`. Only deleting needs `canManageHome`, false for every role.
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
    const guestCanEditPantry = membership.canEditPantry === true;
    return {
      canView: membership.canViewPantry === true,
      canAddItems: membership.canAddItems === true,
      canEditItems: guestCanEditPantry,
      canCreatePantry: guestCanEditPantry,
      canDeletePantry: false, // Guests can never delete a pantry
    };
  }

  // MEMBER: permissive defaults — allowed unless explicitly denied
  const canEditPantry = membership.canEditPantry !== false;
  return {
    canView: membership.canViewPantry !== false,
    canAddItems: membership.canAddItems !== false,
    canEditItems: canEditPantry,
    canCreatePantry: canEditPantry,
    canDeletePantry: membership.canManageHome === true,
  };
}
