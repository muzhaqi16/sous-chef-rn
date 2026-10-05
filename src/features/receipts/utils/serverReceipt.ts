import { ReceiptLineKind } from '#/graphql/generated/schemaTypes';
import type { ReceiptParseReadersFragment } from '#/graphql/readers/receiptParseReaders.generated';
import { readReceiptLine, type ReceiptLineReading } from './readReceiptLine';
import { NOT_BEFORE_PACK_UNIT, RECEIPT_UNIT } from './receiptMeasures';
import {
  foldDetail,
  hasProductWords,
  type ParsedLineKind,
  type ParsedReceipt,
  type ParsedReceiptLine,
} from './structureReceipt';

type ServerReceipt = Pick<
  NonNullable<ReceiptParseReadersFragment['receipt']>,
  'merchant' | 'lines'
>;
type ServerReceiptLine = ServerReceipt['lines'][number];

/** A line with what its printed text states, read once. */
interface Working extends ParsedReceiptLine {
  reading: ReceiptLineReading;
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

// A product code as printed, less a tax flag run into it (`000000040110KF`) but
// not a pack size (`1500G`). The server has returned a line's price (`4.94`) as
// its code.
const PRINTED_CODE = new RegExp(
  `^(\\d{4,14})${NOT_BEFORE_PACK_UNIT}[A-Z]{0,2}$`,
  'i',
);

const codeOf = (line: ServerReceiptLine, printed: string | undefined) =>
  PRINTED_CODE.exec(line.code?.trim() ?? '')?.[1] ?? printed;

// The figures come from the printed text, as they do for the phone's labels,
// and the server's only where the text states none: it has priced a line with
// the next row's amount (`BANANAS ... 1.02 R` as 4.94).
const toLine = (line: ServerReceiptLine, index: number): Working => {
  const reading = readReceiptLine(line.text);
  const amount = reading.amount ?? line.amount ?? undefined;
  const quantity = reading.quantity ?? line.quantity ?? undefined;
  const unitPrice = reading.unitPrice ?? line.unitPrice ?? undefined;
  // The server has returned a line's tax flag (`R`) as its unit.
  const unit =
    reading.unit ??
    (line.unit && RECEIPT_UNIT.test(line.unit) ? line.unit : undefined);
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
    reading,
  };
};

// The server can return the weight or count line under an item as an item of
// its own (Walmart's `2.21 lb @ 0.46`). One that prints a count or weight (the
// server gives every item a quantity), no product words and no code describes
// the item above, as a detail line does on the phone: that item takes its
// figures, and the line is not counted. A folded line is never described.
const foldDetails = (lines: Working[]): Working[] => {
  let above: Working | undefined;
  const described = new Set<Working>();
  return lines.map(line => {
    if (line.kind !== 'item') return line;
    if (
      line.code !== undefined ||
      line.reading.quantity === undefined ||
      hasProductWords(line.rawText) ||
      !above
    ) {
      above = line;
      return line;
    }
    if (described.has(above)) {
      // A second detail line fills in only what the first left unstated.
      above.unit ??= line.unit;
      above.unitPrice ??= line.unitPrice;
      above.lineTotal ??= line.lineTotal;
    } else {
      // As on the phone, the weight line states the item's amount, over the 1
      // the server gives an item it has no count for.
      described.add(above);
      foldDetail(above, line);
    }
    return {
      index: line.index,
      rawText: line.rawText,
      kind: 'other',
      appliesToIndex: above.index,
      reading: line.reading,
    };
  });
};

// On a skewed photo the server has priced the last item, which printed no
// price, with the subtotal printed below it. An item does not cost the whole
// receipt unless it is the only item, or its own line prints that amount.
const dropSumsAsPrices = (lines: Working[]): Working[] => {
  const items = lines.filter(line => line.kind === 'item');
  if (items.length < 2) return lines;
  const sums = new Set(
    lines
      .filter(line => line.kind === 'subtotal' || line.kind === 'total')
      .map(line => line.lineTotal),
  );
  return lines.map(line => {
    if (
      line.kind !== 'item' ||
      !sums.has(line.lineTotal) ||
      line.reading.amount !== undefined
    ) {
      return line;
    }
    const { lineTotal: _sum, ...unpriced } = line;
    return unpriced;
  });
};

/** The server's reading in the shape the review reads, as the phone's is. */
export function fromServerReceipt(receipt: ServerReceipt): ParsedReceipt {
  const lines = dropSumsAsPrices(foldDetails(receipt.lines.map(toLine))).map(
    ({ reading: _reading, ...line }) => line,
  );
  const merchant = receipt.merchant.name?.trim();
  return merchant ? { merchant, lines } : { lines };
}
