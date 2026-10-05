import { object, string, type ObjectSchema } from 'yup';
import { lazyMessage } from '#/utils/validation/common';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

export interface CorrectWeightFormValues {
  weightInput: string;
  unitDisplay: string;
  selectedUnitId: string | null;
  reason: string;
}

export const correctWeightSchema: ObjectSchema<CorrectWeightFormValues> =
  object({
    // The input is a localized decimal string, so the rule runs on the parsed
    // number rather than on `string().matches`.
    weightInput: string()
      .defined()
      .test(
        'is-positive-weight',
        lazyMessage('correctWeight.invalidWeight'),
        value => {
          const parsed = parseDecimalInput(value);
          return !isNaN(parsed) && parsed > 0;
        },
      ),
    unitDisplay: string().defined(),
    selectedUnitId: string().nullable().defined(),
    reason: string()
      .trim()
      .required(lazyMessage('correctWeight.reasonRequired')),
  });

export const correctWeightDefaults = (): CorrectWeightFormValues => ({
  weightInput: '',
  unitDisplay: '',
  selectedUnitId: null,
  reason: '',
});

// Exported for the schema test: the parsed weight the caller submits.
export const parseWeight = (values: CorrectWeightFormValues): number =>
  parseDecimalInput(values.weightInput);
