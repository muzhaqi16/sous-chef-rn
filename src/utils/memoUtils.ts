/**
 * Memoization utilities for React components
 *
 * Provides factory functions for creating optimized prop comparators
 * to use with React.memo for fine-grained re-render control.
 */

/**
 * Configuration for createPropsComparator
 */
interface ComparatorConfig<T> {
  /**
   * Keys to compare by reference equality (fast path).
   * If all reference keys match and there are no nested comparisons,
   * the comparison returns true immediately.
   */
  referenceKeys?: (keyof T)[];

  /**
   * Nested object paths and their fields to compare by value.
   * Supports dot-notation for deeply nested objects.
   *
   * @example
   * ```typescript
   * {
   *   item: ['id', 'name'],                    // compares props.item.id, props.item.name
   *   'item.config': ['value', 'unit'],        // compares props.item.config.value, props.item.config.unit
   * }
   * ```
   */
  nestedComparisons?: Record<string, string[]>;
}

/**
 * Creates a props comparator function for React.memo
 *
 * Generates an optimized comparison function that:
 * 1. Fast path: checks reference equality for specified top-level keys
 * 2. Deep path: compares nested object fields by value
 *
 * Use this when:
 * - Parent components recreate prop objects on every render
 * - You need to compare specific fields instead of entire object references
 * - Default React.memo shallow comparison causes unnecessary re-renders
 *
 * @param config - Comparison configuration
 * @returns A comparator function for React.memo's second argument
 *
 * @example
 * ```typescript
 * interface ItemProps {
 *   item: { id: string; name: string; config?: { value: number } };
 *   isActive: boolean;
 * }
 *
 * const arePropsEqual = createPropsComparator<ItemProps>({
 *   referenceKeys: ['isActive'],
 *   nestedComparisons: {
 *     item: ['id', 'name'],
 *     'item.config': ['value'],
 *   },
 * });
 *
 * export const MyComponent = React.memo(Component, arePropsEqual);
 * ```
 */
export function createPropsComparator<T extends object>(
  config: ComparatorConfig<T>,
): (prev: T, next: T) => boolean {
  const { referenceKeys = [], nestedComparisons = {} } = config;
  const nestedPaths = Object.entries(nestedComparisons);
  const hasNestedComparisons = nestedPaths.length > 0;

  return (prev: T, next: T): boolean => {
    // Fast path: reference equality for specified keys
    for (const key of referenceKeys) {
      if (prev[key] !== next[key]) {
        return false;
      }
    }

    // If no nested comparisons, reference checks are sufficient
    if (!hasNestedComparisons) {
      return true;
    }

    // Deep comparison for nested paths
    for (const [path, fields] of nestedPaths) {
      const prevValue = getNestedValue(prev, path);
      const nextValue = getNestedValue(next, path);

      // Both undefined/null - continue to next path
      if (prevValue == null && nextValue == null) {
        continue;
      }

      // One is null/undefined but not both - not equal
      if (prevValue == null || nextValue == null) {
        return false;
      }

      // Compare each field in this nested object
      for (const field of fields) {
        if (prevValue[field] !== nextValue[field]) {
          return false;
        }
      }
    }

    return true;
  };
}

/**
 * Gets a nested value from an object using dot-notation path
 *
 * @param obj - The object to traverse
 * @param path - Dot-notation path (e.g., 'item.config.value')
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(
  obj: object,
  path: string,
): Record<string, unknown> | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = obj;

  for (const key of path.split('.')) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = current[key];
  }

  return current as Record<string, unknown> | undefined;
}
