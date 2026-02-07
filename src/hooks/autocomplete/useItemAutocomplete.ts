import { useCallback, useDeferredValue } from 'react';
import { useAutocompleteItemsLazyQuery, ItemSuggestion } from '#generated';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';

export function useItemAutocomplete(options?: { debounceMs?: number }) {
  const [fetchItems, { data, loading }] = useAutocompleteItemsLazyQuery({
    fetchPolicy: 'cache-and-network',
  });

  const search = useCallback(
    (term: string) => {
      fetchItems({
        variables: { input: { query: term, limit: 10 } },
      });
    },
    [fetchItems],
  );

  const items = data?.autocompleteItems?.suggestions || [];
  const deferredItems = useDeferredValue(items);
  const isStale = items !== deferredItems;

  const getResults = useCallback((): ItemSuggestion[] => {
    return deferredItems as ItemSuggestion[];
  }, [deferredItems]);

  const autocomplete = useAutocompleteSearch<ItemSuggestion>({
    search,
    getResults,
    loading: loading || isStale,
    keyExtractor: item => item.id,
    minChars: 2,
    debounceMs: options?.debounceMs ?? 250,
    requiresNetwork: true,
    maxResults: 10,
  });

  return autocomplete;
}
