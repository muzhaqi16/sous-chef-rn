import { useLazyQuery } from '@apollo/client/react';
import { SearchBrandsDocument } from '#operations/item/item.generated';
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

export function useBrandAutocomplete(
  options: UseBrandAutocompleteOptions = {},
) {
  const { suggestedBrands = [] } = options;
  const [searchBrands, { data: brandsData, loading }] =
    useLazyQuery(SearchBrandsDocument);

  const search = (term: string) => {
    searchBrands({ variables: { search: term, limit: 20 } });
  };

  const fallbackItems: BrandItem[] = suggestedBrands.map(b => ({
    ...b,
    isSuggested: true,
  }));

  const filterFallback = (term: string, items: BrandItem[]): BrandItem[] => {
    const lower = term.toLowerCase();
    return items.filter(b => b.name.toLowerCase().includes(lower));
  };

  const getResults = (): BrandItem[] => {
    const searchedBrands = brandsData?.brands?.edges?.map(e => e.node) || [];
    return searchedBrands.map(brand => ({
      id: brand.id,
      name: brand.name,
      isSuggested: false,
    }));
  };

  // localFirst: true means useAutocompleteSearch filters cached suggestedBrands
  // before firing the network query. If a user types a brand that's already in
  // suggestedBrands, no API request is made — instant local results.
  return useAutocompleteSearch<BrandItem>({
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
