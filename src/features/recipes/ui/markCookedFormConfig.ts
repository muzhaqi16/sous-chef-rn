import { boolean, object, string, type ObjectSchema } from 'yup';
import type { TranslationKey } from '#/i18n';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { lazyMessage } from '#/utils/validation/common';

export interface MarkCookedFormValues {
  servings: string;
  deductFromPantry: boolean;
  useGranularDeduction: boolean;
  notes: string;
}

// Blank cooks the recipe's own servings. Typed text the parser cannot read is
// refused, never swapped for the default: that would deduct for a count nobody
// entered. A planned meal's servings are an Int, so a fraction refuses there.
const cookedSchema = (
  wholeServings: boolean,
  message: TranslationKey,
): ObjectSchema<MarkCookedFormValues> =>
  object({
    servings: string()
      .defined()
      .test('servings', lazyMessage(message), value => {
        if (!value.trim()) return true;
        const parsed = parseFractionalInput(value);
        return (
          parsed !== null &&
          parsed > 0 &&
          (!wholeServings || Number.isInteger(parsed))
        );
      }),
    deductFromPantry: boolean().defined(),
    useGranularDeduction: boolean().defined(),
    notes: string().defined(),
  });

export const recipeCookedSchema = cookedSchema(false, 'errors.field.servings');
export const plannedMealCookedSchema = cookedSchema(
  true,
  'errors.field.servingsMade',
);

/** The servings to cook: what was typed, else the recipe's own. */
export const cookedServings = (
  { servings }: MarkCookedFormValues,
  defaultServings: number,
): number => parseFractionalInput(servings) ?? defaultServings;
