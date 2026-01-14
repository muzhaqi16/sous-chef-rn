/**
 * Shopping List Cache Updaters
 *
 * Reusable cache update utilities for shopping list items.
 * Used by both mutations and subscriptions to ensure consistent cache updates
 * when items move between purchased/unpurchased states.
 *
 * These utilities handle the dual cache structure:
 * - `itemsConnection` field (used by GetShoppingListQuery)
 * - `unpurchasedItems`/`purchasedItems` aliased fields (used by GetShoppingListItemsPaginatedQuery)
 *
 * Apollo caches aliased fields under the alias name, NOT the underlying field name.
 * So we need separate utilities for each aliased field.
 */

import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from './cacheUpdaters';

// =============================================================================
// itemsConnection field (used by GetShoppingListQuery)
// =============================================================================

/**
 * Add item to ShoppingList.itemsConnection
 */
export const addToShoppingListItemsConnection = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

/**
 * Remove item from ShoppingList.itemsConnection
 */
export const removeFromShoppingListItemsConnection = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

// =============================================================================
// Aliased fields (used by GetShoppingListItemsPaginatedQuery)
// =============================================================================

/**
 * Add item to ShoppingList.unpurchasedItems (alias for itemsConnection with isPurchased: false)
 */
export const addToUnpurchasedItems = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'unpurchasedItems',
  'ShoppingListItem',
);

/**
 * Remove item from ShoppingList.unpurchasedItems
 */
export const removeFromUnpurchasedItems = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'unpurchasedItems',
  'ShoppingListItem',
);

/**
 * Add item to ShoppingList.purchasedItems (alias for itemsConnection with isPurchased: true)
 */
export const addToPurchasedItems = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'purchasedItems',
  'ShoppingListItem',
);

/**
 * Remove item from ShoppingList.purchasedItems
 */
export const removeFromPurchasedItems = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'purchasedItems',
  'ShoppingListItem',
);

// =============================================================================
// High-level Move Utilities
// =============================================================================
// These utilities handle moving items between purchased/unpurchased states.
// They update BOTH:
// - itemsConnection with filter args (for GetShoppingListQuery)
// - aliased fields (for GetShoppingListItemsPaginatedQuery)
//
// Apollo caches these separately, so we must update both.
// =============================================================================

import type { ApolloCache } from '@apollo/client';

// =============================================================================
// Batch Clear Utilities
// =============================================================================

/**
 * Clear ALL purchased items from cache in a single atomic operation.
 * Updates both itemsConnection and purchasedItems alias.
 * Used by "Clear All Purchased" button for instant UI feedback.
 *
 * @param cache - Apollo cache instance
 * @param listId - Shopping list ID
 * @param itemIds - Array of item IDs being cleared
 */
export function clearAllPurchasedItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
): void {
  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });

  if (!parentCacheId) return;

  // 1. Clear purchasedItems alias (used by GetShoppingListItemsPaginatedQuery)
  cache.modify({
    id: parentCacheId,
    fields: {
      purchasedItems(existing: any) {
        if (!existing) return existing;
        return {
          ...existing,
          edges: [],
          totalCount: 0,
        };
      },
    },
  });

  // 2. Clear itemsConnection with isPurchased:true filter variant
  cache.modify({
    id: parentCacheId,
    fields: {
      itemsConnection(existing: any, { storeFieldName }: any) {
        const isPurchasedConnection = storeFieldName.includes('isPurchased":true');
        if (!isPurchasedConnection || !existing) return existing;
        return {
          ...existing,
          edges: [],
          totalCount: 0,
        };
      },
    },
  });

  // 3. Evict all deleted items from cache
  itemIds.forEach(itemId => {
    cache.evict({
      id: cache.identify({ __typename: 'ShoppingListItem', id: itemId }),
    });
  });

  // 4. Garbage collect orphaned references
  cache.gc();
}

// =============================================================================
// Purchase Status Move Utilities
// =============================================================================

/**
 * Helper to update itemsConnection filtered variants when purchase status changes
 */
function updateItemsConnectionForPurchaseStatusChange(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  movingToPurchased: boolean,
): void {
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });

    if (!parentCacheId) return;

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(existing: any, { readField, storeFieldName, toReference }: any) {
          // Detect which filtered variant this is by checking storeFieldName
          const isUnpurchasedConnection = storeFieldName.includes('isPurchased":false');
          const isPurchasedConnection = storeFieldName.includes('isPurchased":true');

          if (!existing?.edges) return existing;

          if (movingToPurchased) {
            // Moving to purchased: remove from unpurchased, add to purchased
            if (isUnpurchasedConnection) {
              return {
                ...existing,
                edges: existing.edges.filter(
                  (edge: any) => readField('id', edge.node) !== itemId,
                ),
                totalCount: Math.max(0, (existing.totalCount || 0) - 1),
              };
            }
            if (isPurchasedConnection) {
              const alreadyExists = existing.edges.some(
                (edge: any) => readField('id', edge.node) === itemId,
              );
              if (alreadyExists) return existing;
              return {
                ...existing,
                edges: [
                  {
                    __typename: 'ShoppingListItemEdge',
                    cursor: itemId,
                    node: toReference({ __typename: 'ShoppingListItem', id: itemId }),
                  },
                  ...existing.edges,
                ],
                totalCount: (existing.totalCount || 0) + 1,
              };
            }
          } else {
            // Moving to unpurchased: remove from purchased, add to unpurchased
            if (isPurchasedConnection) {
              return {
                ...existing,
                edges: existing.edges.filter(
                  (edge: any) => readField('id', edge.node) !== itemId,
                ),
                totalCount: Math.max(0, (existing.totalCount || 0) - 1),
              };
            }
            if (isUnpurchasedConnection) {
              const alreadyExists = existing.edges.some(
                (edge: any) => readField('id', edge.node) === itemId,
              );
              if (alreadyExists) return existing;
              return {
                ...existing,
                edges: [
                  {
                    __typename: 'ShoppingListItemEdge',
                    cursor: itemId,
                    node: toReference({ __typename: 'ShoppingListItem', id: itemId }),
                  },
                  ...existing.edges,
                ],
                totalCount: (existing.totalCount || 0) + 1,
              };
            }
          }

          return existing;
        },
      },
    });
  } catch (error) {
    console.warn('Failed to update itemsConnection for purchase status change:', error);
  }
}

/**
 * Move a shopping list item to purchased state
 *
 * Updates both:
 * - itemsConnection filtered variants (for GetShoppingListQuery)
 * - aliased fields: unpurchasedItems → purchasedItems (for GetShoppingListItemsPaginatedQuery)
 *
 * @param cache - Apollo cache instance
 * @param listId - Shopping list ID
 * @param item - Item to move (must have id)
 */
export function moveShoppingListItemToPurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  // 1. Update itemsConnection filtered variants
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, true);

  // 2. Update aliased fields
  removeFromUnpurchasedItems(cache, listId, item.id);
  addToPurchasedItems(cache, listId, item);
}

/**
 * Move a shopping list item to unpurchased state
 *
 * Updates both:
 * - itemsConnection filtered variants (for GetShoppingListQuery)
 * - aliased fields: purchasedItems → unpurchasedItems (for GetShoppingListItemsPaginatedQuery)
 *
 * @param cache - Apollo cache instance
 * @param listId - Shopping list ID
 * @param item - Item to move (must have id)
 */
export function moveShoppingListItemToUnpurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  // 1. Update itemsConnection filtered variants
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, false);

  // 2. Update aliased fields
  removeFromPurchasedItems(cache, listId, item.id);
  addToUnpurchasedItems(cache, listId, item);
}
