/**
 * Withdrawing a line to the pantry, and restoring it when that fails. Unlike the
 * generic remover these touch ONLY the matching purchased/unpurchased variant, so
 * the other tab's `totalCount` is left alone.
 */

import type { ApolloCache } from '@apollo/client';
import { type ConnectionData, safeEvict } from '#/apollo/utils/cacheUpdaters';
import { logger } from '#/utils/environment';
import { matchesFilter, moveShoppingListItemToPurchased } from './connections';
import { writePurchaseInfo } from './purchase';

/**
 * Remove one item when moving it to the pantry. Unlike the generic remover this
 * touches ONLY the matching purchased/unpurchased variant, so the other tab's
 * `totalCount` is not decremented, and it updates `completedItems`/`totalItems`.
 */
export function removeItemFromShoppingListForMoveToPantry(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  wasPurchased: boolean,
  options: { evictEntity?: boolean } = {},
): void {
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });

    if (!parentCacheId) return;

    // The edge write first, recording whether it changed anything; the counters
    // follow from that. A layer and its commit each run this helper, and
    // `edges.filter` is idempotent while `-1` is not. Two passes because
    // `cache.modify` visits fields in the STORE's order.
    // `modify` reports true only when a modifier returned something other than
    // `existing`, so every no-op path below must return `existing` itself.
    const removed = cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName },
        ) {
          if (
            !matchesFilter(storeFieldName, 'isPurchased', wasPurchased) ||
            !existing?.edges
          )
            return existing;

          const edges = existing.edges.filter(
            edge => readField<string>('id', edge.node) !== itemId,
          );
          if (edges.length === existing.edges.length) return existing;

          return {
            ...existing,
            edges,
            totalCount: Math.max(0, (existing.totalCount ?? 0) - 1),
          };
        },
      },
    });

    if (removed) {
      cache.modify({
        id: parentCacheId,
        fields: {
          ...(wasPurchased && {
            completedItems(existing: number = 0) {
              return Math.max(0, existing - 1);
            },
          }),
          totalItems(existing: number = 0) {
            return Math.max(0, existing - 1);
          },
        },
      });
    }

    // Evicting is for the CONFIRMED move: a layer's evict leaves the row.
    if (options.evictEntity !== false) {
      safeEvict(cache, 'ShoppingListItem', itemId);
    }
  } catch (error) {
    logger.warn(
      'Failed to remove item from ShoppingList for move to pantry:',
      error,
    );
  }
}

/**
 * A purchase that names a list line leaves it bought, as the server does.
 * Written before the write fires: a queued one runs no `update`.
 */
export function stampItemBoughtOnList(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  wasPurchased: boolean,
): void {
  writePurchaseInfo(cache, itemId, { isPurchased: true });
  if (!wasPurchased) {
    moveShoppingListItemToPurchased(cache, listId, { id: itemId });
  }
}

/**
 * A move that keeps the line on the list leaves it bought and stamped, as the
 * server does.
 */
export function stampItemKeptOnListAfterMoveToPantry(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  wasPurchased: boolean,
  now: string,
): void {
  stampItemBoughtOnList(cache, listId, itemId, wasPurchased);
  // A second write: the writer clears the stamp on the flip itself.
  writePurchaseInfo(cache, itemId, { movedToPantryAt: now });
}

/**
 * Display shape of the optimistic `ShoppingList`, mirroring what the overview query
 * `GetShoppingListsLite` selects per node so it reads complete from cache offline.
 */
