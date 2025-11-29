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
    // Optimistic response for instant UI feedback
    optimisticResponse: variables => {
      // Find the moved item
      const movedItem = items.find(
        item => item.id === variables.input.itemId,
      );
      if (!movedItem) {
        return { __typename: 'Mutation', moveShoppingListItem: null as any };
      }

      // Calculate optimistic sortOrder using fractional indexing
      const afterItem = variables.input.afterItemId
        ? items.find(item => item.id === variables.input.afterItemId)
        : null;
      const beforeItem = variables.input.beforeItemId
        ? items.find(item => item.id === variables.input.beforeItemId)
        : null;

      // Generate new position between neighbors
      const optimisticSortOrder = generatePosition(
        afterItem?.sortOrder ?? null,
        beforeItem?.sortOrder ?? null,
      );

      // Return updated item with new sortOrder
      return {
        __typename: 'Mutation' as const,
        moveShoppingListItem: {
          ...movedItem,
          sortOrder: optimisticSortOrder,
          updatedAt: new Date().toISOString(),
          __typename: 'ShoppingListItem' as const,
        } as any,
      };
    },
    // Update cache to reflect new order
    // Uses GetShoppingList.itemsConnection as the cache location
    update(cache, { data }) {
      if (!data?.moveShoppingListItem || !listId) return;

      try {
        // Read the current shopping list query with itemsConnection
        const queryResult = cache.readQuery<GetShoppingListQuery>({
          query: GetShoppingListDocument,
          variables: { id: listId },
        });

        if (!queryResult?.shoppingList?.itemsConnection?.edges) return;

        // Create new edges array with updated item sortOrder
        const updatedEdges = queryResult.shoppingList.itemsConnection.edges.map(
          (edge: any) =>
            edge.node.id === data.moveShoppingListItem.id
              ? { ...edge, node: { ...edge.node, sortOrder: data.moveShoppingListItem.sortOrder } }
              : edge,
        );

        // Sort edges by sortOrder
        const sortedEdges = [...updatedEdges].sort((a: any, b: any) =>
          (a.node.sortOrder || '').localeCompare(b.node.sortOrder || ''),
        );

        // Write back to cache
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
      afterSortOrder: string | null,
      beforeSortOrder: string | null,
    ) => {
      if (!listId) return;

      try {
        // DEFENSIVE CHECK: Detect duplicate sortOrder values
        if (
          afterSortOrder !== null &&
          beforeSortOrder !== null &&
          afterSortOrder === beforeSortOrder
        ) {
          console.error('❌ Duplicate sortOrder detected:', {
            afterItemId,
            afterSortOrder,
            beforeItemId,
            beforeSortOrder,
          });
          Alert.alert(
            'Error',
            'Item positions are out of sync. Please refresh the list.',
          );
          return;
        }

        // Find the current item from cache to preserve all fields
        const currentItem = items.find(item => item.id === itemId);
        if (!currentItem) {
          console.error('Item not found in cache:', itemId);
          return;
        }

        // Execute mutation with optimistic response and cache update
        await moveItem({
          variables: {
            input: {
              itemId,
              afterItemId: afterItemId ?? undefined,
              beforeItemId: beforeItemId ?? undefined,
            },
          },
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
