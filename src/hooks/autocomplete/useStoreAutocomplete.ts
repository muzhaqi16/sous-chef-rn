import { useState } from 'react';
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
  const [lastSearchedTerm, setLastSearchedTerm] = useState('');

  const search = (term: string) => {
    setLastSearchedTerm(term);
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

  const autocomplete = useAutocompleteSearch<StoreItem>({
    search,
    getResults,
    loading,
    keyExtractor: item => item.id,
    minChars: 2,
    debounceMs: 300,
    requiresNetwork: true,
    maxResults: 10,
  });

  // Override displayItems to handle the stale-data check
  const { searchTerm, shouldSearch } = autocomplete;
  const searchedStores = storesData?.stores?.edges?.map(e => e.node) || [];

  // Check if API results are relevant to current search
  const resultsAreRelevant =
    shouldSearch &&
    searchedStores.length > 0 &&
    searchTerm.toLowerCase().startsWith(lastSearchedTerm.toLowerCase());

  const displayItems: StoreItem[] = resultsAreRelevant
    ? searchedStores.map(store => ({
        id: store.id,
        name: store.name,
        address: store.address,
      }))
    : [];

  return {
    ...autocomplete,
    displayItems,
  };
}
