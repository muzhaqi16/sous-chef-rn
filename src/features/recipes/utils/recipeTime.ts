/**
 * A recipe's total time in minutes, falling back to prep + cook.
 *
 * The server does not always populate `totalTimeMinutes`, and where it does not
 * the two components are added — or whichever single one exists is used. Shared
 * because `MyRecipeCard` and `SavedRecipeCard` each carried a byte-identical
 * copy of this expression.
 */
export const recipeTotalMinutes = (recipe: {
  totalTimeMinutes?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
}): number | null =>
  recipe.totalTimeMinutes ??
  (recipe.prepTimeMinutes && recipe.cookTimeMinutes
    ? recipe.prepTimeMinutes + recipe.cookTimeMinutes
    : recipe.prepTimeMinutes ?? recipe.cookTimeMinutes ?? null);
