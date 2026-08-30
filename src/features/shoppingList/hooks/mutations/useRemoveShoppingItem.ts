/**
 * Local-first: the item is evicted and the list stats decremented in the cache
 * PERMANENTLY before firing — an `optimisticResponse` rolls back on the offline
 * queue's null result. The replay is idempotent by item id; on a real (non-network)
 * error the item still exists server-side, so a refetch restores it.
 */

import { gql } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { RemoveItemFromShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { removeFromShoppingListItemsCache } from './utils';
import { handleMutationError } from '#/utils/errorHandlers';
import { isNetworkError } from '#/utils/isNetworkError';
import { errorService } from '#/services/errorService';

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
      // `shoppingListItem { id }` payload, resurrecting the evicted entity.
      if (
        data?.removeItemFromShoppingList?.__typename !==
          'RemoveItemFromShoppingListPayload' ||
        !listId ||
        !variables
      ) {
        return;
      }
      try {
        removeFromShoppingListItemsCache(cache, listId, variables.input.id, {
          evictItem: true,
        });
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Cache cleanup failed for removeItem:',
        });
      }
    },
    onError: error => {
      // queueLink queued the delete for replay — keep the eviction, do NOT restore.
      if (isNetworkError(error)) return;
      // Real (server/validation) error: the item still exists → restore.
      handleMutationError(error, { operation: 'Remove Shopping List Item' });
      refetch();
    },
  });

  const removeItem = async (itemId: string) => {
    if (!listId) return false;

    // Snapshot stats + purchased state to compute the decremented aggregates.
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

    try {
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
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Remove Shopping List Item (optimistic evict + stats)',
      });
    }

    try {
      return await removeItemMutation({
        variables: { input: { id: itemId } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Remove Shopping List Item error:',
      });
      return undefined;
    }
  };

  return { removeItem };
}
