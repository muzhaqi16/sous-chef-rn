/**
 * Utility functions for parsing and displaying nutrition data
 */

import type {
  NutritionsData,
  NutritionValue,
  MacroSummary,
  NutritionHighlight,
  NutrientEntry,
  NutrientCategory,
} from '#types';

// =============================================================================
// PARSING
// =============================================================================

/**
 * Parse JSON nutritions field to typed NutritionsData object
 */
export function parseNutritions(
  nutritionsJson: unknown,
): NutritionsData | null {
  if (!nutritionsJson || typeof nutritionsJson !== 'object') {
    return null;
  }
  return nutritionsJson as NutritionsData;
}

/**
 * Check if nutritions data has any meaningful values
 */
export function hasNutritionData(nutritions: NutritionsData | null): boolean {
  if (!nutritions) return false;

  // Check for at least one nutrient value
  const nutrientKeys = [
    'protein',
    'totalFat',
    'carbohydrates',
    'calories',
    'fiber',
  ];
  return nutrientKeys.some(
    key =>
      nutritions[key] &&
      typeof nutritions[key] === 'object' &&
      (nutritions[key] as NutritionValue).amount !== undefined,
  );
}

// =============================================================================
// SCALING
// =============================================================================

/**
 * Calculate scale factor based on actual serving vs base serving
 */
export function getScaleFactor(
  nutritions: NutritionsData | null,
  actualServingGrams?: number | null,
): number {
  if (!actualServingGrams || !nutritions?.servingSizeGrams) {
    return 1;
  }
  return actualServingGrams / nutritions.servingSizeGrams;
}

/**
 * Format actual serving size for display
 */
