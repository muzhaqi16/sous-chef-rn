// Recipe search filters in the API's own enums. `labelKey` resolves to the
// translated chip label. Shared by RecipeFilterSheet (selection UI) and
// ActiveFilterChipsRow (active-filter display).

import { isLifestyleDiet } from '#domain/dietary';
import type { TranslationKey } from '#/i18n';
import {
  Diet,
  Intolerance,
  RecipeCategory,
} from '#/graphql/generated/schemaTypes';

/** The categories the meal-type filter offers (`MEAL_TYPES`). */
export type MealTypeCategory =
  | RecipeCategory.Breakfast
  | RecipeCategory.Lunch
  | RecipeCategory.Dinner
  | RecipeCategory.Snack
  | RecipeCategory.Dessert;

export interface RecipeFilters {
  diet: Diet[];
  intolerances: Intolerance[];
  mealType: MealTypeCategory | null;
  maxReadyTime: number | null;
}

export const DEFAULT_FILTERS: RecipeFilters = {
  diet: [],
  intolerances: [],
  mealType: null,
  maxReadyTime: null,
};

export interface RecipeFilterOption<V extends string> {
  labelKey: TranslationKey;
  value: V;
}

export const DIET_OPTIONS: RecipeFilterOption<Diet>[] = [
  { labelKey: 'labels.vegetarian', value: Diet.Vegetarian },
  { labelKey: 'recipeFilters.diets.vegan', value: Diet.Vegan },
  { labelKey: 'recipes.diet.GLUTEN_FREE', value: Diet.GlutenFree },
  { labelKey: 'recipeFilters.diets.ketogenic', value: Diet.Keto },
  { labelKey: 'recipes.diet.PALEO', value: Diet.Paleo },
  { labelKey: 'recipeFilters.diets.pescetarian', value: Diet.Pescetarian },
  {
    labelKey: 'recipeFilters.diets.lactoVegetarian',
    value: Diet.LactoVegetarian,
  },
  { labelKey: 'recipeFilters.diets.ovoVegetarian', value: Diet.OvoVegetarian },
  { labelKey: 'recipes.diet.PRIMAL', value: Diet.Primal },
  { labelKey: 'labels.lowFodmap', value: Diet.LowFodmap },
  { labelKey: 'recipes.diet.WHOLE30', value: Diet.Whole30 },
];

export const INTOLERANCE_OPTIONS: RecipeFilterOption<Intolerance>[] = [
  { labelKey: 'recipes.intolerance.DAIRY', value: Intolerance.Dairy },
  { labelKey: 'recipes.intolerance.EGG', value: Intolerance.Egg },
  { labelKey: 'recipes.intolerance.GLUTEN', value: Intolerance.Gluten },
  { labelKey: 'recipes.intolerance.GRAIN', value: Intolerance.Grain },
  { labelKey: 'recipes.intolerance.PEANUT', value: Intolerance.Peanut },
  { labelKey: 'recipes.intolerance.SEAFOOD', value: Intolerance.Seafood },
  { labelKey: 'recipes.intolerance.SESAME', value: Intolerance.Sesame },
  { labelKey: 'recipes.intolerance.SHELLFISH', value: Intolerance.Shellfish },
  { labelKey: 'recipes.intolerance.SOY', value: Intolerance.Soy },
  {
    labelKey: 'labels.sulfite',
    value: Intolerance.Sulfite,
  },
  { labelKey: 'recipes.intolerance.TREE_NUT', value: Intolerance.TreeNut },
  { labelKey: 'recipes.intolerance.WHEAT', value: Intolerance.Wheat },
  { labelKey: 'recipes.intolerance.FISH', value: Intolerance.Fish },
];

// Lifestyle diets are mutually exclusive (single-select); constraint diets
// stack on top (multi-select).
export const LIFESTYLE_DIET_OPTIONS = DIET_OPTIONS.filter(option =>
  isLifestyleDiet(option.value),
);

export const CONSTRAINT_DIET_OPTIONS = DIET_OPTIONS.filter(
  option => !isLifestyleDiet(option.value),
);

export const MEAL_TYPES: RecipeFilterOption<MealTypeCategory>[] = [
  { labelKey: 'labels.breakfast', value: RecipeCategory.Breakfast },
  { labelKey: 'labels.lunch', value: RecipeCategory.Lunch },
  { labelKey: 'labels.dinner', value: RecipeCategory.Dinner },
  { labelKey: 'usagePurpose.SNACK', value: RecipeCategory.Snack },
  { labelKey: 'labels.dessert', value: RecipeCategory.Dessert },
];

/** The i18n label key for a filter value; undefined for a value no option lists. */
export function filterOptionLabelKey<V extends string>(
  options: readonly RecipeFilterOption<V>[],
  value: V,
): TranslationKey | undefined {
  return options.find(option => option.value === value)?.labelKey;
}
