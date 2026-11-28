/**
 * The share of a recipe's ingredients the pantries must hold for it to be
 * ready to cook. Below it a recipe is never called one the pantry can make.
 */
export const READY_COVERAGE = 50;

/** Where a pantry suggestion stands for the pantry that asked. */
export type SuggestionTier = 'ready' | 'almost';

/**
 * Ready when the pantry holds half of it or all but two ingredients; almost
 * when it uses anything held. Null for a recipe that uses nothing held: an
 * idea, not a pantry suggestion. Pantry basics count on neither side.
 */
export function suggestionTier({
  coverage,
  missingIngredientCount,
  usedIngredientCount,
}: {
  coverage: number;
  missingIngredientCount: number;
  usedIngredientCount: number;
}): SuggestionTier | null {
  if (usedIngredientCount === 0) return null;
  return coverage >= READY_COVERAGE || missingIngredientCount <= 2
    ? 'ready'
    : 'almost';
}
