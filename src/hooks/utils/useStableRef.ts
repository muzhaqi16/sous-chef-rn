import { useRef, useEffect } from 'react';

/**
 * useStableRef - Keeps a ref synchronized with a value
 *
 * This hook solves the common pattern of needing to access the latest value
 * inside callbacks without adding the value to dependency arrays.
 *
 * @example
 * ```tsx
 * // Before (4 lines per ref):
 * const itemsRef = useRef(items);
 * useEffect(() => {
 *   itemsRef.current = items;
 * }, [items]);
 *
 * // After (1 line):
 * const itemsRef = useStableRef(items);
 * ```
 *
 * @example Using in callbacks
 * ```tsx
 * const items = useItems();
 * const itemsRef = useStableRef(items);
 *
 * const handleSelect = useCallback((id: string) => {
 *   // Always has latest items without needing items in deps
 *   const item = itemsRef.current.find(i => i.id === id);
 *   if (item) selectItem(item);
 * }, []); // No deps needed for items
 * ```
 *
 * @param value - The value to keep synchronized in the ref
 * @returns A ref that always contains the latest value
 */
export function useStableRef<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
