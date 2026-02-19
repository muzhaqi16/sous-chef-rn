import { useCallback, useMemo, useState } from 'react';
import { useSearchUnitsQuery } from '#generated';
import { useAppStore } from '#store/useAppStore';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';

export interface UnitItem {
  id: string;
  name: string;
  symbol: string;
  type?: string;
  abbreviation?: string;
}

export function useUnitAutocomplete() {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const cachedUnits = useAppStore(state => state.cachedUnits);

  // Skip-based query (not lazy)
  const { data: searchData, loading } = useSearchUnitsQuery({
    variables: { query: debouncedSearchTerm, limit: 10 },
    skip: !debouncedSearchTerm || debouncedSearchTerm.length < 2,
    fetchPolicy: 'cache-first',
  });

  const search = useCallback((term: string) => {
    setDebouncedSearchTerm(term);
  }, []);

  const getResults = useCallback((): UnitItem[] => {
    if (debouncedSearchTerm && debouncedSearchTerm.length >= 2) {
      return (searchData?.searchUnits || []) as UnitItem[];
    }
    return [];
  }, [debouncedSearchTerm, searchData?.searchUnits]);

  const fallbackItems = useMemo(() => cachedUnits as UnitItem[], [cachedUnits]);

  const filterFallback = useCallback(
    (term: string, items: UnitItem[]): UnitItem[] => {
      const lower = term.toLowerCase();
      return items.filter(
        unit =>
          unit.symbol.toLowerCase().includes(lower) ||
          unit.name.toLowerCase().includes(lower),
      );
    },
    [],
  );

  const autocomplete = useAutocompleteSearch<UnitItem>({
    search,
    getResults,
    loading,
    keyExtractor: item => item.id,
    minChars: 2,
    debounceMs: 300,
    requiresNetwork: true,
    fallbackItems,
    filterFallback,
    maxResults: 10,
  });

  return autocomplete;
}
