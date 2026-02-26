import { useState } from 'react';
import { useSearchBrandsLazyQuery } from '#generated';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';

interface SuggestedBrand {
  id: string;
  name: string;
}

export type BrandItem = {
  id: string;
  name: string;
  isSuggested?: boolean;
};

interface UseBrandAutocompleteOptions {
  suggestedBrands?: SuggestedBrand[];
}

export function useBrandAutocomplete(options: UseBrandAutocompleteOptions = {}) {
  const { suggestedBrands = [] } = options;
  const [searchBrands, { data: brandsData, loading }] = useSearchBrandsLazyQuery();
  const [lastSearchedTerm, setLastSearchedTerm] = useState('');

  const search = (term: string) => {
    setLastSearchedTerm(term);
    searchBrands({ variables: { search: term, limit: 20 } });
  };

  const fallbackItems: BrandItem[] = suggestedBrands.map(b => ({ ...b, isSuggested: true }));

  const filterFallback = (term: string, items: BrandItem[]): BrandItem[] => {
    const lower = term.toLowerCase();
    return items.filter(b => b.name.toLowerCase().includes(lower));
  };

  const getResults = (): BrandItem[] => {
    const searchedBrands = brandsData?.brands?.edges?.map(e => e.node) || [];
    if (searchedBrands.length === 0) return [];
    return searchedBrands.map(brand => ({ id: brand.id, name: brand.name, isSuggested: false }));
  };

  const autocomplete = useAutocompleteSearch<BrandItem>({
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

  // Override displayItems to handle the stale-data check and suggested brand priority
  const { searchTerm, shouldSearch } = autocomplete;
  const searchedBrands = brandsData?.brands?.edges?.map(e => e.node) || [];

  // Check if API results are relevant to current search
  const resultsAreRelevant =
    shouldSearch &&
    searchedBrands.length > 0 &&
    searchTerm.toLowerCase().startsWith(lastSearchedTerm.toLowerCase());

  let displayItems: BrandItem[];
  if (resultsAreRelevant) {
    displayItems = searchedBrands.map(brand => ({ id: brand.id, name: brand.name, isSuggested: false }));
  } else if (suggestedBrands.length > 0) {
    // Show fallback (suggested brands) with filtering
    if (searchTerm.length > 0) {
      const lower = searchTerm.toLowerCase();
      displayItems = suggestedBrands
        .filter(b => b.name.toLowerCase().includes(lower))
        .map(b => ({ ...b, isSuggested: true }));
    } else {
      displayItems = suggestedBrands.map(b => ({ ...b, isSuggested: true }));
    }
  } else {
    displayItems = [];
  }

  return {
    ...autocomplete,
    displayItems,
  };
}
