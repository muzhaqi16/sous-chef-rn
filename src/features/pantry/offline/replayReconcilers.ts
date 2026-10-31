/**
 * A pantry replay the server answered with a row other than the one it named:
 * the writes queued behind it move onto that row. The rest is `commit`.
 */
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';
import { isRecord } from '#/utils/isRecord';

type Reconciler = ReplayReconcilerTable[string];

const idOf = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.id === 'string' ? value.id : undefined;

/** The stack a write landed on: the payload's own, else its ledger row's. */
const stackOf = (payload: Record<string, unknown>): unknown => {
  if (isRecord(payload.pantryItem)) return payload.pantryItem;
  return isRecord(payload.pantryItemUsage)
    ? payload.pantryItemUsage.pantryItem
    : undefined;
};

/** `subjectKey` is the input field naming the row the write expected. */
const adoptAnsweredStack =
  (subjectKey: 'id' | 'pantryItemId'): Reconciler =>
  (_cache, variables, data, adopt) => {
    const input: unknown = variables.input;
    const payload: unknown = extractMutationPayload(data);
    if (!isRecord(input) || !isRecord(payload)) return;
    const queuedId = input[subjectKey];
    const row = stackOf(payload);
    const servedId = idOf(row);
    if (typeof queuedId !== 'string' || !servedId || servedId === queuedId) {
      return;
    }
    adopt?.({
      mintedId: queuedId,
      survivingId: servedId,
      version:
        isRecord(row) && typeof row.version === 'number'
          ? row.version
          : undefined,
    });
  };

/**
 * `pantryItemId` is a HINT, honoured only when the move creates a row: if the
 * pantry already stocks that catalog item the server restocks the existing
 * stack and returns ITS id.
 */
export const reconcileMoveToPantryReplay = adoptAnsweredStack('pantryItemId');

/**
 * A queued create replays with `forceAdd`, so a stack for the same item and
 * unit that another member added meanwhile absorbs it under its own id.
 */
export const reconcileCreatePantryItemReplay = adoptAnsweredStack('id');

/**
 * A delta queued against a stack the server has since merged into another
 * (USM-3) lands on the survivor: deltas move with it, while a set or a removal
 * is withdrawn, as for a merged create.
 */
export const reconcilePantryUsageReplay = adoptAnsweredStack('pantryItemId');
export const reconcileRestockReplay = adoptAnsweredStack('id');
export const reconcileConvertExpiredReplay = adoptAnsweredStack('pantryItemId');
