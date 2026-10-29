import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useSelectedHomeId } from '#store/useAppStore';
import { useServerRecipeSuggestions } from '#features/recipes/hooks/useServerRecipeSuggestions';
import { useRestrictionsInPlay } from '#features/profile/hooks/useRestrictionsInPlay';
import { useOnboardingProgressStore } from '#features/onboarding/store/onboardingProgressStore';

const PAYOFF_COUNT = 3;

/**
 * Up to three recipes the pantry can already make, from the Recipes tab's own
 * suggestions request. The API screens suggestions by allergy tags only, so a
 * user with any saved restriction, or one shared with their home, gets none:
 * never a recipe nobody checked against them.
 */
export function useRecipePayoff() {
  const suggestionsOn = useFeatureFlag('pantrySuggestions');
  const restrictionsInPlay = useRestrictionsInPlay(useSelectedHomeId());
  const dietarySaved = useOnboardingProgressStore(state => state.dietarySaved);
  const screened = restrictionsInPlay === false && !dietarySaved;
  const { rows } = useServerRecipeSuggestions(suggestionsOn && screened);

  return {
    rows: rows
      .flatMap(row =>
        row.source === 'suggestion' && row.edge.coverage > 0 ? [row] : [],
      )
      .slice(0, PAYOFF_COUNT),
  };
}
