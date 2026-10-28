import {
  CollaboratorRole,
  MembershipRole,
  CollaboratorStatus,
} from '#/graphql/generated/schemaTypes';

/**
 * What the caller may do to a shopping list and its items
 */
export interface ShoppingListPermissionFlags {
  canAddItems: boolean;
  canRemoveItems: boolean;
  canEditItems: boolean;
  canMarkPurchased: boolean;
  /** The list's own details (name, store): the API's EDIT, not EDIT_ITEMS. */
  canEditList: boolean;
}

/**
 * Home membership shape (from HomeDisplayFragment.myMembership)
 */
interface HomeMembership {
  role: MembershipRole;
}

/**
 * Collaborator shape (from ShoppingListCollaboratorFragment)
 */
interface Collaborator {
  collaboratorId?: string | null;
  collaborator?: { id: string } | null;
  status?: CollaboratorStatus;
  role?: CollaboratorRole;
  canEdit?: boolean;
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
const NO_PERMISSIONS: ShoppingListPermissionFlags = {
  canAddItems: false,
  canRemoveItems: false,
  canEditItems: false,
  canMarkPurchased: false,
  canEditList: false,
};

/**
 * Full permissions - all access
 */
const FULL_PERMISSIONS: ShoppingListPermissionFlags = {
  canAddItems: true,
  canRemoveItems: true,
  canEditItems: true,
  canMarkPurchased: true,
  canEditList: true,
};

/**
 * Guest permissions - mark purchased only
 */
const GUEST_PERMISSIONS: ShoppingListPermissionFlags = {
  canAddItems: false,
  canRemoveItems: false,
  canEditItems: false,
  canMarkPurchased: true,
  canEditList: false,
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

/**
 * A home list follows the member's role alone: the membership's flags grant
 * the home's pantries, and the API reads none of them for a list.
 */
function getHomePermissions(
  membership: HomeMembership,
): ShoppingListPermissionFlags {
  return membership.role === MembershipRole.Guest
    ? GUEST_PERMISSIONS
    : FULL_PERMISSIONS;
}

/** For personal lists (no homeId). */
function getCollaboratorPermissions(
  collaborator: Collaborator,
): ShoppingListPermissionFlags {
  return {
    canAddItems: collaborator.canAddItems ?? false,
    canRemoveItems: collaborator.canRemoveItems ?? false,
    canEditItems: collaborator.canEditItems ?? false,
    canMarkPurchased: collaborator.canMarkPurchased ?? false,
    // Below OWNER the API reads `canEdit` at every role.
    canEditList:
      collaborator.role === CollaboratorRole.Owner ||
      (collaborator.canEdit ?? false),
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
): ShoppingListPermissionFlags {
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
): ShoppingListPermissionFlags {
  // Owners always have full permissions
  if (isOwnerId(shoppingList.ownership?.userId, userId)) {
    return FULL_PERMISSIONS;
  }

  return getShoppingListPermissions(shoppingList, userId, homeMembership);
}

type CollaboratorFlag =
  | 'canEdit'
  | 'canAddItems'
  | 'canRemoveItems'
  | 'canEditItems'
  | 'canMarkPurchased'
  | 'canInviteOthers';

/** The inviting collaborator's own row. */
export interface CollaboratorInviter extends Record<CollaboratorFlag, boolean> {
  role: CollaboratorRole;
}

const EVERY_FLAG: readonly CollaboratorFlag[] = [
  'canEdit',
  'canAddItems',
  'canRemoveItems',
  'canEditItems',
  'canMarkPurchased',
  'canInviteOthers',
];

/** The flags the API gives an invite of each role (`getPermissionsForRole`). */
const ROLE_FLAGS: Record<CollaboratorRole, readonly CollaboratorFlag[]> = {
  [CollaboratorRole.Owner]: EVERY_FLAG,
  [CollaboratorRole.Admin]: EVERY_FLAG,
  [CollaboratorRole.Editor]: EVERY_FLAG.filter(
    flag => flag !== 'canInviteOthers',
  ),
  [CollaboratorRole.Contributor]: [
    'canAddItems',
    'canEditItems',
    'canMarkPurchased',
  ],
  [CollaboratorRole.Shopper]: ['canMarkPurchased'],
  [CollaboratorRole.Viewer]: [],
};

// SHOPPER ranks with VIEWER: what it adds is the canMarkPurchased flag.
const ROLE_RANK: Record<CollaboratorRole, number> = {
  [CollaboratorRole.Viewer]: 1,
  [CollaboratorRole.Shopper]: 1,
  [CollaboratorRole.Contributor]: 2,
  [CollaboratorRole.Editor]: 3,
  [CollaboratorRole.Admin]: 4,
  [CollaboratorRole.Owner]: 5,
};

/**
 * The roles a collaborator may invite to a personal list, as the API decides:
 * holding `canInviteOthers`, at most their own role, and only a role whose
 * flags they all hold. The list's owner has no row and is unconstrained.
 */
export function getInvitableCollaboratorRoles(
  inviter: CollaboratorInviter,
  roles: readonly CollaboratorRole[],
): CollaboratorRole[] {
  if (!inviter.canInviteOthers) return [];
  return roles.filter(
    role =>
      ROLE_RANK[role] <= ROLE_RANK[inviter.role] &&
      ROLE_FLAGS[role].every(flag => inviter[flag]),
  );
}

/**
 * Deleting a list, as the API decides: its owner, and on a home's list the
 * home's OWNER and ADMINs.
 */
export function canDeleteShoppingList(
  isOwner: boolean,
  homeRole: MembershipRole | null | undefined,
): boolean {
  return (
    isOwner ||
    homeRole === MembershipRole.Owner ||
    homeRole === MembershipRole.Admin
  );
}
