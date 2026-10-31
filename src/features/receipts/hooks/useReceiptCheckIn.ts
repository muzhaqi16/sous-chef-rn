import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  AcquisitionMethod,
  ErrorCode,
  type CreateReceiptCheckInInput,
  type ReceiptCheckInLineInput,
} from '#/graphql/generated/schemaTypes';
import type { ShoppingListItemNode } from '#features/shoppingList/hooks/usePaginatedShoppingItems';
import { localIntakeRow } from '#features/pantry/cache/localIntake';
import { localMoveRow } from '#features/shoppingList/cache/localMove';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation, type Settled } from '#/apollo/utils/settleMutation';
import { askForReviewAfterSuccess } from '#/domain/reviewPrompt';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { todayKey } from '#/utils/dateUtils';
import { errorService } from '#/services/errorService';
import { toastService } from '#/services/toastService';
import { Telemetry } from '#/services/telemetry';
import { useTranslation } from '#/i18n';
import { useReceiptDraftActions } from '../store/receiptDraftStore';
import type { CheckInInputs, LocalCheckInLine } from '../offline/localWrites';
import {
  receiptLineOutcomes,
  settleReceiptCheckIn,
  type CheckInLineResult,
} from '../offline/receiptCheckIn';
import {
  CreateReceiptCheckInDocument,
  type CreateReceiptCheckInMutation,
} from './useReceiptCheckIn.generated';
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
    | 'merchant'
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

type ReceiptFields = Omit<ReceiptToCheckIn, 'checkInIds' | 'storeId'>;

/** What a check-in learns once its store exists. */
type PlacedStore = { storeId?: string };

export type ReceiptCheckInOutcome =
  /** Every send was answered; `failed` names the lines the API refused. */
  | { status: 'recorded'; added: number[]; failed: number[] }
  /** Kept for delivery: the lines are shown, and land once the API is reached. */
  | { status: 'queued' }
  /**
   * A send was refused whole: its lines and every later send's are withdrawn,
   * and an earlier send's stay recorded.
   */
  | { status: 'refused'; reason: string };

const chunked = <T>(rows: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(rows.length / size) }, (_, at) =>
    rows.slice(at * size, at * size + size),
  );

// What each line shows, by its place in the send as its result is: the pantry
// row under its minted id and a listed line's list line stamped as moved. A
// line kept out of the pantry only ticks its list line.
const localLines = (
  pantryId: string,
  lines: readonly CheckInLineToSend[],
): LocalCheckInLine[] =>
  lines.map(({ input, itemName, listLine }) => {
    const listLineId = listLine?.id;
    const { pantryItemId } = input;
    if (!pantryItemId) return { listLineId };
    const row = listLine
      ? localMoveRow({
          item: listLine,
          pantryId,
          amount: input.amount,
          totalCost: input.totalPaid,
        })
      : localIntakeRow(pantryId, itemName, {
          item: input.item,
          amount: input.amount,
          purchase: { acquisitionMethod: AcquisitionMethod.Purchased },
        });
    return { stack: { id: pantryItemId, row }, listLineId };
  });

const markLines = (lines: readonly CheckInLineToSend[]) => {
  for (const { input } of lines) {
    if (input.pantryItemId) unconfirmedCreates.mark(input.pantryItemId);
  }
};

const releaseLines = (lines: readonly CheckInLineToSend[]) => {
  for (const { input } of lines) {
    if (input.pantryItemId) unconfirmedCreates.confirm(input.pantryItemId);
  }
};

/**
 * Records a confirmed receipt in one call per 100 lines. Each line shows in the
 * pantry and list before its call fires and while it is queued, as a pending
 * layer per call; the answer keeps the lines the server took. The draft mints
 * its ids once, so nothing records twice.
 */
