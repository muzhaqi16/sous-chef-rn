import type {
  LabeledLine,
  ReceiptLineLabel,
  ReceiptLineLabels,
} from '#/native/ReceiptStructuring';
import {
  readReceiptLine,
  withoutAmount,
  type ReceiptLineReading,
} from './readReceiptLine';

export type ParsedLineKind =
  | 'item'
  | 'discount'
  | 'tax'
  | 'subtotal'
  | 'total'
  | 'payment'
  | 'other';

export interface ParsedReceiptLine {
  index: number;
  rawText: string;
  kind: ParsedLineKind;
  product?: string;
  code?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  /** A discount's item, or the item a weight or count line describes. */
  appliesToIndex?: number;
}

export interface ParsedReceipt {
  merchant?: string;
  lines: ParsedReceiptLine[];
}

// The printed words decide these whatever the model said.
const PRINTED_KIND: readonly [RegExp, ParsedLineKind][] = [
  [/^\W*SUB\s*-?\s*TOTAL\b/i, 'subtotal'],
  [/^\W*(?:(?:TOTAL|BALANCE)(?:\s+DUE)?|AMOUNT\s+DUE)\b/i, 'total'],
  [/^\W*(?:SALES\s+)?TAX\b/i, 'tax'],
];

const PRODUCT_WORD = /[A-Za-z]{3,}/;

// A price alone on its row: ALDI's `6.19` under `2 x` beef, or a skewed photo's
// price column read apart from its names.
const PRICE_ONLY = /^\W*\$?\d{1,6}[.,]\d{2}\s*[A-Z]{0,2}\W*$/i;

const printedKind = (text: string) =>
  PRINTED_KIND.find(([pattern]) => pattern.test(text))?.[1];

const KIND_OF_LABEL: Record<ReceiptLineLabel, ParsedLineKind | 'detail'> = {
  item: 'item',
  itemDetail: 'detail',
  discount: 'discount',
  tax: 'tax',
  subtotal: 'subtotal',
  total: 'total',
  payment: 'payment',
  header: 'other',
  other: 'other',
};

const cents = (value: number) => Math.round(value * 100);

// The model copies the printed words, so Costco's `E 1234567 KS WATER` keeps
// its tax flag and item number, and a Walmart line its price and the flag after
// its code; all are read from the line on their own.
const cleanProduct = (product: string, code: string | undefined) => {
  const priceless = withoutAmount(product);
  // A flag follows the code only at the line's end; elsewhere a short word
  // after it is the name's (Costco's `KS`).
  return (
    code
      ? priceless
          .replace(new RegExp(`${code}(?:\\s+[A-Z]{1,2})?\\s*$`), '')
          .replace(code, ' ')
      : priceless
  )
    .replace(/^\s*[A-Z]\s+(?=\S)/, '')
    .replace(/\s+/g, ' ')
    .trim();
};

interface Working extends ParsedReceiptLine {
  reading: ReceiptLineReading;
  isDetail: boolean;
}

function kindOf(
  text: string,
  reading: ReceiptLineReading,
  label: ReceiptLineLabel | undefined,
): ParsedLineKind | 'detail' {
  const printed = printedKind(text);
  if (printed) return printed;
  if (reading.amount !== undefined && reading.amount < 0) return 'discount';
  // A count or weight is never a saving, whatever the model called it.
  if (label === 'discount' && reading.quantity !== undefined) return 'detail';
  const kind = label ? KIND_OF_LABEL[label] : 'other';
  if (PRICE_ONLY.test(text) && (kind === 'item' || kind === 'other')) {
    return 'detail';
  }
  // The model calls many priced product lines details (ALDI's `Dark Red Kidney
  // 0.81 FA`); a detail states a count or weight, or no words at all.
  if (
    label === 'itemDetail' &&
    reading.amount !== undefined &&
    reading.quantity === undefined &&
    PRODUCT_WORD.test(text)
  ) {
    return 'item';
  }
  return kind;
}

/**
 * The item a count or weight line describes: the one its price multiplies to,
 * else the one above still missing its total, else the one below still missing
 * it (Fanzz prints the price line above the product name).
 */
function detailTarget(
  lines: readonly Working[],
  detail: Working,
): Working | undefined {
  const nearby = lines.filter(
    line => line.kind === 'item' && Math.abs(line.index - detail.index) <= 2,
  );
  const { quantity, unitPrice } = detail.reading;
  if (quantity !== undefined && unitPrice !== undefined) {
    const expected = cents(quantity * unitPrice);
    const byArithmetic = nearby.find(
      line =>
        line.lineTotal !== undefined && cents(line.lineTotal) === expected,
    );
    if (byArithmetic) return byArithmetic;
  }
  const above = nearby
    .filter(line => line.index < detail.index)
    .reverse()
    .find(line => line.lineTotal === undefined || line.quantity === undefined);
  return (
    above ??
    nearby.find(
      line => line.index > detail.index && line.lineTotal === undefined,
    )
  );
}

