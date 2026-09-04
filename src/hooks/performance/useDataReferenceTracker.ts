/**
 * Fires `onChange` when a value's reference identity changes (never on mount),
 * in DEV and production alike — `useFlashListPerformance` reports data churn
 * from it. Console logging stays DEV-only.
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

  // Never assign ref.current during render.
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
      console.debug(`📊 [${labelRef.current}] data reference changed`);
    }
    onChangeRef.current?.();
  }, [value]);
}
