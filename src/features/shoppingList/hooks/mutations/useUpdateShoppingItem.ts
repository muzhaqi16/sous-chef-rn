/**
 * useUpdateShoppingItem - Update item mutation for shopping list
 *
 * Single responsibility:
 * - Update mutation with optimistic response
 * - Version conflict handling
 * - Apollo auto-normalizes response by __typename + id
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { ShoppingListItemDisplayFragmentDoc } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { useErrorService } from '#/services/errorService';
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
  const [updateItemMutation] = useMutation(UpdateShoppingListItemDocument, {
    onError: error => {
      const { message } = handleApolloError(error, {
        operation: 'Update Shopping List Item',
      });
      alertService.alert('Error', message);
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

    const result = await executeMutation(
      () =>
        updateItemMutation({
          variables: {
            id: itemId,
            input: { ...updates, version: item.version },
          },
          optimisticResponse: {
            __typename: 'Mutation',
            updateShoppingListItem: {
              __typename: 'ShoppingListItemPayload',
              success: true,
              message: '',
              code: 'SUCCESS',
              shoppingListItem: {
                __typename: 'ShoppingListItem',
                id: item.id,
                itemName: updates.itemName ?? item.itemName,
                quantity: updates.quantity ?? item.quantity,
                quantityInput: item.quantityInput,
                displayFormat: item.displayFormat,
                notes: item.notes,
                purchaseInfo: item.purchaseInfo,
                version: item.version,
                updatedAt: new Date().toISOString(),
                category: updates.category ?? item.category,
                unitName: updates.unitName ?? item.unitName,
                unit: item.unit,
                sortOrder: item.sortOrder,
                item: item.item,
              },
            },
          },
        }),
      error => {
        if (handleVersionConflict(error)) {
          alertService.alert('Item Updated', getVersionConflictMessage(error), [
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
