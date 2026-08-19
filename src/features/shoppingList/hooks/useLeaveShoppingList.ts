import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { RemoveCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';

/**
 * Removes a collaborator from a shopping list's cached `collaboratorsConnection`.
 * Shared by the leave-list flow (removing yourself) and the remove-member flow
 * (removing others) so both keep the cache consistent — previously ListSettings'
 * leave flow omitted this, leaving a stale collaborator in the cache.
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
 * Owns the RemoveCollaborator mutation, the loading state, and the cache
 * removal so ShareList and ListSettings share one implementation instead of
 * reimplementing — and diverging on — the flow.
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
        // Surfacing is delegated to callbacks.onError (the callers alert/toast) —
        // don't alert here too. classifyCreateResult treats the offline-queued
        // null as success; a resolved error member or transport error → rejected.
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
