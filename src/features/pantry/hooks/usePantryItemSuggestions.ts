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
import { useToday } from '#hooks/useToday';

/**
 * Per-section limit. The sheet shows a small preview of each section that drills
 * into the full list, so this backs the drill-down without a second round-trip.
 */
export const PANTRY_SUGGESTIONS_LIMIT = 20;

type PantryItemSuggestion = NonNullable<
  GetPantryItemSuggestionsQuery['pantry']
>['suggestions']['popular'][number];

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
  const today = useToday();
  const skipped = skip || !pantryId;

  // Not skipped offline: `offlineModeLink` serves a cached read and answers a
  // miss with an error, which `useDataState` classifies as offline.
  const { data, loading, error, refetch } = useQuery(
    GetPantryItemSuggestionsDocument,
    skipped ? skipToken : { variables: { pantryId, limit, today } },
  );

  useApolloErrorLogger(GetPantryItemSuggestionsDocument, error);

  // Attach the resolved image URL the rows render.
  const withImage = (s: PantryItemSuggestion) => ({
    ...s,
    imageUrl: resolveImageUrl(s),
  });

  const sections = data?.pantry?.suggestions;
  const grouped = {
    lowStock: (sections?.lowStock ?? []).map(withImage),
    expiringSoon: (sections?.expiringSoon ?? []).map(withImage),
    recentlyDeleted: (sections?.recentlyDeleted ?? []).map(withImage),
    frequentlyAdded: (sections?.frequentlyAdded ?? []).map(withImage),
    popular: (sections?.popular ?? []).map(withImage),
  };

  // Preload suggestion images into disk cache for instant display. Keyed on the
  // Apollo result, which only changes when the data does — the derived arrays
  // above are rebuilt on every render.
  useEffect(() => {
    if (!sections) return;
    const urls = [
      ...sections.lowStock,
      ...sections.expiringSoon,
      ...sections.recentlyDeleted,
      ...sections.frequentlyAdded,
      ...sections.popular,
    ]
      .map(s => resolveImageUrl(s))
      .filter((url): url is string => !!url);
    if (urls.length > 0) {
      preloadImages(urls);
    }
  }, [sections]);

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
