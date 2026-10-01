import type { ParsedReceipt } from './structureReceipt';

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

const cents = (value: number) => Math.round(value * 100);

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
    const taken = Math.abs(cents(line.lineTotal));
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
          cents(line.lineTotal) - (discountCents.get(line.index) ?? 0);
        review.price = Math.max(0, paid) / 100;
      }
      return review;
    });
}
