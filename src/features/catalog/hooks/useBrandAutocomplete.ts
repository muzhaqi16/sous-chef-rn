import { useLazyQuery } from '@apollo/client/react';
import { SearchBrandsDocument } from '#operations/item/item.generated';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';
import { useAppStore, useIsOnline } from '#store/useAppStore';
import { dedupeById, filterByName } from '#/utils/arrayUtils';

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
  const fallbackItems: BrandItem[] = dedupeById([
    ...suggestedBrands,
    ...cachedBrands,
  ]).map(brand => ({ id: brand.id, name: brand.name, isSuggested: true }));

  const isOnline = useIsOnline();

  const search = (term: string) => {
    searchBrands({ variables: { search: term, limit: 20 } });
  };

  const getResults = (): BrandItem[] => {
    const searchedBrands = brandsData?.brands?.edges?.map(e => e.node) || [];
    return searchedBrands.map(brand => ({
      id: brand.id,
      name: brand.name,
      isSuggested: false,
    }));
  };

  // Only serve from the local fallback (suggested + warmed first ~100 brands)
  // when offline. Online we must still hit the full-catalog search so a brand
  // outside the cached slice isn't suppressed by a cached name collision. The
  // curated suggestions still appear as the pre-search fallback (before the
  // 2-char minimum) regardless of this flag.
  return useAutocompleteSearch<BrandItem>({
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
