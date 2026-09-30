/**
 * Cache updaters for the `Pantry.itemsConnection` edge list, shared because four
 * features write it and two copies of one factory call silently drift apart.
 */
import type { ApolloCache } from '@apollo/client';
import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  safeEvict,
} from '#/apollo/utils/cacheUpdaters';
import { isRecord } from '#/utils/isRecord';
import { evictLocalPantryItemSeeds } from './writeLocalPantryItem';

/** The row's reference; the connection write identifies it by `__typename`. */
export interface PantryItemRef {
  __typename: 'PantryItem';
  id: string;
}

export const addToPantryItemsCache =
  createAddToParentConnectionUpdater<PantryItemRef>(
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
 * Adjust `Pantry.stats.totalItems` by `delta`: the responses carry no parent
 * aggregate and `Pantry.stats` merges rather than recomputes, so the header
 * otherwise contradicts the list. Only `totalItems` — the rest need item state;
 * the write's own subscription echo re-reads them (`usePantrySubscriptions`).
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

interface CountOptions {
  /** A response already wrote the server's count over the local one. */
  countsSettled?: boolean;
}

/**
 * Whether `pantry`, from a response, carried this pantry's item count — which
 * Apollo has already written over the local one, so an adjustment on top counts
 * a row twice.
 */
export function carriesPantryCount(pantry: unknown, pantryId: string): boolean {
  return (
    isRecord(pantry) &&
    pantry.id === pantryId &&
    isRecord(pantry.stats) &&
    typeof pantry.stats.totalItems === 'number'
  );
}

/**
 * Publish a locally-created row AND count it, as one operation. Every path must do
 * both: a count contradicting the rows is visible immediately, and
 * `usePantryScreen` branches on it to pick server-side against client-side
 * sorting. Pairing them here means a call site cannot do one and forget the other.
 */
export function addPantryItemLocally(
  cache: ApolloCache,
  pantryId: string,
  item: PantryItemRef,
  {
    countsSettled = false,
    ...options
  }: CountOptions & Parameters<typeof addToPantryItemsCache>[3] = {},
): boolean {
  // Counted only when the row was actually added: the barcode force-add
  // republishes the same id after a duplicate refusal, which the duplicate guard
  // makes a no-op.
  const added = addToPantryItemsCache(cache, pantryId, item, options);
  if (added && !countsSettled) adjustPantryItemCount(cache, pantryId, 1);
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
  {
    countsSettled = false,
    ...options
  }: CountOptions & Parameters<typeof removeFromPantryItemsCache>[3] = {},
): boolean {
  const removed = removeFromPantryItemsCache(cache, pantryId, itemId, options);
  if (removed && !countsSettled) adjustPantryItemCount(cache, pantryId, -1);
  return removed;
}

/**
 * Withdraw a refused optimistic row: edge first, so `cache.modify` still sees it
 * and takes both counters with it. Evicting alone strands `stats.totalItems`.
 */
export function revertOptimisticPantryItem(
  cache: ApolloCache,
  pantryId: string,
  itemId: string,
  options: CountOptions = {},
): void {
  removePantryItemLocally(cache, pantryId, itemId, options);
  safeEvict(cache, 'PantryItem', itemId);
  evictLocalPantryItemSeeds(cache, itemId);
}
