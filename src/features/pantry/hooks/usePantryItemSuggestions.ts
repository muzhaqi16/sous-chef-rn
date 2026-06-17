import { useEffect } from 'react';
import { useQuery } from '@apollo/client/react';
import {
  GetPantryItemSuggestionsDocument,
  type GetPantryItemSuggestionsQuery,
} from '#features/pantry/graphql/pantry.generated';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';
import { resolveImageUrl } from '#utils/imageUtils';
import { preloadImages } from '#components/atoms/CachedImage';
import type { ErrorLike } from '@apollo/client';

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
  limit = PANTRY_SUGGESTIONS_LIMIT,
  skip = false,
}: UsePantryItemSuggestionsOptions): UsePantryItemSuggestionsReturn {
  const isOffline = useIsEffectivelyOffline();

  const { data, loading, error, refetch } = useQuery(
    GetPantryItemSuggestionsDocument,
    {
      variables: { pantryId: pantryId!, limit },
      skip: skip || !pantryId || isOffline,
    },
  );

  // Each source arrives in its own aliased array (own quota); attach the
  // resolved image URL the rows render.
  const withImage = (s: PantryItemSuggestion) => ({
    ...s,
    imageUrl: resolveImageUrl(s),
  });

  const pantry = data?.pantry;
  const grouped: GroupedSuggestions = {
    lowStock: (pantry?.lowStock ?? []).map(withImage),
    expiringSoon: (pantry?.expiringSoon ?? []).map(withImage),
    recentlyDeleted: (pantry?.recentlyDeleted ?? []).map(withImage),
    frequentlyAdded: (pantry?.frequentlyAdded ?? []).map(withImage),
    popular: (pantry?.popular ?? []).map(withImage),
  };

  const suggestions = [
    ...grouped.lowStock,
    ...grouped.expiringSoon,
    ...grouped.recentlyDeleted,
    ...grouped.frequentlyAdded,
    ...grouped.popular,
  ];

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
