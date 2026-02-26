import { useEffect, useMemo } from 'react';
import {
  useGetPantryItemSuggestionsQuery,
  PantrySuggestionSource,
  type GetPantryItemSuggestionsQuery,
} from '#generated';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { resolveImageUrl } from '#utils/imageUtils';
import { preloadImages } from '#components/atoms/CachedImage';
import type { ErrorLike } from '@apollo/client';

type PantryItemSuggestion =
  NonNullable<GetPantryItemSuggestionsQuery['pantry']>['suggestions'][number];

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

  const suggestions = useMemo(
    () =>
      (data?.pantry?.suggestions ?? []).map((s: PantryItemSuggestion) => ({
        ...s,
        imageUrl: resolveImageUrl(s),
      })),
    [data?.pantry?.suggestions],
  );

  const grouped = useMemo<GroupedSuggestions>(() => {
    const result: GroupedSuggestions = {
      lowStock: [],
      expiringSoon: [],
      recentlyDeleted: [],
      frequentlyAdded: [],
      popular: [],
    };

    for (const suggestion of suggestions) {
      switch (suggestion.source) {
        case PantrySuggestionSource.LowStock:
          result.lowStock.push(suggestion);
          break;
        case PantrySuggestionSource.ExpiringSoon:
          result.expiringSoon.push(suggestion);
          break;
        case PantrySuggestionSource.RecentlyDeleted:
          result.recentlyDeleted.push(suggestion);
          break;
        case PantrySuggestionSource.FrequentlyAdded:
          result.frequentlyAdded.push(suggestion);
          break;
        case PantrySuggestionSource.Popular:
          result.popular.push(suggestion);
          break;
      }
    }

    return result;
  }, [suggestions]);

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
