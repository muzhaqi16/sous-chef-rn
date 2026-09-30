/**
 * Taking back lines a local-first create wrote and counted, whether the
 * foreground answer or a replay says they did not come to exist.
 */

import type { ApolloCache } from '@apollo/client';
import { safeEvictMany } from '#/apollo/utils/cacheUpdaters';
import { isHeld } from '#/apollo/utils/writeLocalEntity';
import { readListCounters } from './connections';

/**
 * Withdraws the minted lines still held: evicts them in one pass and takes them
 * out of the list's counters. A line already gone was already uncounted, so
 * running this again changes nothing. `countsSettled` when the answer carried
 * the list's totals, which Apollo has already written over the local count.
 */
export function withdrawShoppingListItems(
  cache: ApolloCache,
  listId: string,
  ids: readonly string[],
  { countsSettled = false }: { countsSettled?: boolean } = {},
): void {
  const held = [...new Set(ids)].filter(id =>
    isHeld(cache, { __typename: 'ShoppingListItem', id }),
  );
  if (held.length === 0) return;
  safeEvictMany(
    cache,
    held.map(id => ({ typename: 'ShoppingListItem', id })),
  );
  if (countsSettled) return;

  const listCacheId = cache.identify({
    __typename: 'ShoppingList',
    id: listId,
  });
  if (!listCacheId) return;
  const { totalItems, completedItems } = readListCounters(cache, listCacheId);
  // A list cached without its total has nothing to take the lines out of.
  if (totalItems === undefined) return;
  const total = Math.max(0, totalItems - held.length);
  cache.modify({
    id: listCacheId,
    fields: {
      totalItems: () => total,
      ...(completedItems !== undefined && {
        remainingItems: () => Math.max(0, total - completedItems),
        completionRate: () => (total > 0 ? completedItems / total : 0),
      }),
    },
  });
}
