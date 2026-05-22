/**
 * useRemoveShoppingItem - Remove item mutation for shopping list
 *
 * Single responsibility:
 * - Remove mutation with optimistic response
 * - Cache eviction for removed item
 * - Error handling with user feedback
 */

import { alertService } from '#/services/alertService';
import { useMutation } from '@apollo/client/react';
import type { Unmasked } from '@apollo/client/masking';
import {
  RemoveItemFromShoppingListDocument,
  type RemoveItemFromShoppingListMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseRemoveShoppingItem_ItemFragmentDoc,
  type UseRemoveShoppingItem_ItemFragment,
} from './useRemoveShoppingItem.generated';
import { useErrorService } from '#/services/errorService';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { removeFromShoppingListItemsCache } from './utils';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';

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
  const { handleApolloError } = useErrorService();
  const { createRemoveOperation } = useCrudOperations();

  const [removeItemMutation] = useMutation(RemoveItemFromShoppingListDocument, {
    optimisticResponse: (
      variables,
    ): Unmasked<RemoveItemFromShoppingListMutation> => ({
      __typename: 'Mutation',
      removeItemFromShoppingList: {
        __typename: 'RemoveItemFromShoppingListSuccess',
        shoppingListItem: {
          __typename: 'ShoppingListItem',
          id: variables.id,
          shoppingList: {
            __typename: 'ShoppingList',
            id: listId ?? '',
            totalItems: 0,
            completedItems: 0,
            remainingItems: 0,
            completionRate: 0,
          },
        },
      },
    }),
    update(cache, { data }, { variables }) {
      if (
        data?.removeItemFromShoppingList?.__typename !==
          'RemoveItemFromShoppingListSuccess' ||
        !listId ||
        !variables
      ) {
        return;
      }

      executeCacheUpdate(
        () => {
          const itemId = variables.id;

          // Read isPurchased before eviction so we can update completedItems.
          // Uses a co-located narrow fragment (just id + purchaseInfo.isPurchased)
          // so this hook doesn't depend on the wider ShoppingListItemCore shape.
          const itemData =
            cache.readFragment<UseRemoveShoppingItem_ItemFragment>({
              id: cache.identify({
                __typename: 'ShoppingListItem',
                id: itemId,
              }),
              fragment: UseRemoveShoppingItem_ItemFragmentDoc,
              fragmentName: 'useRemoveShoppingItem_item',
            });
          const wasPurchased = itemData?.purchaseInfo?.isPurchased ?? false;

          removeFromShoppingListItemsCache(cache, listId, itemId, {
            evictItem: true,
          });

          // Update totalItems and conditionally completedItems
          const parentCacheId = cache.identify({
            __typename: 'ShoppingList',
            id: listId,
          });
          if (parentCacheId) {
            cache.modify({
              id: parentCacheId,
              fields: {
                totalItems(existing: number = 0) {
                  return Math.max(0, existing - 1);
                },
                ...(wasPurchased && {
                  completedItems(existing: number = 0) {
                    return Math.max(0, existing - 1);
                  },
                }),
              },
            });
          }
        },
        'Cache update failed for removeItem, will refetch:',
        refetch,
      );
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Shopping List Item',
      });
      alertService.alert('Error', message);
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
