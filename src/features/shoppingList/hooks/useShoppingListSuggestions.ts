import { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  GetShoppingListSuggestionsDocument,
  type GetShoppingListSuggestionsQuery,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { resolveImageUrl } from '#utils/imageUtils';
import { preloadImages } from '#components/atoms/CachedImage';
import type { ErrorLike } from '@apollo/client';

/**
 * Per-source fetch limit. Each section is fetched with its own quota, and the
 * sheet shows a small preview that drills into the full per-source list, so this
 * is generous enough to back the drill-down without a second round-trip.
 */
export const SHOPPING_SUGGESTIONS_LIMIT = 20;

/** Type for a single suggestion from the query result */
export type ShoppingListSuggestionItem = NonNullable<
  GetShoppingListSuggestionsQuery['shoppingList']
>['popular'][number];

export interface GroupedSuggestions {
  [key: string]: ShoppingListSuggestionItem[];
  recentlyDeleted: ShoppingListSuggestionItem[];
  frequentlyAdded: ShoppingListSuggestionItem[];
  popular: ShoppingListSuggestionItem[];
}

export interface UseShoppingListSuggestionsReturn {
  suggestions: ShoppingListSuggestionItem[];
  grouped: GroupedSuggestions;
  hasSuggestions: boolean;
  loading: boolean;
  error: ErrorLike | undefined;
  refetch: () => Promise<unknown>;
  isOffline: boolean;
}

interface UseShoppingListSuggestionsOptions {
  shoppingListId: string | undefined;
  limit?: number;
  skip?: boolean;
}

/**
 * Hook to fetch shopping list suggestions grouped by source.
 * Each of RECENTLY_DELETED, FREQUENTLY_ADDED, and POPULAR is fetched with its
 * own quota (aliased query fields), so no source can crowd out the others.
 */
export function useShoppingListSuggestions({
  shoppingListId,
  limit = SHOPPING_SUGGESTIONS_LIMIT,
  skip = false,
}: UseShoppingListSuggestionsOptions): UseShoppingListSuggestionsReturn {
  const isOffline = useIsEffectivelyOffline();

  const { data, loading, error, refetch } = useQuery(
    GetShoppingListSuggestionsDocument,
    {
      variables: {
        id: shoppingListId ?? '',
        limit,
      },
      skip: !shoppingListId || skip || isOffline,
    },
  );

  const list = data?.shoppingList;

  const grouped: GroupedSuggestions = {
    recentlyDeleted: list?.recentlyDeleted ?? [],
    frequentlyAdded: list?.frequentlyAdded ?? [],
    popular: list?.popular ?? [],
  };

  const suggestions: ShoppingListSuggestionItem[] = [
    ...grouped.recentlyDeleted,
    ...grouped.frequentlyAdded,
    ...grouped.popular,
  ];

  // Preload suggestion images into disk cache for instant display
  useEffect(() => {
    if (suggestions.length > 0) {
      const urls = suggestions
        .map(s => resolveImageUrl(s))
        .filter((url): url is string => !!url);
      if (urls.length > 0) {
        preloadImages(urls);
      }
    }
  }, [suggestions]);

  const hasSuggestions =
    grouped.recentlyDeleted.length > 0 ||
    grouped.frequentlyAdded.length > 0 ||
    grouped.popular.length > 0;

  return {
    suggestions: isOffline ? [] : suggestions,
    grouped,
    hasSuggestions: isOffline ? false : hasSuggestions,
    loading,
    error,
    refetch,
    isOffline,
  };
}
