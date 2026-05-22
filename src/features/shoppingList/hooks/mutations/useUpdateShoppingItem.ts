/**
 * useUpdateShoppingItem - Update item mutation for shopping list
 *
 * Pattern: write the optimistic field updates to the cache via
 * `cache.modify` BEFORE firing the mutation, then rely on Apollo's
 * auto-normalization to apply the server-confirmed values. On error,
 * revert the optimistic changes from a snapshot captured up front.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseUpdateShoppingItem_ItemFragmentDoc,
  type UseUpdateShoppingItem_ItemFragment,
} from './useUpdateShoppingItem.generated';
import { useErrorService } from '#/services/errorService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import type { ShoppingListItemUpdate } from './types';
import { executeMutation } from '#/utils/compilerSafeWrappers';

interface UseUpdateShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<any>;
}

const OPTIMISTIC_FIELDS: ReadonlyArray<
  Extract<
    keyof ShoppingListItemUpdate,
    'itemName' | 'quantity' | 'category' | 'unitName' | 'notes'
  >
> = ['itemName', 'quantity', 'category', 'unitName', 'notes'];

export function useUpdateShoppingItem({
  listId,
  refetch,
}: UseUpdateShoppingItemOptions) {
  const { handleApolloError } = useErrorService();
  const client = useApolloClient();

  const [updateItemMutation] = useMutation(UpdateShoppingListItemDocument);

  const updateItem = async (
    itemId: string,
    updates: ShoppingListItemUpdate,
  ) => {
    if (!listId) return false;

    const cacheId = client.cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    if (!cacheId) {
      console.warn('Item not found, cannot update:', itemId);
      return false;
    }

    const snapshot =
      client.cache.readFragment<UseUpdateShoppingItem_ItemFragment>({
        id: cacheId,
        fragment: UseUpdateShoppingItem_ItemFragmentDoc,
        fragmentName: 'useUpdateShoppingItem_item',
      });
    if (!snapshot) {
      console.warn('Item not found, cannot update:', itemId);
      return false;
    }

    // Optimistically write the changed fields. Server response will be
    // auto-normalized on top of this when the mutation completes.
    const optimisticFields: Record<string, () => unknown> = {
      updatedAt: () => new Date().toISOString(),
    };
    for (const field of OPTIMISTIC_FIELDS) {
      if (updates[field] !== undefined) {
        const value = updates[field];
        optimisticFields[field] = () => value;
      }
    }
    client.cache.modify({ id: cacheId, fields: optimisticFields });

    const revertSnapshot = () => {
      const revertFields: Record<string, () => unknown> = {};
      for (const field of OPTIMISTIC_FIELDS) {
        if (updates[field] !== undefined) {
          revertFields[field] = () => snapshot[field];
        }
      }
      revertFields.updatedAt = () => snapshot.updatedAt;
      client.cache.modify({ id: cacheId, fields: revertFields });
    };

    const result = await executeMutation(
      () =>
        updateItemMutation({
          variables: {
            input: { ...updates, id: itemId, version: snapshot.version },
          },
        }),
      error => {
        revertSnapshot();
        if (handleVersionConflict(error)) {
          alertService.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetch() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        const { message } = handleApolloError(error, {
          operation: 'Update Shopping List Item',
        });
        alertService.alert('Error', message);
      },
    );
    if (!result) return false;

    return (
      result.data?.updateShoppingListItem?.__typename ===
      'UpdateShoppingListItemSuccess'
    );
  };

  return { updateItem };
}
