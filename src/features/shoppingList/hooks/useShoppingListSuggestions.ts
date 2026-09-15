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
 * Per-source fetch limit. Each section is fetched with its own quota, and the
 * sheet shows a small preview that drills into the full per-source list, so this
 * is generous enough to back the drill-down without a second round-trip.
 */
export const SHOPPING_SUGGESTIONS_LIMIT = 20;

export type ShoppingListSuggestionItem = NonNullable<
  GetShoppingListSuggestionsQuery['shoppingList']
>['popular'][number];

interface UseShoppingListSuggestionsOptions {
  shoppingListId: string | undefined;
  limit?: number;
  skip?: boolean;
}

/**
 * Shopping list suggestions grouped by source. Each of RECENTLY_DELETED,
 * FREQUENTLY_ADDED and POPULAR is fetched with its own quota (aliased query
 * fields), so no source can crowd out the others.
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

  const list = data?.shoppingList;

  const grouped = {
    recentlyDeleted: list?.recentlyDeleted ?? [],
    frequentlyAdded: list?.frequentlyAdded ?? [],
    popular: list?.popular ?? [],
  };

  // Preload suggestion images into disk cache for instant display. Keyed on the
  // Apollo result, which only changes when the data does — the derived arrays
  // above are rebuilt on every render.
  useEffect(() => {
    if (!list) return;
    const urls = [
      ...list.recentlyDeleted,
      ...list.frequentlyAdded,
      ...list.popular,
    ]
      .map(s => resolveImageUrl(s))
      .filter((url): url is string => !!url);
    if (urls.length > 0) {
      preloadImages(urls);
    }
  }, [list]);

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
