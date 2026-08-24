import { useDebouncedValue } from '#hooks/utils/useDebouncedValue';

/** Keeps typing responsive without a low-priority render. See the note below. */
const DEFAULT_SEARCH_DEBOUNCE_MS = 150;

interface UseDeferredSearchOptions<T> {
  /** Items to search through */
  items: T[];
  /** Current search query */
  searchQuery: string;
  /** Search function that returns true if item matches query */
  searchFn: (item: T, query: string) => boolean;
  /** Minimum query length before searching (default: 0) */
  minQueryLength?: number;
  /** Delay before the query is applied (default: 150ms) */
  debounceMs?: number;
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
 * useDeferredSearch - Hook for responsive search without blocking the input
 *
 * Debounces the query and filters synchronously from it. It deliberately does
 * NOT use `useDeferredValue`: the results array becomes a FlashList `data`
 * prop, and a deferred render is interruptible, which is the exact window that
 * produces `index out of bounds, not enough layouts`
 * (docs/flashlist-layout-index-race.md). Debouncing gives the same "don't
 * filter on every keystroke" benefit from an ordinary, uninterruptible render.
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
  const {
    items,
    searchQuery,
    searchFn,
    minQueryLength = 0,
    debounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
  } = options;

  // Debounced, not deferred — see the note on this hook.
  const deferredQuery = useDebouncedValue(searchQuery, debounceMs);

  // Compute results using deferred query
  const results = (() => {
    const trimmedQuery = deferredQuery.trim();

    // Return all items if query is too short
    if (trimmedQuery.length < minQueryLength) {
      return items;
    }

    // Filter items using search function
    return items.filter(item => searchFn(item, trimmedQuery));
  })();

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
  const {
    items,
    searchQuery,
    searchFn,
    sortFn,
    minQueryLength = 0,
    debounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
  } = options;

  // Debounced, not deferred — same FlashList reason as useDeferredSearch.
  const deferredQuery = useDebouncedValue(searchQuery, debounceMs);

  // Compute results using deferred query with optional sorting
  const results = (() => {
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
  })();

  // Check if results are stale
  const isStale = searchQuery !== deferredQuery;

  return {
    results,
    deferredQuery,
    isStale,
  };
}
