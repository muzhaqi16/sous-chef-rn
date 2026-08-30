import { useState, useEffect } from 'react';

/** Updates only once `delay` ms have passed with no change to `value`. */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // An empty value resolves immediately — a delayed update here can interrupt
    // a `useDeferredValue` background render elsewhere.
    const effectiveDelay =
      value === '' || value === null || value === undefined ? 0 : delay;
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, effectiveDelay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
