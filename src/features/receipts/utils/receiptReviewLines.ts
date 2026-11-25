import type { ReceiptLineChoice } from '../store/receiptDraftStore';
import type { UnitLabelSource } from '#utils/formatQuantity';
import type { ParsedPackages, ParsedReceipt } from './parsedReceipt';
import { toCents } from './money';

/** One bought product as the review list shows it. */
export interface ReceiptReviewLine {
  index: number;
  /** The product words as printed, else the whole line. */
  printed: string;
  /** What the line bought in plain words, which its match searches by. */
  name?: string;
  /** The barcode or store item number printed on the line. */
  code?: string;
  quantity?: number;
  unit?: string;
  /** The known unit `unit` names, to show in the app's language. */
  measureUnit?: UnitLabelSource;
  /** The packages it bought, when its product prints their size. */
  packages?: ParsedPackages;
  /** What was paid for the line once its discounts are taken off. */
  price?: number;
  /** What its discounts took off, never more than its amount. */
  discount?: number;
}

/**
 * A line as printed, before an item is picked for it: its amount and price. A
 * printed size is its packages' contents, so the line counts the packages.
 */
export const seedChoice = (line: ReceiptReviewLine): ReceiptLineChoice => {
  const base = { itemId: null, itemName: '', unitId: null };
  const price = line.price ?? null;
  if (line.packages) {
    const { count, size } = line.packages;
    return {
      ...base,
      quantity: count,
      unitText: '',
      packageSize: {
        quantity: size.quantity,
        unitId: null,
        unitText: size.unit,
      },
      price,
    };
  }
  return {
    ...base,
    quantity: line.quantity ?? 1,
    unitText: line.unit ?? '',
    price,
  };
};

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
      if (line.name) review.name = line.name;
      if (line.code) review.code = line.code;
      if (line.quantity !== undefined) review.quantity = line.quantity;
      if (line.unit) review.unit = line.unit;
      if (line.measureUnit) review.measureUnit = line.measureUnit;
      if (line.packages) review.packages = line.packages;
      if (line.lineTotal !== undefined) {
        const amount = toCents(line.lineTotal);
        const taken = Math.min(
          discountCents.get(line.index) ?? 0,
          Math.max(0, amount),
        );
        review.price = Math.max(0, amount - taken) / 100;
        if (taken > 0) review.discount = taken / 100;
      }
      return review;
    });
}

/**
 * What the receipt took off the whole order ("$5 off $50"): its discounts that
 * name no line, printed before its total or payment. A savings summary printed
 * after the payment only repeats the line discounts, so it is never counted.
 */
export function orderDiscountOf(receipt: ParsedReceipt): number {
  const end = receipt.lines.findIndex(
    line => line.kind === 'total' || line.kind === 'payment',
  );
  const counted = end === -1 ? receipt.lines : receipt.lines.slice(0, end);
  const cents = counted.reduce(
    (sum, line) =>
      line.kind === 'discount' &&
      line.appliesToIndex === undefined &&
      line.lineTotal !== undefined
        ? sum + Math.abs(toCents(line.lineTotal))
        : sum,
    0,
  );
  return cents / 100;
}
