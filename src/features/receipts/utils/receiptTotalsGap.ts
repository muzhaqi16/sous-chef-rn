import type { ParsedReceipt, ParsedReceiptLine } from './structureReceipt';

/** What the read lines add up to, against what the receipt printed for them. */
export interface ReceiptTotalsGap {
  counted: number;
  printed: number;
}

const cents = (value: number) => Math.round(value * 100);

const firstPriced = (
  lines: readonly ParsedReceiptLine[],
  kind: ParsedReceiptLine['kind'],
) => lines.find(line => line.kind === kind && line.lineTotal !== undefined);

/**
 * The item lines after their discounts, with any fee or deposit printed among
 * them, against the receipt's subtotal (else its total less tax). Null when the
 * receipt prints neither or the two agree to the cent. It only reports: a
 * figure is never changed to make the sum come out.
 */
export function receiptTotalsGap(
  receipt: ParsedReceipt,
): ReceiptTotalsGap | null {
  const { lines } = receipt;
  const firstItem = lines.find(line => line.kind === 'item');
  if (!firstItem) return null;

  const subtotal = firstPriced(lines, 'subtotal');
  const total = firstPriced(lines, 'total');
  const end = subtotal ?? total;
  if (!end?.lineTotal) return null;

  const tax = subtotal
    ? 0
    : lines
        .filter(line => line.kind === 'tax' && line.index < end.index)
        .reduce((sum, line) => sum + cents(line.lineTotal ?? 0), 0);
  const printed = cents(end.lineTotal) - tax;

  let counted = 0;
  for (const line of lines) {
    if (line.index < firstItem.index || line.index >= end.index) continue;
    if (line.lineTotal === undefined) continue;
    if (line.kind === 'discount') counted -= Math.abs(cents(line.lineTotal));
    // A fee or deposit reads as `other`, and the subtotal includes it.
    else if (line.kind === 'item' || line.kind === 'other') {
      counted += cents(line.lineTotal);
    }
  }

  return Math.abs(counted - printed) <= 1
    ? null
    : { counted: counted / 100, printed: printed / 100 };
}
