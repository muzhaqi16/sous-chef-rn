/**
 * useRemoveShoppingItem - Remove item mutation for shopping list
 *
 * Evicts the item and decrements the list stats in the cache before firing the
 * mutation, and leaves those changes in place. The removal persists even when the
 * delete is queued offline or the API is unreachable — the queue replays it,
 * idempotent by the item's id. An `optimisticResponse` can't be used here: Apollo
 * would roll it back the moment the request is queued (null result). On a real
 * (non-network) error the item still exists server-side, so it's restored via
 * refetch.
 */

import { gql } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { RemoveItemFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { removeFromShoppingListItemsCache } from './utils';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { handleMutationError } from '#/utils/errorHandlers';
import { isNetworkError } from '#/utils/isNetworkError';

// Minimal cache-read fragments — only the fields the optimistic-update path needs.
const ShoppingListStatsFragment = gql`
  fragment _RemoveShoppingItemStats on ShoppingList {
    totalItems
    completedItems
    remainingItems
    completionRate
  }
`;

const ShoppingListItemPurchaseFragment = gql`
  fragment _RemoveShoppingItemPurchase on ShoppingListItem {
    purchaseInfo {
      isPurchased
    }
  }
`;

interface UseRemoveShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
}

interface UseRemoveShoppingItemReturn {
  removeItem: (itemId: string) => Promise<unknown>;
}

export function useRemoveShoppingItem({
  listId,
  refetch,
}: UseRemoveShoppingItemOptions): UseRemoveShoppingItemReturn {
  const client = useApolloClient();

  const [removeItemMutation] = useMutation(RemoveItemFromShoppingListDocument, {
    update(cache, { data }, { variables }) {
      // Re-evict on the server response: Apollo re-normalizes the
      // `shoppingListItem { id }` payload, which would otherwise resurrect the
      // (already optimistically evicted) entity into its connection.
      if (
        data?.removeItemFromShoppingList?.__typename !==
          'RemoveItemFromShoppingListPayload' ||
        !listId ||
        !variables
      ) {
        return;
      }
      executeCacheUpdate(
        () =>
          removeFromShoppingListItemsCache(cache, listId, variables.input.id, {
            evictItem: true,
          }),
        'Cache cleanup failed for removeItem:',
      );
    },
    onError: error => {
      // Network/transient error: queueLink queued the delete for replay — keep
      // the optimistic eviction; do NOT restore.
      if (isNetworkError(error)) return;
      // Real (server/validation) error: the item still exists → restore.
      handleMutationError(error, { operation: 'Remove Shopping List Item' });
      refetch();
    },
  });

  const removeItem = async (itemId: string) => {
    if (!listId) return false;

    // Snapshot list stats + purchased state to compute the decremented
    // aggregates (the old optimisticResponse path did this via the response).
    const listStats = client.cache.readFragment<{
      totalItems: number;
      completedItems: number;
      remainingItems: number;
      completionRate: number;
    }>({
      id: client.cache.identify({ __typename: 'ShoppingList', id: listId }),
      fragment: ShoppingListStatsFragment,
      fragmentName: '_RemoveShoppingItemStats',
    });
    const itemPurchase = client.cache.readFragment<{
      purchaseInfo: { isPurchased: boolean } | null;
    }>({
      id: client.cache.identify({
        __typename: 'ShoppingListItem',
        id: itemId,
      }),
      fragment: ShoppingListItemPurchaseFragment,
      fragmentName: '_RemoveShoppingItemPurchase',
    });

    const wasPurchased = itemPurchase?.purchaseInfo?.isPurchased ?? false;
    const prevTotal = listStats?.totalItems ?? 0;
    const prevCompleted = listStats?.completedItems ?? 0;
    const newTotal = Math.max(0, prevTotal - 1);
    const newCompleted = wasPurchased
      ? Math.max(0, prevCompleted - 1)
      : prevCompleted;
    const newRemaining = Math.max(0, newTotal - newCompleted);
    const newCompletionRate = newTotal > 0 ? newCompleted / newTotal : 0;

    // Apply the removal to the cache before the mutation, and leave it in place.
    executeCacheUpdate(() => {
      removeFromShoppingListItemsCache(client.cache, listId, itemId, {
        evictItem: true,
      });
      client.cache.modify({
        id: client.cache.identify({ __typename: 'ShoppingList', id: listId }),
        fields: {
          totalItems: () => newTotal,
          completedItems: () => newCompleted,
          remainingItems: () => newRemaining,
          completionRate: () => newCompletionRate,
        },
      });
    }, 'Remove Shopping List Item (optimistic evict + stats)');

    return executeMutation(
      () =>
        removeItemMutation({
          variables: { input: { id: itemId } },
          context: { localFirst: true },
        }),
      'Remove Shopping List Item error:',
    );
  };

  return { removeItem };
}
