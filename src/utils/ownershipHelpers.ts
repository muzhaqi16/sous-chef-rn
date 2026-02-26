/**
 * Ownership Helper Utilities
 *
 * Provides helper functions to determine ownership, roles, and user information
 * for shopping lists and homes.
 */

/**
 * Shopping List Types (matching GraphQL schema)
 */
interface ShoppingListOwnership {
  userId: string;
  user?: {
    id: string;
    email: string;
    profile?: {
      displayName?: string | null;
      avatar?: string | null;
    } | null;
  } | null;
}

interface ShoppingListCollaborator {
  collaboratorId?: string | null;
  role: string;
  status: string;
  collaborator?: {
    id: string;
    email: string;
    profile?: {
      displayName?: string | null;
      avatar?: string | null;
    } | null;
  } | null;
}

interface ShoppingListWithOwnership {
  ownerships?: ShoppingListOwnership[] | null;
  collaboratorsConnection?: {
    edges?: Array<{ node?: ShoppingListCollaborator | null } | null> | null;
    totalCount?: number | null;
  } | null;
}

import { extractNodes } from '#/utils/connectionUtils';

/**
 * Home Types (matching GraphQL schema)
 */
interface HomeMember {
  userId?: string;
  role: string;
  status?: string;
  user?: {
    id: string;
    email?: string;
    profile?: {
      displayName?: string | null;
      avatar?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    } | null;
  } | null;
}

interface HomeWithMembers {
  members?: HomeMember[] | null;
  membersConnection?: {
    edges?: Array<{ node?: HomeMember | null } | null> | null;
  } | null;
}

const resolveHomeMembers = (home: HomeWithMembers): HomeMember[] => {
  if (Array.isArray(home.members)) {
    return home.members.filter(Boolean) as HomeMember[];
  }

  return extractNodes<HomeMember>(home.membersConnection);
};

const resolveCollaborators = (list: ShoppingListWithOwnership): ShoppingListCollaborator[] => {
  return extractNodes<ShoppingListCollaborator>(list.collaboratorsConnection);
};

/**
 * User Info Type
 */
export interface OwnerInfo {
  id: string;
  email?: string | null;
  displayName?: string | null;
  avatar?: string | null;
}

/**
 * Get owner information for a shopping list
 */
export function getShoppingListOwnerInfo(
  list: ShoppingListWithOwnership,
): OwnerInfo | null {
  const ownership = list.ownerships?.[0];
  if (!ownership?.user) return null;

  return {
    id: ownership.user.id,
    email: ownership.user.email,
    displayName: ownership.user.profile?.displayName,
    avatar: ownership.user.profile?.avatar,
  };
}

/**
 * Shopping list with optional home for display avatar resolution
 */
interface ShoppingListWithHome extends ShoppingListWithOwnership {
  home?: HomeWithMembers | null;
}

/**
 * Get display avatar info for a shopping list.
 * Priority: Home owner (if list belongs to a home) > List owner
 */
export function getShoppingListDisplayAvatarInfo(
  list: ShoppingListWithHome,
): OwnerInfo | null {
  // If list has a home, show home owner's avatar
  if (list.home) {
    const homeOwnerInfo = getHomeOwnerInfo(list.home);
    if (homeOwnerInfo) {
      return homeOwnerInfo;
    }
  }

  // Fall back to list owner
  return getShoppingListOwnerInfo(list);
}

/**
 * Check if current user is the owner of a shopping list
 */
export function isShoppingListOwner(
  list: ShoppingListWithOwnership,
  currentUserId?: string,
): boolean {
  if (!currentUserId) return false;
  return list.ownerships?.some(o => o.userId === currentUserId) || false;
}

/**
 * Get current user's role in a shopping list (as a collaborator)
 */
export function getShoppingListRole(
  list: ShoppingListWithOwnership,
  currentUserId?: string,
  homeMyMembership?: { role: string } | null,
): string | null {
  if (!currentUserId) return null;

  // Check if owner
  if (isShoppingListOwner(list, currentUserId)) {
    return 'OWNER';
  }

  // Check collaborators using resolver (supports both array and connection)
  const collaborators = resolveCollaborators(list);
  const collaboration = collaborators.find(
    c => c.collaboratorId === currentUserId,
  );

  // Fall back to home membership role for home-linked lists
  return collaboration?.role || homeMyMembership?.role || null;
}

/**
 * Get owner information for a home
 */
export function getHomeOwnerInfo(home: HomeWithMembers): OwnerInfo | null {
  const owner = resolveHomeMembers(home).find(m => m.role === 'OWNER');
  if (!owner?.user) return null;

  return {
    id: owner.user.id,
    email: owner.user.email,
    displayName: owner.user.profile?.displayName,
    avatar: owner.user.profile?.avatar,
  };
}

/**
 * Check if current user is the owner of a home
 */
export function isHomeOwner(
  home: HomeWithMembers,
  currentUserId?: string,
): boolean {
  if (!currentUserId) return false;
  return (
    resolveHomeMembers(home).some(
      m => m.userId && m.userId === currentUserId && m.role === 'OWNER',
    ) || false
  );
}

/**
 * Get current user's role in a home
 */
export function getHomeRole(
  home: HomeWithMembers,
  currentUserId?: string,
): string | null {
  if (!currentUserId) return null;

  const member = resolveHomeMembers(home).find(
    m => m.userId === currentUserId,
  );
  return member?.role || null;
}

/**
 * Extract initials from a display name for avatar fallback
 * Returns first letter capitalized
 *
 * @example
 * getInitials("John Doe") => "J"
 * getInitials("jane_smith@example.com") => "J"
 * getInitials(null) => "?"
 */
export function getInitials(displayName?: string | null): string {
  if (!displayName) return '?';

  // Remove email domain if present
  const name = displayName.split('@')[0];

  // Get first character and uppercase
  const initial = name.trim().charAt(0).toUpperCase();

  return initial || '?';
}

/**
 * Format a role for display
 */
export function formatRoleDisplay(role: string | null): string {
  if (!role) return 'Unknown';

  switch (role) {
    case 'OWNER':
      return 'Owner';
    case 'ADMIN':
      return 'Admin';
    case 'EDITOR':
      return 'Editor';
    case 'VIEWER':
      return 'Viewer';
    case 'MEMBER':
      return 'Member';
    default:
      return role.charAt(0) + role.slice(1).toLowerCase();
  }
}
