import {
  checkReading,
  readReceipt,
  type DateOrder,
  type ReceiptLine,
  type ReceiptRead,
  type RulesReading,
} from '@muzhaqi16/receipt-rules';
import type { PrintedStore } from '../store/receiptDraftStore';
import { fromServerReceipt, printedStoreOf } from './fromServerReceipt';
import type {
  ParsedLineKind,
  ParsedReceipt,
  ReceiptTotalsGap,
} from './parsedReceipt';
import { receiptReviewLines } from './receiptReviewLines';

/** A reading made on the phone, judged by the rules the server reads with. */
export interface PhoneReading {
  /** Its lines meet a subtotal or total the receipt prints after them. */
  accepted: boolean;
  parsed: ParsedReceipt;
  printedStore?: PrintedStore;
  /** What the lines add up to, against the printed figure they miss. */
  totalsGap?: ReceiptTotalsGap;
}

// Null when it reads no line the review shows.
const asKept = (reading: RulesReading): PhoneReading | null => {
  const parsed = fromServerReceipt(reading.receipt);
  if (receiptReviewLines(parsed).length === 0) return null;
  const printedStore = printedStoreOf(reading.receipt.merchant);
  const totalsGap =
    !reading.accepted && reading.reason === 'TOTALS_MISMATCH'
      ? { counted: reading.counted, printed: reading.printed }
      : undefined;
  return {
    accepted: reading.accepted,
    parsed,
    ...(printedStore ? { printedStore } : {}),
    ...(totalsGap ? { totalsGap } : {}),
  };
};

/**
 * A scan's redacted pages read by the rules, the text their corpus holds. The
 * day is not taken from it: the draft's is read before redaction.
 */
export function readOnPhone(
  pages: readonly string[],
  today: string,
  order: DateOrder,
): PhoneReading | null {
  return asKept(readReceipt(pages, { today, order }));
}

const KIND_OF: Record<ParsedLineKind, ReceiptLine['kind']> = {
  item: 'ITEM',
  discount: 'DISCOUNT',
  tax: 'TAX',
  subtotal: 'SUBTOTAL',
  total: 'TOTAL',
  payment: 'PAYMENT',
  other: 'OTHER',
};

const toReceiptRead = ({ merchant, lines }: ParsedReceipt): ReceiptRead => ({
  merchant: { name: merchant ?? null, storeNumber: null, address: null },
  purchasedOn: null,
  currency: null,
  lines: lines.map(line => ({
    text: line.rawText,
    kind: KIND_OF[line.kind],
    product: line.product ?? null,
    code: line.code ?? null,
    quantity: line.quantity ?? null,
    unit: line.unit ?? null,
    unitPrice: line.unitPrice ?? null,
    amount: line.lineTotal ?? null,
    appliesTo: line.appliesToIndex ?? null,
  })),
});

/**
 * The phone's model's reading of the same pages, held to the rules' check:
 * settled as theirs is, with each discount linked only where the print shows
 * its item.
 */
export function checkOnPhone(
  parsed: ParsedReceipt,
  pages: readonly string[],
): PhoneReading | null {
  return asKept(checkReading(toReceiptRead(parsed), pages));
}
