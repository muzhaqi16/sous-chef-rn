import { ReceiptLineKind } from '#/graphql/generated/schemaTypes';
import { readReceiptLine } from './readReceiptLine';
import {
  hasProductWords,
  type ParsedLineKind,
  type ParsedReceipt,
  type ParsedReceiptLine,
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

// A unit the review can show and the API can take: the server has returned a
// line's tax flag (`R`) as its unit.
const MEASURE =
  /^(?:lbs?|kg|g|oz|fl\.?\s?oz|l|ml|ct|ea|each|pk|pkg|gal|qt|pt|dz|doz)$/i;

// A product code as printed, less a tax flag run into it (`000000040110KF`).
// The server has returned a line's price (`4.94`) as its code.
const PRINTED_CODE = /^(\d{4,14})[A-Z]{0,2}$/;

const codeOf = (line: ServerReceiptLine, printed: string | undefined) =>
  PRINTED_CODE.exec(line.code?.trim() ?? '')?.[1] ?? printed;

// The figures come from the printed text, as they do for the phone's labels,
// and the server's only where the text states none: it has priced a line with
// the next row's amount (`BANANAS ... 1.02 R` as 4.94).
const toLine = (line: ServerReceiptLine, index: number): ParsedReceiptLine => {
  const reading = readReceiptLine(line.text);
  const amount = reading.amount ?? line.amount ?? undefined;
  const quantity = reading.quantity ?? line.quantity ?? undefined;
  const unitPrice = reading.unitPrice ?? line.unitPrice ?? undefined;
  const unit =
    reading.unit ??
    (line.unit && MEASURE.test(line.unit) ? line.unit : undefined);
  const code = codeOf(line, reading.code);
  return {
    index,
    rawText: line.text,
    kind: KIND_OF[line.kind],
    ...(line.product ? { product: line.product } : {}),
    ...(code ? { code } : {}),
    ...(quantity === undefined ? {} : { quantity }),
    ...(unit ? { unit } : {}),
    ...(unitPrice === undefined ? {} : { unitPrice }),
    ...(amount === undefined ? {} : { lineTotal: amount }),
    ...(line.appliesTo == null ? {} : { appliesToIndex: line.appliesTo }),
  };
};

// The server can return the weight or count line under an item as an item of
// its own (Walmart's `2.21 lb @ 0.46`), with or without an amount. One that
// states a count or weight, names no product and prints no code describes the
// item above it, as a detail line does on the phone: that item takes its
// figures, and the line is not counted toward the subtotal.
const foldDetails = (lines: ParsedReceiptLine[]): ParsedReceiptLine[] =>
  lines.map((line, at) => {
    const [above] = lines
      .slice(0, at)
      .reverse()
      .filter(candidate => candidate.kind === 'item');
    if (
      line.kind !== 'item' ||
      line.code !== undefined ||
      line.quantity === undefined ||
      hasProductWords(line.rawText) ||
      !above
    ) {
      return line;
    }
    // As on the phone, the weight line states the item's amount, over the 1
    // the server gives an item it has no count for.
    above.quantity = line.quantity;
    if (line.unit) above.unit = line.unit;
    if (line.unitPrice !== undefined) above.unitPrice = line.unitPrice;
    above.lineTotal ??= line.lineTotal;
    return {
      index: line.index,
      rawText: line.rawText,
      kind: 'other',
      appliesToIndex: above.index,
    };
  });

// On a skewed photo the server has priced the last item, which printed no
// price, with the subtotal printed below it. An item does not cost the whole
// receipt unless it is the only item.
const dropSumsAsPrices = (lines: ParsedReceiptLine[]): ParsedReceiptLine[] => {
  const items = lines.filter(line => line.kind === 'item');
  if (items.length < 2) return lines;
  const sums = new Set(
    lines
      .filter(line => line.kind === 'subtotal' || line.kind === 'total')
      .map(line => line.lineTotal),
  );
  return lines.map(line => {
    if (line.kind !== 'item' || !sums.has(line.lineTotal)) return line;
    const { lineTotal: _sum, ...unpriced } = line;
    return unpriced;
  });
};

/** The server's reading in the shape the review reads, as the phone's is. */
export function fromServerReceipt(receipt: ServerReceipt): ParsedReceipt {
  const lines = dropSumsAsPrices(foldDetails(receipt.lines.map(toLine)));
  const merchant = receipt.merchant.name?.trim();
  return merchant ? { merchant, lines } : { lines };
}