export function useReceiptCheckIn(listId: string | undefined) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { setCheckInState, remintCheckInId, markAdded, markUnsent } =
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

  /**
   * Shows a chunk's lines now and sends them on `turn`, with the store only
   * then known; a turn of null takes them back unsent.
   */
  const send = (
    receipt: ReceiptFields,
    checkInId: string,
    lines: readonly CheckInLineToSend[],
    turn: Promise<PlacedStore | null>,
  ) => {
    const today = todayKey();
    const input = {
      ...receipt,
      id: checkInId,
      today,
      lines: lines.map(line => line.input),
    };
    const inputs: CheckInInputs = {
      pantryId: receipt.pantryId,
      listId,
      lines: localLines(receipt.pantryId, lines),
      now: new Date().toISOString(),
    };
    markLines(lines);
    const settled = pendingWritesOf(client.cache).send<
      CreateReceiptCheckInMutation,
      { input: typeof input; today: string }
    >(
      CreateReceiptCheckInDocument,
      { input, today },
      async (write): Promise<Settled<CreateReceiptCheckInMutation>> => {
        const placed = await turn;
        if (!placed) return { status: 'failed', data: undefined };
        return settleMutation(
          () =>
            createCheckIn({
              ...write,
              variables: { ...write.variables, input: { ...input, ...placed } },
            }),
          {
            document: CreateReceiptCheckInDocument,
            fallback: t('errors.addItemFailedRetry'),
            present: 'none',
          },
        );
      },
      inputs,
    );
    return { input, settled };
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
    const { checkInIds, storeId: placing, ...fields } = receipt;
    const chunks = chunked(lines, LINES_PER_CHECK_IN).flatMap((chunk, at) => {
      const checkInId = checkInIds[at];
      if (!checkInId) return [];
      let open: (placed: PlacedStore | null) => void = () => undefined;
      const turn = new Promise<PlacedStore | null>(resolve => {
        open = resolve;
      });
      return [
        {
          chunk,
          checkInId,
          open,
          sent: send(fields, checkInId, chunk, turn),
        },
      ];
    });
    // Shown, so added: a second Add must not send them again.
    markAdded(lines.map(line => line.index));
    const storeId = await placing;
    const placed: PlacedStore = storeId ? { storeId } : {};
    const added: number[] = [];
    const failed: number[] = [];
    let queued = false;
    for (const [at, prepared] of chunks.entries()) {
      const { chunk, checkInId, open, sent } = prepared;
      open(placed);
      let { input } = sent;
      let settled = await sent.settled;
      // An id another user holds is replaced once, its lines' purchase ids
      // still naming them.
      if (
        settled.status === 'failed' &&
        settled.failure?.code === ErrorCode.Conflict
      ) {
        const retried = send(
          fields,
          remintCheckInId(checkInId),
          chunk,
          Promise.resolve(placed),
        );
        input = retried.input;
        settled = await retried.settled;
      }
      releaseLines(chunk);
      if (settled.status === 'queued') {
        queued = true;
        continue;
      }
      if (settled.status === 'failed') {
        // Refused whole: its lines are back to send, and the later chunks,
        // never sent, are taken back out to add again.
        const code = settled.failure?.code;
        settleReceiptCheckIn(
          client.cache,
          input.id,
          chunk.map(line => ({
            index: line.index,
            success: false,
            failure: code ? { code } : null,
          })),
        );
        const unsent = chunks.slice(at + 1);
        for (const later of unsent) {
          later.open(null);
          await later.sent.settled;
          releaseLines(later.chunk);
        }
        markUnsent(
          unsent.flatMap(later => later.chunk.map(line => line.index)),
        );
        const reason = settled.failure?.body ?? t('errors.addItemFailedRetry');
        toastService.error(reason);
        return { status: 'refused', reason };
      }
      // Results index the send; the draft and the message name receipt lines.
      const sentResults: readonly CheckInLineResult[] =
        appliedPayload(settled.data)?.results ?? [];
      const results = receiptLineOutcomes(input, sentResults);
      settleReceiptCheckIn(client.cache, input.id, results);
      reportFailed(chunk, results);
      for (const result of results) {
        (result.success ? added : failed).push(result.index);
      }
    }
    if (queued) {
      setCheckInState('queued');
      askForReviewAfterSuccess();
      return { status: 'queued' };
    }
    if (added.length > 0) askForReviewAfterSuccess();
    return { status: 'recorded', added, failed };
  };

  return { checkIn };
}
