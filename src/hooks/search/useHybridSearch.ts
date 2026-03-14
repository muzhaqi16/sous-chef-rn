import { useState, useEffect, useRef } from 'react';
import { useApolloClient } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { useDebouncedValue } from '#hooks/utils/useDebouncedValue';
import { shouldUseServerSort } from '#/utils/hybridSort';
import { executeSearchQuery } from '#/utils/compilerSafeWrappers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseHybridSearchConfig<TQuery, TItem extends { id: string }> {
  /** Items from the main query (for local search fallback) */
  items: TItem[];
  /** Server-reported total count (drives server-vs-local decision) */
  totalCount: number;
  /** Whether more pages remain to be fetched */
  hasMore: boolean;
  /** Whether the main query is currently loading */
  loading: boolean;
  /** Page size (e.g. PAGE_SIZE.EXTENDED) */
  pageSize: number;
  /** Whether the device is online */
  isOnline: boolean;
  /** GraphQL document for server search */
  searchDocument: DocumentNode;
  /** Build variables for the server search query. Return null to skip. */
  buildSearchVariables: (
    debouncedSearch: string,
  ) => Record<string, unknown> | null;
  /** Extract items from the query response */
  extractItems: (data: TQuery) => TItem[];
  /** Local search predicate */
  searchPredicate: (item: TItem, query: string) => boolean;
  /** Debounce delay in ms (default 300; 0 for instant) */
  debounceMs?: number;
}

