import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useServerRecipeSuggestions } from './useServerRecipeSuggestions';
import {
  useSpoonacularDiscovery,
  type SpoonacularDiscoveryResult,
} from './useSpoonacularDiscovery';

const noLaterPage = () => undefined;

/**
 * The Recipes tab's discovery. With `pantrySuggestions` on, the server's
 * ranking, which has one page; the Spoonacular discovery that predates it fills
 * in when the server has nothing, and is all there is with the flag off.
 */
export function useRecipeDiscovery(
  dietaryTags?: string,
): SpoonacularDiscoveryResult {
  const serverEnabled = useFeatureFlag('pantrySuggestions');
  const server = useServerRecipeSuggestions(serverEnabled);
  const spoonacular = useSpoonacularDiscovery(dietaryTags, {
    enabled: !serverEnabled || server.unanswered,
  });

  if (!serverEnabled) return spoonacular;
  if (server.rows.length > 0) {
    return {
      ...spoonacular,
      mode: 'pantry',
      rows: server.rows,
      loading: server.loading,
      refresh: server.refresh,
      discoveryHasMore: false,
      loadMoreDiscovery: noLaterPage,
    };
  }
  return {
    ...spoonacular,
    loading: server.loading || (server.unanswered && spoonacular.loading),
  };
}
