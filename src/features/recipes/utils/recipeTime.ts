/**
 * A recipe's total time in minutes. The server does not always populate
 * `totalTimeMinutes`, so it falls back to prep + cook, or whichever one exists.
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
