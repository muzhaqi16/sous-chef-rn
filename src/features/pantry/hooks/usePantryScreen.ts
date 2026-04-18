import React, { useState } from 'react';

import { useUser } from '#store/useAppStore';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { usePantryManagement } from '#/hooks/home/pantry/usePantryManagement';
import { useHybridSearch } from '#/hooks/search/useHybridSearch';
import { useCreateStorageLocation } from '#/hooks/storageLocation/useCreateStorageLocation';
import { useAppStore, useIsOnline } from '#/store/useAppStore';
import { useShallow } from 'zustand/shallow';
import { GetPantryDocument, type GetPantryQuery } from '#generated';
import { normalizePantry } from '#/utils/connectionUtils';
import {
  type LocationFilter,
  locationFilterToQueryFilter,
  sortOptionToOrderBy,
} from '#/utils/pantryFilters';
import { PAGE_SIZE } from '#/constants/pagination';
import { pantryItemSearch } from '#/utils/searchUtils';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import { StorageLocationIcon } from '#components/atoms/StorageLocationIcon';
import type {
  PantrySortOption,
  PantrySortDirection,
} from '#store/slices/preferencesSlice';

/**
 * usePantryScreen - Facade hook for the PantryMain screen
 *
 * Orchestrates all data-fetching and state management:
 * 1. useAuthUser - User info for greeting/avatar
 * 2. useCurrentPantry - Home/pantry resolution with fallback chain
 * 3. Zustand store - Sort prefs, unread count, scroll-to-top, biometric setup
 * 4. Location filter + usePantryManagement + useHybridSearch
 * 5. useCreateStorageLocation + tab construction + location count merging
 * 6. Derived states (loading, no-home, user/household names)
 * 7. Sort change handler
 * 8. handleRemoveItem (removeItem + removeFromResults)
 * 9. Sheet visibility state (addSheet, addLocationSheet)
 * 10. handleAddSheetClose logic (with itemsAddedRef)
 *
 * The component only needs to:
 * - Call this hook
 * - Set up navigation callbacks, refs, scanner, feature hint, lifecycle
 * - Render JSX
 */
