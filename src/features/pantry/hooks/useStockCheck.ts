import { skipToken, useQuery } from '@apollo/client/react';
import {
  StockCheckAnswer,
  type StockConfidence,
  type StockDoubtReason,
  type WasteReason,
} from '#graphql/generated/schemaTypes';
import { errorService } from '#services/errorService';
import { isVersionConflictCode } from '#utils/errors/versionConflict';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import type { SettleStatus } from '#apollo/utils/settleMutation';
import { appliedPayload } from '#utils/errors/mutationPayload';
import { generateEntityId } from '#utils/generateEntityId';
import { useDataState, type DataState } from '#hooks/data/useDataState';
import { useToday } from '#hooks/app/useToday';
import { useDayConfirmedRead } from '#hooks/apollo/useDayConfirmedRead';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { formatReading, readingOf } from '#domain/measure';
import { useTranslation } from '#i18n';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import type { StockCheckInputs } from '#features/pantry/offline/localWrites';
import {
  RecordPantryStockCheckDocument,
  StockToConfirmDocument,
} from './useStockCheck.generated';

/** A stack to check, as the sheet shows it. */
export interface StockCheckRow {
  id: string;
  /** The version the household saw: a count found against it fails if it moved. */
  version: number;
  name: string;
  /** What the pantry says is left, "2 lb". */
  amount: string;
  /** The stack's own unit, which "Some left" is counted in. */
  unitSymbol: string;
  /**
   * What one package holds, where it is known: "Some left" can count it too.
   * `perPackage` is that size in `unitId`, or null where only the server can say.
   */
  contents: {
    unitId: string;
    unitSymbol: string;
    perPackage: number | null;
  } | null;
  level: StockConfidence | null;
  reasons: readonly StockDoubtReason[];
  /** When the stack's amount was last confirmed, as the server dates it. */
  lastConfirmedAt: string | null;
}

/**
 * One row's answer. "Some left" states what is there, in the stack's unit;
 * with `contents`, the packages found and what they hold, as a recount does.
 */
export type StockCheckChoice =
  | { answer: typeof StockCheckAnswer.StillHave }
  | {
      answer: typeof StockCheckAnswer.SomeLeft;
      quantity: number;
      contents?: { amount: number; unitId: string };
    }
  | { answer: typeof StockCheckAnswer.UsedUp }
  | { answer: typeof StockCheckAnswer.ThrewOut; reason: WasteReason };

export interface StockCheckAnswered {
  status: SettleStatus;
  /** Rows the server refused, each with why: to look at again. */
  refused: { pantryItemId: string; message: string }[];
}

/**
 * What remains once answered: an absolute count, never a delta. Still have
 * confirms and moves nothing; a partial package holds what its contents fill.
 */
const heldAfter = (
  row: StockCheckRow,
  choice: StockCheckChoice,
): number | null => {
  switch (choice.answer) {
    case StockCheckAnswer.SomeLeft: {
      if (!choice.contents) return choice.quantity;
      const perPackage = row.contents?.perPackage;
      return perPackage ? choice.contents.amount / perPackage : null;
    }
    case StockCheckAnswer.UsedUp:
    case StockCheckAnswer.ThrewOut:
      return 0;
    case StockCheckAnswer.StillHave:
    default:
      return null;
  }
};

/** Why the server refused one row, in the app's words. */
const refusalOf = (
  code: string | null | undefined,
  t: ReturnType<typeof useTranslation>['t'],
): string => {
  if (isVersionConflictCode(code)) return t('pantryScreen.stockCheckStale');
  return errorService.messageForCode(
    code ?? '',
    t,
    t('pantryScreen.stockCheckFailed'),
  );
};

/**
 * The selected pantry's stacks most worth a "still have it?" check today, at
 * most five in the server's order, and the write that records what was found.
 * A check is never forced: answering some rows, or none, leaves the rest as
 * they were.
 */
