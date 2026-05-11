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
import {
  RemoveItemFromShoppingListDocument,
  type RemoveItemFromShoppingListMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  ShoppingListItemCoreFragmentDoc,
  type ShoppingListItemCoreFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
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
    optimisticResponse: (variables): RemoveItemFromShoppingListMutation => ({
      __typename: 'Mutation',
      removeItemFromShoppingList: {
        __typename: 'ShoppingListItemPayload',
        success: true,
        message: '',
        code: 'SUCCESS',
        shoppingListItem: {
          __typename: 'ShoppingListItem',
          id: variables.id,
        } as RemoveItemFromShoppingListMutation['removeItemFromShoppingList']['shoppingListItem'],
      },
    }),
    update(cache, { data }, { variables }) {
      if (!data?.removeItemFromShoppingList || !listId || !variables) return;

      executeCacheUpdate(
        () => {
          const itemId = variables.id;

          // Read isPurchased before eviction so we can update completedItems.
          // Uses the generated ShoppingListItemCore fragment so the field path
          // (`purchaseInfo.isPurchased`) is type-checked against the schema —
          // the previous inline gql read `isPurchased` directly on
          // ShoppingListItem, which doesn't exist there, and silently fell
          // back to `wasPurchased = false` for every removal.
          const itemData = cache.readFragment<ShoppingListItemCoreFragment>({
            id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
            fragment: ShoppingListItemCoreFragmentDoc,
            fragmentName: 'ShoppingListItemCore',
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
