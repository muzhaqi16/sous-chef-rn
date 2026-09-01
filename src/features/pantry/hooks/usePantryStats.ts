import { StorageState } from '#/graphql/generated/schemaTypes';
import type { LocationCounts } from './pantryDataTypes';

/** Minimal pantry-item shape this hook reads when counting client-side. */
interface PantryStatsItem {
  storageState?: StorageState | null;
  storageLocation?: { id: string } | null;
}

interface UsePantryStatsOptions {
  pantryItems: PantryStatsItem[] | null;
  totalCount?: number;
  storageStateCounts?: {
    refrigerated: number;
    frozen: number;
    ambient: number;
    none: number;
  } | null;
  storageLocationCounts?: Array<{
    storageLocationId: string;
    itemCount: number;
  }>;
}

/**
 * Prefers the server's O(1) counts, falling back to a single client-side pass.
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
          all: totalCount ?? pantryItems?.length ?? 0,
          fridge: storageStateCounts.refrigerated,
          freezer: storageStateCounts.frozen,
          pantry: storageStateCounts.ambient,
          unassigned: storageStateCounts.none,
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
          unassigned: 0,
        } as LocationCounts,
      };
    }

    let fridge = 0;
    let freezer = 0;
    let pantryCount = 0;
    let unassigned = 0;
    const customLocationCounts: Record<string, number> = {};

    for (const item of pantryItems) {
      switch (item.storageState) {
        case StorageState.Refrigerated:
          fridge++;
          break;
        case StorageState.Frozen:
          freezer++;
          break;
        case StorageState.Ambient:
          pantryCount++;
          break;
        // Mirrors `filterByLocation`: `pantry` is strictly AMBIENT, so an
        // unassigned item is its own bucket rather than swelling that count.
        default:
          unassigned++;
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
        unassigned,
        ...customLocationCounts,
      } as LocationCounts,
    };
  })();
}
