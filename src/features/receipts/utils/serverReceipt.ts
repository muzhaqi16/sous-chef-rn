import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import {
  ReceiptLineKind,
  ReceiptParseStatus,
  ReceiptParseWarningCode,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import { todayKey } from '#/utils/dateUtils';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { getRateLimitDetails } from '#/utils/errors/rateLimit';
import { isAuthRefusalCode } from '#/utils/authErrorCodes';
import type { ReceiptParseQuery } from '../hooks/useServerReceiptParse.generated';
import type {
  PrintedStore,
  ServerParseOutcome,
} from '../store/receiptDraftStore';
import { isPlausibleReceiptDay } from './receiptDate';
import { receiptReviewLines } from './receiptReviewLines';
import type { ReceiptTotalsGap } from './receiptTotalsGap';
import type { ReceiptParseReadersFragment } from '#/graphql/readers/receiptParseReaders.generated';
import { readReceiptLine, type ReceiptLineReading } from './readReceiptLine';
import { foldDetail, hasProductWords } from './structureReceipt';
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

/** A line with what its printed text states, read once. */
interface Working extends ParsedReceiptLine {
  reading: ReceiptLineReading;
}

// OTHER includes a discount the API found was never taken off (a co-op's
// `Markdown:` under a price that already has it): never subtracted.
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

// The figures come from the printed text, as they do for the phone's labels,
// and the server's only where the text states none: it has priced a line with
// the next row's amount (`BANANAS ... 1.02 R` as 4.94).
const toLine = (line: ServerReceiptLine, index: number): Working => {
  const reading = readReceiptLine(line.text);
  const amount = reading.amount ?? line.amount ?? undefined;
  const quantity = reading.quantity ?? line.quantity ?? undefined;
  const unitPrice = reading.unitPrice ?? line.unitPrice ?? undefined;
  // The server keeps only printed codes and measures (`normalizeLines`); a code
  // it was not given is read from the text.
  const unit = reading.unit ?? line.unit ?? undefined;
  const code = line.code ?? reading.code;
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

type ServerParse = NonNullable<ReceiptParseQuery['receiptParse']>;

const PASSING_CODES: readonly string[] = [
  TopLevelErrorCode.InternalServerError,
  TopLevelErrorCode.ServiceUnavailable,
];

// A traffic limit on the connection and a request that timed out say nothing
// about this receipt.
const PASSING_STATUSES: readonly number[] = [401, 408, 429];

/**
 * Whether a failed ask is the API's answer on this receipt, which stands. One
 * that never arrived, a server fault, a traffic limit and a session mid-refresh
 * are not: the same ask may well succeed when sent again.
 */
export function isVerdict(error: unknown): boolean {
  if (ServerError.is(error)) {
    return (
      error.statusCode < 500 && !PASSING_STATUSES.includes(error.statusCode)
    );
  }
  if (!CombinedGraphQLErrors.is(error)) return false;
  return error.errors.every(({ extensions }) => {
    const code = extensions?.code;
    return (
      typeof code === 'string' &&
      !PASSING_CODES.includes(code) &&
      !isAuthRefusalCode(code)
    );
  });
}

/**
 * The server's verdict that its lines do not add up to the receipt. A mismatch
 * without figures predates the API's discount rule, which counted a receipt's
 * savings summary as discounts: it is not shown.
 */
function totalsGapOf(
  warnings: ServerParse['warnings'],
): ReceiptTotalsGap | undefined {
  const mismatch = warnings.find(
    warning => warning.code === ReceiptParseWarningCode.TotalsMismatch,
  );
  if (mismatch?.counted == null || mismatch.printed == null) return undefined;
  return { counted: mismatch.counted, printed: mismatch.printed };
}

/** The shop the parse read, when it read a name. */
function printedStoreOf({
  name,
  address,
  storeNumber,
}: NonNullable<ServerParse['receipt']>['merchant']): PrintedStore | undefined {
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

/** What a finished parse leaves on the draft; nothing while it runs. */
export function outcomeOf(parse: ServerParse): ServerParseOutcome | undefined {
  switch (parse.status) {
    case ReceiptParseStatus.Pending:
      return undefined;
    case ReceiptParseStatus.Failed:
      return 'failed';
    case ReceiptParseStatus.Unavailable:
      return 'unavailable';
    case ReceiptParseStatus.Parsed: {
      const { receipt } = parse;
      const lowText = parse.warnings.some(
        warning => warning.code === ReceiptParseWarningCode.LowText,
      );
      const parsed = receipt ? fromServerReceipt(receipt) : null;
      // Never an empty review: too little text to read is a retake.
      if (!receipt || !parsed || lowText) return 'unreadable';
      if (receiptReviewLines(parsed).length === 0) return 'unreadable';
      const totalsGap = totalsGapOf(parse.warnings);
      const printedStore = printedStoreOf(receipt.merchant);
      // Held to the phone's own window: a misread day would date the prices
      // and the shelf life, and the API refuses one after tomorrow.
      const purchasedOn =
        receipt.purchasedOn &&
        isPlausibleReceiptDay(receipt.purchasedOn, todayKey())
          ? receipt.purchasedOn
          : undefined;
      return {
        parsed,
        ...(purchasedOn ? { purchasedOn } : {}),
        ...(totalsGap ? { totalsGap } : {}),
        ...(printedStore ? { printedStore } : {}),
      };
    }
  }
}

const isUpgradeRequired = (error: unknown) =>
  CombinedGraphQLErrors.is(error) &&
  error.errors.some(
    ({ extensions }) =>
      extensions?.code === TopLevelErrorCode.ClientUpgradeRequired,
  );

/**
 * What to do with the answer to an ask: poll a parse still running, settle the
 * draft with a verdict, resend an ask that got none, or wait for the next
 * visit, as an app the API wants updated must.
 */
export type CreateResult =
  | { kind: 'poll' }
  | {
      kind: 'settle';
      outcome: ServerParseOutcome | { retryAt: string };
    }
  | { kind: 'resend' }
  | { kind: 'later' };

export function classifyCreateResult(
  {
    accepted,
    parse,
    refusedField,
    error,
  }: {
    accepted: boolean;
    /** The parse the payload wrote to the cache, if it did. */
    parse: ServerParse | null;
    refusedField: string | null;
    error: unknown;
  },
  now = Date.now(),
): CreateResult {
  if (accepted) {
    const outcome = parse ? outcomeOf(parse) : undefined;
    return outcome === undefined
      ? { kind: 'poll' }
      : { kind: 'settle', outcome };
  }
  // Every refusal on `pages` is a size bound: the scan caps the pages at ten,
  // so it is the character limit, which only the API knows.
  if (refusedField === 'pages') return { kind: 'settle', outcome: 'tooLong' };
  const retryAfter = getRateLimitDetails(error)?.retryAfter;
  // The daily allowance is asked again once it says.
  if (retryAfter && retryAfter > 0) {
    const retryAt = new Date(now + retryAfter * 1000).toISOString();
    return { kind: 'settle', outcome: { retryAt } };
  }
  if (isUpgradeRequired(error)) return { kind: 'later' };
  // A refusal, in the payload or not, stands, as UNAVAILABLE does.
  if (error === undefined || isVerdict(error)) {
    return { kind: 'settle', outcome: 'unavailable' };
  }
  return { kind: 'resend' };
}
