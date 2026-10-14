import {
  ReceiptParseStatus,
  ReceiptParseWarningCode,
} from '#/graphql/generated/schemaTypes';
import { todayKey } from '#/utils/dateUtils';
import {
  dailyAllowanceWait,
  isUpgradeRequired,
  isVerdict,
} from '#domain/serverJobRefusals';
import { firstNonBlank } from '#/utils/firstNonBlank';
import type { ReceiptParseQuery } from '../hooks/useServerReceiptParse.generated';
import type {
  PrintedStore,
  ServerParseOutcome,
} from '../store/receiptDraftStore';
import { isPlausibleReceiptDay } from './receiptDate';
import { receiptReviewLines } from './receiptReviewLines';
import type { ReceiptTotalsGap } from './receiptTotalsGap';
import { fromServerReceipt } from './fromServerReceipt';

type ServerParse = NonNullable<ReceiptParseQuery['receiptParse']>;

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
  const retryAfter = dailyAllowanceWait(error);
  // The daily allowance is asked again once it says.
  if (retryAfter !== null) {
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
