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
import { hideEntity, isHeld } from '#/apollo/utils/writeLocalEntity';
import {
  evictLocalPantryItemSeeds,
  writeLocalPantryItem,
  type LocalPantryItem,
} from './writeLocalPantryItem';

/** The row's reference; the connection write identifies it by `__typename`. */
export type PantryItemRef = {
  __typename: 'PantryItem';
  id: string;
};

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
 * Reconciles a local-first create with its answer: the server's row takes the
 * counted edge. A create resolved onto a held row (a restock) answers with that
 * row's id; the minted row goes with its edge and seeds, not the count.
 */
export function reconcileCreatedPantryItem(
  cache: ApolloCache,
  pantryId: string,
  pantryItem: PantryItemRef,
  clientId: string | null | undefined,
): void {
  if (clientId && clientId !== pantryItem.id) {
    // The held row is never added: the write reaches every cached variant, so
    // it would land in, and count toward, the filtered ones it is not in.
    removeFromPantryItemsCache(cache, pantryId, clientId, { evictItem: true });
    evictLocalPantryItemSeeds(cache, clientId);
    return;
  }
  // NOT the counting helper: the eager write already counted this row.
  addToPantryItemsCache(cache, pantryId, pantryItem);
}

/**
 * Moves `Pantry.stats.totalItems` by `delta`: responses carry no parent
 * aggregate and `Pantry.stats` merges, so the header would contradict the list.
 * The write's echo re-reads the rest (`usePantrySubscriptions`).
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
 * Publishes a locally-created row AND counts it, as one operation: a count
 * contradicting the rows shows at once, and `usePantryScreen` picks server- or
 * client-side sorting from it.
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

/** A create as a layer shows it: the row, listed and counted. */
export function showLocalPantryItem(
  cache: ApolloCache,
  stack: PantryItemRef,
  row: LocalPantryItem,
  now: string,
): void {
  if (!isHeld(cache, stack)) writeLocalPantryItem(cache, stack.id, row, now);
  addPantryItemLocally(cache, row.pantryId, stack);
}

/**
 * Lists the row a create's answer kept. An answer naming a held stack joined
 * that stack, so the minted row never reached the server's data. The held row
 * is not added: the write reaches every cached variant, and it would land in,
 * and count toward, the filtered ones it is not in.
 */
export function listAnsweredPantryItem(
  cache: ApolloCache,
  pantryId: string,
  mintedId: string,
  payload: unknown,
): void {
  if (!isRecord(payload) || !isRecord(payload.pantryItem)) return;
  if (payload.pantryItem.id !== mintedId) return;
  addPantryItemLocally(
    cache,
    pantryId,
    { __typename: 'PantryItem', id: mintedId },
    { countsSettled: carriesPantryCount(payload.pantry, pantryId) },
  );
}

/**
 * Takes a row out from a layer; a row already hidden counts nothing.
 */
export function hidePantryItem(
  cache: ApolloCache,
  pantryId: string,
  itemId: string,
): void {
  const row = { __typename: 'PantryItem', id: itemId };
  if (!isHeld(cache, row)) return;
  removePantryItemLocally(cache, pantryId, itemId);
  hideEntity(cache, row);
}

/**
 * An answered row leaves the server's data. Edge first: an evict always reports
 * a removal, so only the edge can tell whether a realtime event took the row,
 * and its count, before this.
 */
export function dropPantryItem(
  cache: ApolloCache,
  pantryId: string,
  itemId: string,
  options: CountOptions = {},
): void {
  removePantryItemLocally(cache, pantryId, itemId, options);
  safeEvict(cache, 'PantryItem', itemId);
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
