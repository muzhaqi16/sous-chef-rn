import { useLazyQuery } from '@apollo/client/react';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';
import { useAppStore, useIsOnline } from '#store/useAppStore';
import { filterByName } from '#/utils/arrayUtils';

export type StoreItem = {
  id: string;
  name: string;
  address?: string | null;
};

export function useStoreAutocomplete() {
  const [searchStores, { data: storesData, loading }] =
    useLazyQuery(SearchStoresDocument);

  // Reference data warmed while online (useDataPreloading) for offline fallback.
  const cachedStores = useAppStore(state => state.cachedStores);
  const fallbackItems: StoreItem[] = cachedStores.map(store => ({
    id: store.id,
    name: store.name,
    address: store.address ?? null,
  }));

  const isOnline = useIsOnline();

  const search = (term: string) => {
    searchStores({ variables: { search: term, limit: 20 } });
  };

  const getResults = (): StoreItem[] => {
    const searchedStores = storesData?.stores?.edges?.map(e => e.node) || [];
    if (searchedStores.length === 0) return [];
    return searchedStores.map(store => ({
      id: store.id,
      name: store.name,
      address: store.address,
    }));
  };

  // Only serve from the warmed cache when offline. The cache is the first ~100
  // stores (GetStores), so online we must still hit the full-catalog search —
  // otherwise a store outside that slice that collides with a cached name would
  // be unreachable.
  return useAutocompleteSearch<StoreItem>({
    search,
    getResults,
    loading,
    keyExtractor: item => item.id,
    minChars: 2,
    debounceMs: 300,
    requiresNetwork: true,
    fallbackItems,
    filterFallback: filterByName,
    maxResults: 10,
    localFirst: !isOnline,
  });
}
