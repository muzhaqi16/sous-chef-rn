/**
 * The item connection and its filtered variants. Apollo stores an ALIASED field
 * under its real name with serialized keyArgs
 * (`itemsConnection:{"isPurchased":true}`), not under the alias — so every update
 * targets `itemsConnection` and tells variants apart by `storeFieldName`.
 */

import type { ApolloCache, Reference } from '@apollo/client';
import {
  type ConnectionData,
  createRemoveFromParentConnectionUpdater,
  safeEvictMany,
} from '#/apollo/utils/cacheUpdaters';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import type { ShoppingList } from '#/graphql/generated/schemaTypes';
import { logger } from '#/utils/environment';
import { Connections_ListCountersFragmentDoc } from './connections.generated';
import { readIsPurchased } from './purchase';

type ListCounter = keyof Pick<
  ShoppingList,
  'totalItems' | 'completedItems' | 'remainingItems' | 'completionRate'
>;
type ListCounters = Partial<Record<ListCounter, number>>;

const LIST_COUNTERS = [
  'totalItems',
  'completedItems',
  'remainingItems',
  'completionRate',
] satisfies ListCounter[];

/** A list's counters before and after one local write. */
export interface ListCounterChange {
  listId: string;
  before: ListCounters;
  after: ListCounters;
}

export function readListCounters(
  cache: ApolloCache,
  listCacheId: string,
): ListCounters {
  // Partial: a list cached without one counter still records the others.
  const counters = cache.readFragment({
    id: listCacheId,
    fragment: Connections_ListCountersFragmentDoc,
    returnPartialData: true,
    optimistic: true,
  });
  return {
    totalItems: counters?.totalItems,
    completedItems: counters?.completedItems,
    remainingItems: counters?.remainingItems,
    completionRate: counters?.completionRate,
  };
}

/** Runs `write`, recording the list counters it moves so a revert can restore them exactly. */
export function recordListCounters(
  cache: ApolloCache,
  listId: string,
  write: () => void,
): ListCounterChange {
  const id = cache.identify({ __typename: 'ShoppingList', id: listId });
  const before = id ? readListCounters(cache, id) : {};
  write();
  return { listId, before, after: id ? readListCounters(cache, id) : {} };
}

/**
 * Runs `undo`, then restores the counters `change` recorded — a `±1` undo is
 * wrong wherever the write clamped at 0. False when another write moved them
 * in between: the relative undo stands and the caller re-reads.
 */
export function undoListCounters(
  cache: ApolloCache,
  change: ListCounterChange,
  undo: () => void,
): boolean {
  const id = cache.identify({ __typename: 'ShoppingList', id: change.listId });
  const current = id ? readListCounters(cache, id) : {};
  undo();
  if (!id) return true;
  if (LIST_COUNTERS.some(field => current[field] !== change.after[field])) {
    return false;
  }
  const restored: Partial<Record<ListCounter, () => number>> = {};
  for (const field of LIST_COUNTERS) {
    const value = change.before[field];
    if (value !== undefined) restored[field] = () => value;
  }
  if (Object.keys(restored).length > 0) {
    cache.modify({ id, fields: restored });
  }
  return true;
}

export function matchesFilter(
  storeFieldName: string,
  key: string,
  value: boolean,
): boolean {
  return storeFieldName.includes(`${key}":${value}`);
}

/** Shorthand: does this storeFieldName target the purchased variant? */
export function isPurchasedVariant(storeFieldName: string): boolean {
  return matchesFilter(storeFieldName, 'isPurchased', true);
}

/** Shorthand: does this storeFieldName target the unpurchased variant? */
export function isUnpurchasedVariant(storeFieldName: string): boolean {
  return matchesFilter(storeFieldName, 'isPurchased', false);
}

/** Remove an item from EVERY `ShoppingList.itemsConnection` variant — deletion. */
export const removeFromShoppingListItemsConnection =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );

