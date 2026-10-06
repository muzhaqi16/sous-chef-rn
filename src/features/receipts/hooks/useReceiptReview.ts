import { useSelectedShoppingListId } from '#store/useAppStore';
import { useToday } from '#hooks/useToday';
import { useLoadRemainingPages } from '#hooks/utils/useLoadRemainingPages';
import { usePaginatedShoppingItems } from '#features/shoppingList/hooks/usePaginatedShoppingItems';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import { useActiveShoppingListId } from '#features/shoppingList/hooks/useActiveShoppingListId';
import {
  useReceiptDraft,
  useReceiptDraftActions,
  type ReceiptLineChoice,
} from '../store/receiptDraftStore';
import {
  receiptReviewLines,
  seedChoice,
  type ReceiptReviewLine,
} from '../utils/receiptReviewLines';
import { receiptTotalsGap } from '../utils/receiptTotalsGap';
import {
  linkReceiptLines,
  listLineFor,
  type ListMatchKey,
} from '../utils/linkReceiptLines';
import { useApplyReceipt } from './useApplyReceipt';
import { useReceiptMatches, type ReceiptCandidate } from './useReceiptMatches';
import { toDateKey } from '#/utils/dateUtils';

// The chain and its store number print above the items (`ALDI` / `Store #027`).
const HEADER_LINES = 6;

/**
 * What adding does with a line: `add` it, or retry it after it `failed`; it is
 * `added` already; it waits for the API's match (`pending`); or it stays out as
 * a `guess` to check, a line with no match (`unmatched`), or one the user left
 * out (`skipped`).
 */
export type ReceiptRowStatus =
  | 'add'
  | 'failed'
  | 'added'
  | 'pending'
  | 'guess'
  | 'unmatched'
  | 'skipped';

export interface ReceiptReviewRow extends ReceiptReviewLine {
  status: ReceiptRowStatus;
  choice?: ReceiptLineChoice;
  /** The API's best guess when it is unsure: offered, never chosen for the user. */
  guess?: string;
  /** Items the API proposes for the line, best first. */
  candidates: ReceiptCandidate[];
  /** Why the last attempt to add it failed. */
  failure?: string;
  /** Adding it ticks a shopping-list line off rather than adding it again. */
  onList: boolean;
}

/**
 * The saved receipt's item lines, each with what the user chose it to be (else
 * the item the API is sure of) and the open line of the active shopping list
 * it matches, and the step that adds the chosen ones to the current pantry.
 */
