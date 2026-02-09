/**
 * usePantryStats - Computed values for pantry items
 *
 * Single responsibility:
 * - Compute location counts for filter tabs (including custom storage locations)
 *
 * PERFORMANCE: Single-pass algorithm computes all values in O(n)
 */

import { useMemo } from 'react';
import { StorageState } from '#generated';
import type { LocationCounts } from './types';

/**
 * Hook for computing pantry location counts
 *
 * @example
 * ```tsx
 * const { locationCounts } = usePantryStats(pantryItems);
 * ```
 */
export function usePantryStats(pantryItems: any[], totalCount?: number) {
  // PERFORMANCE: Single-pass computation for all values
  return useMemo(() => {
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

    // Location counts
    let fridge = 0;
    let freezer = 0;
    let pantryCount = 0;
    const customLocationCounts: Record<string, number> = {};

    // Single pass through all items
    for (const item of pantryItems) {
      // Count by storage state
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

      // Count custom storage locations (same pass)
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
  }, [pantryItems, totalCount]);
}