export function formatServingSize(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1)}kg`;
  }
  return `${Math.round(grams)}g`;
}

// =============================================================================
// MACRO EXTRACTION
// =============================================================================

/**
 * Extract macro summary (Calories, Protein, Carbs, Fat) from nutritions
 * Optionally scales values based on actual serving size
 */
export function extractMacroSummary(
  nutritions: NutritionsData | null,
  actualServingGrams?: number | null,
): MacroSummary {
  if (!nutritions) {
    return {
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      servingSize: null,
    };
  }

  const scale = getScaleFactor(nutritions, actualServingGrams);
  const servingSize = actualServingGrams
    ? formatServingSize(actualServingGrams)
    : nutritions.servingSize ?? null;

  return {
    calories: nutritions.calories?.amount != null
      ? nutritions.calories.amount * scale
      : null,
    protein: nutritions.protein?.amount != null
      ? nutritions.protein.amount * scale
      : null,
    carbs: nutritions.carbohydrates?.amount != null
      ? nutritions.carbohydrates.amount * scale
      : null,
    fat: nutritions.totalFat?.amount != null
      ? nutritions.totalFat.amount * scale
      : null,
    servingSize,
  };
}

// =============================================================================
// HIGHLIGHTS GENERATION
// =============================================================================

/**
 * Generate smart nutrition highlights based on values
 * e.g., "High Protein", "Low Fat", "Good Fiber"
 */
export function generateHighlights(
  nutritions: NutritionsData | null,
): NutritionHighlight[] {
  if (!nutritions) return [];

  const highlights: NutritionHighlight[] = [];

  // High protein (>= 10g per serving)
  if (nutritions.protein && nutritions.protein.amount >= 10) {
    highlights.push({ label: 'High Protein', type: 'positive' });
  }

  // Low fat (<= 3g per serving)
  if (nutritions.totalFat && nutritions.totalFat.amount <= 3) {
    highlights.push({ label: 'Low Fat', type: 'positive' });
  }

  // Good fiber (>= 3g per serving)
  if (nutritions.fiber && nutritions.fiber.amount >= 3) {
    highlights.push({ label: 'Good Fiber', type: 'positive' });
  }

  // Low sugar (<= 5g per serving)
  if (nutritions.sugar && nutritions.sugar.amount <= 5) {
    highlights.push({ label: 'Low Sugar', type: 'positive' });
  }

  // High sodium (>= 600mg per serving) - caution
  if (nutritions.sodium && nutritions.sodium.amount >= 600) {
    highlights.push({ label: 'High Sodium', type: 'caution' });
  }

  // Good source of Vitamin C (>= 10% DV, roughly 9mg)
  if (nutritions.vitaminC && nutritions.vitaminC.amount >= 9) {
    highlights.push({ label: 'Vitamin C', type: 'positive' });
  }

  // Good source of Iron (>= 10% DV, roughly 1.8mg)
  if (nutritions.iron && nutritions.iron.amount >= 1.8) {
    highlights.push({ label: 'Iron', type: 'positive' });
  }

  // Good source of Calcium (>= 10% DV, roughly 130mg)
  if (nutritions.calcium && nutritions.calcium.amount >= 130) {
    highlights.push({ label: 'Calcium', type: 'positive' });
  }

  // Good source of Potassium (>= 10% DV, roughly 470mg)
  if (nutritions.potassium && nutritions.potassium.amount >= 470) {
    highlights.push({ label: 'Potassium', type: 'positive' });
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

/**
 * Categorize a nutrient by its key
 */
function categorizeNutrient(key: string): NutrientCategory {
  const macros = [
    'protein',
    'totalFat',
    'carbohydrates',
    'fiber',
    'sugar',
    'calories',
    'saturatedFat',
    'transFat',
    'cholesterol',
  ];
  const vitamins = [
    'vitaminA',
    'vitaminC',
    'vitaminD',
    'vitaminE',
    'vitaminK',
    'vitaminB6',
    'vitaminB12',
    'thiamin',
    'riboflavin',
    'niacin',
    'folate',
  ];
  const minerals = [
    'sodium',
    'calcium',
    'iron',
    'potassium',
    'magnesium',
    'phosphorus',
    'zinc',
    'copper',
    'manganese',
    'selenium',
  ];

  if (macros.includes(key)) return 'macro';
  if (vitamins.includes(key)) return 'vitamin';
  if (minerals.includes(key)) return 'mineral';
  return 'other';
}

/**
 * Get display name for a nutrient key
 */
function getNutrientDisplayName(key: string, name?: string): string {
  // Use the name from API if available
  if (name) {
    // Clean up verbose USDA names
    return name
      .replace(', by difference', '')
      .replace(', total dietary', '')
      .replace(', total ascorbic acid', '')
      .replace('Total lipid (fat)', 'Total Fat');
  }

  // Fallback to formatted key
  const nameMap: Record<string, string> = {
    protein: 'Protein',
    totalFat: 'Total Fat',
    carbohydrates: 'Carbohydrates',
    fiber: 'Fiber',
    sugar: 'Sugar',
    calories: 'Calories',
    sodium: 'Sodium',
    calcium: 'Calcium',
    iron: 'Iron',
    potassium: 'Potassium',
    vitaminA: 'Vitamin A',
    vitaminC: 'Vitamin C',
    vitaminD: 'Vitamin D',
  };

  return nameMap[key] || key;
}

/**
 * Get all nutrient entries for detail list display
 * Sorted by category: macros first, then vitamins, then minerals
 * Optionally scales values based on actual serving size
 */
export function getNutrientEntries(
  nutritions: NutritionsData | null,
  actualServingGrams?: number | null,
): NutrientEntry[] {
  if (!nutritions) return [];

  const scale = getScaleFactor(nutritions, actualServingGrams);
  const entries: NutrientEntry[] = [];

  // Skip non-nutrient keys
  const skipKeys = ['servingSize', 'servingSizeGrams'];

  for (const [key, value] of Object.entries(nutritions)) {
    if (skipKeys.includes(key)) continue;
    if (!value || typeof value !== 'object') continue;

    const nutrientValue = value as NutritionValue;
    if (nutrientValue.amount === undefined) continue;

    entries.push({
      key,
      name: getNutrientDisplayName(key, nutrientValue.name),
      amount: nutrientValue.amount * scale,
      unit: nutrientValue.unit,
      category: categorizeNutrient(key),
    });
  }

  // Sort by category priority
  const categoryOrder: Record<NutrientCategory, number> = {
    macro: 0,
    vitamin: 1,
    mineral: 2,
    other: 3,
  };

  return entries.sort(
    (a, b) => categoryOrder[a.category] - categoryOrder[b.category],
  );
}

/**
 * Group nutrient entries by category for sectioned display
 */
export function groupNutrientsByCategory(
  entries: NutrientEntry[],
): Record<NutrientCategory, NutrientEntry[]> {
  return entries.reduce(
    (acc, entry) => {
      if (!acc[entry.category]) {
        acc[entry.category] = [];
      }
      acc[entry.category].push(entry);
      return acc;
    },
    {} as Record<NutrientCategory, NutrientEntry[]>,
  );
}

/**
 * Get display label for a category
 */
export function getCategoryLabel(category: NutrientCategory): string {
  const labels: Record<NutrientCategory, string> = {
    macro: 'Macronutrients',
    vitamin: 'Vitamins',
    mineral: 'Minerals',
    other: 'Other',
  };
  return labels[category];
}