/** Clear ALL purchased items from cache in a single write. */
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

  cache.modify({
    id: parentCacheId,
    fields: {
      itemsConnection(
        existing: ConnectionData | undefined,
        { storeFieldName },
      ) {
        if (!isPurchasedVariant(storeFieldName) || !existing) return existing;
        // Remove exactly the ids the mutation was given, NOT the whole
        // connection. The list is paginated, so `itemIds` is what was loaded
        // at tap time and the server clears only those — emptying the
        // connection hides every row past the loaded page until something
        // else refetches.
        const cleared = new Set(
          itemIds.map(id =>
            cache.identify({ __typename: 'ShoppingListItem', id }),
          ),
        );
        const edges = (existing.edges ?? []).filter(
          edge => !cleared.has(edge.node.__ref),
        );
        return {
          ...existing,
          edges,
          totalCount: Math.max(
            0,
            (existing.totalCount ?? 0) -
              ((existing.edges?.length ?? 0) - edges.length),
          ),
        };
      },
      // Subtracted, not zeroed, for the same reason as the edges above: only
      // the ids that were sent are gone.
      completedItems(existing: number = 0) {
        return Math.max(0, existing - itemIds.length);
      },
      totalItems(existing: number = 0) {
        return Math.max(0, existing - itemIds.length);
      },
    },
  });

  safeEvictMany(
    cache,
    itemIds.map(id => ({ typename: 'ShoppingListItem', id })),
  );
}

function updateItemsConnectionForPurchaseStatusChange(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  movingToPurchased: boolean,
  { countsSettled = false }: { countsSettled?: boolean } = {},
): void {
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });

    if (!parentCacheId) return;

    // readField sees pre-modify values, so all three stat modifiers below derive
    // the new completedItems from the same baseline regardless of run order.
    const nextCompleted = (current: number) =>
      movingToPurchased ? current + 1 : Math.max(0, current - 1);

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName, toReference },
        ) {
          const isUnpurchasedConnection = isUnpurchasedVariant(storeFieldName);
          const isPurchasedConnection = isPurchasedVariant(storeFieldName);

          if (!existing?.edges) return existing;
          const edges = existing.edges;

          const removeItemEdges = () => {
            const kept = edges.filter(
              edge => readField<string>('id', edge.node) !== itemId,
            );
            if (countsSettled && kept.length === edges.length) return existing;
            return {
              ...existing,
              edges: kept,
              totalCount: Math.max(0, (existing.totalCount ?? 0) - 1),
            };
          };

          const addItemEdge = () => {
            const alreadyExists = edges.some(
              edge => readField<string>('id', edge.node) === itemId,
            );
            if (alreadyExists) return existing;
            const node = toReference({
              __typename: 'ShoppingListItem',
              id: itemId,
            });
            if (!node) return existing;
            const newEdge = {
              __typename: 'ShoppingListItemEdge',
              cursor: itemId,
              node,
            };
            return {
              ...existing,
              edges: [newEdge, ...edges],
              totalCount: (existing.totalCount ?? 0) + 1,
            };
          };

          if (movingToPurchased) {
            if (isUnpurchasedConnection) return removeItemEdges();
            if (isPurchasedConnection) return addItemEdge();
          } else {
            if (isPurchasedConnection) return removeItemEdges();
            if (isUnpurchasedConnection) return addItemEdge();
          }

          return existing;
        },
        ...(!countsSettled && {
          completedItems(existing: number = 0) {
            return nextCompleted(existing);
          },
          // Keep the derived stats in sync with the new completedItems so the
          // progress header doesn't go stale until the next refetch.
          remainingItems(existing: number, { readField }) {
            const total = readField<number>('totalItems');
            const completed = readField<number>('completedItems');
            if (total === undefined || completed === undefined) return existing;
            return Math.max(0, total - nextCompleted(completed));
          },
          completionRate(existing: number, { readField }) {
            const total = readField<number>('totalItems');
            const completed = readField<number>('completedItems');
            if (total === undefined || completed === undefined) return existing;
            return total > 0 ? nextCompleted(completed) / total : 0;
          },
        }),
      },
    });
  } catch (error) {
    logger.warn(
      'Failed to update itemsConnection for purchase status change:',
      error,
    );
  }
}

/** Move a row to purchased, rewiring the filtered `itemsConnection` variants. */
export function moveShoppingListItemToPurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, true);
}

