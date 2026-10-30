/**
 * Settling a shopping-list replay the server accepted in part, or answered
 * with a row other than the one minted.
 */
import { carriesListTotals } from '#features/shoppingList/cache/items';
import { addNewItemToShoppingListCache } from '#features/shoppingList/cache/connections';
import { withdrawShoppingListItems } from '#features/shoppingList/cache/withdraw';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';
import { isRecord } from '#/utils/isRecord';

type Reconciler = ReplayReconcilerTable[string];

const serverRow = (value: unknown): { id: string; version?: number } | null =>
  isRecord(value) && typeof value.id === 'string'
    ? {
        ...value,
        id: value.id,
        version: typeof value.version === 'number' ? value.version : undefined,
      }
    : null;

const idOf = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.id === 'string' ? value.id : undefined;

/**
 * A batch-add replay can apply while refusing rows (paired by echoed `index`):
 * a refused row is withdrawn; a MERGED one too, its kept row linked uncounted and
 * taking later writes; a matched typed item takes over from the one minted for it.
 */
export const reconcileShoppingAddReplay: Reconciler = (
  cache,
  variables,
  data,
  adopt,
) => {
  const input: unknown = variables.input;
  if (!isRecord(input)) return;
  const { shoppingListId, items } = input;
  if (typeof shoppingListId !== 'string' || !Array.isArray(items)) return;

  const payload: unknown = extractMutationPayload(data);
  if (!isRecord(payload) || !Array.isArray(payload.results)) return;
  settleReplayedLines(cache, adopt, {
    listId: shoppingListId,
    items,
    results: payload.results,
    list: payload.shoppingList,
  });
};

/** A list created with lines settles them as a batch add settles its own. */
export const reconcileShoppingCreateReplay: Reconciler = (
  cache,
  variables,
  data,
  adopt,
) => {
  const input: unknown = variables.input;
  if (!isRecord(input)) return;
  const { id, items } = input;
  if (typeof id !== 'string' || !Array.isArray(items)) return;

  const payload: unknown = extractMutationPayload(data);
  if (!isRecord(payload) || !Array.isArray(payload.itemResults)) return;
  settleReplayedLines(cache, adopt, {
    listId: id,
    items,
    results: payload.itemResults,
    list: payload.shoppingList,
  });
};

function settleReplayedLines(
  cache: Parameters<Reconciler>[0],
  adopt: Parameters<Reconciler>[3],
  {
    listId,
    items,
    results,
    list,
  }: { listId: string; items: unknown[]; results: unknown[]; list: unknown },
): void {
  // The list is resolved after the whole batch, so the refused and merged rows
  // are already out of its count.
  const countsSettled = carriesListTotals(list, listId);

  const withdrawn: string[] = [];
  const merged: { mintedId: string; item: { id: string; version?: number } }[] =
    [];
  results.forEach((result: unknown, position) => {
    if (!isRecord(result)) return;
    const index = typeof result.index === 'number' ? result.index : position;
    const row: unknown = items[index];
    if (!isRecord(row) || typeof row.id !== 'string') return;

    const item = serverRow(result.item);
    // A refused row comes back unsuccessful, or with its item null.
    if (result.success === false || result.item === null) {
      withdrawn.push(row.id);
    } else if (item && item.id !== row.id) {
      withdrawn.push(row.id);
      merged.push({ mintedId: row.id, item });
    }
    if (result.success !== false && isRecord(result.item)) {
      const sent = isRecord(row.item) ? idOf(row.item.inline) : undefined;
      adoptServerEntityId(cache, 'Item', idOf(result.item.item), sent);
    }
  });
  withdrawShoppingListItems(cache, listId, withdrawn, { countsSettled });
  // A merged line's minted row was counted already, so the kept one is not.
  for (const { mintedId, item } of merged) {
    addNewItemToShoppingListCache(cache, listId, item, false);
    adopt?.({ mintedId, survivingId: item.id, version: item.version });
  }
}
