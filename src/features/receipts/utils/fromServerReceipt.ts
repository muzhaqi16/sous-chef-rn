import { ReceiptLineKind } from '#/graphql/generated/schemaTypes';
import type { ReceiptParseReadersFragment } from '#/graphql/readers/receiptParseReaders.generated';
import { firstNonBlank } from '#/utils/firstNonBlank';
import type { PrintedStore } from '../store/receiptDraftStore';
import type {
  ParsedLineKind,
  ParsedReceipt,
  ParsedReceiptLine,
} from './parsedReceipt';

type ServerReceipt = NonNullable<ReceiptParseReadersFragment['receipt']>;
type ServerReceiptLine = ServerReceipt['lines'][number];

/**
 * A receipt in the API's shape: a server parse's, or the shared rules' reading
 * on the phone, whose kinds are the enum's values as plain strings.
 */
interface ApiReceipt {
  merchant: Pick<ServerReceipt['merchant'], 'name'>;
  lines: readonly (Omit<ServerReceiptLine, '__typename' | 'kind'> & {
    kind: `${ReceiptLineKind}`;
  })[];
}
type ApiReceiptLine = ApiReceipt['lines'][number];

// OTHER includes a discount the API found was never taken off (a co-op's
// `Markdown:` under a price that already has it), and a weight or count line
// folded into its item: never subtracted.
const KIND_OF: Record<`${ReceiptLineKind}`, ParsedLineKind> = {
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

const toLine = (line: ApiReceiptLine, index: number): ParsedReceiptLine => ({
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

/** The API's reading, the server's or the rules' on the phone, in the shape the review reads. */
export function fromServerReceipt(receipt: ApiReceipt): ParsedReceipt {
  const lines = receipt.lines.map(toLine);
  const merchant = receipt.merchant.name?.trim();
  return merchant ? { merchant, lines } : { lines };
}

/** The shop a reading read, the server's or the rules' on the phone, when it read a name. */
export function printedStoreOf({
  name,
  address,
  storeNumber,
}: Pick<ServerReceipt['merchant'], 'name' | 'address' | 'storeNumber'>):
  | PrintedStore
  | undefined {
  const named = firstNonBlank(name);
  if (!named) return undefined;
  const printedAddress = firstNonBlank(address);
  const printedNumber = firstNonBlank(storeNumber);
  return {
    name: named.trim(),
    ...(printedAddress ? { address: printedAddress } : {}),
    ...(printedNumber ? { storeNumber: printedNumber } : {}),
  };
}
