import { mixed, object, string, type ObjectSchema } from 'yup';
import { t, type TranslationKey } from '#/i18n';
import {
  ErrorCode,
  PantryUnitChangeMethod,
  PantryUnitChangeResolution,
} from '#/graphql/generated/schemaTypes';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import type {
  UnitChangePreview,
  UnitChangeRequest,
} from '#features/pantry/hooks/usePantryUnitChange';

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: TranslationKey) => (): string => t(key);

/**
 * What the sheet asks of the user, read off the preview:
 * - `summary`: nothing — confirm the before and after;
 * - `estimate`: the route is approximate, so the estimate or their own amount;
 * - `recount`: no route, so their amount in the new unit;
 * - `packageSize`: a measure becoming a count, so the size of one package;
 * - `refused`: the change cannot be made; the reason is shown.
 */
export type UnitChangeMode =
  | 'summary'
  | 'estimate'
  | 'recount'
  | 'packageSize'
  | 'refused';

export function unitChangeMode(preview: UnitChangePreview): UnitChangeMode {
  const { refusal } = preview;
  if (preview.conflictingPantryItemId) return 'refused';
  if (refusal?.field === 'packageSize') return 'packageSize';
  if (refusal?.code === ErrorCode.UnitChangeNeedsResolution) return 'estimate';
  if (preview.method === null) {
    return !refusal || refusal.field === 'quantity' ? 'recount' : 'refused';
  }
  return refusal ? 'refused' : 'summary';
}

export type AmountChoice = 'estimate' | 'mine';

export const AMOUNT_CHOICES: readonly AmountChoice[] = ['estimate', 'mine'];

export interface UnitChangeFormValues {
  choice: AmountChoice;
  amount: string;
  packageAmount: string;
  packageUnitText: string;
  packageUnitId: string | null;
}

export const unitChangeDefaults = (
  typedAmount: string,
): UnitChangeFormValues => ({
  choice: 'estimate',
  amount: typedAmount,
  packageAmount: '',
  packageUnitText: '',
  packageUnitId: null,
});

const isPositiveFraction = (value: string): boolean => {
  const parsed = parseFractionalInput(value);
  return parsed !== null && parsed > 0;
};

const isPositiveDecimal = (value: string): boolean => {
  const parsed = parseDecimalInput(value);
  return !isNaN(parsed) && parsed > 0;
};

/** Validated with `context: { mode }`: each mode checks only what it asks. */
export const unitChangeSchema: ObjectSchema<UnitChangeFormValues> = object({
  choice: mixed<AmountChoice>().oneOf(['estimate', 'mine']).defined(),
  amount: string()
    .defined()
    .when(['$mode', 'choice'], ([mode, choice], schema) =>
      mode === 'recount' || (mode === 'estimate' && choice === 'mine')
        ? schema.test(
            'amount',
            msg('unitChange.amountRequired'),
            isPositiveFraction,
          )
        : schema,
    ),
  packageAmount: string()
    .defined()
    .when('$mode', ([mode], schema) =>
      mode === 'packageSize'
        ? schema.test(
            'package-amount',
            msg('unitChange.packageSizeRequired'),
            isPositiveDecimal,
          )
        : schema,
    ),
  packageUnitText: string().defined(),
  packageUnitId: string()
    .nullable()
    .defined()
    .when('$mode', ([mode], schema) =>
      mode === 'packageSize'
        ? schema.required(msg('unitChange.packageSizeRequired'))
        : schema,
    ),
});

/** The package size the form holds, once it validated. */
export function packageSizeOf(
  values: UnitChangeFormValues,
): UnitChangeRequest['packageSize'] {
  if (!values.packageUnitId) return undefined;
  return {
    netWeight: parseDecimalInput(values.packageAmount),
    netWeightUnitId: values.packageUnitId,
  };
}

/**
 * The resolution and quantity a confirmed change sends. A summary of a recount
 * carries the amount it was previewed with; an exact route needs neither.
 */
export function changeChoice(
  mode: UnitChangeMode,
  preview: UnitChangePreview,
  values: UnitChangeFormValues,
  previewedQuantity: number | null,
): Pick<UnitChangeRequest, 'resolution' | 'quantity'> {
  const amount = parseFractionalInput(values.amount) ?? undefined;
  if (mode === 'recount') {
    return { resolution: PantryUnitChangeResolution.Recount, quantity: amount };
  }
  if (mode === 'estimate') {
    return values.choice === 'mine'
      ? { resolution: PantryUnitChangeResolution.Recount, quantity: amount }
      : { resolution: PantryUnitChangeResolution.Convert };
  }
  if (preview.method === PantryUnitChangeMethod.Recount) {
    return {
      resolution: PantryUnitChangeResolution.Recount,
      quantity: previewedQuantity ?? undefined,
    };
  }
  return {};
}
