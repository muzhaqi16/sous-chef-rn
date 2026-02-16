import { useCallback, useMemo, useRef } from 'react';
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
  const lastSearchedTermRef = useRef('');

  const search = useCallback(
    (term: string) => {
      lastSearchedTermRef.current = term;
      searchBrands({ variables: { search: term, limit: 20 } });
    },
    [searchBrands],
  );

  const fallbackItems = useMemo(
    (): BrandItem[] => suggestedBrands.map(b => ({ ...b, isSuggested: true })),
    [suggestedBrands],
  );

  const filterFallback = useCallback(
    (term: string, items: BrandItem[]): BrandItem[] => {
      const lower = term.toLowerCase();
      return items.filter(b => b.name.toLowerCase().includes(lower));
    },
    [],
  );

  const getResults = useCallback((): BrandItem[] => {
    const searchedBrands = brandsData?.brands?.edges?.map(e => e.node) || [];
    if (searchedBrands.length === 0) return [];
    return searchedBrands.map(brand => ({ id: brand.id, name: brand.name, isSuggested: false }));
  }, [brandsData?.brands]);

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
  const displayItems = useMemo((): BrandItem[] => {
    const { searchTerm, shouldSearch } = autocomplete;
    const searchedBrands = brandsData?.brands?.edges?.map(e => e.node) || [];

    // Check if API results are relevant to current search
    const resultsAreRelevant =
      shouldSearch &&
      searchedBrands.length > 0 &&
      searchTerm.toLowerCase().startsWith(lastSearchedTermRef.current.toLowerCase());

    if (resultsAreRelevant) {
      return searchedBrands.map(brand => ({ id: brand.id, name: brand.name, isSuggested: false }));
    }

    // Show fallback (suggested brands) with filtering
    if (suggestedBrands.length > 0) {
      if (searchTerm.length > 0) {
        const lower = searchTerm.toLowerCase();
        const filtered = suggestedBrands
          .filter(b => b.name.toLowerCase().includes(lower))
          .map(b => ({ ...b, isSuggested: true }));
        return filtered;
      }
      return suggestedBrands.map(b => ({ ...b, isSuggested: true }));
    }

    return [];
  }, [autocomplete, brandsData?.brands, suggestedBrands]);

  return {
    ...autocomplete,
    displayItems,
  };
}
