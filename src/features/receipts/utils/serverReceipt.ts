import { ReceiptLineKind } from '#/graphql/generated/schemaTypes';
import { readReceiptLine } from './readReceiptLine';
import type {
  ParsedLineKind,
  ParsedReceipt,
  ParsedReceiptLine,
} from './structureReceipt';

/** A line as the server's receipt parser reads it. */
export interface ServerReceiptLine {
  text: string;
  kind: ReceiptLineKind;
  product?: string | null;
  code?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  /** As printed; a discount is negative. */
  amount?: number | null;
  /** On a discount, the index of the item line it reduces. */
  appliesTo?: number | null;
}

export interface ServerReceipt {
  merchant: { name?: string | null };
  lines: readonly ServerReceiptLine[];
}

// A fee or a deposit reads as `other`, which the totals check counts toward the
// subtotal, as it does for a fee the phone read.
const KIND_OF: Record<ReceiptLineKind, ParsedLineKind> = {
  [ReceiptLineKind.Item]: 'item',
  [ReceiptLineKind.Discount]: 'discount',
  [ReceiptLineKind.Tax]: 'tax',
  [ReceiptLineKind.Subtotal]: 'subtotal',
  [ReceiptLineKind.Total]: 'total',
  [ReceiptLineKind.Payment]: 'payment',
  [ReceiptLineKind.Fee]: 'other',
  [ReceiptLineKind.Deposit]: 'other',
  [ReceiptLineKind.Other]: 'other',
};

const toLine = (line: ServerReceiptLine, index: number): ParsedReceiptLine => ({
  index,
  rawText: line.text,
  kind: KIND_OF[line.kind],
  ...(line.product ? { product: line.product } : {}),
  ...(line.code ? { code: line.code } : {}),
  ...(line.quantity == null ? {} : { quantity: line.quantity }),
  ...(line.unit ? { unit: line.unit } : {}),
  ...(line.unitPrice == null ? {} : { unitPrice: line.unitPrice }),
  ...(line.amount == null ? {} : { lineTotal: line.amount }),
  ...(line.appliesTo == null ? {} : { appliesToIndex: line.appliesTo }),
});

// The server can return a weight or count line as an item of its own with no
// amount (Walmart's `2.21 lb @ 0.46`). One that states a count or weight and
// prints no code describes the item above it, as a detail line does on the
// phone; an amount-less line with a code is a real item whose price was missed.
const foldDetails = (lines: ParsedReceiptLine[]): ParsedReceiptLine[] =>
  lines.map((line, at) => {
    const reading = readReceiptLine(line.rawText);
    const statesAmount =
      line.quantity !== undefined || reading.quantity !== undefined;
    const [above] = lines
      .slice(0, at)
      .reverse()
      .filter(candidate => candidate.kind === 'item');
    if (
      line.kind !== 'item' ||
      line.lineTotal !== undefined ||
      line.code !== undefined ||
      reading.code !== undefined ||
      !statesAmount ||
      !above
    ) {
      return line;
    }
    above.quantity ??= line.quantity ?? reading.quantity;
    above.unit ??= line.unit ?? reading.unit;
    above.unitPrice ??= line.unitPrice ?? reading.unitPrice;
    return {
      index: line.index,
      rawText: line.rawText,
      kind: 'other',
      appliesToIndex: above.index,
    };
  });

/** The server's reading in the shape the review reads, as the phone's is. */
export function fromServerReceipt(receipt: ServerReceipt): ParsedReceipt {
  const lines = foldDetails(receipt.lines.map(toLine));
  const merchant = receipt.merchant.name?.trim();
  return merchant ? { merchant, lines } : { lines };
}
