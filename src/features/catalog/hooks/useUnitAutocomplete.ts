import { logger } from '#/utils/environment';
import { useEffect, useRef, useState } from 'react';
import { skipToken, useApolloClient, useQuery } from '@apollo/client/react';
import {
  SearchUnitsDocument,
  GetCommonUnitsDocument,
} from '#operations/item/unit.generated';
import { useAppStore, useIsOnline } from '#store/useAppStore';
import { fromServer } from '#/apollo/utils/fromServer';
import { useAutocompleteSearch } from '#features/catalog/hooks/useAutocompleteSearch';
import { filterByTerm } from '#hooks/search/useLocalSearch';
import type { UnitType } from '#/graphql/generated/schemaTypes';

export interface UnitItem {
  id: string;
  name: string;
  symbol: string;
  type?: UnitType;
  abbreviation?: string;
}

/** 24 hours in milliseconds — matches backend refresh cadence for common units */
const UNITS_CACHE_TTL = 24 * 60 * 60 * 1000;

export function useUnitAutocomplete() {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const isOnline = useIsOnline();
  const cachedUnits = useAppStore(state => state.cachedUnits);
  const setCachedUnits = useAppStore(state => state.setCachedUnits);
  const lastUnitsFetchedAt = useAppStore(state => state.lastUnitsFetchedAt);
  const setLastUnitsFetchedAt = useAppStore(
    state => state.setLastUnitsFetchedAt,
  );

  // Lazy preload: fetch common units on first mount (when AddItemSheet opens)
  // and cache in Zustand for local-first autocomplete on subsequent uses
  const hasPreloadedRef = useRef(false);
  const client = useApolloClient();

  useEffect(() => {
    if (hasPreloadedRef.current) return;
    hasPreloadedRef.current = true;

    const isCacheFresh =
      cachedUnits.length > 0 &&
      lastUnitsFetchedAt !== null &&
      Date.now() - lastUnitsFetchedAt < UNITS_CACHE_TTL;

    if (isCacheFresh) return;

    requestIdleCallback(() => {
      void fromServer(() =>
        client.query({
          query: GetCommonUnitsDocument,
          fetchPolicy: 'network-only',
        }),
      )
        .then(data => {
          if (data && data.units.length > 0) {
            setCachedUnits(data.units);
            setLastUnitsFetchedAt(Date.now());
          }
        })
        .catch(error => logger.warn('Common units preload failed', error));
    });
  }, [
    cachedUnits.length,
    lastUnitsFetchedAt,
    client,
    setCachedUnits,
    setLastUnitsFetchedAt,
  ]);

  // Gated by `skipToken` (not lazy)
  const { data: searchData, loading } = useQuery(
    SearchUnitsDocument,
    debouncedSearchTerm.length >= 2
      ? {
          variables: { query: debouncedSearchTerm, limit: 10 },
          fetchPolicy: 'cache-first',
          refetchOn: false,
        }
      : skipToken,
  );

  const search = (term: string) => {
    setDebouncedSearchTerm(term);
  };

  const getResults = (): UnitItem[] => {
    if (debouncedSearchTerm && debouncedSearchTerm.length >= 2) {
      return searchData?.searchUnits ?? [];
    }
    return [];
  };

  const fallbackItems: UnitItem[] = cachedUnits;

  const filterFallback = (term: string, items: UnitItem[]): UnitItem[] => {
    return [...filterByTerm(items, term, ['symbol', 'name'])];
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
    // The cached units are the common ones only, and the server matches
    // plurals and alternate names ("sticks", "ounces"): it answers when it can.
    localFirst: !isOnline,
  });

  return autocomplete;
}
