import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import { RemoveCollaboratorDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { settleMutation } from '#/apollo/utils/settleMutation';
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
  const [removeMember, { client }] = useMutation(RemoveCollaboratorDocument);
  const [leaving, setLeaving] = useState(false);

  const leaveList = async (
    collaboratorId: string,
    callbacks?: LeaveCallbacks,
  ) => {
    await executeWithLoadingState(
      async () => {
        const settled = await settleMutation(
          () => removeMember({ variables: { input: { id: collaboratorId } } }),
          {
            document: RemoveCollaboratorDocument,
            fallback: t('shoppingListScreens.failedToLeave'),
            removal: true,
            // Callers show their own copy through `onError`.
            present: 'none',
          },
        );
        if (settled.failure) {
          callbacks?.onError?.(settled.failure);
          return;
        }
        // A repeat answered as not found names no collaborator, so the cache
        // is updated from the settle, not from the payload.
        removeCollaboratorFromShoppingListCache(
          client.cache,
          listId,
          collaboratorId,
          { evictItem: true },
        );
        callbacks?.onSuccess?.();
      },
      setLeaving,
      callbacks?.onError,
    );
  };

  return { leaveList, leaving };
}
