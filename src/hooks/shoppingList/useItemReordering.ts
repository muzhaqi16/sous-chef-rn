import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import { useMoveShoppingListItemMutation } from '#generated';
import { generatePosition } from '#/utils/fractionalIndexing';
import { SubscriptionService } from '#/services/subscriptions/SubscriptionService';
import {
  handleVersionConflict,
  getVersionConflictMessage } from '#/utils/errors/versionConflict';
import { executeMutationWithErrorHandler } from '#/utils/compilerSafeWrappers';

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
  const handleSortOrderUpdate = async (
      itemId: string,
      afterItemId: string | null,
      beforeItemId: string | null,
      _afterSortOrder: string | null,
      _beforeSortOrder: string | null,
    ) => {
      if (!listId) return;

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
      // If after > before, the visual order doesn't match sortOrder order (cache out of sync)
      let newSortOrder: string | undefined;

      if (afterItem?.sortOrder && beforeItem?.sortOrder) {
        if (afterItem.sortOrder > beforeItem.sortOrder) {
          // Cache is out of sync - visual order doesn't match sortOrder order
          console.warn('Invalid sortOrder state (after > before), refetching...', {
            afterId: afterItemId,
            afterSortOrder: afterItem.sortOrder,
            beforeId: beforeItemId,
            beforeSortOrder: beforeItem.sortOrder });
          refetch?.();
          return;
        }

        if (afterItem.sortOrder === beforeItem.sortOrder) {
          // Collision: two items have the same sortOrder (can't insert between identical values)
          // Fallback: insert after the duplicate block by finding next different sortOrder
          console.warn('Duplicate sortOrder in cache, using fallback positioning', {
            afterId: afterItemId,
            beforeId: beforeItemId,
            sharedSortOrder: afterItem.sortOrder });

          // Find the next item with a different (higher) sortOrder
          const nextItem = items
            .filter(i => i.sortOrder && i.sortOrder > afterItem.sortOrder!)
            .sort((a, b) => (a.sortOrder || '').localeCompare(b.sortOrder || ''))[0];

          newSortOrder = generatePosition(afterItem.sortOrder, nextItem?.sortOrder ?? null);
        }
      }

      // Generate sortOrder normally if not already set by fallback logic
      if (!newSortOrder) {
        newSortOrder = generatePosition(
          afterItem?.sortOrder ?? null,
          beforeItem?.sortOrder ?? null,
        );
      }

      // PERFORMANCE: Batch both cache modifications into a single update
      // This ensures FlashList sees a consistent state and reduces re-render cycles
      // Per apollo-client-patterns.md Pattern 5: Use cache.modify for simple field updates
      client.cache.batch({
        update: cache => {
          // 1. Update the item's sortOrder and timestamp
          cache.modify({
            id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
            fields: {
              sortOrder() { return newSortOrder; },
              updatedAt() { return new Date().toISOString(); } } });

          // Helper to sort edges by sortOrder with secondary sort by id
          // justified: Apollo readField returns opaque cache references — no public type for edge/node access
          const sortEdges = (edges: readonly any[], readField: any) => {
            return [...edges].sort((a, b) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const nodeA = readField('node', a) as any;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const nodeB = readField('node', b) as any;
              const sortA = (nodeA ? readField('sortOrder', nodeA) : '') as string || '';
              const sortB = (nodeB ? readField('sortOrder', nodeB) : '') as string || '';
              if (sortA < sortB) return -1;
              if (sortA > sortB) return 1;
              // Secondary sort by id for deterministic ordering when sortOrder matches
              const idA = (nodeA ? readField('id', nodeA) : '') as string || '';
              const idB = (nodeB ? readField('id', nodeB) : '') as string || '';
              return idA.localeCompare(idB);
            });
          };

          // 2. Re-sort edges in itemsConnection so FlashList sees new order
          // Uses cache.modify instead of writeQuery to target the correct cache key
          // (writeQuery with aliases doesn't match the field policy's keyArgs: ['filters'])
          cache.modify({
            id: cache.identify({ __typename: 'ShoppingList', id: listId }),
            fields: {
              // Target the actual field name with its keyArgs to match the cache key
              itemsConnection(existing, { storeFieldName, readField }) {
                // Only modify the unpurchased connection (check filter in storeFieldName)
                if (!storeFieldName.includes('"isPurchased":false')) {
                  return existing;
                }

                return {
                  ...existing,
                  edges: sortEdges(existing?.edges || [], readField) };
              },
              // Also target aliased fields - Apollo may cache under the alias name
              // when using GetShoppingListItemsPaginated query
              unpurchasedItems(existing, { readField }) {
                if (!existing?.edges) return existing;
                return {
                  ...existing,
                  edges: sortEdges(existing.edges, readField) };
              } } });
        } });

      // Execute mutation (NO optimisticResponse - cache already updated above)
      const moveAfterItemId = afterItemId ?? undefined;
      const moveBeforeItemId = beforeItemId ?? undefined;
      const result = await executeMutationWithErrorHandler(
        () => moveItem({
          variables: {
            input: {
              itemId,
              afterItemId: moveAfterItemId,
              beforeItemId: moveBeforeItemId } } }),
        (error: any) => {
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
        },
      );
      if (!result) return;

      // Check for GraphQL errors (with errorPolicy: 'all', errors don't throw)
      if (result.error) {
        console.error('MoveShoppingListItem mutation error:', result.error);
        Alert.alert('Error', result.error.message || 'Failed to reorder item');
        refetch?.(); // Refetch to restore correct order
        return;
      }

      // Check if a real move happened by comparing versions
      const serverItem = result.data?.moveShoppingListItem?.shoppingListItem;
      const serverVersion = serverItem?.version;
      const serverSortOrder = serverItem?.sortOrder;
      const originalVersion = currentItem.version;

      if (serverVersion === originalVersion) {
        // No-op move - item was already in correct position
        console.log('⊘ Move was no-op (item already in position):', {
          itemId,
          version: serverVersion });
        return;
      }

      // Real move happened
      console.log('✓ Sort order updated on server:', {
        itemId,
        serverSortOrder,
        oldVersion: originalVersion,
        newVersion: serverVersion });

      // Ensure server's sortOrder is in cache (may differ from optimistic value)
      // This prevents cache desync when server calculates a different sortOrder
      if (serverSortOrder && serverSortOrder !== newSortOrder) {
        console.log('Server returned different sortOrder, updating cache:', {
          optimistic: newSortOrder,
          server: serverSortOrder });
        client.cache.modify({
          id: client.cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
          fields: {
            sortOrder() { return serverSortOrder; } } });
      }

      // Mark this item as recently reordered to ignore subscription echo
      SubscriptionService.getInstance().markItemReordered(itemId);
    };

  return { handleSortOrderUpdate };
}
