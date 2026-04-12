import { useSearchStoresLazyQuery } from '#generated';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';

export type StoreItem = {
  id: string;
  name: string;
  address?: string | null;
};

export function useStoreAutocomplete() {
  const [searchStores, { data: storesData, loading }] =
    useSearchStoresLazyQuery();

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

  return useAutocompleteSearch<StoreItem>({
    search,
    getResults,
    loading,
    keyExtractor: item => item.id,
    minChars: 2,
    debounceMs: 300,
    requiresNetwork: true,
    maxResults: 10,
  });
}
