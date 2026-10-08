import { ReceiptLineKind } from '#/graphql/generated/schemaTypes';
import type { ReceiptParseReadersFragment } from '#/graphql/readers/receiptParseReaders.generated';
import type {
  ParsedLineKind,
  ParsedReceipt,
  ParsedReceiptLine,
} from './parsedReceipt';

type ServerReceipt = Pick<
  NonNullable<ReceiptParseReadersFragment['receipt']>,
  'merchant' | 'lines'
>;
type ServerReceiptLine = ServerReceipt['lines'][number];

// OTHER includes a discount the API found was never taken off (a co-op's
// `Markdown:` under a price that already has it), and a weight or count line
// folded into its item: never subtracted.
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

/** The server's reading in the shape the review reads, as the phone's is. */
export function fromServerReceipt(receipt: ServerReceipt): ParsedReceipt {
  const lines = receipt.lines.map(toLine);
  const merchant = receipt.merchant.name?.trim();
  return merchant ? { merchant, lines } : { lines };
}
