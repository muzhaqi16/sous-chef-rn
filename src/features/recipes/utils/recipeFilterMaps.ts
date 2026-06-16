import { Diet, Intolerance } from '#/graphql/generated/schemaTypes';

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

// ── Diet / Intolerance ↔ Spoonacular-string maps ──
// Single source of truth for both directions. `activeFilters.diet` /
// `.intolerances` hold Spoonacular-format strings (the `value` fields in
// recipeFilterOptions' DIET_OPTIONS / INTOLERANCE_OPTIONS); the dietary profile
// is normalized into that form through the forward maps below. Spoonacular's
// complexSearch consumes those strings directly, while the local `searchRecipes`
// GraphQL API takes Diet/Intolerance enums — so the reverse lookups are derived
// from the same maps and can't drift. The forward maps are exhaustive over the
// enums: TS requires every member as a key, so a new schema enum fails to
// compile until it's mapped here.
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

// Reverse lookups (Spoonacular string → enum), derived from the forward maps so
// the two directions stay in sync. `Object.keys` widens to `string[]`; narrowing
// each key back to its enum member is sound because the source map is keyed
// exactly by that enum.
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
