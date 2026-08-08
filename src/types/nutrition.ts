/**
 * Nutrition and Image types for Item display
 * Based on actual API response structure
 */

// =============================================================================
// NUTRITION TYPES
// =============================================================================

/**
 * Individual nutrition value from API
 * e.g., { amount: 0.852, unit: "g", name: "Protein" }
 */
export interface NutritionValue {
  amount: number;
  unit: string;
  name: string;
}

/**
 * Full nutritions object from API (keyed by nutrient name)
 * Includes serving size info and all available nutrients
 */
export interface NutritionsData {
  // Core macros
  protein?: NutritionValue;
  totalFat?: NutritionValue;
  carbohydrates?: NutritionValue;
  fiber?: NutritionValue;
  sugar?: NutritionValue;
  calories?: NutritionValue;

  // Minerals
  sodium?: NutritionValue;
  calcium?: NutritionValue;
  iron?: NutritionValue;
  potassium?: NutritionValue;
  magnesium?: NutritionValue;
  phosphorus?: NutritionValue;
  zinc?: NutritionValue;

  // Vitamins
  vitaminA?: NutritionValue;
  vitaminC?: NutritionValue;
  vitaminD?: NutritionValue;
  vitaminE?: NutritionValue;
  vitaminK?: NutritionValue;
  vitaminB6?: NutritionValue;
  vitaminB12?: NutritionValue;
  thiamin?: NutritionValue;
  riboflavin?: NutritionValue;
  niacin?: NutritionValue;
  folate?: NutritionValue;

  // Serving info
  servingSize?: string;
  servingSizeGrams?: number;

  // Allow additional nutrients not explicitly typed
  [key: string]: NutritionValue | string | number | undefined;
}

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
  label: string;
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

export type NutrientCategory = 'macro' | 'vitamin' | 'mineral' | 'other';

// Image types live in `#utils/imageUtils` (`PhotoLike`, `PreferredSize`) and in
// the generated schema types (`ItemPhoto`, `ItemImage`, `ImagePerspective`).
