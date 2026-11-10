import { object, string, type ObjectSchema } from 'yup';
import { t, type TranslationKey } from '#/i18n';
import { DIETARY_LIMITS } from '#domain/dietary';

export interface MacroTargetsFormValues {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

type Macro = keyof MacroTargetsFormValues;

const RANGE_KEY: Record<Macro, TranslationKey> = {
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
  calorieTarget?: number | null;
  proteinTarget?: number | null;
  carbsTarget?: number | null;
  fatTarget?: number | null;
}

/**
 * A filled field sends its target. A blank one sends nothing, so saving one
 * target keeps the others, unless it held a stored target: emptied, it
 * clears it (null).
 */
export const macroTargetUpdates = (
  values: MacroTargetsFormValues,
  held: MacroTargetUpdates = {},
): MacroTargetUpdates => {
  const updates: MacroTargetUpdates = {};
  const target = (entry: string, stored: number | null | undefined) =>
    entry ? parseInt(entry) : stored != null ? null : undefined;
  const calorieTarget = target(values.calories, held.calorieTarget);
  const proteinTarget = target(values.protein, held.proteinTarget);
  const carbsTarget = target(values.carbs, held.carbsTarget);
  const fatTarget = target(values.fat, held.fatTarget);
  if (calorieTarget !== undefined) updates.calorieTarget = calorieTarget;
  if (proteinTarget !== undefined) updates.proteinTarget = proteinTarget;
  if (carbsTarget !== undefined) updates.carbsTarget = carbsTarget;
  if (fatTarget !== undefined) updates.fatTarget = fatTarget;
  return updates;
};
