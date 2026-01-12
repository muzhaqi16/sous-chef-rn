import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import { useMoveShoppingListItemMutation } from '#generated';
import { generatePosition } from '#/utils/fractionalIndexing';
import {
  GetShoppingListItemsPaginatedDocument,
  GetShoppingListItemsPaginatedQuery,
} from '#generated';
import { SubscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  handleVersionConflict,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import { PAGINATION } from '#/constants/shoppingList';

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
  const client = useApolloClient();

  const [moveItem] = useMoveShoppingListItemMutation({
    errorPolicy: 'all',
    // NO optimisticResponse and NO update callback
    // Per apollo-client-patterns.md Pattern 5: Use cache.modify for simple field updates
    // We do cache.modify BEFORE the mutation call for immediate UI feedback
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

        // Calculate new sortOrder BEFORE cache update
        const afterItem = afterItemId
          ? items.find(i => i.id === afterItemId)
          : null;
        const beforeItem = beforeItemId
          ? items.find(i => i.id === beforeItemId)
          : null;

        // Defensive validation: verify sortOrder ordering
        // If after >= before, the visual order doesn't match sortOrder order (cache out of sync)
        if (afterItem?.sortOrder && beforeItem?.sortOrder) {
          if (afterItem.sortOrder >= beforeItem.sortOrder) {
            console.warn('Invalid sortOrder state detected (after >= before), refetching...', {
              afterId: afterItemId,
              afterSortOrder: afterItem.sortOrder,
              beforeId: beforeItemId,
              beforeSortOrder: beforeItem.sortOrder,
            });
            refetch?.();
            return;
          }
        }

        const newSortOrder = generatePosition(
          afterItem?.sortOrder ?? null,
          beforeItem?.sortOrder ?? null,
        );

        // IMMEDIATE: Modify cache BEFORE mutation call
        // Per apollo-client-patterns.md Pattern 5: Use cache.modify for simple field updates
        // This provides instant UI feedback without fragment validation issues
        client.cache.modify({
          id: client.cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
          fields: {
            sortOrder() { return newSortOrder; },
            updatedAt() { return new Date().toISOString(); },
          },
        });

        // IMMEDIATE: Re-sort edges in unpurchasedItems so FlashList sees new order
        // Uses GetShoppingListItemsPaginatedDocument (the query used by usePaginatedShoppingItems)
        const queryResult = client.cache.readQuery<GetShoppingListItemsPaginatedQuery>({
          query: GetShoppingListItemsPaginatedDocument,
          variables: { id: listId, first: PAGINATION.ITEMS_PAGE_SIZE },
        });

        if (queryResult?.shoppingList?.unpurchasedItems?.edges) {
          // Use lexicographic comparison for fractional-indexing keys
          // The fractional-indexing library uses alphabet '0-9A-Za-z' which is designed
          // for standard string comparison (<, >), NOT localeCompare() which is locale-sensitive
          const sortedEdges = [...queryResult.shoppingList.unpurchasedItems.edges]
            .sort((a, b) => {
              const sortA = a.node.sortOrder || '';
              const sortB = b.node.sortOrder || '';
              if (sortA < sortB) return -1;
              if (sortA > sortB) return 1;
              return 0;
            });

          client.cache.writeQuery({
            query: GetShoppingListItemsPaginatedDocument,
            variables: { id: listId, first: PAGINATION.ITEMS_PAGE_SIZE },
            data: {
              shoppingList: {
                ...queryResult.shoppingList,
                unpurchasedItems: {
                  ...queryResult.shoppingList.unpurchasedItems,
                  edges: sortedEdges,
                },
              },
            },
          });
        }

        // Execute mutation (NO optimisticResponse - cache already updated above)
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
    [listId, moveItem, items, refetch, client],
  );

  return { handleSortOrderUpdate };
}
