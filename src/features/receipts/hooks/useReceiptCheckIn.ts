import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import {
  AcquisitionMethod,
  ErrorCode,
  type CreateReceiptCheckInInput,
  type ReceiptCheckInLineInput,
} from '#/graphql/generated/schemaTypes';
import type { ShoppingListItemNode } from '#features/shoppingList/hooks/usePaginatedShoppingItems';
import {
  localIntakeRow,
  writeLocalIntake,
} from '#features/pantry/cache/localIntake';
import { writeLocalMove } from '#features/shoppingList/cache/localMove';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { todayKey } from '#/utils/dateUtils';
import { errorService } from '#/services/errorService';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { useTranslation } from '#/i18n';
import { useReceiptDraftActions } from '../store/receiptDraftStore';
import {
  applyReceiptCheckIn,
  type CheckInLineResult,
  type WrittenLine,
} from '../offline/receiptCheckIn';
import { CreateReceiptCheckInDocument } from './useReceiptCheckIn.generated';
import { cappedNames } from '#/utils/cappedNames';

/** The API's cap on one check-in: a longer receipt goes as several. */
export const LINES_PER_CHECK_IN = 100;

/** The error ids a failed check-in reports, for support to look up. */
const REPORTED_ERROR_IDS = 3;

/** A confirmed line, as the check-in sends it and the device shows it. */
export interface CheckInLineToSend {
  index: number;
  input: ReceiptCheckInLineInput;
  /** The name its pantry row shows until the server answers. */
  itemName: string;
  /** The open list line it ticks off. */
  listLine?: ShoppingListItemNode;
}

/**
 * What every line was bought on, sent as given: the caller leaves out a field
 * it has no value for.
 */
export interface ReceiptToCheckIn
  extends Pick<
    CreateReceiptCheckInInput,
    | 'pantryId'
    | 'purchasedOn'
    | 'purchasedAt'
    | 'shoppingListId'
    | 'receiptParseId'
    | 'merchantHeader'
    | 'orderDiscount'
  > {
  /** One per send: a receipt over the API's cap goes as several. */
  checkInIds: readonly string[];
  /**
   * The receipt's store, or the create placing it: online, the check-in is
   * sent once the store exists, while its lines already show.
   */
  storeId?: string | Promise<string | undefined>;
}

type PlacedReceipt = Omit<ReceiptToCheckIn, 'checkInIds' | 'storeId'> & {
  storeId?: string;
};

export type ReceiptCheckInOutcome =
  /** Every send was answered; `failed` names the lines the API refused. */
  | { status: 'recorded'; added: number[]; failed: number[] }
  /** Kept for delivery: the lines are shown, and land once the API is reached. */
  | { status: 'queued' }
  /** Refused whole; nothing was recorded, and what it showed is withdrawn. */
  | { status: 'refused'; reason: string };

const chunked = <T>(rows: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, at) =>
    rows.slice(at * size, at * size + size),
  );

// Every line's rows, written before its check-in fires: the pantry row under
// its minted id and a listed line's list line stamped as moved, keyed by its
// place in the send as its result is. A line stocking nothing writes nothing.
const writeLines = (
  cache: ApolloCache,
  pantryId: string,
  listId: string | undefined,
  lines: readonly CheckInLineToSend[],
): Map<number, WrittenLine> => {
  const written = new Map<number, WrittenLine>();
  for (const [at, { input, itemName, listLine }] of lines.entries()) {
    const { pantryItemId } = input;
    if (!pantryItemId) continue;
    unconfirmedCreates.mark(pantryItemId);
    if (listLine) {
      written.set(at, {
        kind: 'move',
        written: writeLocalMove(cache, {
          item: listLine,
          pantryId,
          pantryItemId,
          amount: input.amount,
          totalCost: input.totalPaid,
          removeFromList: false,
          currentListId: listId,
        }),
      });
      continue;
    }
    writeLocalIntake(
      cache,
      pantryItemId,
      localIntakeRow(pantryId, itemName, {
        item: input.item,
        amount: input.amount,
        purchase: { acquisitionMethod: AcquisitionMethod.Purchased },
      }),
    );
    written.set(at, { kind: 'intake' });
  }
  return written;
};

const releaseLines = (lines: readonly CheckInLineToSend[]) => {
  for (const { input } of lines) {
    if (input.pantryItemId) unconfirmedCreates.confirm(input.pantryItemId);
  }
};

/**
 * Records a confirmed receipt in one call per 100 lines. Each line shows in the
 * pantry and list before its call fires and while it is queued; a refused line
 * is withdrawn alone. The draft mints its ids once, so nothing records twice.
 */
