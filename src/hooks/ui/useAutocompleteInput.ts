import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '#store';

interface UseAutocompleteInputOptions<T> {
  /** Minimum characters required before searching */
  minChars?: number;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Callback when text changes */
  onChangeText?: (text: string) => void;
  /** Callback when an item is selected */
  onItemSelected?: (id: string | null) => void;
  /** Function to get display text from selected item */
  getDisplayValue?: (item: T) => string;
  /** Whether to check online status before searching */
  checkOnlineStatus?: boolean;
}

interface UseAutocompleteInputReturn<T> {
  /** Current search term */
  searchTerm: string;
  /** Debounced search term (for API calls) */
  debouncedSearchTerm: string;
  /** Whether the device is online */
  isOnline: boolean;
  /** Whether the search term meets minimum character requirement */
  canSearch: boolean;
  /** Handle text input change */
  handleTextChange: (text: string) => void;
  /** Handle item selection */
  handleSelectItem: (item: T) => void;
  /** Set search term directly (useful for initializing) */
  setSearchTerm: (term: string) => void;
  /** Reset the search state */
  reset: () => void;
}

export function useAutocompleteInput<T extends { id: string }>({
  minChars = 2,
  debounceMs = 300,
  onChangeText,
  onItemSelected,
  getDisplayValue,
  checkOnlineStatus = true,
}: UseAutocompleteInputOptions<T> = {}): UseAutocompleteInputReturn<T> {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Get online status from store
  const isOnline = useStore(state => state.isOnline);

  // Track whether we should check online status
  const effectiveIsOnline = checkOnlineStatus ? isOnline : true;

  // Debounce timer ref
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search term
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm, debounceMs]);

  // Check if we can search based on minimum characters and online status
  const canSearch = searchTerm.length >= minChars && effectiveIsOnline;

  // Handle text change
  const handleTextChange = useCallback((text: string) => {
    setSearchTerm(text);
    onChangeText?.(text);
    // Clear selection when user types manually
    onItemSelected?.(null);
  }, [onChangeText, onItemSelected]);

  // Handle item selection
  const handleSelectItem = useCallback((item: T) => {
    const displayValue = getDisplayValue?.(item) ?? '';
    setSearchTerm(displayValue);
    onChangeText?.(displayValue);
    onItemSelected?.(item.id);
  }, [getDisplayValue, onChangeText, onItemSelected]);

  // Reset state
  const reset = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    onItemSelected?.(null);
  }, [onItemSelected]);

  return {
    searchTerm,
    debouncedSearchTerm,
    isOnline: effectiveIsOnline,
    canSearch,
    handleTextChange,
    handleSelectItem,
    setSearchTerm,
    reset,
  };
}
