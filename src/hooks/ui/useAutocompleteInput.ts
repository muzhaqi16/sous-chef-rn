import {useState, useCallback, useRef, useEffect} from 'react';
import {useNetInfo} from '@react-native-community/netinfo';

interface UseAutocompleteInputOptions<T> {
  /** Minimum characters before triggering search */
  minChars?: number;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Callback when text changes (for external search) */
  onChangeText?: (text: string) => void;
  /** Callback when an item is selected */
  onItemSelected?: (item: T) => void;
  /** Function to get display value from item */
  getDisplayValue?: (item: T) => string;
  /** Whether to check online status before searching */
  checkOnlineStatus?: boolean;
}

interface UseAutocompleteInputReturn<T> {
  /** Current input text value */
  inputValue: string;
  /** Set the input value */
  setInputValue: (value: string) => void;
  /** Whether the dropdown should be shown */
  showDropdown: boolean;
  /** Set dropdown visibility */
  setShowDropdown: (show: boolean) => void;
  /** Handle text input change with debouncing */
  handleTextChange: (text: string) => void;
  /** Handle item selection */
  handleItemSelect: (item: T) => void;
  /** Clear the input */
  clearInput: () => void;
  /** Whether device is online */
  isOnline: boolean;
  /** Whether search should be triggered (meets min chars and online) */
  shouldSearch: boolean;
}

/**
 * A reusable hook for autocomplete input functionality.
 * Provides debounced text handling, dropdown state management,
 * and network status awareness.
 */
export function useAutocompleteInput<T extends {id: string}>({
  minChars = 2,
  debounceMs = 300,
  onChangeText,
  onItemSelected,
  getDisplayValue = (item: T) => String(item),
  checkOnlineStatus = true,
}: UseAutocompleteInputOptions<T> = {}): UseAutocompleteInputReturn<T> {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const netInfo = useNetInfo();

  const isOnline = !checkOnlineStatus || netInfo.isConnected !== false;
  const shouldSearch = inputValue.length >= minChars && isOnline;

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      setInputValue(text);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Show dropdown if meets minimum chars
      if (text.length >= minChars) {
        setShowDropdown(true);

        // Debounce the external search callback
        debounceTimerRef.current = setTimeout(() => {
          onChangeText?.(text);
        }, debounceMs);
      } else {
        setShowDropdown(false);
      }
    },
    [minChars, debounceMs, onChangeText],
  );

  const handleItemSelect = useCallback(
    (item: T) => {
      const displayValue = getDisplayValue(item);
      setInputValue(displayValue);
      setShowDropdown(false);
      onItemSelected?.(item);
    },
    [getDisplayValue, onItemSelected],
  );

  const clearInput = useCallback(() => {
    setInputValue('');
    setShowDropdown(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  return {
    inputValue,
    setInputValue,
    showDropdown,
    setShowDropdown,
    handleTextChange,
    handleItemSelect,
    clearInput,
    isOnline,
    shouldSearch,
  };
}
