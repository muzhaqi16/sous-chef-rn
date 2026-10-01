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

export interface ReceiptReviewRow extends ReceiptReviewLine {
  choice?: ReceiptLineChoice;
  added: boolean;
  /** Why the last attempt to add it failed. */
  failure?: string;
  /** Adding it ticks a shopping-list line off rather than adding it again. */
  onList: boolean;
}

/**
 * The saved receipt's item lines, each with what the user chose it to be and
 * the open line of the active shopping list it matches, and the step that adds
 * the chosen ones to the current pantry.
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

  const added = new Set(draft?.added);
  const lines = draft?.parsed ? receiptReviewLines(draft.parsed) : [];
  const pending = lines.flatMap(line => {
    const choice = draft?.choices?.[line.index];
    return choice && !added.has(line.index)
      ? [{ index: line.index, choice }]
      : [];
  });
  const openLines = list.unpurchased.items;
  const links = linkReceiptLines(pending, openLines);

  const rows: ReceiptReviewRow[] = lines.map(line => ({
    ...line,
    choice: draft?.choices?.[line.index],
    added: added.has(line.index),
    failure: failures.find(failure => failure.index === line.index)?.reason,
    onList: links.has(line.index),
  }));

  // Every other row keeps its link, so a line never shows one already taken.
  const listItemNameFor = (index: number, key: ListMatchKey) => {
    const held = new Set(
      [...links].flatMap(([other, line]) => (other === index ? [] : [line])),
    );
    const open = openLines.filter(line => !held.has(line));
    return listLineFor(key, open)?.itemName ?? undefined;
  };

  return {
    rows,
    merchant: draft?.parsed?.merchant ?? null,
    /** The read lines disagree with the receipt's own total: one may be missing. */
    totalsGap: draft?.parsed ? receiptTotalsGap(draft.parsed) : null,
    pantryName,
    pendingCount: pending.length,
    applying,
    chooseLine,
    /** The list line a line would tick off with this product and unit, as they are picked. */
    listItemNameFor,
    addChosen: () =>
      apply(
        pending.map(line => ({ ...line, listLine: links.get(line.index) })),
      ),
    finish: clearDraft,
  };
}