export function useStockCheck(enabled = true) {
  const { t } = useTranslation();
  const { pantry } = useCurrentPantry();
  const today = useToday();
  const system = useReadingSystem();
  const apiUnavailable = useIsApiUnavailable();
  const pantryId = pantry?.id;
  // Cached without its day: a new day shows the last check until it is
  // confirmed, and until then how sure the server is reads as unknown.
  const dayRead = useDayConfirmedRead(
    enabled && pantryId ? `${today}:${pantryId}` : null,
  );
  const { data, loading, error, refetch, variables } = useQuery(
    StockToConfirmDocument,
    enabled && pantryId
      ? { variables: { pantryId, today }, ...dayRead.policy }
      : skipToken,
  );
  // Offline the device answers the read itself, with whatever day it holds:
  // only the API's answer is today's.
  dayRead.markAnswered(
    data && !loading && !error && !apiUnavailable
      ? `${variables.today}:${variables.pantryId}`
      : null,
  );
  const record = useLocalWrite(RecordPantryStockCheckDocument, {
    fallback: t('pantryScreen.stockCheckFailed'),
  });

  // The subject guard: an answer for another pantry or day is not this one's.
  const held = data?.pantry?.id === pantryId ? data?.pantry : null;
  const rows: StockCheckRow[] = (held?.stockToConfirm ?? []).map(stack => ({
    id: stack.id,
    version: stack.version,
    name: stack.itemName,
    amount: formatReading(readingOf(stack.amountLeft, system)),
    unitSymbol: stack.unit.symbol,
    contents:
      stack.packageSize && stack.netWeightUnit
        ? {
            unitId: stack.netWeightUnit.id,
            unitSymbol: stack.netWeightUnit.symbol,
            perPackage:
              stack.packageSize.unitId === stack.netWeightUnit.id
                ? stack.packageSize.value
                : null,
          }
        : null,
    ...(dayRead.isConfirmed
      ? {
          level: stack.stockConfidence?.level ?? null,
          reasons: stack.stockConfidence?.reasons ?? [],
          lastConfirmedAt: stack.stockConfidence?.lastConfirmedAt ?? null,
        }
      : { level: null, reasons: [], lastConfirmedAt: null }),
  }));
  const state: DataState = useDataState({
    loading,
    error,
    hasResult: !!held,
    skipped: !enabled || !pantryId,
    isEmpty: rows.length === 0,
  });

  /** Sends the answered rows only, each against the version the household saw. */
  const answer = async (
    answers: readonly { row: StockCheckRow; choice: StockCheckChoice }[],
  ): Promise<StockCheckAnswered> => {
    if (!pantryId || answers.length === 0)
      return { status: 'applied', refused: [] };
    const checkedAt = new Date().toISOString();
    const inputs: StockCheckInputs = {
      pantryId,
      now: checkedAt,
      rows: answers.map(({ row, choice }) => ({
        pantryItemId: row.id,
        held: heldAfter(row, choice),
        ...(choice.answer === StockCheckAnswer.SomeLeft &&
          choice.contents && { remainingNetWeight: choice.contents.amount }),
      })),
    };
    const settled = await record.send(
      {
        today,
        input: {
          pantryId,
          // Kept on replay: the count is what was seen then, not when it lands.
          checkedAt,
          idempotencyKey: generateEntityId(),
          entries: answers.map(({ row, choice }) => ({
            pantryItemId: row.id,
            answer: choice.answer,
            expectedVersion: row.version,
            ...(choice.answer === StockCheckAnswer.SomeLeft
              ? {
                  quantity: choice.quantity,
                  ...(choice.contents
                    ? {
                        remainingNetWeight: choice.contents.amount,
                        remainingNetWeightUnitId: choice.contents.unitId,
                      }
                    : {}),
                }
              : {}),
            ...(choice.answer === StockCheckAnswer.ThrewOut
              ? { wasteReason: choice.reason }
              : {}),
          })),
        },
      },
      inputs,
    );
    const results = appliedPayload(settled.data)?.results ?? [];
    return {
      status: settled.status,
      refused: results
        .filter(result => !result.success)
        .map(result => ({
          pantryItemId: result.pantryItemId,
          message: refusalOf(result.failure?.code, t),
        })),
    };
  };

  return {
    rows,
    /** Today's answer is still on its way: what the rows say of doubt is not known yet. */
    asking: !dayRead.isConfirmed && loading,
    state,
    /** Asks again after a failed read. */
    retry: () => {
      void refetch();
    },
    answer,
  };
}
