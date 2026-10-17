import type { ApolloCache } from '@apollo/client';
import type {
  CountWithdrawalTable,
  ReplayReconcilerTable,
  RowAdoption,
  UnlinkWithdrawalTable,
} from '#/apollo/offlineQueue/types';
import {
  reconcileCreatedPantryItem,
  removePantryItemLocally,
  revertOptimisticPantryItem,
  type PantryItemRef,
} from '#features/pantry/cache/items';
import {
  applyMoveToPantryCacheUpdate,
  revertLocalMove,
  type LocalMove,
} from '#features/shoppingList/cache/localMove';
import { writePurchaseInfo } from '#features/shoppingList/cache/purchase';
import { adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import { extractMutationPayload } from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import {
  useReceiptDraftStore,
  type CheckInLineOutcome,
} from '../store/receiptDraftStore';

/**
 * What a check-in's settle reads from what was sent: true of the input this
 * build builds, and of one read back from the queue.
 */
export interface CheckInSent {
  id: string;
  pantryId: string;
  shoppingListId?: string | null;
  lines: readonly {
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

/** What a line wrote before the check-in fired, so a refusal undoes exactly that. */
export type WrittenLine =
  | { kind: 'move'; written: LocalMove }
  | { kind: 'intake' };

const pantryRef = (id: string): PantryItemRef => ({
  __typename: 'PantryItem',
  id,
});

// A refused line, given what it wrote: exact. Read back from the queue, only
// its input: a kept list line is un-stamped, and its flag comes back on the
// reread the caller runs.
const withdrawLine = (
  cache: ApolloCache,
  input: CheckInSent,
  line: CheckInSent['lines'][number],
  wrote: WrittenLine | undefined,
): boolean => {
  const { pantryId } = input;
  const { pantryItemId, shoppingListItemId } = line;
  if (wrote?.kind === 'move' && pantryItemId && shoppingListItemId) {
    return revertLocalMove(
      cache,
      { pantryId, pantryItemId, shoppingListItemId, removeFromList: false },
      wrote.written,
    );
  }
  if (pantryItemId) revertOptimisticPantryItem(cache, pantryId, pantryItemId);
  if (!shoppingListItemId) return true;
  writePurchaseInfo(cache, shoppingListItemId, { movedToPantryAt: null });
  return false;
};

/**
 * A recorded check-in's cache side: a line the API recorded, now or before,
 * adopts its stack; a refused one withdraws only what it wrote. Returns whether
 * all withdrawals were exact (else re-read the lists) and where minted ids merged.
 */
export function applyReceiptCheckIn(
  cache: ApolloCache,
  input: CheckInSent,
  results: readonly CheckInLineResult[],
  written?: ReadonlyMap<number, WrittenLine>,
): { exact: boolean; adopted: RowAdoption[] } {
  const { pantryId } = input;
  let exact = true;
  const adopted: RowAdoption[] = [];
  for (const result of results) {
    const line = input.lines[result.index];
    if (!line) continue;
    const { pantryItemId, shoppingListItemId } = line;
    if (!result.success) {
      exact =
        withdrawLine(cache, input, line, written?.get(result.index)) && exact;
      continue;
    }
    // A typed name the API matched to an item it holds: the row now names that
    // item, and the one written under the minted id goes.
    if (result.item) {
      adoptServerEntityId(cache, 'Item', result.item.id, line.item?.inline?.id);
    }
    if (!pantryItemId || !result.pantryItem) continue;
    const pantryItem = pantryRef(result.pantryItem.id);
    if (shoppingListItemId) {
      applyMoveToPantryCacheUpdate(cache, {
        pantryId,
        shoppingListItemId,
        removeFromList: false,
        currentListId: input.shoppingListId ?? undefined,
        pantryItem,
        clientId: pantryItemId,
      });
    } else {
      reconcileCreatedPantryItem(cache, pantryId, pantryItem, pantryItemId);
    }
    if (pantryItem.id !== pantryItemId) {
      adopted.push({
        mintedId: pantryItemId,
        survivingId: pantryItem.id,
        version: undefined,
      });
    }
  }
  return { exact, adopted };
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
    shoppingListId: idOrNull(input.shoppingListId),
    lines: input.lines.map((line: unknown) =>
      isRecord(line)
        ? {
            pantryItemId: idOrNull(line.pantryItemId),
            shoppingListItemId: idOrNull(line.shoppingListItemId),
            item: inlineOf(line.item),
          }
        : {},
    ),
  };
};

const resultsOf = (data: unknown): CheckInLineResult[] => {
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
 * A queued check-in the server answered: the same per-line settle as the
 * foreground, a merged stack's queued writes moved to it, and the saved
 * receipt told which lines landed.
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
  const { adopted } = applyReceiptCheckIn(cache, input, results);
  for (const adoption of adopted) adopt?.(adoption);
  useReceiptDraftStore.getState().settleCheckIn(input.id, results);
};

/** A queued check-in refused for good: every stack it wrote goes, uncounted. */
export const withdrawReceiptCheckIn: CountWithdrawalTable[string] = (
  cache,
  variables,
) => {
  const input = checkInSentOf(variables);
  if (!input) return;
  for (const { pantryItemId } of input.lines) {
    if (pantryItemId) {
      removePantryItemLocally(cache, input.pantryId, pantryItemId);
    }
  }
  useReceiptDraftStore.getState().setCheckInState('idle');
};

/**
 * The list lines a refused check-in stamped. Their pre-check-in flag is not
 * recorded, so the withdrawal's reread brings `isPurchased` back.
 */
export const restoreReceiptCheckInListLines: UnlinkWithdrawalTable[string] = (
  cache,
  variables,
) => {
  const input = checkInSentOf(variables);
  if (!input) return;
  for (const { shoppingListItemId } of input.lines) {
    if (shoppingListItemId) {
      writePurchaseInfo(cache, shoppingListItemId, { movedToPantryAt: null });
    }
  }
};
