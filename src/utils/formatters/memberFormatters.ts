import type { ShoppingListCollaboratorFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import type {
  MembershipRole,
  MembershipStatus,
} from '#/graphql/generated/schemaTypes';
import type { Translate } from '#/i18n/types';
import { firstNonBlank } from '#/utils/firstNonBlank';

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
    /** Readable by anyone sharing a home or list, whatever the profile says. */
    displayName?: string | null;
    profile?: {
      displayName?: string | null;
    } | null;
  } | null;
};

/** What a row names a person by; the queries that name one select these. */
export type NamedPerson = {
  displayName?: string | null;
  email?: string | null;
  profile?: { displayName?: string | null } | null;
};

/**
 * The name a row shows for a person, or undefined when none is readable.
 * `User.displayName` follows the sharing relationship, so it resolves where a
 * private `profile` comes back null; `email` is only ever the reader's own.
 */
export function personName(
  person: NamedPerson | null | undefined,
): string | undefined {
  return firstNonBlank(
    person?.displayName,
    person?.profile?.displayName,
    person?.email,
  );
}

/** Resolves to "You" for `currentUserId`, else the first non-empty name source. */
export function getMemberDisplayName(
  member: Member,
  translate: Translate,
  currentUserId?: string,
): string {
  if (currentUserId && member.user?.id === currentUserId) {
    return translate('homeDetail.youLabel');
  }

  return (
    firstNonBlank(
      member.displayName,
      member.user?.displayName,
      member.user?.profile?.displayName,
      member.user?.email?.split('@')[0],
      member.user?.email,
    ) ?? translate('labels.unknown')
  );
}

/** Picked from the generated fragment, so it tracks the schema. */
export type CollaboratorDisplayShape = Pick<
  ShoppingListCollaboratorFragment,
  'email' | 'collaboratorId' | 'collaborator'
>;

/**
 * `User.displayName` first: it follows the SHARING relationship, so it resolves
 * even when a private `profile` comes back null. Then the profile; the email's
 * local part is the last resort.
 */
export function getCollaboratorDisplayName(
  collaborator: CollaboratorDisplayShape,
  translate: Translate,
  currentUserId?: string,
): string {
  if (currentUserId && collaborator.collaboratorId === currentUserId) {
    return translate('homeDetail.youLabel');
  }

  const email = collaborator.collaborator?.email ?? collaborator.email ?? null;

  return (
    firstNonBlank(
      collaborator.collaborator?.displayName,
      collaborator.collaborator?.profile?.displayName,
      email?.split('@')[0],
      email,
    ) ?? translate('labels.unknown')
  );
}