export interface UseHybridSearchReturn<TItem> {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  debouncedSearch: string;
  searchActive: boolean;
  useServerSort: boolean;
  activeItems: TItem[];
  isSearching: boolean;
  /** Optimistically remove an item from server search results by id */
  removeFromResults: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Variable stabilization — prevents the effect from re-firing when
// buildSearchVariables returns an identical-but-new object reference.
// ---------------------------------------------------------------------------

function stableStringify(value: unknown): string {
  return JSON.stringify(value) ?? '';
}

// Stable empty array reference for when server results are null (loading state)
const EMPTY_SEARCH_RESULTS: never[] = [];

// Module-level cache for local filter results — prevents new array on every render
// when items reference and search query haven't changed
let _lastFilterItems: unknown = null;
let _lastFilterQuery = '';
let _lastFilterResult: any[] = [];

function cachedLocalFilter<TItem extends { id: string }>(
  items: TItem[],
  query: string,
  predicate: (item: TItem, q: string) => boolean,
): TItem[] {
  if (items === _lastFilterItems && query === _lastFilterQuery) {
    return _lastFilterResult as TItem[];
  }
  const result = query ? items.filter(item => predicate(item, query)) : items;
  _lastFilterItems = items;
  _lastFilterQuery = query;
  _lastFilterResult = result;
  return result;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHybridSearch<TQuery, TItem extends { id: string }>(
  config: UseHybridSearchConfig<TQuery, TItem>,
): UseHybridSearchReturn<TItem> {
  const {
    items,
    totalCount,
    hasMore,
    loading,
    pageSize,
    isOnline,
    searchDocument,
    buildSearchVariables,
    extractItems,
    searchPredicate,
    debounceMs = 300,
  } = config;

  const client = useApolloClient();

  // -------------------------------------------------------------------------
  // Search query state + debouncing
  // -------------------------------------------------------------------------

  const [searchQuery, setSearchQuery] = useState('');
  const rawDebouncedSearch = useDebouncedValue(searchQuery, debounceMs);
  // Clearing to empty bypasses debounce — show all items immediately
  const debouncedSearch = searchQuery === '' ? '' : rawDebouncedSearch;

  // -------------------------------------------------------------------------
  // Server sort decision — "adjusting state during render" pattern
  // -------------------------------------------------------------------------

  const [knownTotalCount, setKnownTotalCount] = useState(0);
  const [allItemsLoaded, setAllItemsLoaded] = useState(false);

  // Update knownTotalCount from main query (only when not searching)
  if (totalCount > 0 && totalCount !== knownTotalCount && !debouncedSearch) {
    setKnownTotalCount(totalCount);
  }

  // Track when all pages have been loaded
  if (
    !hasMore &&
    !loading &&
    totalCount > 0 &&
    !allItemsLoaded &&
    !debouncedSearch &&
    items.length >= totalCount
  ) {
    setAllItemsLoaded(true);
  }
  // Reset when more data becomes available (items added, filter changed, refetch)
  if (hasMore && allItemsLoaded) {
    setAllItemsLoaded(false);
  }

  const useServerSort =
    shouldUseServerSort(knownTotalCount, pageSize, isOnline) && !allItemsLoaded;

  const searchActive = useServerSort && !!debouncedSearch;

  // -------------------------------------------------------------------------
  // Server search execution — client.query() inside useEffect
  // -------------------------------------------------------------------------

  // Track the variablesKey that the latest server results correspond to.
  // When the key changes, we know a new search is in-flight until results arrive.
  const [serverState, setServerState] = useState<{
    results: TItem[] | null;
    resolvedKey: string;
  }>({ results: null, resolvedKey: '' });

  // Clear server results during render when search deactivates
  // ("adjusting state during render" pattern — avoids sync setState in effect)
  if (!searchActive && serverState.results !== null) {
    setServerState({ results: null, resolvedKey: '' });
  }

  // Stabilize variables via JSON key — the key is the effect dependency,
  // not the object itself (which is a new reference each render).
  const variables = searchActive ? buildSearchVariables(debouncedSearch) : null;
  const variablesKey = stableStringify(variables);

  // Derive isSearching: we're searching when server sort is active with a search
  // term and results haven't arrived for the current variables yet
  const isSearching =
    searchActive && !!variables && serverState.resolvedKey !== variablesKey;

  // Store extractItems in a ref so the effect can read it without
  // depending on the (potentially unstable) function reference.
  // Written in an effect (not during render) per React Compiler rules.
  const extractItemsRef = useRef(extractItems);
  useEffect(() => {
    extractItemsRef.current = extractItems;
  });

  useEffect(() => {
    if (!searchActive || variablesKey === 'null') return;

    // Reconstruct variables from the stable JSON key inside the effect,
    // avoiding the unstable object reference as a dependency.
    const effectVariables = JSON.parse(variablesKey) as Record<string, unknown>;
    const currentExtract = extractItemsRef.current;
    let cancelled = false;

    const run = async () => {
      const data = await executeSearchQuery<TQuery>(
        () =>
          client.query<TQuery>({
            query: searchDocument,
            variables: effectVariables,
            fetchPolicy: 'network-only',
          }),
        () => cancelled,
      );

      if (cancelled) return;

      if (data) {
        setServerState({
          results: currentExtract(data),
          resolvedKey: variablesKey,
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [searchActive, variablesKey, client, searchDocument]);

  // -------------------------------------------------------------------------
  // Optimistic removal from server search results
  // -------------------------------------------------------------------------

  const removeFromResults = (id: string) => {
    setServerState(prev => ({
      ...prev,
      results: prev.results?.filter(item => item.id !== id) ?? null,
    }));
  };

  // -------------------------------------------------------------------------
  // Determine active items
  // -------------------------------------------------------------------------

  let activeItems: TItem[];

  if (searchActive) {
    // Server search path: use server results (fall back to stable empty array during loading)
    activeItems = serverState.results ?? EMPTY_SEARCH_RESULTS;
  } else if (debouncedSearch) {
    // Local search path: cached filter avoids new array when inputs unchanged
    const trimmed = debouncedSearch.trim();
    activeItems = cachedLocalFilter(items, trimmed, searchPredicate);
  } else {
    // No search: pass through main query items
    activeItems = items;
  }

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    searchActive,
    useServerSort,
    activeItems,
    isSearching,
    removeFromResults,
  };
}
