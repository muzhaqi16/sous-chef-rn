import { useDeferredValue, useEffect, useState } from 'react';
import { useLazyQuery } from '@apollo/client/react';
import {
  AutocompleteItemsDocument,
  SearchItemsSemanticDocument,
  SearchItemsSemanticQuery,
} from '#operations/item/item.generated';
import { ItemSuggestion } from '#/graphql/generated/schemaTypes';
import { useAutocompleteSearch } from '#hooks/ui/useAutocompleteSearch';
import { useAppStore, useIsOnline } from '#store/useAppStore';

type SemanticItem = NonNullable<
  SearchItemsSemanticQuery['searchItemsSemantic']['edges'][number]
>['node'];

function semanticItemToSuggestion(node: SemanticItem): ItemSuggestion {
  const primaryCategory =
    node.categories.find(c => c.isPrimary) ?? node.categories[0];

  return {
    __typename: 'ItemSuggestion',
    id: node.id,
    name: node.name,
    type: node.type,
    imageUrl: node.imageUrl,
    netWeight: node.netWeight,
    displayUnit: null,
    defaultUnit: node.defaultConsumeUnit
      ? {
          __typename: 'ItemUnitSuggestion',
          id: node.defaultConsumeUnit.id,
          name: node.defaultConsumeUnit.name,
          symbol: node.defaultConsumeUnit.symbol,
          type: node.defaultConsumeUnit.type,
          isDefault: true,
          isPreferred: false,
        }
      : null,
    brands: node.brands.map(b => ({
      __typename: 'BrandSuggestion',
      id: b.brand.id,
      name: b.brand.name,
    })),
    category: primaryCategory
      ? {
          __typename: 'ItemCategorySuggestion',
          id: primaryCategory.category.id,
          name: primaryCategory.category.name,
          isPrimary: primaryCategory.isPrimary,
          type: primaryCategory.category.type,
        }
      : null,
  };
}

export function useItemAutocomplete(options?: { debounceMs?: number }) {
  const [fetchItems, { data, loading }] = useLazyQuery(
    AutocompleteItemsDocument,
  );
  const [fetchSemantic, { data: semanticData, loading: semanticLoading }] =
    useLazyQuery(SearchItemsSemanticDocument);

  const [activeTerm, setActiveTerm] = useState('');

  const search = (term: string) => {
    setActiveTerm(term);
    fetchItems({
      variables: { input: { query: term, limit: 10 } },
    });
  };

  // Fall back to semantic search when the tsvector autocomplete returns no
  // results — handles typos, OCR noise, and natural-language prompts that
  // exact-match search misses. Auth-gated and embedding-priced server-side,
  // so we only fire after autocomplete has finished returning empty.
  const autocompleteSuggestions = data?.autocompleteItems?.suggestions ?? [];
  const hasAutocompleteResults = autocompleteSuggestions.length > 0;
  useEffect(() => {
    if (!activeTerm || loading || hasAutocompleteResults) return;
    if (!data) return;
    fetchSemantic({ variables: { prompt: activeTerm, first: 10 } });
  }, [activeTerm, loading, hasAutocompleteResults, data, fetchSemantic]);

  const semanticSuggestions = (
    semanticData?.searchItemsSemantic?.edges ?? []
  ).map(edge => semanticItemToSuggestion(edge.node));

  const items: ItemSuggestion[] = hasAutocompleteResults
    ? (autocompleteSuggestions as ItemSuggestion[])
    : semanticSuggestions;

  const deferredItems = useDeferredValue(items);
  const isStale = items !== deferredItems;

  const getResults = (): ItemSuggestion[] => deferredItems;

  // The catalog is far too large to cache, so we keep the items the user has
  // actually seen via search in a bounded LRU. Online we still hit the API for
  // fresh, full-catalog results; offline we serve those cached items.
  const isOnline = useIsOnline();
  const cachedItemSuggestions = useAppStore(
    state => state.cachedItemSuggestions,
  );
  const addCachedItemSuggestions = useAppStore(
    state => state.addCachedItemSuggestions,
  );

  useEffect(() => {
    if (deferredItems.length > 0) {
      addCachedItemSuggestions(deferredItems);
    }
  }, [deferredItems, addCachedItemSuggestions]);

  const filterFallback = (
    term: string,
    suggestions: ItemSuggestion[],
  ): ItemSuggestion[] => {
    const lower = term.toLowerCase();
    return suggestions.filter(item => item.name.toLowerCase().includes(lower));
  };

  const autocomplete = useAutocompleteSearch<ItemSuggestion>({
    search,
    getResults,
    loading: loading || semanticLoading || isStale,
    keyExtractor: item => item.id,
    minChars: 2,
    debounceMs: options?.debounceMs ?? 250,
    requiresNetwork: true,
    fallbackItems: cachedItemSuggestions,
    filterFallback,
    // Only serve from the seen-items cache when offline — online keeps hitting
    // the full-catalog API so search isn't limited to the cached subset.
    localFirst: !isOnline,
    maxResults: 10,
  });

  return autocomplete;
}
