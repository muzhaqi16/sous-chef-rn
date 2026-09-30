/**
 * Settling a shopping-list replay the server accepted in part, or answered
 * with a row other than the one minted.
 */
import type { ApolloCache } from '@apollo/client';
import { carriesListTotals } from '#features/shoppingList/cache/items';
import { addNewItemToShoppingListCache } from '#features/shoppingList/cache/connections';
import { withdrawShoppingListItems } from '#features/shoppingList/cache/withdraw';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { safeEvict } from '#/apollo/utils/cacheUpdaters';
import type {
  ReplayReconcilerTable,
  RowAdoption,
} from '#/apollo/offlineQueue/types';
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

/**
 * The server merged the line into the list's existing row for the same item
 * (`outcome: MERGED`): the minted row goes, the kept one is linked uncounted
 * (the minted row was counted already), and later writes move to it.
 */
function foldMintedRow(
  cache: ApolloCache,
  listId: string,
  item: { id: string; version?: number },
  mintedId: string,
  { countsSettled }: { countsSettled: boolean },
  adopt: ((adoption: RowAdoption) => void) | undefined,
): void {
  withdrawShoppingListItems(cache, listId, [mintedId], { countsSettled });
  addNewItemToShoppingListCache(cache, listId, item, false);
  adopt?.({ mintedId, survivingId: item.id, version: item.version });
}

/**
 * Every batch-add copy replays as itself and can apply while refusing rows
 * inside `results`. Each result is paired to its row by the `index` the server
 * echoes; a refused row is withdrawn and a merged one folded onto the kept row.
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
  // The list is resolved after the whole batch, so the refused and merged rows
  // are already out of its count. An older build's document reads it per row.
  const countsSettled = [
    payload.shoppingList,
    ...payload.results.map((result: unknown) =>
      isRecord(result) && isRecord(result.item)
        ? result.item.shoppingList
        : undefined,
    ),
  ].some(list => carriesListTotals(list, shoppingListId));

  const withdrawn: string[] = [];
  const merged: { mintedId: string; item: { id: string; version?: number } }[] =
    [];
  payload.results.forEach((result: unknown, position) => {
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
  });
  withdrawShoppingListItems(cache, shoppingListId, withdrawn, {
    countsSettled,
  });
  // A merged line's minted row was counted already, so the kept one is not.
  for (const { mintedId, item } of merged) {
    addNewItemToShoppingListCache(cache, shoppingListId, item, false);
    adopt?.({ mintedId, survivingId: item.id, version: item.version });
  }
};

/**
 * A single created row whose payload names the row the server kept. A
 * different id means the server merged the line into an existing one, so the
 * minted row is folded onto it.
 */
export const reconcileShoppingRowReplay: Reconciler = (
  cache,
  variables,
  data,
  adopt,
) => {
  const input: unknown = variables.input;
  if (!isRecord(input)) return;
  const { id: mintedId, shoppingListId } = input;
  if (typeof mintedId !== 'string' || typeof shoppingListId !== 'string') {
    return;
  }

  const payload: unknown = extractMutationPayload(data);
  const returned = isRecord(payload) ? payload.shoppingListItem : undefined;
  const item = serverRow(returned);
  if (!item || item.id === mintedId) return;
  const countsSettled =
    isRecord(returned) &&
    carriesListTotals(returned.shoppingList, shoppingListId);
  foldMintedRow(
    cache,
    shoppingListId,
    item,
    mintedId,
    { countsSettled },
    adopt,
  );
};

/**
 * An applied delete answers with its row's `{ id }`, which re-creates the entity
 * the local removal evicted; it goes again. A converged replay answers `null`.
 */
export const settleShoppingItemDelete: Reconciler = (cache, variables) => {
  const input: unknown = variables.input;
  if (!isRecord(input)) return;
  if (typeof input.id === 'string') {
    safeEvict(cache, 'ShoppingListItem', input.id);
  }
};
