import { useMemo } from 'react';
import {
  useGetPantryItemSuggestionsQuery,
  PantrySuggestionSource,
  type GetPantryItemSuggestionsQuery,
} from '#generated';

type PantryItemSuggestion =
  GetPantryItemSuggestionsQuery['pantryItemSuggestions'][number];

interface UsePantryItemSuggestionsOptions {
  pantryId: string | undefined;
  limit?: number;
  skip?: boolean;
}

interface GroupedSuggestions {
  lowStock: PantryItemSuggestion[];
  expiringSoon: PantryItemSuggestion[];
  recentlyDeleted: PantryItemSuggestion[];
  frequentlyAdded: PantryItemSuggestion[];
  popular: PantryItemSuggestion[];
}

export function usePantryItemSuggestions({
  pantryId,
  limit = 10,
  skip = false,
}: UsePantryItemSuggestionsOptions) {
  const { data, loading, error, refetch } = useGetPantryItemSuggestionsQuery({
    variables: { pantryId: pantryId!, limit },
    skip: skip || !pantryId,
    fetchPolicy: 'cache-and-network',
  });

  const suggestions = useMemo(
    () => data?.pantryItemSuggestions ?? [],
    [data?.pantryItemSuggestions],
  );

  // Group by source for sectioned display
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

  const hasSuggestions = suggestions.length > 0;

  return {
    suggestions,
    grouped,
    loading,
    error,
    hasSuggestions,
    refetch,
  };
}

export type { PantryItemSuggestion };
