/**
 * Composition of `usePantryQuery` + `usePantryStats` + `usePantryItemMutations`;
 * new code should prefer those directly.
 */

import {
  type PantryItemFilters,
  type PantryItemOrderBy,
} from '#/graphql/generated/schemaTypes';
import { usePantryQuery, type PantryQueryOptions } from './usePantryQuery';
import { usePantryStats } from './usePantryStats';
import { usePantryItemMutations } from './mutations/usePantryItemMutations';

export interface PantryManagementOptions extends PantryQueryOptions {
  filters?: PantryItemFilters | null;
  orderBy?: PantryItemOrderBy | null;
  /** Page size; defaults to the whole page (see `usePantryQuery`). */
  first?: number;
}

export function usePantryManagement(
  pantryId: string | undefined,
  options?: PantryManagementOptions,
) {
  // Query hook - fetches pantry data
  const {
    state: {
      pantryItems,
      pantryStorageLocations,
      stats,
      totalCount,
      loading,
      isRefreshing,
      error,
      hasResult,
      skipped,
      hasMore,
      isLoadingMore,
    },
    actions: { refetch, loadMore },
  } = usePantryQuery(
    pantryId,
    options?.filters,
    options?.orderBy,
    options?.first,
    options,
  );

  // Stats hook - computes location counts
  // Use stats.totalItems for the "all" tab (always full count, not filtered)
  // Use storageStateCounts from server when available
  // Use storageLocationCounts from server for custom location tabs
  const { locationCounts } = usePantryStats({
    pantryItems,
    totalCount: stats?.totalItems,
    storageStateCounts: stats?.storageStateCounts ?? null,
    storageLocationCounts: stats?.storageLocationCounts ?? [],
  });

  // Mutations hook - update/remove operations (adds go through the dedicated
  // add surfaces, which own the duplicate-recovery flow)
  const { updateItem, removeItem } = usePantryItemMutations({
    pantryId,
    refetch,
  });

  return {
    state: {
      items: pantryItems,
      pantryStorageLocations,
      stats,
      totalCount,
      loading,
      isRefreshing,
      error,
      hasResult,
      skipped,
      locationCounts,
      hasMore,
      isLoadingMore,
    },
    actions: {
      loadMore,
      updateItem,
      removeItem,
      refetch,
    },
  };
}
