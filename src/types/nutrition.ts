/**
 * Display shapes derived from an item's `NutritionFacts`
 */

import type { TranslationKey } from '#/i18n';

// =============================================================================
// NUTRITION TYPES
// =============================================================================

/**
 * Extracted macro summary for quick display
 */
export interface MacroSummary {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  servingSize: string | null;
}

/**
 * Smart highlight badge (e.g., "High Protein", "Low Fat")
 */
export interface NutritionHighlight {
  /** i18n key path — generateHighlights runs in module scope, no hook. */
  labelKey: TranslationKey;
  type: 'positive' | 'neutral' | 'caution';
}

/**
 * Nutrient entry for detail list display
 */
export interface NutrientEntry {
  key: string;
  name: string;
  amount: number;
  unit: string;
  category: NutrientCategory;
}

export type NutrientCategory = 'macro' | 'vitamin' | 'mineral';

// Image types live in `#utils/imageUtils` (`PhotoLike`, `PreferredSize`) and in
// the generated schema types (`ItemPhoto`, `ItemImage`, `ImagePerspective`).
