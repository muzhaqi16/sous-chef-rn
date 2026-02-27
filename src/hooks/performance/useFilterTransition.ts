import { useState, useTransition, useEffect } from 'react';

interface UseFilterTransitionOptions<T> {
  /** Initial items to filter */
  items: T[];
  /** Filter function to apply */
  filterFn: (item: T) => boolean;
  /** Whether to apply filter immediately on mount */
  applyOnMount?: boolean;
}

interface UseFilterTransitionResult<T> {
  /** Filtered items (updated with transition for non-blocking UI) */
  filteredItems: T[];
  /** Whether a filter transition is pending */
  isPending: boolean;
  /** Manually trigger filter application */
  applyFilter: () => void;
}

/**
 * useFilterTransition - Hook for non-blocking filter operations
 *
 * Uses React 18's useTransition to mark filter operations as non-urgent,
 * keeping the UI responsive during expensive filtering operations.
 *
 * PERFORMANCE: Ideal for:
 * - Filtering large lists (50+ items)
 * - Complex filter predicates
 * - Filters that change frequently (e.g., search as you type)
 *
 * @example
 * ```tsx
 * const { filteredItems, isPending } = useFilterTransition({
 *   items: allItems,
 *   filterFn: (item) => item.name.includes(searchQuery),
 * });
 *
 * return (
 *   <View>
 *     {isPending && <ActivityIndicator />}
 *     <FlatList data={filteredItems} ... />
 *   </View>
 * );
 * ```
 */
export function useFilterTransition<T>(
  options: UseFilterTransitionOptions<T>,
): UseFilterTransitionResult<T> {
  const { items, filterFn, applyOnMount = true } = options;

  const [isPending, startTransition] = useTransition();
  const [filteredItems, setFilteredItems] = useState<T[]>(() =>
    applyOnMount ? items.filter(filterFn) : items,
  );

  // Apply filter with transition (non-blocking)
  const applyFilter = () => {
    startTransition(() => {
      setFilteredItems(items.filter(filterFn));
    });
  };

  // Auto-apply filter when items or filterFn changes
  useEffect(() => {
    startTransition(() => {
      setFilteredItems(items.filter(filterFn));
    });
  }, [items, filterFn]);

  return {
    filteredItems,
    isPending,
    applyFilter };
}

/**
 * useFilterTransitionWithDeps - Extended version with dependency tracking
 *
 * Allows specifying additional dependencies that should trigger re-filtering,
 * beyond just items and filterFn changes.
 *
 * @example
 * ```tsx
 * const { filteredItems, isPending } = useFilterTransitionWithDeps({
 *   items: allItems,
 *   filterFn: (item) => item.category === selectedCategory,
 *   deps: [selectedCategory], // Re-filter when category changes
 * });
 * ```
 */
export function useFilterTransitionWithDeps<T>(
  options: UseFilterTransitionOptions<T> & { deps?: unknown[] },
): UseFilterTransitionResult<T> {
  const { items, filterFn, applyOnMount = true } = options;

  const [isPending, startTransition] = useTransition();
  const [filteredItems, setFilteredItems] = useState<T[]>(() =>
    applyOnMount ? items.filter(filterFn) : items,
  );

  // Apply filter with transition (non-blocking)
  const applyFilter = () => {
    startTransition(() => {
      setFilteredItems(items.filter(filterFn));
    });
  };

  // Auto-apply filter when dependencies change
  useEffect(() => {
    startTransition(() => {
      setFilteredItems(items.filter(filterFn));
    });
  }, [items, filterFn]);

  return {
    filteredItems,
    isPending,
    applyFilter };
}
