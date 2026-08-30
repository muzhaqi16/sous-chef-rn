import { type ShoppingListCollaboratorFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import {
  type MembershipRole,
  type MembershipStatus,
} from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';

/**
 * Loose `Membership` shape: different queries select different subsets, so every
 * field beyond `id`/`role`/`status` is optional and the shapes interchange.
 */
export type Member = {
  id: string;
  role: MembershipRole;
  status?: MembershipStatus;
  homeId?: string;
  userId?: string;
  displayName?: string | null;
  canManageHome?: boolean;
  canViewPantry?: boolean;
  canEditPantry?: boolean;
  canAddItems?: boolean;
  canRemoveItems?: boolean;
  canInviteOthers?: boolean;
  user?: {
    id: string;
    email?: string | null;
    profile?: {
      displayName?: string | null;
    } | null;
  } | null;
};

/** Resolves to "You" for `currentUserId`, else the first non-empty name source. */
export function getMemberDisplayName(
  member: Member,
  currentUserId?: string,
): string {
  if (currentUserId && member.user?.id === currentUserId) {
    return t('homeDetail.youLabel');
  }

  return (
    member.displayName ||
    member.user?.profile?.displayName ||
    member.user?.email?.split('@')[0] ||
    member.user?.email ||
    t('labels.unknown')
  );
}

/** Picked from the generated fragment, so it tracks the schema. */
export type CollaboratorDisplayShape = Pick<
  ShoppingListCollaboratorFragment,
  'email' | 'collaboratorId' | 'collaborator'
>;

/**
 * Unlike `getMemberDisplayName` this reads the `collaborator` sub-object and
 * only its `displayName` — firstName/lastName are not queried for collaborators.
 */
export function getCollaboratorDisplayName(
  collaborator: CollaboratorDisplayShape,
  currentUserId?: string,
): string {
  if (currentUserId && collaborator.collaboratorId === currentUserId) {
    return t('homeDetail.youLabel');
  }

  const email = collaborator.collaborator?.email ?? collaborator.email ?? null;

  return (
    collaborator.collaborator?.profile?.displayName ||
    email?.split('@')[0] ||
    email ||
    t('labels.unknown')
  );
}
