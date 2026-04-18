import { useEffect } from 'react';
import {
  useGetPantryItemSuggestionsQuery,
  PantrySuggestionSource,
  type GetPantryItemSuggestionsQuery,
} from '#generated';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { resolveImageUrl } from '#utils/imageUtils';
import { preloadImages } from '#components/atoms/CachedImage';
import type { ErrorLike } from '@apollo/client';

type PantryItemSuggestion = NonNullable<
  GetPantryItemSuggestionsQuery['pantry']
>['suggestions'][number];

interface UsePantryItemSuggestionsOptions {
  pantryId: string | undefined;
  limit?: number;
  skip?: boolean;
}

interface GroupedSuggestions {
  [key: string]: PantryItemSuggestion[];
  lowStock: PantryItemSuggestion[];
  expiringSoon: PantryItemSuggestion[];
  recentlyDeleted: PantryItemSuggestion[];
  frequentlyAdded: PantryItemSuggestion[];
  popular: PantryItemSuggestion[];
}

export interface UsePantryItemSuggestionsReturn {
  suggestions: (PantryItemSuggestion & { imageUrl: string | null })[];
  grouped: GroupedSuggestions;
  loading: boolean;
  error: ErrorLike | undefined;
  hasSuggestions: boolean;
  refetch: () => Promise<unknown>;
  isOffline: boolean;
}

export function usePantryItemSuggestions({
  pantryId,
  limit = 10,
  skip = false,
}: UsePantryItemSuggestionsOptions): UsePantryItemSuggestionsReturn {
  const isOffline = useIsEffectivelyOffline();

  const { data, loading, error, refetch } = useGetPantryItemSuggestionsQuery({
    variables: { pantryId: pantryId!, limit },
    skip: skip || !pantryId || isOffline,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  const suggestions = (data?.pantry?.suggestions ?? []).map(
    (s: PantryItemSuggestion) => ({
      ...s,
      imageUrl: resolveImageUrl(s),
    }),
  );

  const grouped: GroupedSuggestions = {
    lowStock: [],
    expiringSoon: [],
    recentlyDeleted: [],
    frequentlyAdded: [],
    popular: [],
  };

  for (const suggestion of suggestions) {
    switch (suggestion.source) {
      case PantrySuggestionSource.LowStock:
        grouped.lowStock.push(suggestion);
        break;
      case PantrySuggestionSource.ExpiringSoon:
        grouped.expiringSoon.push(suggestion);
        break;
      case PantrySuggestionSource.RecentlyDeleted:
        grouped.recentlyDeleted.push(suggestion);
        break;
      case PantrySuggestionSource.FrequentlyAdded:
        grouped.frequentlyAdded.push(suggestion);
        break;
      case PantrySuggestionSource.Popular:
        grouped.popular.push(suggestion);
        break;
    }
  }

  // Preload suggestion images into disk cache for instant display
  useEffect(() => {
    if (suggestions.length > 0) {
      const urls = suggestions
        .map(s => s.imageUrl)
        .filter((url): url is string => !!url);
      if (urls.length > 0) {
        preloadImages(urls);
      }
    }
  }, [suggestions]);

  const hasSuggestions = !isOffline && suggestions.length > 0;

  return {
    suggestions: isOffline ? [] : suggestions,
    grouped,
    loading,
    error,
    hasSuggestions,
    refetch,
    isOffline,
  };
}

export type { PantryItemSuggestion };
