/**
 * useRemoveShoppingItem - Remove item mutation for shopping list
 *
 * Single responsibility:
 * - Remove mutation with optimistic response
 * - Cache eviction for removed item
 * - Error handling with user feedback
 */

import { useMutation } from '@apollo/client/react';
import type { Unmasked } from '@apollo/client/masking';
import {
  RemoveItemFromShoppingListDocument,
  type RemoveItemFromShoppingListMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { removeFromShoppingListItemsCache } from './utils';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { handleMutationError } from '#/utils/errorHandlers';

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

  const [removeItemMutation] = useMutation(RemoveItemFromShoppingListDocument, {
    optimisticResponse: (
      variables,
    ): Unmasked<RemoveItemFromShoppingListMutation> => ({
      __typename: 'Mutation',
      removeItemFromShoppingList: {
        __typename: 'RemoveItemFromShoppingListPayload',
        shoppingListItem: {
          __typename: 'ShoppingListItem',
          id: variables.input.id,
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
