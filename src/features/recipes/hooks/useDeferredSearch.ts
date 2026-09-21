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
  /** Filtered by the debounced query, so they lag typing on purpose. */
  results: T[];
}

/**
 * Search-as-you-type that debounces the query and filters synchronously.
 * Deliberately NOT `useDeferredValue`: the results become a FlashList `data`
 * prop, and an interruptible render is the exact window that produces
 * `index out of bounds, not enough layouts` (docs/flashlist-layout-index-race.md).
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

  const results = (() => {
    const trimmedQuery = deferredQuery.trim();

    if (trimmedQuery.length < minQueryLength) {
      return items;
    }

    return items.filter(item => searchFn(item, trimmedQuery));
  })();

  return { results };
}
