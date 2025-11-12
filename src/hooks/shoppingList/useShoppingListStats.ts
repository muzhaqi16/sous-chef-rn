import { useMemo } from 'react';
import type { ShoppingListItemCoreFragment } from '#/graphql/generated/types';

/**
 * Hook for calculating shopping list statistics
 * Computes completion metrics with null-safety for cache corruption
 */
export function useShoppingListStats(items: ShoppingListItemCoreFragment[]) {
  const stats = useMemo(() => {
    const total = items.length;
    // Filter out null items (defensive against cache corruption)
    const completed = items.filter(item => item?.isPurchased).length;
    const pending = total - completed;

    return {
      total,
      completed,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }, [items]);

  return stats;
}
