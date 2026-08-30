import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { RemoveCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';

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
  const [removeMember] = useMutation(RemoveCollaboratorDocument);
  const [leaving, setLeaving] = useState(false);

  const leaveList = async (
    collaboratorId: string,
    callbacks?: LeaveCallbacks,
  ) => {
    await executeWithLoadingState(
      async () => {
        const result = await removeMember({
          variables: { input: { id: collaboratorId } },
          update(cache, { data }) {
            // Only evict on success — a resolved error must not remove the
            // collaborator entry from the cache.
            if (
              data?.removeShoppingListCollaborator?.__typename !==
              'RemoveShoppingListCollaboratorPayload'
            ) {
              return;
            }
            removeCollaboratorFromShoppingListCache(
              cache,
              listId,
              collaboratorId,
              { evictItem: true },
            );
          },
        });
        // Callers alert/toast via callbacks.onError, so nothing is surfaced here.
        // classifyCreateResult treats the offline-queued null as success; a
        // resolved error member or a transport error is 'rejected'.
        if (classifyCreateResult(result) === 'rejected') {
          callbacks?.onError?.(new Error('Leave Shopping List'));
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
