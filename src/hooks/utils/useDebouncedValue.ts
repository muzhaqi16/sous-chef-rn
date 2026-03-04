import { useState, useEffect } from 'react';

/**
 * Returns a debounced version of the provided value.
 * The debounced value only updates after the specified delay has passed
 * since the last change to the input value.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // When value resets to empty/falsy, resolve with 0 delay instead of
    // waiting the full debounce period. This prevents a delayed state update
    // that can interrupt useDeferredValue background renders elsewhere.
    const effectiveDelay =
      value === '' || value === null || value === undefined ? 0 : delay;
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, effectiveDelay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
