/**
 * Data Reference Tracker Hook
 *
 * Fires a callback when a value's reference identity changes (not on mount).
 * Useful for detecting unnecessary re-renders caused by unstable references.
 *
 * The onChange callback fires in both DEV and production so consumers
 * (e.g. useFlashListPerformance) can track data churn in production telemetry.
 * Console logging remains DEV-only.
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
  const labelRef = useRef(label);
  const onChangeRef = useRef(onChange);

  // Sync refs after render — never assign ref.current during render (compiler safe)
  useEffect(() => {
    labelRef.current = label;
  });
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (__DEV__) {
      console.log(`📊 [${labelRef.current}] data reference changed`);
    }
    onChangeRef.current?.();
  }, [value]);
}
