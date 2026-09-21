/**
 * Settling a shopping-list replay the server accepted in part.
 */
import {
  carriesListTotals,
  reconcileShoppingItemCreateUpdate,
  revertOptimisticShoppingListItem,
} from '#features/shoppingList/cache/items';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';
import { isRecord } from '#/utils/isRecord';

/**
 * A multi-row batch replays as itself and can apply while refusing rows inside
 * `results`. Each result is paired to its row by the `index` the server echoes;
 * a refused row is withdrawn and a merged one reconciled onto the existing row.
 * A single-row replay comes back in the sync shape, carries no `results`, and is
 * left alone.
 */
export const reconcileShoppingBatchReplay: ReplayReconcilerTable[string] = (
  cache,
  variables,
  data,
) => {
  const input: unknown = variables.input;
  if (!isRecord(input)) return;
  const { shoppingListId, items } = input;
  if (typeof shoppingListId !== 'string' || !Array.isArray(items)) return;

  const payload: unknown = extractMutationPayload(data);
  const results = isRecord(payload) ? payload.results : undefined;
  if (!Array.isArray(results)) return;

  // Any accepted row's payload carries the list's totals, resolved after the
  // whole batch, so the refused rows are already out of that count.
  const countsSettled = results.some(
    result =>
      isRecord(result) && carriesListTotals(result.item, shoppingListId),
  );

  results.forEach((result: unknown, position) => {
    if (!isRecord(result)) return;
    const index = typeof result.index === 'number' ? result.index : position;
    const row: unknown = items[index];
    if (!isRecord(row) || typeof row.id !== 'string') return;

    if (result.success === false) {
      revertOptimisticShoppingListItem(cache, shoppingListId, row.id, {
        countsSettled,
      });
      return;
    }
    const item: unknown = result.item;
    if (isRecord(item) && typeof item.id === 'string' && item.id !== row.id) {
      reconcileShoppingItemCreateUpdate(
        cache,
        shoppingListId,
        { ...item, id: item.id },
        row.id,
      );
    }
  });
};

/**
 * A single created row whose payload names the row the server kept. A
 * different id means the server merged the line into an existing one, so the
 * minted row is folded onto it.
 */
export const reconcileShoppingRowReplay: ReplayReconcilerTable[string] = (
  cache,
  variables,
  data,
) => {
  const input: unknown = variables.input;
  if (!isRecord(input)) return;
  const { id: mintedId, shoppingListId } = input;
  if (typeof mintedId !== 'string' || typeof shoppingListId !== 'string') {
    return;
  }

  const payload: unknown = extractMutationPayload(data);
  const item = isRecord(payload) ? payload.shoppingListItem : undefined;
  if (!isRecord(item) || typeof item.id !== 'string' || item.id === mintedId) {
    return;
  }
  reconcileShoppingItemCreateUpdate(
    cache,
    shoppingListId,
    { ...item, id: item.id },
    mintedId,
  );
};
