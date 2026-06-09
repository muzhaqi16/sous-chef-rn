import { useLazyQuery } from '@apollo/client/react';
import { SearchStoresDocument } from '#operations/store/store.generated';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';
import { useAppStore } from '#store/useAppStore';

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

  const filterFallback = (term: string, items: StoreItem[]): StoreItem[] => {
    const lower = term.toLowerCase();
    return items.filter(store => store.name.toLowerCase().includes(lower));
  };

  // localFirst: filter the warmed cache before firing the network query, so a
  // store the user has cached resolves instantly and works offline.
  return useAutocompleteSearch<StoreItem>({
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
    localFirst: true,
  });
}
