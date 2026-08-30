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

/**
 * Publish a locally-created row AND count it, as one operation.
 *
 * The row and the count are two writes with one meaning, and every path that
 * does one has to do the other — a count that contradicts the rows beneath it
 * is visible immediately, and `usePantryScreen` also branches on it to choose
 * server-side against client-side sorting, so a stale one can select the wrong
 * mode as well as show a wrong number.
 *
 * They were separate calls, and the separation is what let four of the six
 * paths drift: two quick-add paths published a row without counting it, and the
 * queue's permanent-failure handler withdrew a row without uncounting it —
 * leaving the header permanently ahead of the list, with no response coming to
 * correct it offline. Pairing them here means a call site cannot do one and
 * forget the other.
 */
export function addPantryItemLocally<T extends { id: string }>(
  cache: ApolloCache,
  pantryId: string,
  // Generic so a caller can pass the whole optimistic entity — which it must,
  // since the connection write identifies the row through its `__typename`.
  item: T,
  options?: Parameters<typeof addToPantryItemsCache>[3],
): boolean {
  // Counted only when the row was actually added. The barcode force-add
  // republishes the same id after a duplicate refusal, and the duplicate guard
  // makes that a no-op — a count applied anyway would run ahead of a list that
  // did not change.
  const added = addToPantryItemsCache(cache, pantryId, item, options);
  if (added) adjustPantryItemCount(cache, pantryId, 1);
  return added;
}

/**
 * Withdraw a locally-created row AND uncount it.
 *
 * The mirror of {@link addPantryItemLocally}, for a refusal, a revert, or a
 * queued write the server permanently rejected.
 */
export function removePantryItemLocally(
  cache: ApolloCache,
  pantryId: string,
  itemId: string,
  options?: Parameters<typeof removeFromPantryItemsCache>[3],
): boolean {
  const removed = removeFromPantryItemsCache(cache, pantryId, itemId, options);
  if (removed) adjustPantryItemCount(cache, pantryId, -1);
  return removed;
}
