/**
 * useRemoveShoppingItem - Remove item mutation for shopping list
 *
 * Single responsibility:
 * - Remove mutation with optimistic response
 * - Cache eviction for removed item
 * - Error handling with user feedback
 */

import { Alert } from 'react-native';
import { useRemoveItemFromShoppingListMutation } from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import { useErrorHandler } from '#/utils/errorHandling';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { buildOptimisticRemoveItemResponse } from '#/apollo/utils/optimisticTypes';
import { removeFromShoppingListItemsCache } from './utils';

interface UseRemoveShoppingItemOptions {
  listId: string | null | undefined;
  items: ShoppingListItemDisplayFragment[];
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
export function useRemoveShoppingItem({ listId, items, refetch }: UseRemoveShoppingItemOptions) {
  const { handleApolloError } = useErrorHandler();
  const { createRemoveOperation } = useCrudOperations();

  const [removeItemMutation] = useRemoveItemFromShoppingListMutation({
    errorPolicy: 'all',
    optimisticResponse: variables => {
      const item = items.find(i => i.id === variables.id);
      return buildOptimisticRemoveItemResponse(
        'removeItemFromShoppingList',
        item ?? { __typename: 'ShoppingListItem' as const, id: variables.id },
      );
    },
    update(cache, { data }, { variables }) {
      if (!data?.removeItemFromShoppingList || !listId || !variables) return;

      try {
        const itemId = variables.id;
        removeFromShoppingListItemsCache(cache, listId, itemId, { evictItem: true });
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