export function useReceiptReview() {
  const draft = useReceiptDraft();
  const { chooseLine, setPurchasedOn, chooseStore, clearDraft } =
    useReceiptDraftActions();
  const today = useToday();
  const selectedListId = useSelectedShoppingListId();
  // Until the list tab has opened one, the active list is the default, as there.
  const { lists } = useShoppingListsLite({ skip: !!selectedListId });
  const activeListId = useActiveShoppingListId(lists);
  const listId = selectedListId ?? activeListId;
  const { state: list } = usePaginatedShoppingItems({ listId });
  // A receipt line matches an open list line on any page.
  const { isLoadingRemainingPages } = useLoadRemainingPages(
    !!listId,
    list.loading,
    list.unpurchased,
    listId ?? '',
  );
  const { pantryName, applying, failures, apply } = useApplyReceipt(listId);

  const lines = draft?.parsed ? receiptReviewLines(draft.parsed) : [];
  const [firstPage = ''] = draft?.pages ?? [];
  const {
    matchFor,
    matchState,
    retryMatching,
    resolvedStore,
    recordConfirmed,
  } = useReceiptMatches(
    lines.map(line => ({
      index: line.index,
      text: line.printed,
      code: line.code,
    })),
    // A receipt sent as photos keeps no pages: the merchant the server read stands in.
    firstPage.split('\n').slice(0, HEADER_LINES).join('\n') ||
      draft?.parsed?.merchant,
    draft?.parsedBy,
    draft?.store?.id,
  );
  // What the user picked, else the store the receipt's header names.
  const store =
    draft?.store ??
    (resolvedStore ? { id: resolvedStore.id, name: resolvedStore.name } : null);
  // The server judges its own reading by the rule its lines follow, which
  // knows a discount it found was never taken off.
  const totalsGap =
    draft?.parsedBy === 'server'
      ? draft.totalsGap ?? null
      : draft?.parsed
      ? receiptTotalsGap(draft.parsed)
      : null;
  // A receipt that printed no readable day was bought the day it was scanned.
  const purchasedOn =
    draft?.purchasedOn ??
    (draft ? toDateKey(new Date(draft.scannedAt)) : today);

  const added = new Set(draft?.added);
  const chosen = lines.map(line => {
    const explicit = draft?.choices?.[line.index];
    const match = matchFor(line.index);
    const proposal =
      explicit === undefined && match?.preselect
        ? {
            ...seedChoice(line),
            itemId: match.preselect.itemId,
            itemName: match.preselect.itemName,
          }
        : undefined;
    return {
      line,
      match,
      // Null is the user leaving the line out, proposal or not.
      choice: explicit === undefined ? proposal : explicit ?? undefined,
      skipped: explicit === null,
    };
  });
  const pending = chosen.flatMap(({ line, choice }) =>
    choice && !added.has(line.index)
      ? [{ index: line.index, printed: line.printed, choice }]
      : [],
  );
  const openLines = list.unpurchased.items;
  const links = linkReceiptLines(pending, openLines);

  const statusOf = (
    { line, match, choice, skipped }: (typeof chosen)[number],
    failure: string | undefined,
  ): ReceiptRowStatus => {
    if (added.has(line.index)) return 'added';
    if (choice) return failure ? 'failed' : 'add';
    if (skipped) return 'skipped';
    if (matchState !== 'done') return 'pending';
    return match?.guess ? 'guess' : 'unmatched';
  };

  const rows: ReceiptReviewRow[] = chosen.map(entry => {
    const { line, match, choice } = entry;
    const failure = failures.find(
      failed => failed.index === line.index,
    )?.reason;
    return {
      ...line,
      status: statusOf(entry, failure),
      ...(choice ? { choice } : {}),
      ...(match?.guess && !choice ? { guess: match.guess.itemName } : {}),
      candidates: match?.candidates ?? [],
      failure,
      onList: links.has(line.index),
    };
  });

  // Every other row keeps its link, so a line never shows one already taken.
  const listItemNameFor = (index: number, key: ListMatchKey) => {
    const held = new Set(
      [...links].flatMap(([other, line]) => (other === index ? [] : [line])),
    );
    const open = openLines.filter(line => !held.has(line));
    return listLineFor(key, open)?.itemName ?? undefined;
  };

  const addChosen = async () => {
    const outcome = await apply(
      pending.map(line => ({ ...line, listLine: links.get(line.index) })),
      { purchasedOn, ...(store ? { storeId: store.id } : {}) },
    );
    // Only catalog items can be remembered: a typed name has no id yet.
    void recordConfirmed(
      pending.flatMap(({ index, printed, choice }) =>
        choice.itemId && outcome.addedIndexes.includes(index)
          ? [{ index, text: printed, itemId: choice.itemId }]
          : [],
      ),
    );
    return { added: outcome.addedIndexes.length, failed: outcome.failed };
  };

  return {
    rows,
    merchant: draft?.parsed?.merchant ?? null,
    /** The receipt's store: the user's pick, else the one its header names. */
    store,
    /** Neither the receipt nor the API names the shop, so the user is asked for it. */
    storeUnrecognized: !resolvedStore && !draft?.parsed?.merchant,
    /** The day of the shop, YYYY-MM-DD; the scan's day when none was read. */
    purchasedOn,
    /** No day was read from the receipt and the user set none: it is the scan's. */
    dayIsScanDay: !draft?.purchasedOn,
    setPurchasedOn,
    chooseStore,
    /** The read lines disagree with the receipt's own total: one may be missing. */
    totalsGap,
    /** Whether the API has matched the lines, is matching them, or could not be asked. */
    matchState,
    retryMatching,
    pantryName,
    pendingCount: pending.length,
    applying,
    /** Later list pages are still loading: adding now could miss a list line. */
    listLoading: isLoadingRemainingPages,
    chooseLine,
    /** The list line a line would tick off with this product and unit, as they are picked. */
    listItemNameFor,
    addChosen,
    finish: clearDraft,
  };
}
