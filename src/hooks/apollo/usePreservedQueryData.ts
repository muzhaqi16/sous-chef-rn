import { useRef, useMemo } from 'react';

/**
 * Preserves the last successful query data when subsequent queries fail
 *
 * Use this with queries that have errorPolicy: 'ignore' to prevent
 * cascade failures where undefined data is treated as "empty" instead
 * of "keep last known value"
 *
 * @template T - The type of data to preserve
 * @param currentData - The current data from the query (may be undefined on error)
 * @param initialValue - The initial value to use before any successful query
 * @returns The current data if available, otherwise the last successful value
 *
 * @example
 * ```typescript
 * const { data } = useGetPantryItemsQuery({
 *   errorPolicy: 'ignore',
 *   variables: { pantryId }
 * });
 *
 * const items = usePreservedQueryData(data?.pantryItems, []);
 * // Returns last successful value if current query fails
 * ```
 */
export function usePreservedQueryData<T>(
  currentData: T | undefined,
  initialValue: T
): T {
  // Store the last successful (non-undefined) value
  const lastSuccessfulValue = useRef<T>(initialValue);

  return useMemo(() => {
    // If we have current data, update our reference and return it
    if (currentData !== undefined) {
      lastSuccessfulValue.current = currentData;
      return currentData;
    }

    // If current data is undefined (query failed), return last known good value
    return lastSuccessfulValue.current;
  }, [currentData]);
}

/**
 * Specialized version of usePreservedQueryData for array data
 *
 * Always returns an array, never undefined. More convenient than
 * usePreservedQueryData when working with array results.
 *
 * @template T - The type of items in the array
 * @param currentData - The current array from the query (may be undefined/null on error)
 * @returns The current array if available, otherwise the last successful array, or empty array
 *
 * @example
 * ```typescript
 * const { data } = useGetShoppingListItemsQuery({
 *   errorPolicy: 'ignore',
 *   variables: { listId }
 * });
 *
 * const items = usePreservedArrayData(data?.shoppingListItems);
 * // Always returns an array, preserves last known value on error
 * ```
 */
export function usePreservedArrayData<T>(
  currentData: T[] | undefined | null
): T[] {
  return usePreservedQueryData(
    currentData ?? undefined,
    [] as T[]
  );
}
