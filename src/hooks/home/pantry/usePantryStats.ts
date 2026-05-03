/**
 * usePantryStats - Computed values for pantry items
 *
 * Single responsibility:
 * - Compute location counts for filter tabs (including custom storage locations)
 *
 * PERFORMANCE: Uses server-side counts (O(1)) when available,
 * falls back to client-side single-pass algorithm (O(n))
 */

import { StorageState } from '#/graphql/generated/schemaTypes';
import type { LocationCounts } from './types';

interface UsePantryStatsOptions {
  pantryItems: any[];
  totalCount?: number;
  storageStateCounts?: {
    refrigerated: number;
    frozen: number;
    ambient: number;
  } | null;
  storageLocationCounts?: Array<{
    storageLocationId: string;
    itemCount: number;
  }>;
}

/**
 * Hook for computing pantry location counts
 *
 * Prefers server-side counts (storageStateCounts, currentItemCount)
 * when available, falling back to client-side counting.
 *
 * @example
 * ```tsx
 * const { locationCounts } = usePantryStats({
 *   pantryItems,
 *   totalCount: stats?.totalItems,
 *   storageStateCounts: stats?.storageStateCounts ?? null,
 *   storageLocationCounts: stats?.storageLocationCounts ?? [],
 * });
 * ```
 */
export function usePantryStats(options: UsePantryStatsOptions) {
  const { pantryItems, totalCount, storageStateCounts, storageLocationCounts } =
    options;

  return (() => {
    // Server-side counts available — use them (O(1))
    if (storageStateCounts) {
      const customLocationCounts: Record<string, number> = {};
      if (storageLocationCounts) {
        for (const loc of storageLocationCounts) {
          customLocationCounts[loc.storageLocationId] = loc.itemCount;
        }
      }

      return {
        locationCounts: {
          all: totalCount ?? pantryItems.length,
          fridge: storageStateCounts.refrigerated,
          freezer: storageStateCounts.frozen,
          pantry: storageStateCounts.ambient,
          ...customLocationCounts,
        } as LocationCounts,
      };
    }

    // Fallback: client-side counting (O(n))
    if (!pantryItems || pantryItems.length === 0) {
      return {
        locationCounts: {
          all: 0,
          fridge: 0,
          freezer: 0,
          pantry: 0,
        } as LocationCounts,
      };
    }

    let fridge = 0;
    let freezer = 0;
    let pantryCount = 0;
    const customLocationCounts: Record<string, number> = {};

    for (const item of pantryItems) {
      switch (item.storageState) {
        case StorageState.Refrigerated:
          fridge++;
          break;
        case StorageState.Frozen:
          freezer++;
          break;
        default:
          pantryCount++;
          break;
      }

      const customLocationId = item.storageLocation?.id;
      if (customLocationId) {
        customLocationCounts[customLocationId] =
          (customLocationCounts[customLocationId] || 0) + 1;
      }
    }

    return {
      locationCounts: {
        all: totalCount ?? pantryItems.length,
        fridge,
        freezer,
        pantry: pantryCount,
        ...customLocationCounts,
      } as LocationCounts,
    };
  })();
}
