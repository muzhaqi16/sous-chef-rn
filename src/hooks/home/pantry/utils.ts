/**
 * Shared utilities for pantry management hooks
 */

import type { ApolloCache } from '@apollo/client';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  createBatchAddToConnectionUpdater,
  incrementNestedCounter,
} from '#/apollo/utils/cacheUpdaters';

// Cache updater utilities for pantry items
export const addToPantryItemsCache = createAddToParentConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

export const removeFromPantryItemsCache =
  createRemoveFromParentConnectionUpdater(
    'Pantry',
    'itemsConnection',
    'PantryItem',
  );

const batchAddToPantryItems = createBatchAddToConnectionUpdater(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

/**
 * Batch-add multiple pantry items to the cache in a single cache.modify() call.
 * Use this instead of calling addToPantryItemsCache N times during rapid-fire
 * mutations to avoid N separate watcher notifications and re-renders.
 */
export function batchAddToPantryItemsCache(
  cache: ApolloCache,
  pantryId: string,
  newItems: Array<{ id: string }>,
  options?: { updateStats?: boolean },
): void {
  batchAddToPantryItems(cache, pantryId, newItems);

  if (options?.updateStats) {
    incrementNestedCounter(
      cache,
      'Pantry',
      pantryId,
      'stats',
      'totalItems',
      newItems.length,
    );
  }
}
