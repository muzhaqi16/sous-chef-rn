import { boolean, mixed, object, string, type ObjectSchema } from 'yup';
import { UnitType } from '#/graphql/generated/schemaTypes';
import { lazyMessage, positiveDecimalRule } from '#/utils/validation/common';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

export interface CorrectWeightFormValues {
  weightInput: string;
  unitDisplay: string;
  selectedUnitId: string | null;
  selectedUnitType: UnitType | null;
  /** A first count of what a package holds: it restates no stock. */
  definesCount: boolean;
  reason: string;
}

export const correctWeightSchema: ObjectSchema<CorrectWeightFormValues> =
  object({
    weightInput: positiveDecimalRule('correctWeight.invalidWeight'),
    unitDisplay: string().defined(),
    selectedUnitId: string().nullable().defined(),
    selectedUnitType: mixed<UnitType>()
      .oneOf(Object.values(UnitType))
      .nullable()
      .defined(),
    definesCount: boolean().defined(),
    // A correction records why; a first count changes nothing held.
    reason: string()
      .trim()
      .defined()
      .test(
        'reason-given',
        lazyMessage('correctWeight.reasonRequired'),
        (value, context: { parent: CorrectWeightFormValues }) =>
          context.parent.definesCount || !!value,
      ),
  });

export const correctWeightDefaults = (): CorrectWeightFormValues => ({
  weightInput: '',
  unitDisplay: '',
  selectedUnitId: null,
  selectedUnitType: null,
  definesCount: false,
  reason: '',
});

// Exported for the schema test: the parsed weight the caller submits.
export const parseWeight = (values: CorrectWeightFormValues): number =>
  parseDecimalInput(values.weightInput);
