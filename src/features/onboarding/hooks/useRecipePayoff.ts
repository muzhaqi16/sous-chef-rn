import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useSelectedHomeId } from '#store/useAppStore';
import { useServerRecipeSuggestions } from '#features/recipes/hooks/useServerRecipeSuggestions';
import { useRestrictionsInPlay } from '#features/profile/hooks/useRestrictionsInPlay';

const PAYOFF_COUNT = 3;

/**
 * Up to three recipes the pantry can already make, screened on the server for
 * the user's restrictions and those their home shares: none would show a
 * dietary alert on its page. Screening reads recipe data only, so the label
 * caveat shows whenever a restriction may apply.
 */
export function useRecipePayoff() {
  const suggestionsOn = useFeatureFlag('pantrySuggestions');
  const restrictionsInPlay = useRestrictionsInPlay(useSelectedHomeId());
  const { rows } = useServerRecipeSuggestions(suggestionsOn, {
    excludeDietaryConflicts: true,
  });

  return {
    rows: rows
      .flatMap(row =>
        row.source === 'suggestion' && row.edge.coverage > 0 ? [row] : [],
      )
      .slice(0, PAYOFF_COUNT),
    showCheckLabel: restrictionsInPlay !== false,
  };
}
