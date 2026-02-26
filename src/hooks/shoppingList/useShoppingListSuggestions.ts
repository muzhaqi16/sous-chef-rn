import { useEffect, useMemo } from 'react';
import {
  useGetShoppingListSuggestionsQuery,
  SuggestionSource,
  type GetShoppingListSuggestionsQuery,
} from '#generated';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { resolveImageUrl } from '#utils/imageUtils';
import { preloadImages } from '#components/atoms/CachedImage';
import type { ErrorLike } from '@apollo/client';

/** Type for a single suggestion from the query result */
export type ShoppingListSuggestionItem =
  NonNullable<GetShoppingListSuggestionsQuery['shoppingList']>['suggestions'][number];

export interface GroupedSuggestions {
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
 * Hook to fetch and group shopping list suggestions by source.
 * Combines RECENTLY_DELETED, FREQUENTLY_ADDED, and POPULAR items.
 */
export function useShoppingListSuggestions({
  shoppingListId,
  limit = 15,
  skip = false,
}: UseShoppingListSuggestionsOptions): UseShoppingListSuggestionsReturn {
  const isOffline = useIsEffectivelyOffline();

  const { data, loading, error, refetch } = useGetShoppingListSuggestionsQuery({
    variables: {
      id: shoppingListId ?? '',
      limit,
    },
    skip: !shoppingListId || skip || isOffline,
    fetchPolicy: 'cache-and-network',
  });

  const suggestions = data?.shoppingList?.suggestions;

  const grouped = useMemo<GroupedSuggestions>(() => {
    const recentlyDeleted: ShoppingListSuggestionItem[] = [];
    const frequentlyAdded: ShoppingListSuggestionItem[] = [];
    const popular: ShoppingListSuggestionItem[] = [];

    if (suggestions) {
      for (const suggestion of suggestions) {
        switch (suggestion.source) {
          case SuggestionSource.RecentlyDeleted:
            recentlyDeleted.push(suggestion);
            break;
          case SuggestionSource.FrequentlyAdded:
            frequentlyAdded.push(suggestion);
            break;
          case SuggestionSource.Popular:
            popular.push(suggestion);
            break;
        }
      }
    }

    return { recentlyDeleted, frequentlyAdded, popular };
  }, [suggestions]);

  // Preload suggestion images into disk cache for instant display
  useEffect(() => {
    if (suggestions && suggestions.length > 0) {
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
    suggestions: isOffline ? [] : (suggestions ?? []),
    grouped,
    hasSuggestions: isOffline ? false : hasSuggestions,
    loading,
    error,
    refetch,
    isOffline,
  };
}
