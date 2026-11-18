import {
  skipToken,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import {
  StockCheckAnswer,
  type StockConfidence,
  type StockDoubtReason,
} from '#/graphql/generated/schemaTypes';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import {
  settleMutation,
  type SettleStatus,
} from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { useDataState, type DataState } from '#hooks/data/useDataState';
import { useToday } from '#hooks/app/useToday';
import { useDayConfirmedRead } from '#hooks/apollo/useDayConfirmedRead';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import { formatReading, readingOf } from '#domain/measure';
import { useTranslation } from '#/i18n';
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
  /** What one package holds, where it is known: "Some left" can count it too. */
  contents: { unitId: string; unitSymbol: string } | null;
  level: StockConfidence | null;
  reasons: readonly StockDoubtReason[];
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
  | { answer: typeof StockCheckAnswer.ThrewOut };

export interface StockCheckAnswered {
  status: SettleStatus;
  /** Rows the server refused (a stack that moved since it was seen): to look at again. */
  refused: string[];
}

/**
 * What remains once answered: an absolute count, never a delta. Still have
 * confirms and moves nothing.
 */
const heldAfter = (choice: StockCheckChoice): number | null => {
  switch (choice.answer) {
    case StockCheckAnswer.SomeLeft:
      // Only the server turns contents into what the stack holds.
      return choice.contents ? null : choice.quantity;
    case StockCheckAnswer.UsedUp:
    case StockCheckAnswer.ThrewOut:
      return 0;
    case StockCheckAnswer.StillHave:
    default:
      return null;
  }
};

/**
 * The selected pantry's stacks most worth a "still have it?" check today, at
 * most five in the server's order, and the write that records what was found.
 * A check is never forced: answering some rows, or none, leaves the rest as
 * they were.
 */
export function useStockCheck(enabled = true) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { pantry } = useCurrentPantry();
  const today = useToday();
  const system = useReadingSystem();
  const pantryId = pantry?.id;
  // Cached without its day: a new day shows the last check until it is confirmed.
  const dayRead = useDayConfirmedRead(
    enabled && pantryId ? `${today}:${pantryId}` : null,
  );
  const { data, loading, error, refetch, variables } = useQuery(
    StockToConfirmDocument,
    enabled && pantryId
      ? { variables: { pantryId, today }, ...dayRead.policy }
      : skipToken,
  );
  dayRead.markAnswered(
    data && !loading && !error
      ? `${variables.today}:${variables.pantryId}`
      : null,
  );
  const [record] = useMutation(RecordPantryStockCheckDocument, {
    context: { localFirst: true },
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
          }
        : null,
    level: stack.stockConfidence?.level ?? null,
    reasons: stack.stockConfidence?.reasons ?? [],
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
      now: checkedAt,
      rows: answers.map(({ row, choice }) => ({
        pantryItemId: row.id,
        held: heldAfter(choice),
      })),
    };
    const settled = await pendingWritesOf(client.cache).send(
      RecordPantryStockCheckDocument,
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
          })),
        },
      },
      write =>
        settleMutation(() => record(write), {
          document: RecordPantryStockCheckDocument,
          fallback: t('pantryScreen.stockCheckFailed'),
        }),
      inputs,
    );
    const results = appliedPayload(settled.data)?.results ?? [];
    return {
      status: settled.status,
      refused: results
        .filter(result => !result.success)
        .map(result => result.pantryItemId),
    };
  };

  return {
    rows,
    state,
    /** Asks again after a failed read. */
    retry: () => {
      void refetch();
    },
    answer,
  };
}
