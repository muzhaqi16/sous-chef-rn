import {
  Diet,
  Intolerance,
  RecipeCategory,
} from '#/graphql/generated/schemaTypes';

// ── Filter types ──

export interface RecipeFilters {
  diet: string[];
  intolerances: string[];
  mealType: string | null;
  maxReadyTime: number | null;
}

export const DEFAULT_FILTERS: RecipeFilters = {
  diet: [],
  intolerances: [],
  mealType: null,
  maxReadyTime: null,
};

// BOTH directions: `activeFilters` holds the Spoonacular strings complexSearch
// takes, `searchRecipes` takes the enums, and the reverse lookups below derive
// from these. Exhaustive, so a new enum member fails to compile until mapped.
export const DIET_ENUM_TO_SPOONACULAR: Record<Diet, string> = {
  [Diet.Vegetarian]: 'vegetarian',
  [Diet.Vegan]: 'vegan',
  [Diet.GlutenFree]: 'gluten free',
  [Diet.Keto]: 'ketogenic',
  [Diet.Paleo]: 'paleo',
  [Diet.Pescetarian]: 'pescetarian',
  [Diet.LactoVegetarian]: 'lacto-vegetarian',
  [Diet.OvoVegetarian]: 'ovo-vegetarian',
  [Diet.Primal]: 'primal',
  [Diet.LowFodmap]: 'low fodmap',
  [Diet.Whole30]: 'whole30',
};

export const INTOLERANCE_ENUM_TO_SPOONACULAR: Record<Intolerance, string> = {
  [Intolerance.Dairy]: 'dairy',
  [Intolerance.Egg]: 'egg',
  [Intolerance.Gluten]: 'gluten',
  [Intolerance.Grain]: 'grain',
  [Intolerance.Peanut]: 'peanut',
  [Intolerance.Seafood]: 'seafood',
  [Intolerance.Sesame]: 'sesame',
  [Intolerance.Shellfish]: 'shellfish',
  [Intolerance.Soy]: 'soy',
  [Intolerance.Sulfite]: 'sulfite',
  [Intolerance.TreeNut]: 'tree nut',
  [Intolerance.Wheat]: 'wheat',
  [Intolerance.Fish]: 'fish',
};

type MealTypeCategory =
  | RecipeCategory.Breakfast
  | RecipeCategory.Lunch
  | RecipeCategory.Dinner
  | RecipeCategory.Snack
  | RecipeCategory.Dessert;

/** The categories the meal-type filter offers (`MEAL_TYPES`). */
const MEAL_TYPE_CATEGORY_TO_SPOONACULAR: Record<MealTypeCategory, string> = {
  [RecipeCategory.Breakfast]: 'breakfast',
  [RecipeCategory.Lunch]: 'lunch',
  [RecipeCategory.Dinner]: 'dinner',
  [RecipeCategory.Snack]: 'snack',
  [RecipeCategory.Dessert]: 'dessert',
};

// Spoonacular string → enum. Narrowing `Object.keys`' `string[]` back to the
// enum is sound: the source map is keyed by exactly that enum.
function invertEnumMap<E extends string>(
  map: Record<E, string>,
): Record<string, E> {
  const reversed: Record<string, E> = {};
  for (const key of Object.keys(map)) {
    const member = key as E;
    reversed[map[member]] = member;
  }
  return reversed;
}

export const SPOONACULAR_TO_DIET_ENUM = invertEnumMap(DIET_ENUM_TO_SPOONACULAR);
export const SPOONACULAR_TO_INTOLERANCE_ENUM = invertEnumMap(
  INTOLERANCE_ENUM_TO_SPOONACULAR,
);
export const SPOONACULAR_TO_MEAL_TYPE_CATEGORY = invertEnumMap(
  MEAL_TYPE_CATEGORY_TO_SPOONACULAR,
);
