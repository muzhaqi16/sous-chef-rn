import type { MealRefInput } from '#/graphql/generated/schemaTypes';

export interface MealNaming {
  customMealName?: string | null;
  recipe?: { id: string } | null;
}

/**
 * `MealRefInput` is @oneOf and non-null, so a meal naming neither a recipe nor
 * itself has nothing to send. Every derived copy reports such a row as skipped
 * rather than inventing a name for it.
 */
export function mealReferenceOf(meal: MealNaming): MealRefInput | null {
  if (meal.recipe?.id) return { recipeId: meal.recipe.id };
  if (meal.customMealName) return { customMealName: meal.customMealName };
  return null;
}
