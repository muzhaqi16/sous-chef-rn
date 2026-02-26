import { useAutocompleteCategoriesLazyQuery, CategorySuggestion, CategoryType } from '#generated';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';

interface UseCategoryAutocompleteOptions {
  categoryType?: CategoryType;
}

export function useCategoryAutocomplete(options: UseCategoryAutocompleteOptions = {}) {
  const { categoryType = CategoryType.General } = options;
  const [searchCategories, { data, loading }] = useAutocompleteCategoriesLazyQuery();

  const search = (term: string) => {
      searchCategories({
        variables: {
          input: {
            query: term,
            limit: 5,
            type: categoryType } } });
    };

  const getResults = (): CategorySuggestion[] => {
    return (data?.autocompleteCategories?.suggestions || []) as CategorySuggestion[];
  };

  const autocomplete = useAutocompleteSearch<CategorySuggestion>({
    search,
    getResults,
    loading,
    keyExtractor: item => item.id,
    minChars: 2,
    debounceMs: 300,
    requiresNetwork: true,
    maxResults: 5 });

  return autocomplete;
}
