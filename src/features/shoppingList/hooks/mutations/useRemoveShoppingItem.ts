/**
 * useRemoveShoppingItem - Remove item mutation for shopping list
 *
 * Single responsibility:
 * - Remove mutation with optimistic response
 * - Cache eviction for removed item
 * - Error handling with user feedback
 */

import { gql } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { Unmasked } from '@apollo/client/masking';
import {
  RemoveItemFromShoppingListDocument,
  type RemoveItemFromShoppingListMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { removeFromShoppingListItemsCache } from './utils';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { handleMutationError } from '#/utils/errorHandlers';

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
  refetch: () => Promise<any>;
}

/**
 * Hook for removing items from a shopping list
 *
 * @example
 * ```tsx
 * const { removeItem } = useRemoveShoppingItem({ listId, items, refetch });
 * await removeItem('item-123');
 * ```
 */
interface UseRemoveShoppingItemReturn {
  removeItem: (itemId: string) => Promise<unknown>;
}

export function useRemoveShoppingItem({
  listId,
  refetch,
}: UseRemoveShoppingItemOptions): UseRemoveShoppingItemReturn {
  const { createRemoveOperation } = useCrudOperations();
  const client = useApolloClient();

  const [removeItemMutation] = useMutation(RemoveItemFromShoppingListDocument, {
    optimisticResponse: (
      variables,
    ): Unmasked<RemoveItemFromShoppingListMutation> => {
      // Read current aggregates from cache so the optimistic response
      // reflects correct counts instead of hardcoded zeros.
      const listStats = listId
        ? client.cache.readFragment<{
            totalItems: number;
            completedItems: number;
            remainingItems: number;
            completionRate: number;
          }>({
            id: client.cache.identify({
              __typename: 'ShoppingList',
              id: listId,
            }),
            fragment: ShoppingListStatsFragment,
            fragmentName: '_RemoveShoppingItemStats',
          })
        : null;

      const itemPurchase = client.cache.readFragment<{
        purchaseInfo: { isPurchased: boolean } | null;
      }>({
        id: client.cache.identify({
          __typename: 'ShoppingListItem',
          id: variables.input.id,
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

      return {
        __typename: 'Mutation',
        removeItemFromShoppingList: {
          __typename: 'RemoveItemFromShoppingListPayload',
          shoppingListItem: {
            __typename: 'ShoppingListItem',
            id: variables.input.id,
            shoppingList: {
              __typename: 'ShoppingList',
              id: listId ?? '',
              totalItems: newTotal,
              completedItems: newCompleted,
              remainingItems: newRemaining,
              completionRate: newCompletionRate,
            },
          },
        },
      };
    },
    update(cache, { data }, { variables }) {
      if (
        data?.removeItemFromShoppingList?.__typename !==
          'RemoveItemFromShoppingListPayload' ||
        !listId ||
        !variables
      ) {
        return;
      }

      executeCacheUpdate(
        () => {
          const itemId = variables.input.id;
          removeFromShoppingListItemsCache(cache, listId, itemId, {
            evictItem: true,
          });
        },
        'Cache update failed for removeItem, will refetch:',
        refetch,
      );
    },
    onError: error => {
      handleMutationError(error, { operation: 'Remove Shopping List Item' });
    },
  });

  const removeItem = async (itemId: string) => {
    const operation = createRemoveOperation({
      mutation: removeItemMutation,
      parentId: listId,
      itemId,
      operationName: 'Delete Shopping List Item',
    });
    return operation();
  };

  return { removeItem };
}
