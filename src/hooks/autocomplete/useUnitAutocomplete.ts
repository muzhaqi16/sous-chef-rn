import { useEffect, useRef, useState } from 'react';
import { useSearchUnitsQuery, useGetCommonUnitsLazyQuery } from '#generated';
import { useAppStore } from '#store/useAppStore';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';

export interface UnitItem {
  id: string;
  name: string;
  symbol: string;
  type?: string;
  abbreviation?: string;
}

/** 24 hours in milliseconds — matches backend refresh cadence for common units */
const UNITS_CACHE_TTL = 24 * 60 * 60 * 1000;

export function useUnitAutocomplete() {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const cachedUnits = useAppStore(state => state.cachedUnits);
  const setCachedUnits = useAppStore(state => state.setCachedUnits);
  const lastUnitsFetchedAt = useAppStore(state => state.lastUnitsFetchedAt);
  const setLastUnitsFetchedAt = useAppStore(
    state => state.setLastUnitsFetchedAt,
  );

  // Lazy preload: fetch common units on first mount (when AddItemSheet opens)
  // and cache in Zustand for local-first autocomplete on subsequent uses
  const hasPreloadedRef = useRef(false);
  const [fetchCommonUnits] = useGetCommonUnitsLazyQuery({
    fetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });

  useEffect(() => {
    if (hasPreloadedRef.current) return;
    hasPreloadedRef.current = true;

    const isCacheFresh =
      cachedUnits.length > 0 &&
      lastUnitsFetchedAt !== null &&
      Date.now() - lastUnitsFetchedAt < UNITS_CACHE_TTL;

    if (isCacheFresh) return;

    requestIdleCallback(() => {
      fetchCommonUnits().then(result => {
        if (result.data?.units && result.data.units.length > 0) {
          setCachedUnits(result.data.units);
          setLastUnitsFetchedAt(Date.now());
        }
      });
    });
  }, [cachedUnits.length, lastUnitsFetchedAt, fetchCommonUnits, setCachedUnits, setLastUnitsFetchedAt]);

  // Skip-based query (not lazy)
  const { data: searchData, loading } = useSearchUnitsQuery({
    variables: { query: debouncedSearchTerm, limit: 10 },
    skip: !debouncedSearchTerm || debouncedSearchTerm.length < 2,
    fetchPolicy: 'cache-first' });

  const search = (term: string) => {
    setDebouncedSearchTerm(term);
  };

  const getResults = (): UnitItem[] => {
    if (debouncedSearchTerm && debouncedSearchTerm.length >= 2) {
      return (searchData?.searchUnits || []) as UnitItem[];
    }
    return [];
  };

  const fallbackItems = cachedUnits as UnitItem[];

  const filterFallback = (term: string, items: UnitItem[]): UnitItem[] => {
      const lower = term.toLowerCase();
      return items.filter(
        unit =>
          unit.symbol.toLowerCase().includes(lower) ||
          unit.name.toLowerCase().includes(lower),
      );
    };

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
    localFirst: true });

  return autocomplete;
}
