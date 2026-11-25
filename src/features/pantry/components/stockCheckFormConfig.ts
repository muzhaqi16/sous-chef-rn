import { lazy, mixed, number, object, string, type InferType } from 'yup';
import { StockCheckAnswer, WasteReason } from '#graphql/generated/schemaTypes';
import { DEFAULT_WASTE_REASON } from '#features/pantry/utils/wasteReasons';
import { parseFractionalInput } from '#utils/fractionUtils';
import {
  lazyMessage,
  quantityCapMessage,
  withinQuantityCap,
} from '#utils/validation/common';
import type {
  StockCheckChoice,
  StockCheckRow,
} from '#features/pantry/hooks/useStockCheck';

const readsAsAmount = (value: string | undefined): boolean => {
  const parsed = parseFractionalInput(value ?? '');
  return parsed !== null && !Number.isNaN(parsed) && parsed >= 0;
};

const isSomeLeft = (answer: unknown) => answer === StockCheckAnswer.SomeLeft;

// A row nobody answered has no `answer`. `seen` is the version the row showed
// when answered, so a change that lands while the sheet is open is refused,
// never counted over.
const rowSchema = object({
  answer: mixed<StockCheckAnswer>()
    .oneOf(Object.values(StockCheckAnswer))
    .optional(),
  seen: number().optional(),
  left: string()
    .optional()
    .when('answer', {
      is: isSomeLeft,
      then: rule =>
        rule
          .test('left', lazyMessage('errors.invalidQuantity'), readsAsAmount)
          .test('quantity-cap', quantityCapMessage, withinQuantityCap),
    }),
  // What the packages found hold: blank counts packages only.
  inside: string()
    .optional()
    .when('answer', {
      is: isSomeLeft,
      then: rule =>
        rule.test(
          'inside',
          lazyMessage('errors.invalidQuantity'),
          value => !value?.trim() || readsAsAmount(value),
        ),
    }),
  reason: mixed<WasteReason>().oneOf(Object.values(WasteReason)).optional(),
});

/** Rows keyed by pantry item id. */
export const stockCheckSchema = object({
  rows: lazy((rows: Partial<Record<string, unknown>> = {}) =>
    object(Object.fromEntries(Object.keys(rows).map(id => [id, rowSchema]))),
  ),
});

export type StockCheckRowValues = InferType<typeof rowSchema>;
export type StockCheckFormValues = InferType<typeof stockCheckSchema>;

/** A row's answer as the server takes it; null for one nobody answered. */
export function stockCheckChoice(
  row: StockCheckRow,
  values: StockCheckRowValues | undefined,
): StockCheckChoice | null {
  switch (values?.answer) {
    case undefined:
      return null;
    case StockCheckAnswer.StillHave:
      return { answer: StockCheckAnswer.StillHave };
    case StockCheckAnswer.UsedUp:
      return { answer: StockCheckAnswer.UsedUp };
    case StockCheckAnswer.ThrewOut:
      return {
        answer: StockCheckAnswer.ThrewOut,
        reason: values.reason ?? DEFAULT_WASTE_REASON,
      };
    case StockCheckAnswer.SomeLeft: {
      const quantity = parseFractionalInput(values.left ?? '');
      if (quantity === null) return null;
      // What the packages found hold, as a recount takes it: never a fraction
      // of a package worked out by hand.
      const amount = parseFractionalInput(values.inside ?? '');
      return amount === null || !row.contents
        ? { answer: StockCheckAnswer.SomeLeft, quantity }
        : {
            answer: StockCheckAnswer.SomeLeft,
            quantity,
            contents: { amount, unitId: row.contents.unitId },
          };
    }
  }
}
