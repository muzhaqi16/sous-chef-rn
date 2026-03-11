/**
 * Data Reference Tracker Hook
 *
 * Fires a callback when a value's reference identity changes (not on mount).
 * Useful for detecting unnecessary re-renders caused by unstable references.
 *
 * No try-catch in hook body (React Compiler safe).
 * Ref read is inside useEffect (not during render) — compiler safe.
 */
import { useEffect, useRef } from 'react';

export function useDataReferenceTracker<T>(
  value: T,
  label: string,
  onChange?: () => void,
): void {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!__DEV__) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    console.log(`📊 [${label}] data reference changed`);
    onChange?.();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
}
