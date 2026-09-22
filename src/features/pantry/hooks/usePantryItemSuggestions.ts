import { useEffect } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import {
  GetPantryItemSuggestionsDocument,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import { resolveImageUrl } from '#utils/imageUtils';
import { preloadImages } from '#components/atoms/CachedImage';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useDataState } from '#hooks/data/useDataState';
import { errorService } from '#/services/errorService';
import type { SuggestionsHookResult } from '#features/catalog/ui/AddItemSheet/types';
import { toDateKey } from '#/utils/dateUtils';

/**
 * Per-source fetch limit. Each section is fetched with its own quota, and the
 * sheet shows a small preview that drills into the full per-source list, so this
 * is generous enough to back the drill-down without a second round-trip.
 */
export const PANTRY_SUGGESTIONS_LIMIT = 20;

type PantryItemSuggestion = NonNullable<
  GetPantryItemSuggestionsQuery['pantry']
>['popular'][number];

interface UsePantryItemSuggestionsOptions {
  pantryId: string | undefined;
  limit?: number;
  skip?: boolean;
}

export function usePantryItemSuggestions({
  pantryId,
  limit = PANTRY_SUGGESTIONS_LIMIT,
  skip = false,
}: UsePantryItemSuggestionsOptions): SuggestionsHookResult<PantryItemSuggestion> {
  const skipped = skip || !pantryId;

  // Not skipped offline: `offlineModeLink` serves a cached read and answers a
  // miss with an error, which `useDataState` classifies as offline.
  const { data, loading, error, refetch } = useQuery(
    GetPantryItemSuggestionsDocument,
    skipped
      ? skipToken
      : { variables: { pantryId, limit, today: toDateKey(new Date()) } },
  );

  useApolloErrorLogger(GetPantryItemSuggestionsDocument, error);

  // Each source arrives in its own aliased array (own quota); attach the
  // resolved image URL the rows render.
  const withImage = (s: PantryItemSuggestion) => ({
    ...s,
    imageUrl: resolveImageUrl(s),
  });

  const pantry = data?.pantry;
  const grouped = {
    lowStock: (pantry?.lowStock ?? []).map(withImage),
    expiringSoon: (pantry?.expiringSoon ?? []).map(withImage),
    recentlyDeleted: (pantry?.recentlyDeleted ?? []).map(withImage),
    frequentlyAdded: (pantry?.frequentlyAdded ?? []).map(withImage),
    popular: (pantry?.popular ?? []).map(withImage),
  };

  // Preload suggestion images into disk cache for instant display. Keyed on the
  // Apollo result, which only changes when the data does — the derived arrays
  // above are rebuilt on every render.
  useEffect(() => {
    if (!pantry) return;
    const urls = [
      ...pantry.lowStock,
      ...pantry.expiringSoon,
      ...pantry.recentlyDeleted,
      ...pantry.frequentlyAdded,
      ...pantry.popular,
    ]
      .map(s => resolveImageUrl(s))
      .filter((url): url is string => !!url);
    if (urls.length > 0) {
      preloadImages(urls);
    }
  }, [pantry]);

  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: Object.values(grouped).every(items => items.length === 0),
    skipped,
  });

  return {
    grouped,
    state,
    refetch: () => {
      void refetch().catch(refetchError =>
        errorService.reportError(refetchError, {
          operation: 'usePantryItemSuggestions.refetch',
        }),
      );
    },
  };
}

export type { PantryItemSuggestion };
