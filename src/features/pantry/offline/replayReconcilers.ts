/**
 * A pantry replay the server answered with a row other than the one it named:
 * the writes queued behind it move onto that row. The rest is `commit`.
 */
import { extractMutationPayload } from '#utils/errors/mutationPayload';
import type {
  RefusedRowsNarrower,
  ReplayReconcilerTable,
} from '#apollo/offlineQueue/types';
import { isRecord } from '#utils/isRecord';
import { generateEntityId } from '#utils/generateEntityId';
import { answeredStack } from './localWrites';

type Reconciler = ReplayReconcilerTable[string];

const idOf = (value: unknown): string | undefined =>
  isRecord(value) && typeof value.id === 'string' ? value.id : undefined;

/** `subjectKey` is the input field naming the row the write expected. */
const adoptAnsweredStack =
  (subjectKey: 'id' | 'pantryItemId'): Reconciler =>
  (_cache, variables, data, adopt) => {
    const input: unknown = variables.input;
    const payload: unknown = extractMutationPayload(data);
    if (!isRecord(input) || !isRecord(payload)) return;
    const queuedId = input[subjectKey];
    const row = answeredStack(payload);
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

/** The stacks whose entries a stock check's answer refused. */
const refusedStacks = (payload: unknown): ReadonlySet<string> =>
  new Set(
    (isRecord(payload) && Array.isArray(payload.results)
      ? payload.results
      : []
    ).flatMap((result: unknown) =>
      isRecord(result) &&
      result.success === false &&
      typeof result.pantryItemId === 'string'
        ? [result.pantryItemId]
        : [],
    ),
  );

const aboutRefused =
  (refused: ReadonlySet<string>) =>
  (row: unknown): boolean =>
    isRecord(row) &&
    typeof row.pantryItemId === 'string' &&
    refused.has(row.pantryItemId);

/**
 * A stock check whose answer refused rows keeps only those, under a key of its
 * own: the API answers a resend of the first key with what that send did, so
 * the refused rows would never apply, and a row that landed is not counted
 * again over what changed since.
 */
export const keepRefusedStockCheckRows: RefusedRowsNarrower = (
  { variables, pendingWrite },
  payload,
) => {
  const refused = refusedStacks(payload);
  const input: unknown = variables.input;
  if (refused.size === 0 || !isRecord(input) || !Array.isArray(input.entries)) {
    return null;
  }
  const rows: unknown = pendingWrite?.inputs.rows;
  return {
    variables: {
      ...variables,
      input: {
        ...input,
        idempotencyKey: generateEntityId(),
        entries: input.entries.filter(aboutRefused(refused)),
      },
    },
    pendingWrite: pendingWrite && {
      ...pendingWrite,
      inputs: {
        ...pendingWrite.inputs,
        rows: Array.isArray(rows) ? rows.filter(aboutRefused(refused)) : rows,
      },
    },
  };
};
