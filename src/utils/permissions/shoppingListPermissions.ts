import { MembershipRole, CollaboratorStatus } from '#generated';

/**
 * Permission flags for shopping list item operations
 */
export interface ShoppingListPermissions {
  canAddItems: boolean;
  canRemoveItems: boolean;
  canEditItems: boolean;
  canMarkPurchased: boolean;
}

/**
 * Home membership shape (from HomeDisplayFragment.myMembership)
 */
interface HomeMembership {
  role: MembershipRole;
  canAddItems?: boolean;
  canRemoveItems?: boolean;
  canEditPantry?: boolean;
}

/**
 * Collaborator shape (from ShoppingListCollaboratorFragment)
 */
interface Collaborator {
  collaboratorId?: string | null;
  collaborator?: { id: string } | null;
  status?: CollaboratorStatus;
  canAddItems?: boolean;
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
}

/**
 * Shopping list data shape needed for permission calculation
 */
interface ShoppingListData {
  homeId?: string | null;
  collaboratorsConnection?: {
    edges?: Array<{ node?: Collaborator | null } | null> | null;
  } | null;
}

/**
 * Default permissions - no access
 */
const NO_PERMISSIONS: ShoppingListPermissions = {
  canAddItems: false,
  canRemoveItems: false,
  canEditItems: false,
  canMarkPurchased: false,
};

/**
 * Full permissions - all access
 */
const FULL_PERMISSIONS: ShoppingListPermissions = {
  canAddItems: true,
  canRemoveItems: true,
  canEditItems: true,
  canMarkPurchased: true,
};

/**
 * Guest permissions - mark purchased only
 */
const GUEST_PERMISSIONS: ShoppingListPermissions = {
  canAddItems: false,
  canRemoveItems: false,
  canEditItems: false,
  canMarkPurchased: true,
};

/**
 * Find the current user's collaborator from the collaborators connection
 */
function findMyCollaborator(
  collaboratorsConnection: ShoppingListData['collaboratorsConnection'],
  userId?: string,
): Collaborator | null {
  if (!collaboratorsConnection?.edges || !userId) {
    return null;
  }

  for (const edge of collaboratorsConnection.edges) {
    if (!edge?.node) continue;
    const collab = edge.node;

    // Match by collaborator.id or collaboratorId
    if (collab.collaborator?.id === userId || collab.collaboratorId === userId) {
      // Only return if status is ACTIVE
      if (collab.status === CollaboratorStatus.Active) {
        return collab;
      }
    }
  }

  return null;
}

/**
 * Get permissions from home membership for home-linked lists
 *
 * Permission rules for home-linked lists:
 * - OWNER/ADMIN/MEMBER: all permissions (use membership fields)
 * - GUEST: mark purchased only
 */
function getHomePermissions(membership: HomeMembership): ShoppingListPermissions {
  // Guest role: mark purchased only
  if (membership.role === MembershipRole.Guest) {
    return GUEST_PERMISSIONS;
  }

  // OWNER/ADMIN/MEMBER: Use the membership permission fields
  // Fall back to true for backward compatibility if fields are undefined
  return {
    canAddItems: membership.canAddItems ?? true,
    canRemoveItems: membership.canRemoveItems ?? true,
    canEditItems: membership.canEditPantry ?? true,
    canMarkPurchased: membership.canAddItems ?? true,
  };
}

/**
 * Get permissions from collaborator for personal lists (no homeId)
 */
function getCollaboratorPermissions(collaborator: Collaborator): ShoppingListPermissions {
  return {
    canAddItems: collaborator.canAddItems ?? false,
    canRemoveItems: collaborator.canRemoveItems ?? false,
    canEditItems: collaborator.canEditItems ?? false,
    canMarkPurchased: collaborator.canMarkPurchased ?? false,
  };
}

/**
 * Get permissions for a shopping list based on:
 * - Home membership (if list has homeId) - uses home membership permissions
 * - Collaborator permissions (if list has no homeId) - uses collaborator permissions
 *
 * @param shoppingList - The shopping list data with homeId and collaborators
 * @param userId - The current user's ID
 * @param homeMembership - The user's membership in the home (required for home-linked lists)
 * @returns Permission flags for the shopping list
 */
export function getShoppingListPermissions(
  shoppingList: ShoppingListData,
  userId?: string,
  homeMembership?: HomeMembership | null,
): ShoppingListPermissions {
  // If list is linked to a home, use home membership permissions
  if (shoppingList.homeId) {
    if (!homeMembership) {
      // User is not a member of the home - no permissions
      return NO_PERMISSIONS;
    }
    return getHomePermissions(homeMembership);
  }

  // For personal lists (no homeId), use collaborator permissions
  const collaborator = findMyCollaborator(shoppingList.collaboratorsConnection, userId);
  if (collaborator) {
    return getCollaboratorPermissions(collaborator);
  }

  // No collaborator found - this shouldn't happen for valid access
  // Return no permissions as a safety measure
  return NO_PERMISSIONS;
}

/**
 * Check if user is the owner of a shopping list
 * Owners always have full permissions
 */
export function isShoppingListOwner(
  ownerId?: string | null,
  userId?: string,
): boolean {
  return !!ownerId && !!userId && ownerId === userId;
}

/**
 * Get permissions for a shopping list, accounting for ownership
 * Owners always get full permissions regardless of other settings
 */
export function getShoppingListPermissionsWithOwner(
  shoppingList: ShoppingListData & { ownership?: { userId?: string } | null },
  userId?: string,
  homeMembership?: HomeMembership | null,
): ShoppingListPermissions {
  // Owners always have full permissions
  if (isShoppingListOwner(shoppingList.ownership?.userId, userId)) {
    return FULL_PERMISSIONS;
  }

  return getShoppingListPermissions(shoppingList, userId, homeMembership);
}
