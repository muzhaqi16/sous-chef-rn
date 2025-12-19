import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useMoveShoppingListItemMutation } from '#generated';
import { generatePosition } from '#/utils/fractionalIndexing';
import {
  GetShoppingListDocument,
  GetShoppingListQuery,
} from '#generated';
import { SubscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';

interface ShoppingListItem {
  id: string;
  sortOrder?: string | null;
  version: number;
  [key: string]: any;
}

interface UseItemReorderingOptions<T extends ShoppingListItem> {
  /**
   * Current shopping list ID
   */
  listId?: string;

  /**
   * Array of shopping list items
   */
  items: T[];

  /**
   * Optional refetch function for version conflict recovery
   */
  refetch?: () => void;
}

/**
 * Hook to manage shopping list item reordering
 *
 * Provides optimistic reordering with fractional indexing for instant
 * UI feedback while coordinating with the server. Handles:
 * - Fractional index generation for new positions
 * - Optimistic UI updates
 * - Apollo cache management
 * - Error handling with user feedback
 *
 * @param options - Configuration options
 * @returns Object with sort order update handler
 *
 * @example
 * ```typescript
 * const { handleSortOrderUpdate } = useItemReordering({
 *   listId: currentListId,
 *   items: shoppingListItems,
 * });
 *
 * <SortableList
 *   onReorder={(itemId, afterId, beforeId) =>
 *     handleSortOrderUpdate(itemId, afterId, beforeId)
 *   }
 * />
 * ```
 */
export function useItemReordering<T extends ShoppingListItem>(
  options: UseItemReorderingOptions<T>,
) {
  const { listId, items, refetch } = options;

  const [moveItem] = useMoveShoppingListItemMutation({
    errorPolicy: 'all',
    // NO optimisticResponse - cache.modify handles instant UI feedback
    // This avoids "Missing field" warnings from partial fragment spreads
    // Per apollo-client-patterns.md Pattern 5: Use cache.modify for simple field updates

    // Update cache to reflect new order immediately using cache.modify
    // This provides instant UI feedback without the missing field warnings
    update(cache, _result, { variables }) {
      if (!variables?.input?.itemId || !listId) return;

      try {
        const itemId = variables.input.itemId;
        const afterItemId = variables.input.afterItemId;
        const beforeItemId = variables.input.beforeItemId;

        // Find neighbor sortOrders from current items
        const afterItem = afterItemId
          ? items.find(i => i.id === afterItemId)
          : null;
        const beforeItem = beforeItemId
          ? items.find(i => i.id === beforeItemId)
          : null;

        // Get sortOrder values with duplicate handling
        let effectiveAfterSortOrder = afterItem?.sortOrder ?? null;
        let effectiveBeforeSortOrder = beforeItem?.sortOrder ?? null;

        // Handle duplicate sortOrder values gracefully
        // Instead of blocking, recover by using only afterSortOrder
        if (
          effectiveAfterSortOrder !== null &&
          effectiveBeforeSortOrder !== null &&
          effectiveAfterSortOrder === effectiveBeforeSortOrder
        ) {
          console.warn('⚠️ Duplicate sortOrder in cache.modify, recovering:', {
            afterItemId,
            afterSortOrder: effectiveAfterSortOrder,
            beforeItemId,
            beforeSortOrder: effectiveBeforeSortOrder,
          });
          // Use only afterSortOrder - generate position after the "after" item
          // Server will correct the order when it responds
          effectiveBeforeSortOrder = null;
        }

        // Generate new sortOrder using fractional indexing
        const newSortOrder = generatePosition(
          effectiveAfterSortOrder,
          effectiveBeforeSortOrder,
        );

        // Directly modify the cached item's sortOrder field
        // This provides instant UI feedback without fragment validation
        cache.modify({
          id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
          fields: {
            sortOrder() {
              return newSortOrder;
            },
            updatedAt() {
              return new Date().toISOString();
            },
          },
        });

        // Re-sort the itemsConnection edges to reflect new order
        const queryResult = cache.readQuery<GetShoppingListQuery>({
          query: GetShoppingListDocument,
          variables: { id: listId },
        });

        if (!queryResult?.shoppingList?.itemsConnection?.edges) return;

        // Sort edges by sortOrder (localeCompare matches base62 ordering)
        const sortedEdges = [...queryResult.shoppingList.itemsConnection.edges].sort(
          (a: any, b: any) =>
            (a.node.sortOrder || '').localeCompare(b.node.sortOrder || ''),
        );

        // Write back sorted edges to cache
        cache.writeQuery({
          query: GetShoppingListDocument,
          variables: { id: listId },
          data: {
            shoppingList: {
              ...queryResult.shoppingList,
              itemsConnection: {
                ...queryResult.shoppingList.itemsConnection,
                edges: sortedEdges,
              },
            },
          },
        });
      } catch (error) {
        console.warn('Cache update failed for moveItem:', error);
        // Don't throw - let mutation succeed even if cache update fails
      }
    },
  });

  /**
   * Handle sort order update when an item is moved
   *
   * @param itemId - ID of the item being moved
   * @param afterItemId - ID of the item that comes before the new position
   * @param beforeItemId - ID of the item that comes after the new position
   * @param afterSortOrder - sortOrder value of the item before the new position
   * @param beforeSortOrder - sortOrder value of the item after the new position
   */
  const handleSortOrderUpdate = useCallback(
    async (
      itemId: string,
      afterItemId: string | null,
      beforeItemId: string | null,
      _afterSortOrder: string | null,
      _beforeSortOrder: string | null,
    ) => {
      if (!listId) return;

      try {
        // Find the current item from cache to preserve all fields
        const currentItem = items.find(item => item.id === itemId);
        if (!currentItem) {
          console.error('Item not found in cache:', itemId);
          return;
        }

        // Execute mutation with optimistic response and cache update
        const result = await moveItem({
          variables: {
            input: {
              itemId,
              afterItemId: afterItemId ?? undefined,
              beforeItemId: beforeItemId ?? undefined,
            },
          },
        });

        // Check for GraphQL errors (with errorPolicy: 'all', errors don't throw)
        if (result.error) {
          console.error('MoveShoppingListItem mutation error:', result.error);
          Alert.alert('Error', result.error.message || 'Failed to reorder item');
          refetch?.(); // Refetch to restore correct order
          return;
        }

        // Check if a real move happened by comparing versions
        const serverItem = result.data?.moveShoppingListItem;
        const serverVersion = serverItem?.version;
        const serverSortOrder = serverItem?.sortOrder;
        const originalVersion = currentItem.version;

        if (serverVersion === originalVersion) {
          // No-op move - item was already in correct position
          console.log('⊘ Move was no-op (item already in position):', {
            itemId,
            version: serverVersion,
          });
          return;
        }

        // Real move happened
        console.log('✓ Sort order updated on server:', {
          itemId,
          serverSortOrder,
          oldVersion: originalVersion,
          newVersion: serverVersion,
        });

        // Mark this item as recently reordered to ignore subscription echo
        SubscriptionService.getInstance().markItemReordered(itemId);
      } catch (error: any) {
        console.error('Failed to move item:', error);

        // PERFORMANCE: Handle version conflict errors with user-friendly message
        if (handleVersionConflict(error)) {
          Alert.alert('Item Updated', getVersionConflictMessage(error), [
            { text: 'Refresh', onPress: () => refetch?.() },
            { text: 'Cancel', style: 'cancel' },
          ]);
          return;
        }

        // Generic error fallback
        Alert.alert('Error', 'Failed to reorder items. Please try again.');
      }
    },
    [listId, moveItem, items, refetch],
  );

  return { handleSortOrderUpdate };
}