export function usePantryScreen() {
  // -------------------------------------------------------------------------
  // 1. User info
  // -------------------------------------------------------------------------
  const authUser = useUser();

  // -------------------------------------------------------------------------
  // 2. Home/pantry resolution
  // -------------------------------------------------------------------------
  const {
    pantry,
    pantries,
    currentHome,
    selectedHomeId,
    setSelectedPantryId,
    homeCount,
    isReady,
  } = useCurrentPantry();

  // -------------------------------------------------------------------------
  // 3. Zustand store — consolidated selector
  // -------------------------------------------------------------------------
  const {
    showBiometricSetup,
    unreadCount,
    pantrySortOption,
    pantrySortDirection,
    setPantrySortOption,
    setPantrySortDirection,
    pendingPantryScrollToTop,
    setPendingPantryScrollToTop,
  } = useAppStore(
    useShallow(s => ({
      showBiometricSetup: s.showBiometricSetup,
      unreadCount: s.unreadCount,
      pantrySortOption: s.pantrySortOption ?? 'recent',
      pantrySortDirection: s.pantrySortDirection ?? 'desc',
      setPantrySortOption: s.setPantrySortOption,
      setPantrySortDirection: s.setPantrySortDirection,
      pendingPantryScrollToTop: s.pendingPantryScrollToTop,
      setPendingPantryScrollToTop: s.setPendingPantryScrollToTop,
    })),
  );

  // -------------------------------------------------------------------------
  // 4. Location filter + pantry management + hybrid search
  // -------------------------------------------------------------------------
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const isOnline = useIsOnline();

  const locationQueryFilter = locationFilterToQueryFilter(locationFilter);
  const queryFilter = locationQueryFilter;
  const orderBy = sortOptionToOrderBy(pantrySortOption, pantrySortDirection);

  const {
    state: {
      items: rawPantryItems,
      pantryStorageLocations,
      stats,
      totalCount,
      loading,
      isRefreshing,
      error: pantryError,
      hasMore,
      isLoadingMore,
      locationCounts,
    },
    actions: { removeItem, refetch, loadMore },
  } = usePantryManagement(pantry?.id, queryFilter, orderBy);

  const {
    searchQuery,
    setSearchQuery,
    searchActive,
    useServerSort,
    activeItems,
    removeFromResults,
  } = useHybridSearch<GetPantryQuery, (typeof rawPantryItems)[number]>({
    items: rawPantryItems,
    totalCount,
    hasMore,
    loading,
    pageSize: PAGE_SIZE.EXTENDED,
    isOnline,
    searchDocument: GetPantryDocument,
    buildSearchVariables: search => {
      if (!pantry?.id?.trim()) return null;
      return {
        id: pantry.id,
        itemsFirst: PAGE_SIZE.DEFAULT,
        itemsFilter: { ...(locationQueryFilter ?? {}), search },
        itemsOrderBy: orderBy,
        storageLocationsFirst: 0,
      };
    },
    extractItems: data => normalizePantry(data.pantry)?.items ?? [],
    searchPredicate: pantryItemSearch,
    debounceMs: 300,
  });

  const pantryItems = activeItems;

  // -------------------------------------------------------------------------
  // 5. Create storage location + tab construction + count merging
  // -------------------------------------------------------------------------
  const { createLocation, creating: creatingLocation } =
    useCreateStorageLocation(selectedHomeId ?? undefined, pantry?.id);

  const tabIconSize = 16;
  const defaultTabs: FilterTabConfig<LocationFilter>[] = [
    { id: 'all', label: 'All' },
    {
      id: 'fridge',
      label: 'Fridge',
      icon: 'thermometer-outline',
      iconElement: React.createElement(StorageLocationIcon, {
        type: 'REFRIGERATOR',
        size: tabIconSize,
      }),
    },
    {
      id: 'freezer',
      label: 'Freezer',
      icon: 'snow-outline',
      iconElement: React.createElement(StorageLocationIcon, {
        type: 'FREEZER',
        size: tabIconSize,
      }),
    },
    {
      id: 'pantry',
      label: 'Pantry',
      icon: 'cube-outline',
      iconElement: React.createElement(StorageLocationIcon, {
        type: 'PANTRY_SHELF',
        size: tabIconSize,
      }),
    },
  ];

  const customTabs: FilterTabConfig<LocationFilter>[] =
    pantryStorageLocations.map(
      (location: (typeof pantryStorageLocations)[number]) => ({
        id: location.id,
        label: location.name,
        ...(location.color ? { activeColor: location.color } : undefined),
        ...(location.icon
          ? { icon: location.icon }
          : {
              iconElement: React.createElement(StorageLocationIcon, {
                type: location.type,
                size: tabIconSize,
              }),
            }),
      }),
    );

  const combinedTabs: FilterTabConfig<LocationFilter>[] = [
    ...defaultTabs,
    ...customTabs,
  ];

  // Ensure every custom location has a count entry (default 0) so badges always render
  const completeCounts = { ...locationCounts } as typeof locationCounts;
  for (const loc of pantryStorageLocations) {
    if (completeCounts[loc.id] === undefined) {
      completeCounts[loc.id] = 0;
    }
  }

  // -------------------------------------------------------------------------
  // 6. Derived states
  // -------------------------------------------------------------------------
  const noHomeSelected = isReady && !selectedHomeId && homeCount > 0;
  const noHomes = isReady && !selectedHomeId && homeCount === 0;

  const isLoadingInitial =
    (!isReady || loading) && !pantryError && pantryItems.length === 0;

  const userName =
    authUser?.name || authUser?.firstName || authUser?.lastName || 'there';

  const householdName = noHomeSelected
    ? 'Tap to select a home'
    : noHomes
    ? 'No homes yet'
    : currentHome?.name || 'Your Home';

  // -------------------------------------------------------------------------
  // 7. Sort change handler
  // -------------------------------------------------------------------------
  const handleSortChange = (
    option: PantrySortOption,
    direction: PantrySortDirection,
  ) => {
    setPantrySortOption?.(option);
    setPantrySortDirection?.(direction);
  };

  // -------------------------------------------------------------------------
  // 8. handleRemoveItem (wraps removeItem + removeFromResults)
  // -------------------------------------------------------------------------
  const handleRemoveItem = async (id: string) => {
    removeFromResults(id);
    await removeItem(id);
  };

  // Handle location filter change
  const handleLocationFilterChange = (filter: LocationFilter) => {
    setLocationFilter(filter);
  };

  const handleRefresh = async () => {
    await refetch();
  };

  // -------------------------------------------------------------------------
  // Reset UI state when switching between pantries
  // Uses "adjusting state during render" pattern (no ref.current read during render)
  // NOTE: No explicit refetch() needed — Apollo re-executes the query automatically
  // when variables.id changes (via cache-and-network fetch policy).
  // -------------------------------------------------------------------------
  const [prevPantryId, setPrevPantryId] = useState<string | undefined>(
    pantry?.id,
  );
  if (prevPantryId !== pantry?.id) {
    setPrevPantryId(pantry?.id);
    setLocationFilter('all');
    setSearchQuery('');
  }

  // -------------------------------------------------------------------------
  // Return flat interface
  // -------------------------------------------------------------------------
  return {
    // User
    authUser,
    userName,
    householdName,

    // Home / Pantry resolution
    pantry,
    pantries,
    currentHome,
    selectedHomeId,
    setSelectedPantryId,
    homeCount,
    isReady,
    noHomeSelected,
    noHomes,

    // Store state
    showBiometricSetup,
    unreadCount,
    pantrySortOption,
    pantrySortDirection,
    pendingPantryScrollToTop,
    setPendingPantryScrollToTop,

    // Pantry data
    pantryItems,
    rawPantryItems,
    pantryStorageLocations,
    stats,
    totalCount,
    pantryError,

    // Loading states
    loading,
    isLoadingInitial,
    isRefreshing,

    // Search
    searchQuery,
    setSearchQuery,
    searchActive,
    useServerSort,

    // Pagination
    loadMore,
    hasMore,
    isLoadingMore,

    // Location filter
    locationFilter,
    handleLocationFilterChange,
    combinedTabs,
    completeCounts,

    // Sort
    handleSortChange,

    // Mutations / actions
    handleRemoveItem,
    removeItem,
    refetch,
    handleRefresh,
    createLocation,
    creatingLocation,

    // Network
    isOnline,
  };
}
