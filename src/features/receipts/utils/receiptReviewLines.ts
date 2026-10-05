import type { ReceiptLineChoice } from '../store/receiptDraftStore';
import type { ParsedReceipt } from './structureReceipt';
import { toCents } from './money';

/** One bought product as the review list shows it. */
export interface ReceiptReviewLine {
  index: number;
  /** The product words as printed, else the whole line. */
  printed: string;
  /** The barcode or store item number printed on the line. */
  code?: string;
  quantity?: number;
  unit?: string;
  /** What was paid for the line once its discounts are taken off. */
  price?: number;
}

/** A line as printed, before an item is picked for it: its amount and price. */
export const seedChoice = (line: ReceiptReviewLine): ReceiptLineChoice => ({
  itemId: null,
  itemName: '',
  quantity: line.quantity ?? 1,
  unitId: null,
  unitText: line.unit ?? '',
  price: line.price ?? null,
});

/** The receipt's item lines, each priced after the discounts that name it. */
export function receiptReviewLines(
  receipt: ParsedReceipt,
): ReceiptReviewLine[] {
  const discountCents = new Map<number, number>();
  for (const line of receipt.lines) {
    if (
      line.kind !== 'discount' ||
      line.appliesToIndex === undefined ||
      line.lineTotal === undefined
    ) {
      continue;
    }
    // Printed either way round: `0.50-` reads as negative, `SAVINGS 0.50` as positive.
    const taken = Math.abs(toCents(line.lineTotal));
    discountCents.set(
      line.appliesToIndex,
      (discountCents.get(line.appliesToIndex) ?? 0) + taken,
    );
  }

  return receipt.lines
    .filter(line => line.kind === 'item')
    .map(line => {
      const review: ReceiptReviewLine = {
        index: line.index,
        printed: line.product ?? line.rawText,
      };
      if (line.code) review.code = line.code;
      if (line.quantity !== undefined) review.quantity = line.quantity;
      if (line.unit) review.unit = line.unit;
      if (line.lineTotal !== undefined) {
        const paid =
          toCents(line.lineTotal) - (discountCents.get(line.index) ?? 0);
        review.price = Math.max(0, paid) / 100;
      }
      return review;
    });
}
