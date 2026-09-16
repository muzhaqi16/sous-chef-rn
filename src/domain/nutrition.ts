/**
 * Utility functions for displaying an item's `NutritionFacts`
 */

import type {
  MacroSummary,
  NutritionHighlight,
  NutrientEntry,
  NutrientCategory,
} from '#/types/nutrition';
import type { TranslationKey } from '#/i18n';
import type { Translate } from '#/i18n/types';
import type { NutritionFacts } from '#/graphql/generated/schemaTypes';
import { formatQuantityForDisplay } from '#/utils/formatQuantity';
import { isOwnKey } from '#utils/isOwnKey';

/** The columns the macro summary, its highlights and the data check read. */
export type NutritionSummaryFacts = Pick<
  NutritionFacts,
  | 'calories'
  | 'protein'
  | 'totalCarbs'
  | 'totalFat'
  | 'dietaryFiber'
  | 'totalSugars'
  | 'sodium'
  | 'calcium'
  | 'iron'
  | 'potassium'
  | 'servingSize'
  | 'servingUnit'
>;

type NutrientField =
  | 'calories'
  | 'totalFat'
  | 'saturatedFat'
  | 'transFat'
  | 'cholesterol'
  | 'sodium'
  | 'totalCarbs'
  | 'dietaryFiber'
  | 'totalSugars'
  | 'addedSugars'
  | 'protein'
  | 'vitaminD'
  | 'calcium'
  | 'iron'
  | 'potassium';

/** Every nutrient column of `NutritionFacts`, plus its serving. */
export type NutritionFactsValues = Pick<
  NutritionFacts,
  NutrientField | 'servingSize' | 'servingUnit'
>;

// =============================================================================
// PRESENCE
// =============================================================================

/** Whether the facts carry any macro the summary shows. */
export function hasNutritionData<T extends NutritionSummaryFacts>(
  facts: T | null,
): facts is T {
  if (!facts) return false;
  return [
    facts.calories,
    facts.protein,
    facts.totalCarbs,
    facts.totalFat,
    facts.dietaryFiber,
  ].some(amount => amount !== null);
}

// =============================================================================
// SERVING
// =============================================================================

/** The serving the figures are stated for, or null when the row names none. */
export function formatServing(
  facts: Pick<NutritionFacts, 'servingSize' | 'servingUnit'>,
): string | null {
  const { servingSize, servingUnit } = facts;
  const unit = servingUnit?.trim();
  if (servingSize === null || servingSize <= 0 || !unit) return null;
  return `${formatQuantityForDisplay(servingSize)} ${unit}`;
}

// =============================================================================
// MACRO EXTRACTION
// =============================================================================

/** Calories, protein, carbs and fat, as the API stores them. */
export function extractMacroSummary(
  facts: NutritionSummaryFacts | null,
): MacroSummary {
  if (!facts) {
    return {
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      servingSize: null,
    };
  }

  return {
    calories: facts.calories,
    protein: facts.protein,
    carbs: facts.totalCarbs,
    fat: facts.totalFat,
    servingSize: formatServing(facts),
  };
}

// =============================================================================
// HIGHLIGHTS GENERATION
// =============================================================================

// An absent amount meets no threshold, a `<=` one included.
function meets(
  amount: number | null,
  comparison: '>=' | '<=',
  threshold: number,
): boolean {
  if (amount === null) return false;
  return comparison === '>=' ? amount >= threshold : amount <= threshold;
}

/**
 * Generate smart nutrition highlights based on values
 * e.g., "High Protein", "Low Fat", "Good Fiber"
 */
export function generateHighlights(
  facts: NutritionSummaryFacts | null,
): NutritionHighlight[] {
  if (!facts) return [];

  const highlights: NutritionHighlight[] = [];

  // High protein (>= 10g per serving)
  if (meets(facts.protein, '>=', 10)) {
    highlights.push({
      labelKey: 'recipes.healthGoal.HIGH_PROTEIN',
      type: 'positive',
    });
  }

  // Low fat (<= 3g per serving)
  if (meets(facts.totalFat, '<=', 3)) {
    highlights.push({
      labelKey: 'nutritionHighlights.lowFat',
      type: 'positive',
    });
  }

  // Good fiber (>= 3g per serving)
  if (meets(facts.dietaryFiber, '>=', 3)) {
    highlights.push({
      labelKey: 'nutritionHighlights.goodFiber',
      type: 'positive',
    });
  }

  // Low sugar (<= 5g per serving)
  if (meets(facts.totalSugars, '<=', 5)) {
    highlights.push({
      labelKey: 'nutritionHighlights.lowSugar',
      type: 'positive',
    });
  }

  // High sodium (>= 600mg per serving) - caution
  if (meets(facts.sodium, '>=', 600)) {
    highlights.push({
      labelKey: 'nutritionHighlights.highSodium',
      type: 'caution',
    });
  }

  // Good source of Iron (>= 10% DV, roughly 1.8mg)
  if (meets(facts.iron, '>=', 1.8)) {
    highlights.push({ labelKey: 'nutritionHighlights.iron', type: 'positive' });
  }

  // Good source of Calcium (>= 10% DV, roughly 130mg)
  if (meets(facts.calcium, '>=', 130)) {
    highlights.push({
      labelKey: 'nutritionHighlights.calcium',
      type: 'positive',
    });
  }

  // Good source of Potassium (>= 10% DV, roughly 470mg)
  if (meets(facts.potassium, '>=', 470)) {
    highlights.push({
      labelKey: 'nutritionHighlights.potassium',
      type: 'positive',
    });
  }

  return highlights;
}

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Format a nutrition value with its unit
 * e.g., formatNutritionValue(5.4, 'g') => '5.4g'
 */
