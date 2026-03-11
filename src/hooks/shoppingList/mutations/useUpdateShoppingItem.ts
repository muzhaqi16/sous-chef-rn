/**
 * useUpdateShoppingItem - Update item mutation for shopping list
 *
 * Single responsibility:
 * - Update mutation with optimistic response
 * - Version conflict handling
 * - Apollo auto-normalizes response by __typename + id
 */

import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  useUpdateShoppingListItemMutation,
  ShoppingListItemDisplayFragmentDoc,
} from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import { useErrorService } from '#/services/errorService';
import { buildOptimisticMutationResponse } from '#/apollo/utils/optimisticTypes';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import type { ShoppingListItemUpdate } from './types';
import { executeMutation } from '#/utils/compilerSafeWrappers';

interface UseUpdateShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<any>;
}

/**
 * Hook for updating shopping list items
 *
 * @example
 * ```tsx
 * const { updateItem } = useUpdateShoppingItem({ listId, items, refetch });
 * await updateItem('item-123', { quantity: 3 });
 * ```
 */
export function useUpdateShoppingItem({
  listId,
  refetch,
}: UseUpdateShoppingItemOptions) {
  const { handleApolloError } = useErrorService();
  const client = useApolloClient();

  // Apollo auto-normalizes the server response by __typename + id
  // No manual cache update needed - Apollo merge functions handle this automatically
  const [updateItemMutation] = useUpdateShoppingListItemMutation({
    errorPolicy: 'all',
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Shopping List Item',
      });
      Alert.alert('Error', message);
    },
  });

  // Apollo auto-normalizes the server response by __typename + id, so we only need a basic optimistic response
  const updateItem = async (
    itemId: string,
    updates: ShoppingListItemUpdate,
  ) => {
    if (!listId) return false;

    const item = client.cache.readFragment<ShoppingListItemDisplayFragment>({
      id: client.cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
      fragment: ShoppingListItemDisplayFragmentDoc,
      fragmentName: 'ShoppingListItemDisplayFragment',
    });

    if (!item) {
      console.warn('Item not found, cannot update:', itemId);
      return false;
    }

    // Pre-compute optimistic values outside try/catch (React Compiler cannot handle ?? inside try)
    const optimisticItemName = updates.itemName ?? item.itemName;
    const optimisticQuantity = updates.quantity ?? item.quantity;
    const optimisticCategory = updates.category ?? item.category;
    const optimisticUnitName = updates.unitName ?? item.unitName;
    const optimisticResponse = buildOptimisticMutationResponse(
      'updateShoppingListItem',
      'ShoppingListItemPayload',
      'shoppingListItem',
      {
        __typename: 'ShoppingListItem' as const,
        id: item.id,
        itemName: optimisticItemName,
        quantity: optimisticQuantity,
        quantityInput: item.quantityInput,
        purchaseInfo: item.purchaseInfo,
        version: item.version,
        updatedAt: new Date().toISOString(),
        category: optimisticCategory,
        unitName: optimisticUnitName,
        unit: item.unit,
        sortOrder: item.sortOrder,
        item: item.item,
      },
    );

    const result = await executeMutation(
      () =>
        updateItemMutation({
          variables: {
            id: itemId,
            input: { ...updates, version: item.version },
          },
          // Simple optimistic response - Apollo merges by __typename + id
          // Only include fields from ShoppingListItemDisplayFragment
          optimisticResponse,
        }),
      error => {
        if (handleVersionConflict(error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetch() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }
        console.error('Update shopping list item error:', error);
      },
    );
    if (!result) return false;

    return result.data?.updateShoppingListItem?.success ?? false;
  };

  return { updateItem };
}
