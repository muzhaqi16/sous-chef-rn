import { useLazyQuery } from '@apollo/client/react';
import { AutocompleteCategoriesDocument } from '#operations/item/item.generated';
import {
  CategorySuggestion,
  CategoryType,
} from '#/graphql/generated/schemaTypes';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';
import { useAppStore, useIsOnline } from '#store/useAppStore';
import { filterByName } from '#/utils/arrayUtils';

interface UseCategoryAutocompleteOptions {
  categoryType?: CategoryType;
}

export function useCategoryAutocomplete(
  options: UseCategoryAutocompleteOptions = {},
) {
  const { categoryType = CategoryType.General } = options;
  const [searchCategories, { data, loading }] = useLazyQuery(
    AutocompleteCategoriesDocument,
  );

  // Reference data warmed while online (useDataPreloading), narrowed to the
  // requested category type so offline matches stay type-correct.
  const cachedCategories = useAppStore(state => state.cachedCategories);
  const fallbackItems = cachedCategories.filter(c => c.type === categoryType);
  const isOnline = useIsOnline();

  const search = (term: string) => {
    searchCategories({
      variables: {
        input: {
          query: term,
          limit: 5,
          type: categoryType,
        },
      },
    });
  };

  const getResults = (): CategorySuggestion[] => {
    return (data?.autocompleteCategories?.suggestions ||
      []) as CategorySuggestion[];
  };

  // Only serve from the warmed cache when offline. The cache is the first ~100
  // categories (GetCategories), so online we must still hit the server search
  // rather than cap results to the cached slice.
  const autocomplete = useAutocompleteSearch<CategorySuggestion>({
    search,
    getResults,
    loading,
    keyExtractor: item => item.id,
    minChars: 2,
    debounceMs: 300,
    requiresNetwork: true,
    fallbackItems,
    filterFallback: filterByName,
    maxResults: 5,
    localFirst: !isOnline,
  });

  return autocomplete;
}
