import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '#store/useAppStore';

export interface AutocompleteSearchConfig<TItem> {
  /** Trigger the query (lazy query call or setState for skip-based) */
  search: (term: string) => void;
  /** Read current results from Apollo cache / local state */
  getResults: () => TItem[];
  /** Query loading state */
  loading: boolean;
  /** Extract unique key from item */
  keyExtractor: (item: TItem) => string;
  /** Minimum characters before triggering search. Default: 2 */
  minChars?: number;
  /** Debounce delay in milliseconds. Default: 300 */
  debounceMs?: number;
  /** Whether to check network status. Default: true. False for client-side-only (storage locations) */
  requiresNetwork?: boolean;
  /** Items to show before any search (cached units, suggested brands) */
  fallbackItems?: TItem[];
  /** Client-side filter for fallback items */
  filterFallback?: (term: string, items: TItem[]) => TItem[];
  /** Maximum results to display. Default: 10 */
  maxResults?: number;
}

export interface AutocompleteSearchReturn<TItem> {
  /** Ready-to-render items (handles anti-flicker, fallback, slicing) */
  displayItems: TItem[];
  /** Current raw search term */
  searchTerm: string;
  /** Whether search is loading */
  isLoading: boolean;
  /** Whether device is online */
  isOnline: boolean;
  /** Whether search should be triggered (meets min chars and online) */
  shouldSearch: boolean;
  /** Handle search term change (call from onChangeText) */
  handleSearchTermChange: (text: string) => void;
  /** Directly set search term without debounce (e.g., after selection reset) */
  setSearchTerm: (text: string) => void;
  /** Reset search state */
  reset: () => void;
}

export function useAutocompleteSearch<TItem>(
  config: AutocompleteSearchConfig<TItem>,
): AutocompleteSearchReturn<TItem> {
  const {
    search,
    getResults,
    loading,
    minChars = 2,
    debounceMs = 300,
    requiresNetwork = true,
    fallbackItems = [],
    filterFallback,
    maxResults = 10 } = config;

  const [searchTerm, setSearchTerm] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastResults, setLastResults] = useState<TItem[]>([]);

  const isOnline = useAppStore(state => state.isOnline);
  const shouldSearch = searchTerm.length >= minChars && (!requiresNetwork || isOnline);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Debounced search trigger
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (shouldSearch) {
      debounceTimerRef.current = setTimeout(() => {
        search(searchTerm);
      }, debounceMs);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [searchTerm, shouldSearch, search, debounceMs]);

  // Get current results
  const results = getResults();

  // Anti-flicker: track last results using render-time conditional state update
  // (React-recommended pattern for syncing derived state with render values)
  const [prevResults, setPrevResults] = useState(results);
  const [prevLoading, setPrevLoading] = useState(loading);
  if (results !== prevResults || loading !== prevLoading) {
    setPrevResults(results);
    setPrevLoading(loading);
    if (results.length > 0) {
      setLastResults(results);
    } else if (!loading) {
      setLastResults([]);
    }
  }

  // Compute display items
  const displayItems = (() => {
    // If below min chars or no search term, use fallback
    if (searchTerm.length < minChars) {
      if (filterFallback && searchTerm.length > 0) {
        return filterFallback(searchTerm, fallbackItems).slice(0, maxResults);
      }
      return fallbackItems.slice(0, maxResults);
    }

    // Show current results if available
    if (results.length > 0) {
      return results.slice(0, maxResults);
    }

    // Anti-flicker: show last results while loading
    if (loading && lastResults.length > 0) {
      return lastResults.slice(0, maxResults);
    }

    return [];
  })();

  const handleSearchTermChange = (text: string) => {
    setSearchTerm(text);
  };

  const reset = () => {
    setSearchTerm('');
    setLastResults([]);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  };

  return {
    displayItems,
    searchTerm,
    isLoading: loading,
    isOnline,
    shouldSearch,
    handleSearchTermChange,
    setSearchTerm,
    reset };
}
