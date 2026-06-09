import { useLazyQuery } from '@apollo/client/react';
import { AutocompleteCategoriesDocument } from '#operations/item/item.generated';
import {
  CategorySuggestion,
  CategoryType,
} from '#/graphql/generated/schemaTypes';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';
import { useAppStore } from '#store/useAppStore';

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

  const filterFallback = (
    term: string,
    items: CategorySuggestion[],
  ): CategorySuggestion[] => {
    const lower = term.toLowerCase();
    return items.filter(c => c.name.toLowerCase().includes(lower));
  };

  // localFirst: filter the warmed cache before firing the network query, so a
  // category the user has cached resolves instantly and works offline.
  const autocomplete = useAutocompleteSearch<CategorySuggestion>({
    search,
    getResults,
    loading,
    keyExtractor: item => item.id,
    minChars: 2,
    debounceMs: 300,
    requiresNetwork: true,
    fallbackItems,
    filterFallback,
    maxResults: 5,
    localFirst: true,
  });

  return autocomplete;
}