const comparable = (text: string) =>
  text.replace(/\s+/g, ' ').trim().toUpperCase();

/**
 * Each label on the line it describes. The model numbers lines itself and can
 * drift from the numbers it was given (a Walmart receipt's every label two lines
 * early), so a label lands where its copied product words are printed, nearest
 * the current drift; one without them keeps the drift of the label before it.
 */
function alignLabels(
  lines: readonly string[],
  labels: ReceiptLineLabels,
): Map<number, LabeledLine> {
  const aligned = new Map<number, LabeledLine>();
  let drift = 0;
  for (const label of [...labels.lines].sort((a, b) => a.line - b.line)) {
    const product = label.product ? comparable(label.product) : '';
    if (product.length >= 3) {
      const found = [drift, 0, 1, -1, 2, -2, 3, -3].find(offset =>
        comparable(lines[label.line + offset] ?? '').includes(product),
      );
      if (found !== undefined) drift = found;
    }
    const index = label.line + drift;
    if (index >= 0 && index < lines.length && !aligned.has(index)) {
      aligned.set(index, label);
    }
  }
  return aligned;
}

/**
 * The lines worth labelling: through the first printed total, as no item
 * follows it, else all of them. A footer's sweepstakes text can make Apple's
 * model refuse the whole receipt (docs/verified-library-behaviour.md).
 */
export function linesThroughTotal(lines: readonly string[]): string[] {
  const end = lines.findIndex(
    line =>
      printedKind(line) === 'total' &&
      readReceiptLine(line).amount !== undefined,
  );
  return end === -1 ? [...lines] : lines.slice(0, end + 1);
}

/**
 * Turns the model's line labels and each line's own figures into a receipt.
 * The figures always come from the printed text, never from the model.
 */
export function structureReceipt(
  lines: readonly string[],
  labels: ReceiptLineLabels,
): ParsedReceipt {
  const labelAt = alignLabels(lines, labels);

  const working: Working[] = lines.map((rawText, index) => {
    const reading = readReceiptLine(rawText);
    const labeled = labelAt.get(index);
    const kind = kindOf(rawText, reading, labeled?.label);
    const line: Working = {
      index,
      rawText,
      kind: kind === 'detail' ? 'other' : kind,
      reading,
      isDetail: kind === 'detail',
    };
    if (reading.code) line.code = reading.code;
    if (kind === 'item') {
      const product = labeled?.product
        ? cleanProduct(labeled.product, reading.code)
        : '';
      if (product) line.product = product;
      if (reading.amount !== undefined) line.lineTotal = reading.amount;
      if (reading.quantity !== undefined) line.quantity = reading.quantity;
      if (reading.unit) line.unit = reading.unit;
      if (reading.unitPrice !== undefined) line.unitPrice = reading.unitPrice;
    } else if (reading.amount !== undefined) {
      line.lineTotal = reading.amount;
    }
    return line;
  });

  for (const detail of working.filter(line => line.isDetail)) {
    const item = detailTarget(working, detail);
    if (!item) continue;
    detail.appliesToIndex = item.index;
    const { quantity, unit, unitPrice, amount } = detail.reading;
    if (quantity !== undefined) item.quantity = quantity;
    if (unit) item.unit = unit;
    if (unitPrice !== undefined) item.unitPrice = unitPrice;
    if (amount !== undefined && item.lineTotal === undefined) {
      item.lineTotal = amount;
    }
    // The figures moved to the item, so the detail line is not summed twice.
    delete detail.lineTotal;
  }

  for (const discount of working.filter(line => line.kind === 'discount')) {
    const earlier = working.filter(
      line => line.kind === 'item' && line.index < discount.index,
    );
    const byCode = discount.code
      ? earlier.find(line => line.code === discount.code)
      : undefined;
    const target = byCode ?? earlier.at(-1);
    if (target) discount.appliesToIndex = target.index;
  }

  const merchant =
    labels.storeName ??
    working.find(line => labelAt.get(line.index)?.label === 'header')?.rawText;
  const parsed = working.map(
    ({ reading: _reading, isDetail: _isDetail, ...line }) => line,
  );
  return merchant ? { merchant, lines: parsed } : { lines: parsed };
}

/**
 * Worth keeping: the model placed nearly every line, and at least one item has
 * a price. Anything less goes back to the draft's plain text.
 */
export function isUsableReceipt(
  parsed: ParsedReceipt,
  labels: ReceiptLineLabels,
): boolean {
  const placed = new Set(labels.lines.map(line => line.line)).size;
  const covered = parsed.lines.length === 0 ? 0 : placed / parsed.lines.length;
  return (
    covered >= 0.9 &&
    parsed.lines.some(
      line => line.kind === 'item' && line.lineTotal !== undefined,
    )
  );
}
