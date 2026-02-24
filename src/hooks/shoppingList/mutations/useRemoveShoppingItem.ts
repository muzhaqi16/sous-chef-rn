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
export function useRemoveShoppingItem({ listId, refetch }: UseRemoveShoppingItemOptions) {
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
