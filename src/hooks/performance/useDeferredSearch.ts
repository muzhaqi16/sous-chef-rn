import { useMemo, useDeferredValue } from 'react';

interface UseDeferredSearchOptions<T> {
  /** Items to search through */
  items: T[];
  /** Current search query */
  searchQuery: string;
  /** Search function that returns true if item matches query */
  searchFn: (item: T, query: string) => boolean;
  /** Minimum query length before searching (default: 0) */
  minQueryLength?: number;
}

interface UseDeferredSearchResult<T> {
  /** Search results (deferred for non-blocking UI) */
  results: T[];
  /** The deferred query value being used for results */
  deferredQuery: string;
  /** Whether results are stale (query changed but results not yet updated) */
  isStale: boolean;
}

/**
 * useDeferredSearch - Hook for responsive search with deferred value
 *
 * Uses React 18's useDeferredValue to keep the search input responsive
 * while deferring expensive search operations. The UI shows immediate
 * feedback for typing while search results update without blocking.
 *
 * PERFORMANCE: Ideal for:
 * - Search-as-you-type functionality
 * - Large datasets (100+ items)
 * - Complex search predicates
 *
 * The isStale flag can be used to show a loading indicator while
 * results are being computed.
 *
 * @example
 * ```tsx
 * const { results, isStale } = useDeferredSearch({
 *   items: allItems,
 *   searchQuery,
 *   searchFn: (item, query) =>
 *     item.name.toLowerCase().includes(query.toLowerCase()),
 * });
 *
 * return (
 *   <View>
 *     <TextInput value={searchQuery} onChangeText={setSearchQuery} />
 *     {isStale && <ActivityIndicator />}
 *     <FlatList data={results} ... />
 *   </View>
 * );
 * ```
 */
export function useDeferredSearch<T>(
  options: UseDeferredSearchOptions<T>,
): UseDeferredSearchResult<T> {
  const { items, searchQuery, searchFn, minQueryLength = 0 } = options;

  // Defer the search query to avoid blocking the input
  const deferredQuery = useDeferredValue(searchQuery);

  // Compute results using deferred query
  const results = useMemo(() => {
    const trimmedQuery = deferredQuery.trim();

    // Return all items if query is too short
    if (trimmedQuery.length < minQueryLength) {
      return items;
    }

    // Filter items using search function
    return items.filter(item => searchFn(item, trimmedQuery));
  }, [items, deferredQuery, searchFn, minQueryLength]);

  // Check if results are stale (query changed but deferred hasn't caught up)
  const isStale = searchQuery !== deferredQuery;

  return {
    results,
    deferredQuery,
    isStale,
  };
}

/**
 * useDeferredSearchWithSort - Extended version with sorting support
 *
 * Combines deferred search with optional sorting of results.
 * Both search and sort operations are deferred together.
 *
 * @example
 * ```tsx
 * const { results, isStale } = useDeferredSearchWithSort({
 *   items: allItems,
 *   searchQuery,
 *   searchFn: (item, query) => item.name.includes(query),
 *   sortFn: (a, b) => a.name.localeCompare(b.name),
 * });
 * ```
 */
export function useDeferredSearchWithSort<T>(
  options: UseDeferredSearchOptions<T> & {
    sortFn?: (a: T, b: T) => number;
  },
): UseDeferredSearchResult<T> {
  const { items, searchQuery, searchFn, sortFn, minQueryLength = 0 } = options;

  // Defer the search query to avoid blocking the input
  const deferredQuery = useDeferredValue(searchQuery);

  // Compute results using deferred query with optional sorting
  const results = useMemo(() => {
    const trimmedQuery = deferredQuery.trim();

    // Start with all items or filtered items
    let filtered: T[];
    if (trimmedQuery.length < minQueryLength) {
      filtered = items;
    } else {
      filtered = items.filter(item => searchFn(item, trimmedQuery));
    }

    // Apply sorting if provided
    if (sortFn) {
      return [...filtered].sort(sortFn);
    }

    return filtered;
  }, [items, deferredQuery, searchFn, sortFn, minQueryLength]);

  // Check if results are stale
  const isStale = searchQuery !== deferredQuery;

  return {
    results,
    deferredQuery,
    isStale,
  };
}
