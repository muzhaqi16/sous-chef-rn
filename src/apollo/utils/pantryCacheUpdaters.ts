/**
 * Cache updaters for the `Pantry.itemsConnection` edge list.
 *
 * Shared rather than feature-owned because three features and two shared
 * modals write to this connection — `features/pantry`, `features/barcode`,
 * `components/modals/AddToPantrySheet` and `screens/onBoarding`. They lived in
 * two places before this file: `hooks/home/pantry/utils.ts` and
 * `features/pantry/hooks/mutations/utils.ts` each declared their own
 * `addToPantryItemsCache` from the same factory with the same three arguments,
 * so the two could drift into writing the same connection differently.
 *
 * Sits beside `shoppingListCacheUpdaters.ts`, which is the same thing for the
 * shopping list, and next to the factory both are built from.
 */
import type { ApolloCache } from '@apollo/client';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from './cacheUpdaters';

export const addToPantryItemsCache = createAddToParentConnectionUpdater<{
  id: string;
}>('Pantry', 'itemsConnection', 'PantryItem');

export const removeFromPantryItemsCache =
  createRemoveFromParentConnectionUpdater(
    'Pantry',
    'itemsConnection',
    'PantryItem',
  );

/**
 * Adjust `Pantry.stats.totalItems` by `delta` after a local add or remove.
 *
 * The mutation responses do not carry the parent's aggregate, and
 * `Pantry.stats` uses a `mergeObjects` field policy rather than a recomputation,
 * so nothing updates the count until the next full refetch. Without this the
 * header contradicts the list it sits above: adding an item showed 64 rows under
 * "63 items", and removing one showed 64 rows under "65 items".
 *
 * Only `totalItems` is adjusted. The other stats (expiring, expired, low stock,
 * per-location counts) depend on item state the caller does not necessarily
 * know, and guessing them would replace one wrong number with several.
 */
export function adjustPantryItemCount(
  cache: ApolloCache,
  pantryId: string,
  delta: number,
): void {
  cache.modify({
    id: cache.identify({ __typename: 'Pantry', id: pantryId }),
    fields: {
      stats(existingStats?: { totalItems?: number; readonly __ref?: string }) {
        // A normalized ref has no inline totalItems to adjust, and writing a
        // plain object over it would detach the entity.
        if (!existingStats || existingStats.__ref) return existingStats;
        return {
          ...existingStats,
          totalItems: Math.max(0, (existingStats.totalItems ?? 0) + delta),
        };
      },
    },
  });
}
