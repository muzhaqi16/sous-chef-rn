import type {
  MemberShipFragment,
  ShoppingListCollaboratorFragment,
} from '#/graphql/generated';

/**
 * Loose `Membership` shape used by home-membership UI components.
 *
 * Different queries select different subsets of `Membership`:
 *  - `HomeFragment.membersConnection` selects `user { id, email }` + `canManageHome`
 *  - `HomeListFragment.membersConnection` selects no `user` and no permissions
 *  - `HomeFragment.myMembership` selects all permissions but no `user`
 *
 * To accept all three at the same call site, every field beyond the
 * always-present `id`/`role`/`status` is optional. Field types are pulled
 * from `MemberShipFragment` so the schema stays the source of truth.
 *
 * `user` is defined locally rather than as `MemberShipFragment['user']`
 * because slim queries (e.g. `HomeFragment.membersConnection`) select only
 * `{ id, email }` without `profile` — narrower than the full `UserSummary`.
 */
export type Member = Pick<MemberShipFragment, 'id' | 'role' | 'status'> &
  Partial<
    Pick<
      MemberShipFragment,
      | 'homeId'
      | 'userId'
      | 'displayName'
      | 'canManageHome'
      | 'canViewPantry'
      | 'canEditPantry'
      | 'canAddItems'
      | 'canRemoveItems'
      | 'canInviteOthers'
    >
  > & {
    user?: {
      id: string;
      email?: string | null;
      profile?: {
        displayName?: string | null;
      } | null;
    } | null;
  };

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
 * 4. email username (part before @)
 * 5. full email
 * 6. "Unknown Member"
 */
export function getMemberDisplayName(
  member: Member,
  currentUserId?: string,
): string {
  if (currentUserId && member.user?.id === currentUserId) {
    return 'You';
  }

  return (
    member.displayName ||
    member.user?.profile?.displayName ||
    member.user?.email?.split('@')[0] ||
    member.user?.email ||
    'Unknown Member'
  );
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
