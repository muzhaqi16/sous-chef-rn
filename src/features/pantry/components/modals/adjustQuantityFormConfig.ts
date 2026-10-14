import { object, string, type ObjectSchema } from 'yup';
import { lazyMessage, quantityRule } from '#/utils/validation/common';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { parseDecimalInput } from '#/utils/parseDecimalInput';

export interface AdjustQuantityFormValues {
  quantityInput: string;
  reason: string;
  remainingWeightInput: string;
}

export const adjustQuantitySchema: ObjectSchema<AdjustQuantityFormValues> =
  object({
    quantityInput: quantityRule('errors.invalidQuantity', { allowZero: true }),
    reason: string()
      .trim()
      .required(lazyMessage('adjustQuantity.reasonRequired')),
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
