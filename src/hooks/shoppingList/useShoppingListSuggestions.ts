import { useMemo } from 'react';
import {
  useGetShoppingListSuggestionsQuery,
  SuggestionSource,
  type GetShoppingListSuggestionsQuery,
} from '#generated';
import { useIsEffectivelyOffline } from '#hooks/settings/useOfflineMode';

/** Type for a single suggestion from the query result */
export type ShoppingListSuggestionItem =
  NonNullable<GetShoppingListSuggestionsQuery['shoppingList']>['suggestions'][number];

export interface GroupedSuggestions {
  recentlyDeleted: ShoppingListSuggestionItem[];
  frequentlyAdded: ShoppingListSuggestionItem[];
  popular: ShoppingListSuggestionItem[];
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
}: UseShoppingListSuggestionsOptions) {
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
