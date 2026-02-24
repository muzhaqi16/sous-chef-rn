/**
 * useAddShoppingItem - Add item mutation for shopping list
 *
 * Single responsibility:
 * - Add mutation with optimistic response
 * - Cache update for instant UI
 * - Error handling with user feedback
 */

import { Alert } from 'react-native';
import {
  useAddItemToShoppingListMutation,
  type AddItemToShoppingListMutation,
} from '#generated';
import { useErrorService } from '#/services/errorService';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { addToShoppingListItemsCache } from './utils';
import type { ShoppingListItemInput } from './types';

interface UseAddShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<any>;
}

/**
 * Hook for adding items to a shopping list
 *
 * @example
 * ```tsx
 * const { addItem } = useAddShoppingItem({ listId, refetch });
 * await addItem({ itemName: 'Milk', quantity: 2 });
 * ```
 */
export function useAddShoppingItem({ listId, refetch }: UseAddShoppingItemOptions) {
  const { handleApolloError } = useErrorService();
  const { createAddOperation } = useCrudOperations();
  // Track the most recently generated temp ID for cleanup in update()
  // A ref is necessary here because optimisticResponse and update are separate
  // callbacks configured at hook level that need to share per-mutation state
  let lastTempId: string | null = null;

  const [addItemMutation] = useAddItemToShoppingListMutation({
    errorPolicy: 'all',
    // Type assertion needed: createOptimisticEntity returns VersionedEntity base type
    // but the spread properties match ShoppingListItemDisplayFragment at runtime
    optimisticResponse: (variables: any) => {
      const tempId = `temp-${generateId()}`;
      lastTempId = tempId;
      return {
        __typename: 'Mutation',
        addItemToShoppingList: {
          __typename: 'ShoppingListItemPayload',
          success: true,
          message: '',
          code: 'SUCCESS',
          shoppingListItem: createOptimisticEntity('ShoppingListItem', tempId, {
            itemName: variables.input.itemName,
            quantity: variables.input.quantity ?? 1,
            quantityInput: variables.input.quantityInput || null,
            unitName: variables.input.unitName || null,
            category: variables.input.category || null,
            sortOrder: '',
            priority: null,
            brandId: null,
            netWeight: null,
            netWeightUnitId: null,
            item: variables.input.itemId
              ? {
                  __typename: 'Item' as const,
                  id: variables.input.itemId,
                  imageUrl: null,
                  categories: [],
                  units: [],
                }
              : null,
            unit: variables.input.unitId
              ? {
                  __typename: 'Unit' as const,
                  id: variables.input.unitId,
                  name: '',
                  symbol: '',
                }
              : null,
            brand: null,
            netWeightUnit: null,
            purchaseInfo: {
              __typename: 'ShoppingListItemPurchaseInfo',
              isPurchased: false,
            },
          }),
        },
      } as unknown as AddItemToShoppingListMutation;
    },
    update(cache, { data }) {
      if (!data?.addItemToShoppingList?.shoppingListItem || !listId) return;

      const item = data.addItemToShoppingList.shoppingListItem;

      // Evict temp-ID entity when the real server response arrives
      // update() runs twice: once for the optimistic response (item.id starts with "temp-"),
      // once for the server response (real ID). On the server response, evict the stale temp entity.
      if (lastTempId && !item.id.startsWith('temp-')) {
        cache.evict({
          id: cache.identify({ __typename: 'ShoppingListItem', id: lastTempId }),
        });
        cache.gc();
        lastTempId = null;
      }

      try {
        addToShoppingListItemsCache(cache, listId, item);
      } catch (error) {
        console.warn('Cache update failed for addItem, will refetch:', error);
        refetch();
      }
    },
    onError: error => {
      lastTempId = null;
      const { message } = handleApolloError(error, {
        operation: 'Add Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  const addItem = createAddOperation({
    mutation: addItemMutation,
    parentId: () => listId,
    transformInput: (input: ShoppingListItemInput) => ({
      shoppingListId: listId,
      itemName: input.itemName,
      quantity: input.quantity ?? 1,
      ...(input.unitName && { unitName: input.unitName }),
      ...(input.unitId && { unitId: input.unitId }),
      ...(input.notes && { notes: input.notes }),
      ...(input.category && { category: input.category }),
    }),
    onSuccess: (data: any) => data?.addItemToShoppingList,
    operationName: 'Add Shopping List Item',
  });

  return { addItem };
}
