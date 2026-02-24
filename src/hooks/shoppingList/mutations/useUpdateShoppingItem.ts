/**
 * useUpdateShoppingItem - Update item mutation for shopping list
 *
 * Single responsibility:
 * - Update mutation with optimistic response
 * - Version conflict handling
 * - Apollo auto-normalizes response by __typename + id
 */

import { Alert } from 'react-native';
import { useUpdateShoppingListItemMutation } from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import { useErrorService } from '#/services/errorService';
import { buildOptimisticMutationResponse } from '#/apollo/utils/optimisticTypes';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import type { ShoppingListItemUpdate } from './types';

interface UseUpdateShoppingItemOptions {
  listId: string | null | undefined;
  items: ShoppingListItemDisplayFragment[];
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
export function useUpdateShoppingItem({ listId, items, refetch }: UseUpdateShoppingItemOptions) {
  const { handleApolloError } = useErrorService();

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

  // Uses items array from props instead of reading from cache
  // Apollo auto-normalizes the server response by __typename + id, so we only need a basic optimistic response
  const updateItem = async (itemId: string, updates: ShoppingListItemUpdate) => {
    if (!listId) return false;

    try {
      // Use items array (already in memory) instead of cache read
      const item = items.find(i => i.id === itemId);

      if (!item) {
        console.warn('Item not found, cannot update:', itemId);
        return false;
      }

      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: { ...updates, version: item.version },
        },
        // Simple optimistic response - Apollo merges by __typename + id
        // Only include fields from ShoppingListItemDisplayFragment
        optimisticResponse: buildOptimisticMutationResponse(
          'updateShoppingListItem',
          'ShoppingListItemPayload',
          'shoppingListItem',
          {
            __typename: 'ShoppingListItem' as const,
            id: item.id,
            itemName: updates.itemName ?? item.itemName,
            quantity: updates.quantity ?? item.quantity,
            quantityInput: item.quantityInput,
            purchaseInfo: item.purchaseInfo,
            version: item.version,
            updatedAt: new Date().toISOString(),
            category: updates.category ?? item.category,
            unitName: updates.unitName ?? item.unitName,
            unit: item.unit,
            sortOrder: item.sortOrder,
            item: item.item,
          },
        ),
      });

      return result.data?.updateShoppingListItem?.success ?? false;
    } catch (error: any) {
      if (handleVersionConflict(error)) {
        Alert.alert('Item Updated', getVersionConflictMessage(error), [
          { text: 'Refresh', onPress: () => refetch() },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return false;
      }
      console.error('Update shopping list item error:', error);
      return false;
    }
  };

  return { updateItem };
}
