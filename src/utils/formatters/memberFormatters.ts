import type { ShoppingListCollaboratorFragment } from '#/graphql/generated';

/**
 * Member interface for type safety
 */
export interface Member {
  id: string;
  role: string;
  status: string;
  userId?: string;
  displayName?: string | null;
  canViewPantry?: boolean;
  canEditPantry?: boolean;
  canAddItems?: boolean;
  canRemoveItems?: boolean;
  canInviteOthers?: boolean;
  canManageHome?: boolean;
  user?: {
    id: string;
    email?: string | null;
    profile?: {
      firstName?: string | null;
      lastName?: string | null;
      displayName?: string | null;
    } | null;
  } | null;
}

/**
 * Get display name for a member with comprehensive fallback logic
 * Handles current user detection and multiple fallback strategies
 *
 * @param member - Member object with user and profile information
 * @param currentUserId - Optional current user ID for "You" detection
 * @returns Display name string
 *
 * Priority order:
 * 1. "You" if current user
 * 2. member.displayName
 * 3. user.profile.displayName
 * 4. user.profile.firstName
 * 5. firstName + lastName combination
 * 6. email username (part before @)
 * 7. full email
 * 8. "Unknown Member"
 */
export function getMemberDisplayName(
  member: Member,
  currentUserId?: string,
): string {
  // Check if this member is the current user
  const isCurrentUser = currentUserId && member.user?.id === currentUserId;

  if (isCurrentUser) {
    return 'You';
  }

  // Try to get display name in order of preference
  const displayName =
    member.displayName ||
    member.user?.profile?.displayName ||
    member.user?.profile?.firstName ||
    (member.user?.profile?.firstName && member.user?.profile?.lastName
      ? `${member.user.profile.firstName} ${member.user.profile.lastName}`
      : null) ||
    member.user?.email?.split('@')[0] || // Use email username part
    member.user?.email ||
    'Unknown Member';

  return displayName;
}

/**
 * Minimal shape needed to resolve a shopping list collaborator's display name.
 * Picked from the generated `ShoppingListCollaboratorFragment` so the function
 * stays in sync with the GraphQL schema and accepts any object that matches
 * what the fragment queries.
 */
export type CollaboratorDisplayShape = Pick<
  ShoppingListCollaboratorFragment,
  'email' | 'collaboratorId' | 'collaborator'
>;

/**
 * Display name for a ShoppingListCollaborator.
 *
 * Unlike `getMemberDisplayName`, this reads from the `collaborator` sub-object
 * (matching the GraphQL fragment shape) and only uses `displayName` from the
 * profile — firstName/lastName aren't queried for shopping list collaborators.
 *
 * Priority order:
 * 1. "You" if current user
 * 2. collaborator.profile.displayName
 * 3. email username (part before @)
 * 4. full email
 * 5. "Unknown"
 */
export function getCollaboratorDisplayName(
  collaborator: CollaboratorDisplayShape,
  currentUserId?: string,
): string {
  if (currentUserId && collaborator.collaboratorId === currentUserId) {
    return 'You';
  }

  const email = collaborator.collaborator?.email ?? collaborator.email ?? null;

  return (
    collaborator.collaborator?.profile?.displayName ||
    email?.split('@')[0] ||
    email ||
    'Unknown'
  );
}