/** Move a row to unpurchased, rewiring the filtered `itemsConnection` variants. */
export function moveShoppingListItemToUnpurchased(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
): void {
  updateItemsConnectionForPurchaseStatusChange(cache, listId, item.id, false);
}

/** Whether a cached `isPurchased: false` variant lists the row. */
export function isListedToBuy(
  cache: ApolloCache,
  listId: string,
  itemId: string,
): boolean {
  let listed = false;
  cache.modify({
    id: cache.identify({ __typename: 'ShoppingList', id: listId }),
    fields: {
      itemsConnection(
        existing: ConnectionData | undefined,
        { readField, storeFieldName },
      ) {
        listed ||=
          isUnpurchasedVariant(storeFieldName) &&
          (existing?.edges ?? []).some(
            edge => readField<string>('id', edge.node) === itemId,
          );
        return existing;
      },
    },
  });
  return listed;
}

/**
 * Moves an answered row's edge between the variants. The answer states the
 * list's counts, and a read may have moved the row already, so this counts
 * nothing and takes out only an edge it finds.
 */
export function moveAnsweredShoppingListItem(
  cache: ApolloCache,
  listId: string,
  itemId: string,
  isPurchased: boolean,
): void {
  updateItemsConnectionForPurchaseStatusChange(
    cache,
    listId,
    itemId,
    isPurchased,
    { countsSettled: true },
  );
}

const withoutEdges =
  (rows: ReadonlySet<string | undefined>) =>
  (existing: ConnectionData | undefined) => {
    if (!existing?.edges) return existing;
    const edges = existing.edges.filter(edge => !rows.has(edge.node.__ref));
    const removed = existing.edges.length - edges.length;
    if (removed === 0) return existing;
    return {
      ...existing,
      edges,
      totalCount: Math.max(0, (existing.totalCount ?? 0) - removed),
    };
  };

/** The list's counters without some rows; a count the cache lacks stays absent. */
function countersWithout(
  counters: ListCounters,
  rows: number,
  purchased: number,
): Partial<Record<ListCounter, () => number>> {
  const next: ListCounters = {};
  if (counters.totalItems !== undefined) {
    next.totalItems = Math.max(0, counters.totalItems - rows);
  }
  if (counters.completedItems !== undefined) {
    next.completedItems = Math.max(0, counters.completedItems - purchased);
  }
  const { totalItems, completedItems } = next;
  if (totalItems !== undefined && completedItems !== undefined) {
    next.remainingItems = Math.max(0, totalItems - completedItems);
    next.completionRate = totalItems > 0 ? completedItems / totalItems : 0;
  }
  const fields: Partial<Record<ListCounter, () => number>> = {};
  for (const field of LIST_COUNTERS) {
    const value = next[field];
    if (value !== undefined) fields[field] = () => value;
  }
  return fields;
}

/**
 * Takes rows out of a list from a layer, where `evict` leaves a row the server
 * holds: deleting its fields hides it. A row already hidden counts nothing, so
 * a rebuild changes nothing.
 */
export function hideShoppingListRows(
  cache: ApolloCache,
  listId: string,
  ids: readonly string[],
): void {
  const rows = ids
    .map(id => ({ __typename: 'ShoppingListItem', id }))
    .filter(row => isHeld(cache, row));
  if (rows.length === 0) return;
  const listCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });
  if (!listCacheId) return;

  const purchased = rows.filter(({ id }) => readIsPurchased(cache, id)).length;
  cache.modify({
    id: listCacheId,
    fields: {
      itemsConnection: withoutEdges(
        new Set(rows.map(row => cache.identify(row))),
      ),
      ...countersWithout(
        readListCounters(cache, listCacheId),
        rows.length,
        purchased,
      ),
    },
  });
  for (const row of rows) {
    cache.modify({
      id: cache.identify(row),
      fields: (_value, { DELETE }) => DELETE,
    });
  }
}

