/**
 * Shopping List Cache Updaters
 *
 * Reusable cache update utilities for shopping list items.
 * Used by both mutations and subscriptions to ensure consistent cache updates
 * when items move between purchased/unpurchased states.
 *
 * Apollo stores aliased fields under the actual field name with serialized
 * keyArgs (e.g. `itemsConnection:{"isPurchased":true}`), NOT under the alias
 * name. All cache updates therefore target `itemsConnection` and use
 * `storeFieldName` to distinguish filtered variants.
 */

import type { ApolloCache } from '@apollo/client';
import { createRemoveFromParentConnectionUpdater } from './cacheUpdaters';

/**
 * Remove item from ShoppingList.itemsConnection (all variants).
 * Correct for deletion — runs on every storeFieldName variant.
 */
export const removeFromShoppingListItemsConnection =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );

/**
 * Clear ALL items of a given purchase status from cache in a single atomic operation.
 * Used by "Clear All" buttons for instant UI feedback.
 *
 * @param cache - Apollo cache instance
 * @param listId - Shopping list ID
 * @param itemIds - Array of item IDs being cleared
 * @param isPurchased - Whether clearing purchased (true) or unpurchased (false) items
 */
function clearItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
  isPurchased: boolean,
): void {
  const parentCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });

  if (!parentCacheId) return;

  const filterKey = `isPurchased":${isPurchased}`;

  cache.modify({
    id: parentCacheId,
    fields: {
      itemsConnection(existing: any, { storeFieldName }: any) {
        if (!storeFieldName.includes(filterKey) || !existing) return existing;
        return {
          ...existing,
          edges: [],
          totalCount: 0,
        };
      },
      ...(isPurchased && {
        completedItems() {
          return 0;
        },
      }),
      totalItems(existing: number = 0) {
        return Math.max(0, existing - itemIds.length);
      },
    },
  });

  // Evict all deleted items from cache
  itemIds.forEach(itemId => {
    const cacheId = cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    if (cacheId) {
      cache.evict({ id: cacheId });
    }
  });

  cache.gc();
}

/** Clear ALL purchased items from cache. */
export function clearAllPurchasedItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
): void {
  clearItemsFromCache(cache, listId, itemIds, true);
}

/** Clear ALL unpurchased items from cache. */
export function clearAllUnpurchasedItemsFromCache(
  cache: ApolloCache,
  listId: string,
  itemIds: string[],
): void {
  clearItemsFromCache(cache, listId, itemIds, false);
}

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
        itemsConnection(
          existing: any,
          { readField, storeFieldName, toReference }: any,
        ) {
          // Detect which filtered variant this is by checking storeFieldName
          const isUnpurchasedConnection =
            storeFieldName.includes('isPurchased":false');
          const isPurchasedConnection =
            storeFieldName.includes('isPurchased":true');

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
                    node: toReference({
                      __typename: 'ShoppingListItem',
                      id: itemId,
                    }),
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
                    node: toReference({
                      __typename: 'ShoppingListItem',
                      id: itemId,
                    }),
                  },
                  ...existing.edges,
                ],
                totalCount: (existing.totalCount || 0) + 1,
              };
            }
          }

          return existing;
        },
        completedItems(existing: number = 0) {
          return movingToPurchased ? existing + 1 : Math.max(0, existing - 1);
        },
      },
    });
  } catch (error) {
    console.warn(
      'Failed to update itemsConnection for purchase status change:',
      error,
    );
  }
}

/**
 * Move a shopping list item to purchased state.
 * Updates itemsConnection filtered variants via storeFieldName detection.
 */
export function moveShoppingListItemToPurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, true);
}

/**
 * Move a shopping list item to unpurchased state.
 * Updates itemsConnection filtered variants via storeFieldName detection.
 */
export function moveShoppingListItemToUnpurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, false);
}

/**
 * Add a new item to shopping list cache.
 *
 * Uses storeFieldName detection to correctly update filtered itemsConnection variants:
 * - isPurchased:true variant → REMOVE the item (handles re-add of previously purchased item)
 * - All other variants (unfiltered, isPurchased:false) → ADD the item
 */
export function addNewItemToShoppingListCache(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
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
        itemsConnection(
          existing: any,
          { readField, storeFieldName, toReference }: any,
        ) {
          if (!existing?.edges) return existing;

          const isPurchasedConnection =
            storeFieldName.includes('isPurchased":true');

          if (isPurchasedConnection) {
            // REMOVE from purchased variant (handles re-add of previously purchased item)
            const hadItem = existing.edges.some(
              (edge: any) => readField('id', edge.node) === item.id,
            );
            if (!hadItem) return existing;
            return {
              ...existing,
              edges: existing.edges.filter(
                (edge: any) => readField('id', edge.node) !== item.id,
              ),
              totalCount: Math.max(0, (existing.totalCount || 0) - 1),
            };
          }

          // ADD to unfiltered and unpurchased variants
          const alreadyExists = existing.edges.some(
            (edge: any) => readField('id', edge.node) === item.id,
          );
          if (alreadyExists) return existing;

          return {
            ...existing,
            edges: [
              {
                __typename: 'ShoppingListItemEdge',
                cursor: item.id,
                node: toReference(
                  { __typename: 'ShoppingListItem', id: item.id },
                  true,
                ),
              },
              ...existing.edges,
            ],
            totalCount: (existing.totalCount || 0) + 1,
          };
        },
        totalItems(existing: number = 0) {
          return existing + 1;
        },
      },
    });
  } catch (error) {
    console.warn('Failed to update cache for new shopping list item:', error);
  }
}
