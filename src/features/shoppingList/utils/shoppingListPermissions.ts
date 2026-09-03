import {
  MembershipRole,
  CollaboratorStatus,
} from '#/graphql/generated/schemaTypes';

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
    if (
      collab.collaborator?.id === userId ||
      collab.collaboratorId === userId
    ) {
      // Only return if status is ACTIVE
      if (collab.status === CollaboratorStatus.Active) {
        return collab;
      }
    }
  }

  return null;
}

/** GUEST marks purchased only; every other role reads the membership fields. */
function getHomePermissions(
  membership: HomeMembership,
): ShoppingListPermissions {
  if (membership.role === MembershipRole.Guest) {
    return GUEST_PERMISSIONS;
  }

  // An undefined field falls back to true for these roles.
  return {
    canAddItems: membership.canAddItems ?? true,
    canRemoveItems: membership.canRemoveItems ?? true,
    canEditItems: membership.canEditPantry ?? true,
    canMarkPurchased: membership.canAddItems ?? true,
  };
}

/** For personal lists (no homeId). */
function getCollaboratorPermissions(
  collaborator: Collaborator,
): ShoppingListPermissions {
  return {
    canAddItems: collaborator.canAddItems ?? false,
    canRemoveItems: collaborator.canRemoveItems ?? false,
    canEditItems: collaborator.canEditItems ?? false,
    canMarkPurchased: collaborator.canMarkPurchased ?? false,
  };
}

/**
 * Home membership when the list has a `homeId`, collaborator permissions
 * otherwise. `homeMembership` is required for a home-linked list.
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
  const collaborator = findMyCollaborator(
    shoppingList.collaboratorsConnection,
    userId,
  );
  if (collaborator) {
    return getCollaboratorPermissions(collaborator);
  }

  // No collaborator found - this shouldn't happen for valid access
  // Return no permissions as a safety measure
  return NO_PERMISSIONS;
}

/**
 * Two ids, compared. NOT exported and NOT named `isShoppingListOwner`: the
 * public answer to that question is `ownershipHelpers.isShoppingListOwner`,
 * which searches the `ownerships` ARRAY. Two exports under one name is how a
 * caller reaches for the wrong arity and gets `false` for a real owner.
 */
function isOwnerId(ownerId?: string | null, userId?: string): boolean {
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
  if (isOwnerId(shoppingList.ownership?.userId, userId)) {
    return FULL_PERMISSIONS;
  }

  return getShoppingListPermissions(shoppingList, userId, homeMembership);
}
