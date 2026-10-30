import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useServerRecipeSuggestions } from '#features/recipes/hooks/useServerRecipeSuggestions';

const PAYOFF_COUNT = 3;

/**
 * Up to three recipes the pantry can already make, screened on the server for
 * the user's restrictions and those their home shares: none would show a
 * dietary alert on its page.
 */
export function useRecipePayoff() {
  const suggestionsOn = useFeatureFlag('pantrySuggestions');
  const { rows } = useServerRecipeSuggestions(suggestionsOn, {
    excludeDietaryConflicts: true,
  });

  return {
    rows: rows
      .flatMap(row =>
        row.source === 'suggestion' && row.edge.coverage > 0 ? [row] : [],
      )
      .slice(0, PAYOFF_COUNT),
  };
}
