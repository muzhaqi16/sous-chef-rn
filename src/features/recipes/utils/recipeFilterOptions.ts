// ── Filter options — synced with DietaryRestrictionSelector + Spoonacular API values ──
// `value` is the Spoonacular API value (do not translate). `labelKey` resolves
// to the translated chip label via i18n. Shared by RecipeFilterSheet (selection
// UI) and ActiveFilterChipsRow (active-filter display).

import { isLifestyleDiet } from '#/constants/dietary';
import { SPOONACULAR_TO_DIET_ENUM } from './recipeFilterMaps';

export interface RecipeFilterOption {
  labelKey: string;
  value: string;
}

export const DIET_OPTIONS: RecipeFilterOption[] = [
  { labelKey: 'recipeFilters.diets.vegetarian', value: 'vegetarian' },
  { labelKey: 'recipeFilters.diets.vegan', value: 'vegan' },
  { labelKey: 'recipes.diet.GLUTEN_FREE', value: 'gluten free' },
  { labelKey: 'recipeFilters.diets.ketogenic', value: 'ketogenic' },
  { labelKey: 'recipes.diet.PALEO', value: 'paleo' },
  { labelKey: 'recipeFilters.diets.pescetarian', value: 'pescetarian' },
  {
    labelKey: 'recipeFilters.diets.lactoVegetarian',
    value: 'lacto-vegetarian',
  },
  { labelKey: 'recipeFilters.diets.ovoVegetarian', value: 'ovo-vegetarian' },
  { labelKey: 'recipeFilters.diets.primal', value: 'primal' },
  { labelKey: 'labels.lowFodmap', value: 'low fodmap' },
  { labelKey: 'recipes.diet.WHOLE30', value: 'whole30' },
];

export const INTOLERANCE_OPTIONS: RecipeFilterOption[] = [
  { labelKey: 'recipes.intolerance.DAIRY', value: 'dairy' },
  { labelKey: 'recipeFilters.intolerances.egg', value: 'egg' },
  { labelKey: 'recipes.intolerance.GLUTEN', value: 'gluten' },
  { labelKey: 'recipes.intolerance.GRAIN', value: 'grain' },
  { labelKey: 'recipes.intolerance.PEANUT', value: 'peanut' },
  { labelKey: 'recipes.intolerance.SEAFOOD', value: 'seafood' },
  { labelKey: 'recipes.intolerance.SESAME', value: 'sesame' },
  { labelKey: 'recipes.intolerance.SHELLFISH', value: 'shellfish' },
  { labelKey: 'recipes.intolerance.SOY', value: 'soy' },
  { labelKey: 'recipeFilters.intolerances.sulfite', value: 'sulfite' },
  { labelKey: 'recipes.intolerance.TREE_NUT', value: 'tree nut' },
  { labelKey: 'recipes.intolerance.WHEAT', value: 'wheat' },
  { labelKey: 'recipes.intolerance.FISH', value: 'fish' },
];

// ── Lifestyle vs constraint split (derived from the shared classification) ──
// Lifestyle diets are mutually exclusive (single-select); constraint diets
// stack on top (multi-select). Derived from `isLifestyleDiet` so a schema enum
// change flows through one place. `SPOONACULAR_TO_DIET_ENUM` maps the option's
// Spoonacular string back to the enum the classification is keyed on.
export const LIFESTYLE_DIET_OPTIONS: RecipeFilterOption[] = DIET_OPTIONS.filter(
  option => isLifestyleDietValue(option.value),
);

export const CONSTRAINT_DIET_OPTIONS: RecipeFilterOption[] =
  DIET_OPTIONS.filter(option => !isLifestyleDietValue(option.value));

/** True when a Spoonacular-format diet string is a lifestyle (exclusive) diet.
 *  Unknown strings default to lifestyle (treated as the exclusive primary). */
export function isLifestyleDietValue(value: string): boolean {
  const dietEnum = SPOONACULAR_TO_DIET_ENUM[value];
  return dietEnum ? isLifestyleDiet(dietEnum) : true;
}

export const MEAL_TYPES: RecipeFilterOption[] = [
  { labelKey: 'labels.breakfast', value: 'breakfast' },
  { labelKey: 'labels.lunch', value: 'lunch' },
  { labelKey: 'labels.dinner', value: 'dinner' },
  { labelKey: 'usagePurpose.SNACK', value: 'snack' },
  { labelKey: 'labels.dessert', value: 'dessert' },
];

/** Find the i18n label key for a filter value; falls back to the raw value. */
export function filterOptionLabelKey(
  options: RecipeFilterOption[],
  value: string,
): string {
  return options.find(option => option.value === value)?.labelKey ?? value;
}
