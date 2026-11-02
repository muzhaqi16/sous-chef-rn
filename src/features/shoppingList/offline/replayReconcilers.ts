/**
 * A shopping-list replay the server answered with a row other than the one
 * minted: the writes queued behind it move onto that row. The rest is `commit`.
 */
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
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

/** Lines pair with their answers by the echoed `index`, else by position. */
function adoptMergedLines(
  adopt: Parameters<Reconciler>[3],
  items: unknown[],
  results: unknown[],
): void {
  results.forEach((result: unknown, position) => {
    if (!isRecord(result)) return;
    const index = typeof result.index === 'number' ? result.index : position;
    const line: unknown = items[index];
    const item = serverRow(result.item);
    if (!isRecord(line) || typeof line.id !== 'string' || !item) return;
    if (result.success === false || item.id === line.id) return;
    adopt?.({ mintedId: line.id, survivingId: item.id, version: item.version });
  });
}

export const reconcileShoppingAddReplay: Reconciler = (
  _cache,
  variables,
  data,
  adopt,
) => {
  const input: unknown = variables.input;
  if (!isRecord(input) || !Array.isArray(input.items)) return;
  const payload: unknown = extractMutationPayload(data);
  if (!isRecord(payload) || !Array.isArray(payload.results)) return;
  adoptMergedLines(adopt, input.items, payload.results);
};

/** A list created with lines answers them as a batch add does. */
export const reconcileShoppingCreateReplay: Reconciler = (
  _cache,
  variables,
  data,
  adopt,
) => {
  const input: unknown = variables.input;
  if (!isRecord(input) || !Array.isArray(input.items)) return;
  const payload: unknown = extractMutationPayload(data);
  if (!isRecord(payload) || !Array.isArray(payload.itemResults)) return;
  adoptMergedLines(adopt, input.items, payload.itemResults);
};
