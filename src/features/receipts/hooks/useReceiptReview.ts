import { useSelectedShoppingListId } from '#store/useAppStore';
import { usePaginatedShoppingItems } from '#features/shoppingList/hooks/usePaginatedShoppingItems';
import { useShoppingListsLite } from '#features/shoppingList/hooks/useShoppingListsLite';
import {
  useReceiptDraftStore,
  type ReceiptLineChoice,
} from '../store/receiptDraftStore';
import {
  receiptReviewLines,
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
import {
  receiptLineDefaults,
  toLineChoice,
} from '../components/receiptLineFormConfig';
import { toDateKey } from '#/utils/dateUtils';

// The chain and its store number print above the items (`ALDI` / `Store #027`).
const HEADER_LINES = 6;

export interface ReceiptReviewRow extends ReceiptReviewLine {
  choice?: ReceiptLineChoice;
  /** The choice is the API's proposal, not yet one the user made. */
  proposed: boolean;
  /** The API's best guess when it is unsure: offered, never chosen for the user. */
  guess?: string;
  /** Items the API proposes for the line, best first. */
  candidates: ReceiptCandidate[];
  added: boolean;
  /** Why the last attempt to add it failed. */
  failure?: string;
  /** Adding it ticks a shopping-list line off rather than adding it again. */
  onList: boolean;
}

// The line sheet's seed for a line, with the proposed item picked.
const proposedChoice = (
  line: ReceiptReviewLine,
  candidate: ReceiptCandidate,
): ReceiptLineChoice =>
  toLineChoice({
    ...receiptLineDefaults(line, undefined),
    itemName: candidate.itemName,
    itemId: candidate.itemId,
  });

/**
 * The saved receipt's item lines, each with what the user chose it to be (else
 * the item the API is sure of) and the open line of the active shopping list
 * it matches, and the step that adds the chosen ones to the current pantry.
 */
export function useReceiptReview() {
  const draft = useReceiptDraftStore(state => state.draft);
  const chooseLine = useReceiptDraftStore(state => state.chooseLine);
  const clearDraft = useReceiptDraftStore(state => state.clearDraft);
  const selectedListId = useSelectedShoppingListId();
  // Until the list tab has opened one, the active list is the default, as there.
  const { lists } = useShoppingListsLite({ skip: !!selectedListId });
  const listId =
    selectedListId ??
    (lists.find(list => list.isDefault) ?? lists[0])?.id ??
    undefined;
  const { state: list } = usePaginatedShoppingItems({ listId });
  const { pantryName, applying, failures, apply } = useApplyReceipt(listId);

  const lines = draft?.parsed ? receiptReviewLines(draft.parsed) : [];
  const [firstPage = ''] = draft?.pages ?? [];
  const { matchFor, matching, storeId, recordConfirmed } = useReceiptMatches(
    lines.map(line => ({
      index: line.index,
      text: line.printed,
      code: line.code,
    })),
    firstPage.split('\n').slice(0, HEADER_LINES).join('\n') || undefined,
    draft?.parsedBy,
  );

  const added = new Set(draft?.added);
  const chosen = lines.map(line => {
    const explicit = draft?.choices?.[line.index];
    const match = matchFor(line.index);
    const proposal =
      explicit === undefined && match?.preselect
        ? proposedChoice(line, match.preselect)
        : undefined;
    return {
      line,
      match,
      // Null is the user leaving the line out, proposal or not.
      choice: explicit === undefined ? proposal : explicit ?? undefined,
      proposed: !!proposal,
    };
  });
  const pending = chosen.flatMap(({ line, choice }) =>
    choice && !added.has(line.index)
      ? [{ index: line.index, printed: line.printed, choice }]
      : [],
  );
  const openLines = list.unpurchased.items;
  const links = linkReceiptLines(pending, openLines);

  const rows: ReceiptReviewRow[] = chosen.map(
    ({ line, match, choice, proposed }) => ({
      ...line,
      ...(choice ? { choice } : {}),
      proposed,
      ...(match?.guess && !choice ? { guess: match.guess.itemName } : {}),
      candidates: match?.candidates ?? [],
      added: added.has(line.index),
      failure: failures.find(failure => failure.index === line.index)?.reason,
      onList: links.has(line.index),
    }),
  );

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
      {
        // A receipt that printed no readable day was bought the day it was scanned.
        purchasedOn:
          draft?.purchasedOn ??
          toDateKey(draft ? new Date(draft.scannedAt) : new Date()),
        ...(storeId ? { storeId } : {}),
      },
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
    /** The read lines disagree with the receipt's own total: one may be missing. */
    totalsGap: draft?.parsed ? receiptTotalsGap(draft.parsed) : null,
    /** Still asking the API which items the lines are. */
    matching,
    pantryName,
    pendingCount: pending.length,
    applying,
    chooseLine,
    /** The list line a line would tick off with this product and unit, as they are picked. */
    listItemNameFor,
    addChosen,
    finish: clearDraft,
  };
}
