import type { ApolloCache, OperationVariables } from '@apollo/client';
import type { ReplayReconcilerTable } from '#/apollo/offlineQueue/types';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  useReceiptDraftStore,
  type CheckInLineOutcome,
} from '../store/receiptDraftStore';
import { forgetReceipt } from '../utils/forgetReceipt';

/**
 * What a check-in's settle reads from what was sent: true of the input this
 * build builds, and of one read back from the queue.
 */
interface CheckInSent {
  id: string;
  pantryId: string;
  lines: readonly {
    /** The receipt line it is, as a string. */
    clientId?: string | null;
    pantryItemId?: string | null;
    shoppingListItemId?: string | null;
    item?: { inline?: { id?: string | null } | null } | null;
  }[];
}

/** One line's outcome, with the item and stack the API recorded it as. */
export interface CheckInLineResult extends CheckInLineOutcome {
  /** `errorId` names the server's log entry, for diagnostics only. */
  failure?: { code: string; errorId?: string | null } | null;
  item?: { id: string } | null;
  pantryItem?: { id: string } | null;
}

/**
 * Results as the receipt lines they answer: a result's `index` is its place in
 * the send, and the line sent there names its receipt line by `clientId`.
 */
export function receiptLineOutcomes<Result extends CheckInLineOutcome>(
  input: CheckInSent,
  results: readonly Result[],
): Result[] {
  return results.flatMap(result => {
    const clientId = input.lines[result.index]?.clientId;
    const index = clientId ? Number(clientId) : Number.NaN;
    return Number.isInteger(index) ? [{ ...result, index }] : [];
  });
}

/**
 * Settles the saved receipt holding `checkInId`. One this ends drops its
 * lookups, as leaving its review does.
 */
export function settleReceiptCheckIn(
  cache: ApolloCache,
  checkInId: string,
  outcomes: readonly CheckInLineOutcome[],
): void {
  const { draft, settleCheckIn } = useReceiptDraftStore.getState();
  if (!draft?.checkIn?.ids.includes(checkInId)) return;
  settleCheckIn(checkInId, outcomes);
  if (!useReceiptDraftStore.getState().draft) {
    forgetReceipt(cache, draft.parseId ?? draft.serverParse?.id);
  }
}

const idOrNull = (value: unknown) => (typeof value === 'string' ? value : null);

const refOf = (value: unknown) =>
  isRecord(value) && typeof value.id === 'string' ? { id: value.id } : null;

const inlineOf = (item: unknown) =>
  isRecord(item) ? { inline: refOf(item.inline) } : null;

// A queued entry's input, read back from JSON field by field.
const checkInSentOf = (variables: { input?: unknown }): CheckInSent | null => {
  const { input } = variables;
  if (
    !isRecord(input) ||
    typeof input.id !== 'string' ||
    typeof input.pantryId !== 'string' ||
    !Array.isArray(input.lines)
  ) {
    return null;
  }
  return {
    id: input.id,
    pantryId: input.pantryId,
    lines: input.lines.map((line: unknown) =>
      isRecord(line)
        ? {
            clientId: idOrNull(line.clientId),
            pantryItemId: idOrNull(line.pantryItemId),
            shoppingListItemId: idOrNull(line.shoppingListItemId),
            item: inlineOf(line.item),
          }
        : {},
    ),
  };
};

export const resultsOf = (data: unknown): CheckInLineResult[] => {
  const payload: unknown = extractMutationPayload(data);
  if (!isRecord(payload) || !Array.isArray(payload.results)) return [];
  return payload.results.flatMap((result: unknown) =>
    isRecord(result) &&
    typeof result.index === 'number' &&
    typeof result.success === 'boolean'
      ? [
          {
            index: result.index,
            success: result.success,
            failure:
              isRecord(result.failure) &&
              typeof result.failure.code === 'string'
                ? { code: result.failure.code }
                : null,
            item: refOf(result.item),
            pantryItem: refOf(result.pantryItem),
          },
        ]
      : [],
  );
};

/**
 * A queued check-in the server answered: a merged stack's queued writes move to
 * it, and the saved receipt is told which lines landed.
 */
export const reconcileReceiptCheckInReplay: ReplayReconcilerTable[string] = (
  cache,
  variables,
  data,
  adopt,
) => {
  const input = checkInSentOf(variables);
  if (!input) return;
  const results = resultsOf(data);
  for (const { index, success, pantryItem } of results) {
    const mintedId = input.lines[index]?.pantryItemId;
    if (success && mintedId && pantryItem && pantryItem.id !== mintedId) {
      adopt?.({ mintedId, survivingId: pantryItem.id, version: undefined });
    }
  }
  settleReceiptCheckIn(cache, input.id, receiptLineOutcomes(input, results));
};

/** A queued check-in refused for good: its lines are back to send on the receipt. */
export function refuseReceiptCheckIn(
  cache: ApolloCache,
  variables: OperationVariables,
): void {
  const input = checkInSentOf(variables);
  if (!input) return;
  const refused = input.lines.map((_line, index) => ({
    index,
    success: false,
  }));
  settleReceiptCheckIn(cache, input.id, receiptLineOutcomes(input, refused));
}
