/**
 * Settling a shopping-list replay the server accepted in part.
 */
import { revertOptimisticShoppingListItem } from '#features/shoppingList/cache/items';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * A multi-row batch replays as itself and can apply while refusing rows inside
 * `results` (input order). A refused row is withdrawn; a single-row replay comes
 * back in the sync shape, carries no `results`, and is left alone.
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

  results.forEach((result: unknown, position) => {
    if (!isRecord(result) || result.success !== false) return;
    const row: unknown = items[position];
    if (isRecord(row) && typeof row.id === 'string') {
      revertOptimisticShoppingListItem(cache, shoppingListId, row.id);
    }
  });
};
