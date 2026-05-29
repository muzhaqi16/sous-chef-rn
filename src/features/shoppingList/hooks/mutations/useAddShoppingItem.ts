/**
 * useAddShoppingItem - Add item mutation for shopping list
 *
 * Single responsibility:
 * - Add mutation with optimistic response
 * - Cache update for instant UI
 * - Error handling with user feedback
 */

import { useRef } from 'react';
import { gql } from '@apollo/client';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  AddItemToShoppingListDocument,
  type AddItemToShoppingListMutation,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { createOptimisticShoppingListItem } from './utils';
import { handleMutationError } from '#/utils/errorHandlers';
import type { ShoppingListItemInput } from './types';

// Minimal cache-read fragment — only the fields the optimistic-update path needs.
const ShoppingListStatsFragment = gql`
  fragment _AddShoppingItemStats on ShoppingList {
    totalItems
    completedItems
    remainingItems
    completionRate
  }
`;

interface UseAddShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
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
  const { createAddOperation } = useCrudOperations();
  const client = useApolloClient();
  // Track the most recently generated temp ID for cleanup in update()
  // A ref is necessary here because optimisticResponse and update are separate
  // callbacks configured at hook level that need to share per-mutation state
  const lastTempIdRef = useRef<string | null>(null);

  const [addItemMutation] = useMutation(AddItemToShoppingListDocument, {
    optimisticResponse: variables => {
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
            fragmentName: '_AddShoppingItemStats',
          })
        : null;

      const prevTotal = listStats?.totalItems ?? 0;
      const prevCompleted = listStats?.completedItems ?? 0;
      const newTotal = prevTotal + 1;
      // New items are always unpurchased, so completedItems stays the same
      const newRemaining = newTotal - prevCompleted;
      const newCompletionRate = newTotal > 0 ? prevCompleted / newTotal : 0;

      const optimistic: AddItemToShoppingListMutation = {
        __typename: 'Mutation',
        addItemToShoppingList: {
          __typename: 'AddItemToShoppingListPayload',
          shoppingListItem: {
            ...entity,
            shoppingList: {
              __typename: 'ShoppingList',
              id: listId ?? '',
              totalItems: newTotal,
              completedItems: prevCompleted,
              remainingItems: newRemaining,
              completionRate: newCompletionRate,
            },
          },
        },
      };
      return optimistic;
    },
    update(cache, { data }) {
      const payload = data?.addItemToShoppingList;
      if (payload?.__typename !== 'AddItemToShoppingListPayload' || !listId) {
        return;
      }

      const item = payload.shoppingListItem;

      // Evict temp-ID entity when the real server response arrives
      // update() runs twice: once for the optimistic response (item.id starts with "temp-"),
      // once for the server response (real ID). On the server response, evict the stale temp entity.
      if (lastTempIdRef.current && !item.id.startsWith('temp-')) {
        safeEvict(cache, 'ShoppingListItem', lastTempIdRef.current);
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
      handleMutationError(error, { operation: 'Add Shopping List Item' });
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
