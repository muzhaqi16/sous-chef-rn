import { useEffect } from 'react';
import { skipToken, useQuery } from '@apollo/client/react';
import {
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { resolveImageUrl } from '#utils/imageUtils';
import { preloadImages } from '#components/atoms/CachedImage';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { useDataState } from '#hooks/data/useDataState';
import { errorService } from '#/services/errorService';
import type { SuggestionsHookResult } from '#features/catalog/ui/AddItemSheet/types';

/**
 * Per-section limit. The sheet shows a small preview of each section that drills
 * into the full list, so this backs the drill-down without a second round-trip.
 */
export const SHOPPING_SUGGESTIONS_LIMIT = 20;

export type ShoppingListSuggestionItem = NonNullable<
  GetShoppingListSuggestionsQuery['shoppingList']
>['suggestions']['popular'][number];

interface UseShoppingListSuggestionsOptions {
  shoppingListId: string | undefined;
  limit?: number;
  skip?: boolean;
}

/**
 * Shopping list suggestions by section, each with its own quota. The server
 * places an item in only the first section that offers it.
 */
export function useShoppingListSuggestions({
  shoppingListId,
  limit = SHOPPING_SUGGESTIONS_LIMIT,
  skip = false,
}: UseShoppingListSuggestionsOptions): SuggestionsHookResult<ShoppingListSuggestionItem> {
  const skipped = skip || !shoppingListId;

  // Not skipped offline: `offlineModeLink` serves a cached read and answers a
  // miss with an error, which `useDataState` classifies as offline.
  const { data, loading, error, refetch } = useQuery(
    GetShoppingListSuggestionsDocument,
    skipped ? skipToken : { variables: { id: shoppingListId, limit } },
  );

  useApolloErrorLogger(GetShoppingListSuggestionsDocument, error);

  const sections = data?.shoppingList?.suggestions;

  const grouped = {
    recentlyDeleted: sections?.recentlyDeleted ?? [],
    frequentlyAdded: sections?.frequentlyAdded ?? [],
    popular: sections?.popular ?? [],
  };

  // Preload suggestion images into disk cache for instant display. Keyed on the
  // Apollo result, which only changes when the data does — the derived arrays
  // above are rebuilt on every render.
  useEffect(() => {
    if (!sections) return;
    const urls = [
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
          operation: 'useShoppingListSuggestions.refetch',
        }),
      );
    },
  };
}
