import { useFeatureFlag } from '#hooks/settings/useFeatureFlag';
import { useServerRecipeSuggestions } from './useServerRecipeSuggestions';
import {
  useCatalogDiscovery,
  type CatalogDiscoveryResult,
  type DiscoveryDiet,
} from './useCatalogDiscovery';

const noLaterPage = () => undefined;

/**
 * The Recipes tab's discovery. With `pantrySuggestions` on, the server's
 * ranking, which has one page; the catalog discovery that predates it fills in
 * when the server has nothing, and is all there is with the flag off.
 */
export function useRecipeDiscovery(
  diet: DiscoveryDiet,
): CatalogDiscoveryResult {
  const serverEnabled = useFeatureFlag('pantrySuggestions');
  const server = useServerRecipeSuggestions(serverEnabled);
  const catalog = useCatalogDiscovery(diet, {
    enabled: !serverEnabled || server.unanswered,
  });

  if (!serverEnabled) return catalog;
  if (server.rows.length > 0) {
    return {
      ...catalog,
      // Ranked with nothing the pantry holds (an empty pantry): ideas to try.
      mode: server.fromPantry ? 'pantry' : 'random',
      rows: server.rows,
      loading: server.loading,
      refreshing: server.refreshing,
      failed: false,
      refresh: server.refresh,
      discoveryHasMore: false,
      loadMoreDiscovery: noLaterPage,
    };
  }
  return {
    ...catalog,
    loading: server.loading || (server.unanswered && catalog.loading),
  };
}
