/**
 * useAddShoppingItem - Add item mutation for shopping list
 *
 * Single responsibility:
 * - Add mutation with optimistic response
 * - Cache update for instant UI
 * - Error handling with user feedback
 */

import { useRef } from 'react';
import { alertService } from '#/services/alertService';
import {
  useAddItemToShoppingListMutation,
  type AddItemToShoppingListMutation,
  type AddItemToShoppingListMutationVariables,
} from '#generated';
import { useErrorService } from '#/services/errorService';
import { buildOptimisticMutationResponse } from '#/apollo/utils/optimisticTypes';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { createOptimisticShoppingListItem } from './utils';
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
export function useAddShoppingItem({
  listId,
  refetch,
}: UseAddShoppingItemOptions) {
  const { handleApolloError } = useErrorService();
  const { createAddOperation } = useCrudOperations();
  // Track the most recently generated temp ID for cleanup in update()
  // A ref is necessary here because optimisticResponse and update are separate
  // callbacks configured at hook level that need to share per-mutation state
  const lastTempIdRef = useRef<string | null>(null);

  const [addItemMutation] = useAddItemToShoppingListMutation({
    errorPolicy: 'all',
    optimisticResponse: (variables: AddItemToShoppingListMutationVariables) => {
      const { tempId, entity } = createOptimisticShoppingListItem({
        itemName: variables.input.itemName ?? '',
        quantity: Number(variables.input.quantity) || 1,
        quantityInput: null,
        unitName: variables.input.unit?.unitName || null,
        category: variables.input.category || null,
        itemId: variables.input.itemId,
        unitId: variables.input.unit?.unitId,
      });
      lastTempIdRef.current = tempId;
      return buildOptimisticMutationResponse(
        'addItemToShoppingList',
        'ShoppingListItemPayload',
        'shoppingListItem',
        entity,
      );
    },
    update(cache, { data }) {
      if (!data?.addItemToShoppingList?.shoppingListItem || !listId) return;

      const item = data.addItemToShoppingList.shoppingListItem;

      // Evict temp-ID entity when the real server response arrives
      // update() runs twice: once for the optimistic response (item.id starts with "temp-"),
      // once for the server response (real ID). On the server response, evict the stale temp entity.
      if (lastTempIdRef.current && !item.id.startsWith('temp-')) {
        cache.evict({
          id: cache.identify({
            __typename: 'ShoppingListItem',
            id: lastTempIdRef.current,
          }),
        });
        cache.gc();
        lastTempIdRef.current = null;
      }

      executeCacheUpdate(
        () => addNewItemToShoppingListCache(cache, listId, item),
        'Cache update failed for addItem, will refetch:',
        refetch,
      );
    },
    onError: error => {
      lastTempIdRef.current = null;
      const { message } = handleApolloError(error, {
        operation: 'Add Shopping List Item',
      });
      alertService.alert('Error', message);
    },
  });

  const addItem = createAddOperation({
    mutation: addItemMutation,
    parentId: () => listId,
    transformInput: (input: ShoppingListItemInput) => ({
      shoppingListId: listId,
      itemName: input.itemName,
      quantity: input.quantity ?? 1,
      ...((input.unitName || input.unitId) && {
        unit: {
          ...(input.unitId && { unitId: input.unitId }),
          ...(input.unitName && { unitName: input.unitName }),
        },
      }),
      ...(input.notes && { notes: input.notes }),
      ...(input.category && { category: input.category }),
    }),
    onSuccess: (data: AddItemToShoppingListMutation) =>
      data?.addItemToShoppingList,
    operationName: 'Add Shopping List Item',
  });

  return { addItem };
}
