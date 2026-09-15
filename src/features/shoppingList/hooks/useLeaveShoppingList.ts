import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { RemoveCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { useTranslation } from '#/i18n';

/**
 * Shared by the leave-list flow (removing yourself) and the remove-member flow
 * (removing others), so both keep `collaboratorsConnection` consistent.
 */
export const removeCollaboratorFromShoppingListCache =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'collaboratorsConnection',
    'ShoppingListCollaborator',
  );

interface LeaveCallbacks {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Leave a shopping list (removes the current user's own collaborator entry).
 * One implementation shared by ShareList and ListSettings.
 */
export function useLeaveShoppingList(listId: string) {
  const { t } = useTranslation();
  const [removeMember] = useMutation(RemoveCollaboratorDocument);
  const [leaving, setLeaving] = useState(false);

  const leaveList = async (
    collaboratorId: string,
    callbacks?: LeaveCallbacks,
  ) => {
    await executeWithLoadingState(
      async () => {
        const settled = await settleMutation(
          () =>
            removeMember({
              variables: { input: { id: collaboratorId } },
              update(cache, { data }) {
                // Only evict on success — a resolved error must not remove the
                // collaborator entry from the cache.
                if (!appliedPayload(data)) return;
                removeCollaboratorFromShoppingListCache(
                  cache,
                  listId,
                  collaboratorId,
                  { evictItem: true },
                );
              },
            }),
          {
            document: RemoveCollaboratorDocument,
            fallback: t('shoppingListScreens.failedToLeave'),
            // Callers show their own copy through `onError`.
            present: 'none',
          },
        );
        if (settled.failure) {
          callbacks?.onError?.(settled.failure);
          return;
        }
        callbacks?.onSuccess?.();
      },
      setLeaving,
      callbacks?.onError,
    );
  };

  return { leaveList, leaving };
}
