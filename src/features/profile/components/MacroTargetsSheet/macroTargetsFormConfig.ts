import { object, string, type ObjectSchema } from 'yup';
import { t } from '#/i18n';
import { DIETARY_LIMITS } from '#domain/dietary';

export interface MacroTargetsFormValues {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

type Macro = keyof MacroTargetsFormValues;

const RANGE_KEY: Record<Macro, string> = {
  calories: 'macroTargets.caloriesRange',
  protein: 'macroTargets.proteinRange',
  carbs: 'macroTargets.carbsRange',
  fat: 'macroTargets.fatRange',
};

const limitsFor = (macro: Macro) => DIETARY_LIMITS[macro];

// Every target is OPTIONAL — a blank field means "no target" — so the rule only
// fires on a value that is present and out of range. The message resolves
// LAZILY, or a schema built at module scope freezes the launch language.
const inRange = (macro: Macro) =>
  string()
    .defined()
    .test(
      'within-range',
      () => t(RANGE_KEY[macro], limitsFor(macro)),
      value => {
        if (!value) return true;
        const parsed = parseInt(value);
        const { min, max } = limitsFor(macro);
        return !isNaN(parsed) && parsed >= min && parsed <= max;
      },
    );

export const macroTargetsSchema: ObjectSchema<MacroTargetsFormValues> = object({
  calories: inRange('calories'),
  protein: inRange('protein'),
  carbs: inRange('carbs'),
  fat: inRange('fat'),
});

export const macroTargetsDefaults = (): MacroTargetsFormValues => ({
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
});

export interface MacroTargetUpdates {
  calorieTarget?: number;
  proteinTarget?: number;
  carbsTarget?: number;
  fatTarget?: number;
}

/** A blank field is left out entirely, so it clears no stored target. */
export const macroTargetUpdates = (
  values: MacroTargetsFormValues,
): MacroTargetUpdates => {
  const updates: MacroTargetUpdates = {};
  if (values.calories) updates.calorieTarget = parseInt(values.calories);
  if (values.protein) updates.proteinTarget = parseInt(values.protein);
  if (values.carbs) updates.carbsTarget = parseInt(values.carbs);
  if (values.fat) updates.fatTarget = parseInt(values.fat);
  return updates;
};
