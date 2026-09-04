import { object, string, type ObjectSchema } from 'yup';
import { t } from '#/i18n';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

// Messages resolve LAZILY: the schema is built once at module scope, so an
// eagerly resolved one freezes whichever language was active at import time.
const msg = (key: string) => (): string => t(key);

export interface AdjustQuantityFormValues {
  quantityInput: string;
  reason: string;
  remainingWeightInput: string;
}

export const adjustQuantitySchema: ObjectSchema<AdjustQuantityFormValues> =
  object({
    // The field takes a fraction ("1 1/4") as readily as a decimal, so the rule
    // runs on the parsed number rather than on the string.
    quantityInput: string()
      .defined()
      .test('is-quantity', msg('errors.invalidQuantity'), value => {
        const parsed = parseFractionalInput(value ?? '');
        return parsed !== null && !isNaN(parsed) && parsed >= 0;
      }),
    reason: string().trim().required(msg('adjustQuantity.reasonRequired')),
    // Optional, and only shown for an opened item; a blank one means "unchanged".
    remainingWeightInput: string().defined(),
  });

export const adjustQuantityDefaults = (): AdjustQuantityFormValues => ({
  quantityInput: '',
  reason: '',
  remainingWeightInput: '',
});

/** The quantity the caller submits — the same read the rule makes. */
export const parseQuantity = (values: AdjustQuantityFormValues): number =>
  parseFractionalInput(values.quantityInput) as number;

/** A blank or unreadable remaining weight leaves the stored one alone. */
export const parseRemainingWeight = (
  values: AdjustQuantityFormValues,
): number | undefined => {
  const parsed = parseDecimalInput(values.remainingWeightInput);
  return !isNaN(parsed) && parsed >= 0 ? parsed : undefined;
};
