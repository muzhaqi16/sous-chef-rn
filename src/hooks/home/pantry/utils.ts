/**
 * Shared utilities for pantry management hooks
 */

import type { ApolloCache } from '@apollo/client';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { serializeError } from '#/utils/errorSerialization';
import { PantryStatsCounter_PantryFragmentDoc } from './utils.generated';

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

/**
 * Adjust the `Pantry.stats.totalItems` counter by `delta` via the typed
 * `cache.updateFragment` API. Clamps at 0. Replaces the generic
 * `incrementNestedCounter` helper — full TS inference, no Modifier cast.
 */
export function adjustPantryTotalItemsCount(
  cache: ApolloCache,
  pantryId: string,
  delta: number,
): void {
  try {
    const id = cache.identify({ __typename: 'Pantry', id: pantryId });
    if (!id) return;
    cache.updateFragment(
      {
        fragment: PantryStatsCounter_PantryFragmentDoc,
        fragmentName: 'pantryStatsCounter_pantry',
        id,
      },
      prev =>
        prev && {
          ...prev,
          stats: {
            ...prev.stats,
            totalItems: Math.max(0, prev.stats.totalItems + delta),
          },
        },
    );
  } catch (error) {
    console.warn(
      `Cache update failed for Pantry:${pantryId}.stats.totalItems:`,
      serializeError(error),
    );
  }
}