export function formatNutritionValue(
  amount: number | null | undefined,
  unit: string,
): string {
  if (amount === null || amount === undefined) {
    return '-';
  }

  // Round to 1 decimal place if needed
  const rounded = Math.round(amount * 10) / 10;

  // Format as integer if whole number
  const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);

  return `${formatted}${unit}`;
}

/**
 * Format calorie value (no unit, just number)
 */
export function formatCalories(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '-';
  }
  return Math.round(amount).toString();
}

// =============================================================================
// DETAIL LIST ENTRIES
// =============================================================================

interface NutrientSpec {
  labelKey: TranslationKey;
  /** The canonical unit the API stores the column in. */
  unit: 'kcal' | 'g' | 'mg' | 'mcg';
  category: NutrientCategory;
}

/** In display order within each category. */
const NUTRIENTS: Record<NutrientField, NutrientSpec> = {
  calories: { labelKey: 'labels.calories', unit: 'kcal', category: 'macro' },
  protein: { labelKey: 'recipes.macroProtein', unit: 'g', category: 'macro' },
  totalFat: {
    labelKey: 'nutrition.nutrient.totalFat',
    unit: 'g',
    category: 'macro',
  },
  saturatedFat: {
    labelKey: 'nutrition.nutrient.saturatedFat',
    unit: 'g',
    category: 'macro',
  },
  transFat: {
    labelKey: 'nutrition.nutrient.transFat',
    unit: 'g',
    category: 'macro',
  },
  cholesterol: {
    labelKey: 'nutrition.nutrient.cholesterol',
    unit: 'mg',
    category: 'macro',
  },
  totalCarbs: {
    labelKey: 'recipes.macroCarbohydrates',
    unit: 'g',
    category: 'macro',
  },
  dietaryFiber: {
    labelKey: 'recipes.macroFiber',
    unit: 'g',
    category: 'macro',
  },
  totalSugars: {
    labelKey: 'recipes.macroSugar',
    unit: 'g',
    category: 'macro',
  },
  addedSugars: {
    labelKey: 'nutrition.nutrient.addedSugars',
    unit: 'g',
    category: 'macro',
  },
  vitaminD: {
    labelKey: 'nutrition.nutrient.vitaminD',
    unit: 'mcg',
    category: 'vitamin',
  },
  sodium: {
    labelKey: 'recipes.macroSodium',
    unit: 'mg',
    category: 'mineral',
  },
  calcium: {
    labelKey: 'nutritionHighlights.calcium',
    unit: 'mg',
    category: 'mineral',
  },
  iron: {
    labelKey: 'nutritionHighlights.iron',
    unit: 'mg',
    category: 'mineral',
  },
  potassium: {
    labelKey: 'nutritionHighlights.potassium',
    unit: 'mg',
    category: 'mineral',
  },
};

const CATEGORY_ORDER: Record<NutrientCategory, number> = {
  macro: 0,
  vitamin: 1,
  mineral: 2,
};

/** Every stored nutrient, macros first, then vitamins, then minerals. */
export function getNutrientEntries(
  facts: NutritionFactsValues | null,
  t: Translate,
): NutrientEntry[] {
  if (!facts) return [];

  const entries: NutrientEntry[] = [];
  for (const key of Object.keys(NUTRIENTS)) {
    if (!isOwnKey(NUTRIENTS, key)) continue;
    const amount = facts[key];
    if (amount === null) continue;
    const { labelKey, unit, category } = NUTRIENTS[key];
    entries.push({ key, name: t(labelKey), amount, unit, category });
  }

  return entries.sort(
    (a, b) => CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category],
  );
}

/**
 * Group nutrient entries by category for sectioned display
 */
export function groupNutrientsByCategory(
  entries: NutrientEntry[],
): Partial<Record<NutrientCategory, NutrientEntry[]>> {
  const groups: Partial<Record<NutrientCategory, NutrientEntry[]>> = {};
  for (const entry of entries) {
    const group = groups[entry.category];
    if (group) {
      group.push(entry);
    } else {
      groups[entry.category] = [entry];
    }
  }
  return groups;
}

const NUTRIENT_CATEGORY_LABEL_KEYS: Record<NutrientCategory, TranslationKey> = {
  macro: 'nutrition.category.macro',
  vitamin: 'nutrition.category.vitamin',
  mineral: 'nutrition.category.mineral',
};

/** A nutrient category's section heading. */
export function getCategoryLabel(
  category: NutrientCategory,
  t: Translate,
): string {
  return t(NUTRIENT_CATEGORY_LABEL_KEYS[category]);
}
