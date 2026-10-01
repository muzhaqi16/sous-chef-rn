import {
  useReceiptDraftStore,
  type ReceiptLineChoice,
} from '../store/receiptDraftStore';
import {
  receiptReviewLines,
  type ReceiptReviewLine,
} from '../utils/receiptReviewLines';
import { useApplyReceipt } from './useApplyReceipt';

export interface ReceiptReviewRow extends ReceiptReviewLine {
  choice?: ReceiptLineChoice;
  added: boolean;
  /** Why the last attempt to add it failed. */
  failure?: string;
}

/**
 * The saved receipt's item lines, each with what the user chose it to be, and
 * the step that adds the chosen ones to the current pantry.
 */
export function useReceiptReview() {
  const draft = useReceiptDraftStore(state => state.draft);
  const chooseLine = useReceiptDraftStore(state => state.chooseLine);
  const clearDraft = useReceiptDraftStore(state => state.clearDraft);
  const { pantryName, applying, failures, apply } = useApplyReceipt();

  const added = new Set(draft?.added);
  const rows: ReceiptReviewRow[] = (
    draft?.parsed ? receiptReviewLines(draft.parsed) : []
  ).map(line => ({
    ...line,
    choice: draft?.choices?.[line.index],
    added: added.has(line.index),
    failure: failures.find(failure => failure.index === line.index)?.reason,
  }));

  const pending = rows.flatMap(row =>
    row.choice && !row.added ? [{ index: row.index, choice: row.choice }] : [],
  );

  return {
    rows,
    merchant: draft?.parsed?.merchant ?? null,
    pantryName,
    pendingCount: pending.length,
    applying,
    chooseLine,
    addChosen: () => apply(pending),
    finish: clearDraft,
  };
}