export function useReceiptCheckIn(listId: string | undefined) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { setCheckInState, settleCheckIn, remintCheckInId, markAdded } =
    useReceiptDraftActions();
  const [createCheckIn] = useMutation(CreateReceiptCheckInDocument, {
    context: { localFirst: true },
  });

  // Names the refused lines and, when one code accounts for all of them, its
  // cause in the reader's language; never the server's text.
  const reportFailed = (
    lines: readonly CheckInLineToSend[],
    results: readonly CheckInLineResult[],
  ) => {
    const failedIndexes = new Set(
      results.filter(result => !result.success).map(result => result.index),
    );
    const failed = lines.filter(line => failedIndexes.has(line.index));
    const count = failed.length;
    if (count === 0) return;
    const names = cappedNames(
      failed.map(line => line.itemName.trim()).filter(name => name !== ''),
    ).shown;
    const codes = [
      ...new Set(
        results.flatMap(result =>
          result.success ? [] : result.failure?.code ?? '',
        ),
      ),
    ];
    const [code] = codes;
    const cause =
      codes.length === 1 && code && errorService.hasUserFriendlyMessage(code)
        ? errorService.messageForCode(code, t)
        : null;
    if (names) {
      toastService.error(
        cause
          ? t('receipts.review.failedLinesCause', { count, names, cause })
          : t('receipts.review.failedLines', { count, names }),
      );
    } else {
      toastService.error(
        cause
          ? t('receipts.review.failedLinesCountCause', { count, cause })
          : t('receipts.review.failedLinesCount', { count }),
      );
    }
    Telemetry.trackEvent('receipt_check_in_lines_failed', {
      failed_count: count,
      failed_codes: codes.filter(Boolean).sort().join(','),
      // How support finds the server's log for a failure nobody can reproduce.
      failed_error_ids: results
        .flatMap(result => result.failure?.errorId ?? [])
        .slice(0, REPORTED_ERROR_IDS)
        .join(','),
    });
  };

  const send = async (
    receipt: PlacedReceipt,
    checkInId: string,
    lines: readonly CheckInLineToSend[],
    written: ReadonlyMap<number, WrittenLine>,
  ) => {
    const today = todayKey();
    const input = {
      ...receipt,
      id: checkInId,
      today,
      lines: lines.map(line => line.input),
    };
    // A whole refusal withdraws every line it showed.
    const withdrawAll = () =>
      applyReceiptCheckIn(
        client.cache,
        input,
        lines.map((_line, at) => ({ index: at, success: false })),
        written,
      );
    const settled = await settleMutation(
      () => createCheckIn({ variables: { input, today } }),
      {
        document: CreateReceiptCheckInDocument,
        fallback: t('errors.addItemFailedRetry'),
        onFailed: withdrawAll,
        present: 'none',
      },
    );
    return { input, settled };
  };

  // Sends a chunk whose rows are written; an id another user holds is
  // replaced once, its lines' purchase ids still naming them.
  const sendChunk = async (
    receipt: PlacedReceipt,
    checkInId: string,
    chunk: readonly CheckInLineToSend[],
    written: Map<number, WrittenLine>,
  ) => {
    let sent = await send(receipt, checkInId, chunk, written);
    let sentWritten = written;
    if (
      sent.settled.status === 'failed' &&
      sent.settled.failure?.code === ErrorCode.Conflict
    ) {
      const reminted = remintCheckInId(checkInId);
      sentWritten = writeLines(client.cache, receipt.pantryId, listId, chunk);
      sent = await send(receipt, reminted, chunk, sentWritten);
    }
    releaseLines(chunk);
    return { ...sent, written: sentWritten };
  };

  /**
   * Shows every line at once, then sends each chunk of them under its own
   * check-in id, once the receipt's store exists.
   */
  const checkIn = async (
    receipt: ReceiptToCheckIn,
    lines: readonly CheckInLineToSend[],
  ): Promise<ReceiptCheckInOutcome> => {
    setCheckInState('sending');
    const chunks = chunked(lines, LINES_PER_CHECK_IN).map(chunk => ({
      chunk,
      written: writeLines(client.cache, receipt.pantryId, listId, chunk),
    }));
    // Shown, so added: a second Add must not send them again.
    markAdded(lines.map(line => line.index));
    const { checkInIds, storeId: placing, ...fields } = receipt;
    const storeId = await placing;
    const placed: PlacedReceipt = {
      ...fields,
      ...(storeId ? { storeId } : {}),
    };
    const added: number[] = [];
    const failed: number[] = [];
    let queued = false;
    for (const [at, prepared] of chunks.entries()) {
      const checkInId = checkInIds[at];
      if (!checkInId) continue;
      const { chunk } = prepared;
      const { input, settled, written } = await sendChunk(
        placed,
        checkInId,
        chunk,
        prepared.written,
      );
      if (settled.status === 'queued') {
        queued = true;
        continue;
      }
      if (settled.status === 'failed') {
        // Refused whole: every line it withdrew is back to send again.
        const code = settled.failure?.code;
        settleCheckIn(
          input.id,
          lines.map(line => ({
            index: line.index,
            success: false,
            failure: code ? { code } : null,
          })),
        );
        const reason = settled.failure?.body ?? t('errors.addItemFailedRetry');
        toastService.error(reason);
        return { status: 'refused', reason };
      }
      // Results index the send; the draft and the message name receipt lines.
      const sentResults: readonly CheckInLineResult[] =
        appliedPayload(settled.data)?.results ?? [];
      try {
        const { exact } = applyReceiptCheckIn(
          client.cache,
          input,
          sentResults,
          written,
        );
        if (!exact) {
          client.refetchQueries({ include: 'active' }).catch(error => {
            errorService.reportError(error, {
              operation: 'Re-read after a refused receipt line',
            });
          });
        }
      } catch (cacheError) {
        errorService.reportError(cacheError, {
          operation: 'Settle receipt check-in',
        });
      }
      const results = sentResults.flatMap(result => {
        const line = chunk[result.index];
        return line ? [{ ...result, index: line.index }] : [];
      });
      settleCheckIn(input.id, results);
      reportFailed(chunk, results);
      for (const result of results) {
        (result.success ? added : failed).push(result.index);
      }
    }
    if (queued) {
      setCheckInState('queued');
      return { status: 'queued' };
    }
    return { status: 'recorded', added, failed };
  };

  return { checkIn };
}
