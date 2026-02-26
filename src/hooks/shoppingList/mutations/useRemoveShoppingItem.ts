/**
 * useRemoveShoppingItem - Remove item mutation for shopping list
 *
 * Single responsibility:
 * - Remove mutation with optimistic response
 * - Cache eviction for removed item
 * - Error handling with user feedback
 */

import { Alert } from 'react-native';
import { gql } from '@apollo/client';
import { useRemoveItemFromShoppingListMutation } from '#generated';
import { useErrorService } from '#/services/errorService';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { buildOptimisticDeleteResponse } from '#/apollo/utils/optimisticTypes';
import { removeFromShoppingListItemsCache } from './utils';

interface UseRemoveShoppingItemOptions {
  listId: string | null | undefined;
  items?: unknown;
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

export function useRemoveShoppingItem({ listId, refetch }: UseRemoveShoppingItemOptions): UseRemoveShoppingItemReturn {
  const { handleApolloError } = useErrorService();
  const { createRemoveOperation } = useCrudOperations();

  const [removeItemMutation] = useRemoveItemFromShoppingListMutation({
    errorPolicy: 'all',
    optimisticResponse: variables => {
      return buildOptimisticDeleteResponse(
        'removeItemFromShoppingList',
        'ShoppingListItemPayload',
        'shoppingListItem',
        'ShoppingListItem',
        variables.id,
      );
    },
    update(cache, { data }, { variables }) {
      if (!data?.removeItemFromShoppingList || !listId || !variables) return;

      try {
        const itemId = variables.id;

        // Read isPurchased before eviction so we can update completedItems
        const itemData = cache.readFragment<{ isPurchased: boolean }>({
          id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
          fragment: gql`
            fragment RemovedItemStatus on ShoppingListItem {
              isPurchased
            }
          `,
        });

        removeFromShoppingListItemsCache(cache, listId, itemId, { evictItem: true });

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
              ...(itemData?.isPurchased && {
                completedItems(existing: number = 0) {
                  return Math.max(0, existing - 1);
                },
              }),
            },
          });
        }
      } catch (error) {
        console.warn('Cache update failed for removeItem, will refetch:', error);
        refetch();
      }
    },
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Remove Shopping List Item',
      });
      Alert.alert('Error', message);
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
