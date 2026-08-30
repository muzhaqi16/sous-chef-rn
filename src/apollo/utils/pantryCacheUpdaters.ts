/**
 * Cache updaters for the `Pantry.itemsConnection` edge list — shared because
 * `features/pantry`, `features/barcode`, `components/modals/AddToPantrySheet` and
 * `screens/onBoarding` all write it, and two copies of the same factory call can
 * drift into writing the same connection differently.
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
 * Adjust `Pantry.stats.totalItems` by `delta` after a local add or remove: the
 * responses carry no parent aggregate and `Pantry.stats` merges rather than
 * recomputes, so the header otherwise contradicts the list beneath it. Only
 * `totalItems` — the other stats depend on item state the caller may not know.
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
 * Publish a locally-created row AND count it, as one operation. Every path must do
 * both: a count contradicting the rows is visible immediately, and
 * `usePantryScreen` branches on it to pick server-side against client-side
 * sorting. Pairing them here means a call site cannot do one and forget the other.
 */
export function addPantryItemLocally<T extends { id: string }>(
  cache: ApolloCache,
  pantryId: string,
  // Generic so a caller can pass the whole optimistic entity — which it must,
  // since the connection write identifies the row through its `__typename`.
  item: T,
  options?: Parameters<typeof addToPantryItemsCache>[3],
): boolean {
  // Counted only when the row was actually added: the barcode force-add
  // republishes the same id after a duplicate refusal, which the duplicate guard
  // makes a no-op.
  const added = addToPantryItemsCache(cache, pantryId, item, options);
  if (added) adjustPantryItemCount(cache, pantryId, 1);
  return added;
}

/**
 * Withdraw a locally-created row AND uncount it — the mirror of
 * {@link addPantryItemLocally}, for a refusal, a revert, or a permanent rejection.
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
