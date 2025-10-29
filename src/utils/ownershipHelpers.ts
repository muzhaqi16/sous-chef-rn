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
  collaborators?: ShoppingListCollaborator[] | null;
}

/**
 * Home Types (matching GraphQL schema)
 */
interface HomeMember {
  userId?: string;
  role: string;
  status: string;
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
}

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
): string | null {
  if (!currentUserId) return null;

  // Check if owner
  if (isShoppingListOwner(list, currentUserId)) {
    return 'OWNER';
  }

  // Check collaborators
  const collaboration = list.collaborators?.find(
    c => c.collaboratorId === currentUserId,
  );

  return collaboration?.role || null;
}

/**
 * Get owner information for a home
 */
export function getHomeOwnerInfo(home: HomeWithMembers): OwnerInfo | null {
  const owner = home.members?.find(m => m.role === 'OWNER');
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
    home.members?.some(
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

  const member = home.members?.find(m => m.userId === currentUserId);
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