/** Removes answered rows from the server's data; the answer states the counts. */
export function dropShoppingListRows(
  cache: ApolloCache,
  listId: string,
  ids: readonly string[],
): void {
  const rows = ids.map(id => ({ typename: 'ShoppingListItem', id }));
  cache.modify({
    id: cache.identify({ __typename: 'ShoppingList', id: listId }),
    fields: {
      itemsConnection: withoutEdges(
        new Set(
          ids.map(id => cache.identify({ __typename: 'ShoppingListItem', id })),
        ),
      ),
    },
  });
  safeEvictMany(cache, rows);
}

/** Puts the rows still to buy, the one variant ordered by `sortOrder`, in order. */
export function sortShoppingListRows(cache: ApolloCache, listId: string): void {
  cache.modify({
    id: cache.identify({ __typename: 'ShoppingList', id: listId }),
    fields: {
      itemsConnection(
        existing: ConnectionData | undefined,
        { storeFieldName, readField },
      ) {
        if (!isUnpurchasedVariant(storeFieldName)) return existing;
        const keyOf = (node: Reference | undefined) => ({
          sortOrder: (node ? readField<string>('sortOrder', node) : '') ?? '',
          id: (node ? readField<string>('id', node) : '') ?? '',
        });
        return {
          ...existing,
          edges: [...(existing?.edges ?? [])].sort((a, b) => {
            const first = keyOf(readField<Reference>('node', a));
            const second = keyOf(readField<Reference>('node', b));
            if (first.sortOrder < second.sortOrder) return -1;
            if (first.sortOrder > second.sortOrder) return 1;
            return first.id.localeCompare(second.id);
          }),
        };
      },
    },
  });
}

/**
 * Add an item to a shopping list's cache. The `isPurchased:true` variant REMOVES
 * the row (re-adding a purchased item); every other variant adds it. Pass
 * `bumpTotalItems: false` when a local-first
 * {@link addLocalShoppingListItem} has already counted it.
 *
 * Returns true when a cached `isPurchased: false` variant already listed the
 * line — it was on the list, not reused from a bought or removed one.
 */
export function addNewItemToShoppingListCache(
  cache: ApolloCache,
  listId: string,
  item: { id: string },
  bumpTotalItems = true,
): boolean {
  let listedActive = false;
  try {
    const parentCacheId = cache.identify({
      __typename: 'ShoppingList',
      id: listId,
    });
    if (!parentCacheId) return false;

    cache.modify({
      id: parentCacheId,
      fields: {
        itemsConnection(
          existing: ConnectionData | undefined,
          { readField, storeFieldName, toReference },
        ) {
          if (!existing?.edges) return existing;

          if (isPurchasedVariant(storeFieldName)) {
            // Re-adding a purchased row: drop it from the purchased variant.
            const hadItem = existing.edges.some(
              edge => readField<string>('id', edge.node) === item.id,
            );
            if (!hadItem) return existing;
            return {
              ...existing,
              edges: existing.edges.filter(
                edge => readField<string>('id', edge.node) !== item.id,
              ),
              totalCount: Math.max(0, (existing.totalCount ?? 0) - 1),
            };
          }

          const alreadyExists = existing.edges.some(
            edge => readField<string>('id', edge.node) === item.id,
          );
          if (alreadyExists) {
            if (isUnpurchasedVariant(storeFieldName)) listedActive = true;
            return existing;
          }

          const node = toReference(
            { __typename: 'ShoppingListItem', id: item.id },
            true,
          );
          if (!node) return existing;
          const newEdge = {
            __typename: 'ShoppingListItemEdge',
            cursor: item.id,
            node,
          };
          return {
            ...existing,
            edges: [newEdge, ...existing.edges],
            totalCount: (existing.totalCount ?? 0) + 1,
          };
        },
        ...(bumpTotalItems && {
          totalItems(existing: number = 0) {
            return existing + 1;
          },
        }),
      },
    });
  } catch (error) {
    logger.warn('Failed to update cache for new shopping list item:', error);
  }
  return listedActive;
}

/**
 * Reconcile a local-first create from the mutation's `update`: adopt the server id
 * and re-wire the edge WITHOUT re-counting — the optimistic add already bumped
 * `totalItems`. `clientId` comes from the mutation's own `variables`, never a
 * shared ref, so overlapping adds stay correct.
 */
