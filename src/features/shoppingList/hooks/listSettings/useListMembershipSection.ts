import { useTranslation } from '#/i18n';
import { alertService } from '#/services/alertService';
import { destructiveConfirm } from '#/services/destructiveConfirm';
import { toastService } from '#/services/toastService';
import { useScreenFocusEffect } from '#platform/screen';
import { useRemoveCollaborator } from '#features/shoppingList/hooks/useRemoveCollaborator';
import type { useShoppingListDetails } from '#features/shoppingList/hooks/useShoppingListDetails';
import {
  formatRoleDisplay,
  getShoppingListOwnerInfo,
  getShoppingListRole,
  listOwnershipOf,
} from '#features/shoppingList/utils/ownershipHelpers';
import { useUser } from '#store/useAppStore';

interface ListMembershipOptions {
  listId: string | undefined;
  details: ReturnType<typeof useShoppingListDetails>;
  /** Leaves the screen once the list is gone for this person. */
  leaveGoneList: () => void;
}

/** Who holds the list, in what role, and leaving it. */
export function useListMembershipSection({
  listId,
  details: { shoppingList, isShared, collaborators, ownerships, refetch },
  leaveGoneList,
}: ListMembershipOptions) {
  const { t } = useTranslation();
  const user = useUser();
  const { leaveList, leaving } = useRemoveCollaborator(listId ?? '');

  // ownerships + collaborators are materialized in the hook so the helpers
  // (typed against structural shapes) accept them via a synthesized arg.
  const snapshot = shoppingList
    ? {
        ownerships,
        collaboratorsConnection: {
          edges: collaborators.map(n => ({ node: n })),
        },
      }
    : null;
  const ownership = listOwnershipOf(listId, snapshot, user?.id);
  const isOwner = ownership === 'owner';
  const role = snapshot
    ? getShoppingListRole(snapshot, user?.id, shoppingList?.home?.myMembership)
    : null;

  // The email arm is guarded: both sides are nullable, and null-to-null would
  // match an arbitrary collaborator as "me".
  const currentUserCollaborator = collaborators.find(
    c =>
      (!!user?.email && c.email === user.email) ||
      c.collaboratorId === user?.id,
  );
  // Only a home MEMBER is told to "leave the home first". A direct collaborator
  // on a since-linked list has an orphaned row and must be able to leave the
  // list itself — gating on homeId alone dead-ends them.
  const isHomeMember = !!shoppingList?.home?.myMembership;

  // Leaving a home evicts only the Home, not a home-linked ShoppingList a
  // non-owner reached through it, so with every access path gone this pops back
  // and clears the selection rather than land on a list they cannot open.
  const hasLostListAccess =
    !!listId &&
    !!shoppingList &&
    !isOwner &&
    !currentUserCollaborator &&
    !isHomeMember;
  useScreenFocusEffect(() => {
    if (hasLostListAccess) leaveGoneList();
  });

  return {
    collaborators,
    isShared,
    ownership,
    isOwner,
    roleDisplay: formatRoleDisplay(role, t),
    ownerInfo: snapshot ? getShoppingListOwnerInfo(snapshot) : null,
    isHomeMember,
    linkedHomeId: shoppingList?.homeId ?? null,
    leaving,
    retryOwnership: () => {
      void refetch();
    },
    handleLeaveList: () => {
      alertService.alert(
        t('shoppingListScreens.leaveListTitle'),
        t('shoppingListScreens.leaveListMessage', {
          name: shoppingList?.name ?? t('shoppingListScreens.thisList'),
        }),
        destructiveConfirm(t('labels.leaveList'), () => {
          if (!currentUserCollaborator?.id) {
            toastService.error(
              t('shoppingListScreens.couldNotDetermineMembership'),
            );
            return;
          }
          void leaveList(currentUserCollaborator.id, {
            onSuccess: leaveGoneList,
            onError: () =>
              toastService.error(t('shoppingListScreens.failedToLeave')),
          });
        }),
      );
    },
  };
}
