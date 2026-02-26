import {useState, useEffect} from 'react';

export interface SearchableListOptions {
  /** Debounce delay in milliseconds (default: 0) */
  debounceMs?: number;
  /** Minimum query length to start filtering (default: 0) */
  minQueryLength?: number;
  /** Case sensitive search (default: false) */
  caseSensitive?: boolean;
}

/**
 * A custom hook that provides a searchable list functionality.
 *
 * @param items - The list of items to filter (can be undefined or null).
 * @param filterFn - A function that determines if an item matches the search query.
 * @param options - Optional configuration for search behavior.
 */
export function useSearchableList<T>(
  items: T[] | null | undefined,
  filterFn: (item: T, query: string) => boolean,
  options: SearchableListOptions = {},
) {
  const {debounceMs = 0, minQueryLength = 0, caseSensitive = false} = options;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the query if debounceMs is provided
  useEffect(() => {
    if (debounceMs > 0) {
      const timer = setTimeout(() => {
        setDebouncedQuery(query);
      }, debounceMs);
      return () => clearTimeout(timer);
    } else {
      setDebouncedQuery(query);
    }
  }, [query, debounceMs]);

  // Ensure we have an array
  const list = Array.isArray(items) ? items : [];

  // Use debounced query for filtering
  const searchQuery = debounceMs > 0 ? debouncedQuery : query;

  let filtered: T[];
  // Preserve original array reference when not actively searching
  if (!searchQuery || searchQuery.length < minQueryLength) {
    filtered = list;
  } else {
    // Apply case sensitivity if needed
    const processedQuery = caseSensitive
      ? searchQuery
      : searchQuery.toLowerCase();

    filtered = list.filter(item => filterFn(item, processedQuery));
  }

  // Clear search function
  const clearQuery = () => {
    setQuery('');
    setDebouncedQuery('');
  };

  // Check if currently filtering
  const isFiltering = query.length >= minQueryLength;

  return {
    query,
    setQuery,
    filtered,
    clearQuery,
    isFiltering,
    resultCount: filtered.length,
    totalCount: Array.isArray(items) ? items.length : 0 };
}
