import { useLazyQuery } from '@apollo/client/react';
import { SearchBrandsDocument } from '#operations/item/item.generated';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';
import { useAppStore } from '#store/useAppStore';

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

  // Caller-supplied suggestions plus the warmed reference cache
  // (useDataPreloading), deduped by id, give offline-capable local fallback.
  const cachedBrands = useAppStore(state => state.cachedBrands);
  const fallbackItems: BrandItem[] = [];
  const seenBrandIds = new Set<string>();
  for (const brand of [...suggestedBrands, ...cachedBrands]) {
    if (seenBrandIds.has(brand.id)) continue;
    seenBrandIds.add(brand.id);
    fallbackItems.push({ id: brand.id, name: brand.name, isSuggested: true });
  }

  const search = (term: string) => {
    searchBrands({ variables: { search: term, limit: 20 } });
  };

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

  // localFirst: filter the local fallback (suggested + warmed cache) before
  // firing the network query. If a user types a brand already cached, no API
  // request is made — instant local results that also work offline.
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
