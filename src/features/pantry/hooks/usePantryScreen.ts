import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUser } from '#store/useAppStore';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { usePantryManagement } from '#/hooks/home/pantry/usePantryManagement';
import { useHybridPantrySearch } from '#features/pantry/hooks/useHybridPantrySearch';
import { useCreateStorageLocation } from '#/hooks/storageLocation/useCreateStorageLocation';
import { useAppStore, useIsOnline } from '#store/useAppStore';
import { useShallow } from 'zustand/shallow';
import {
  type LocationFilter,
  locationFilterToQueryFilter,
  sortOptionToOrderBy,
  filterByLocation,
} from '#features/pantry/utils/pantryFilters';
import { PAGE_SIZE } from '#/constants/pagination';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import { StorageLocationIcon } from '#components/atoms/StorageLocationIcon';
import { PREFERENCE_DEFAULTS } from '#store/slices/preferenceTypes';
import type {
  PantrySortOption,
  PantrySortDirection,
} from '#store/slices/preferenceTypes';

/**
 * usePantryScreen - Facade hook for the PantryMain screen
 *
 * Orchestrates all data-fetching and state management:
 * 1. useAuthUser - User info for greeting/avatar
 * 2. useCurrentPantry - Home/pantry resolution with fallback chain
 * 3. Zustand store - Sort prefs, unread count, scroll-to-top
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
  const { t } = useTranslation();
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
    unreadCount,
    pantrySortOption,
    pantrySortDirection,
    setPantrySortOption,
    setPantrySortDirection,
    pendingPantryScrollToTop,
    setPendingPantryScrollToTop,
  } = useAppStore(
    useShallow(s => ({
      unreadCount: s.unreadCount,
      pantrySortOption:
        s.pantrySortOption ?? PREFERENCE_DEFAULTS.pantrySortOption,
      pantrySortDirection:
        s.pantrySortDirection ?? PREFERENCE_DEFAULTS.pantrySortDirection,
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

  // Server vs client mode. In CLIENT mode (the common case — pantries that fit
  // in one load window), the main query uses a STABLE cache key (no per-sort /
  // per-filter variables), so changing the sort or location tab does not refetch
  // or re-key the connection — sort, location-filter, and search all run on the
  // already-loaded items and update instantly (and the stable key means cold
  // start always hits cache, no blank flash). Large pantries (> PAGE_SIZE.MAX
  // total) fall back to SERVER mode so filter/sort/search stay correct beyond
  // the loaded window. The decision reads the argument-free `stats.totalItems`
  // (the true full count, unaffected by the active filter) to avoid oscillation.
  const [serverMode, setServerMode] = useState(false);
  const mainFilter = serverMode ? queryFilter : null;
  const mainOrderBy = serverMode ? orderBy : null;

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
  } = usePantryManagement(pantry?.id, mainFilter, mainOrderBy);

  // Adjusting state during render: flip mode once the true total is known.
  const nextServerMode = isOnline && (stats?.totalItems ?? 0) > PAGE_SIZE.MAX;
  if (nextServerMode !== serverMode) {
    setServerMode(nextServerMode);
  }

  // In client mode the main query is unfiltered, so apply the location filter
  // locally; in server mode the query already returned the filtered page.
  const locationFilteredItems = serverMode
    ? rawPantryItems
    : filterByLocation(rawPantryItems, locationFilter);

  const {
    searchQuery,
    setSearchQuery,
    searchActive,
    useServerSort,
    activeItems,
    removeFromResults,
  } = useHybridPantrySearch({
    pantryId: pantry?.id,
    locationQueryFilter,
    orderBy,
    items: locationFilteredItems,
    totalCount,
    hasMore,
    loading,
    isOnline,
  });

  const pantryItems = activeItems;

  // -------------------------------------------------------------------------
  // 5. Create storage location + tab construction + count merging
  // -------------------------------------------------------------------------
  const { createLocation, creating: creatingLocation } =
    useCreateStorageLocation(selectedHomeId ?? undefined, pantry?.id);

  const tabIconSize = 16;
  const defaultTabs: FilterTabConfig<LocationFilter>[] = [
    { id: 'all', label: t('pantryScreen.tabAll') },
    {
      id: 'fridge',
      label: t('pantryScreen.tabFridge'),
      icon: 'thermometer-outline',
      iconElement: React.createElement(StorageLocationIcon, {
        type: 'REFRIGERATOR',
        size: tabIconSize,
      }),
    },
    {
      id: 'freezer',
      label: t('pantryScreen.tabFreezer'),
      icon: 'snow-outline',
      iconElement: React.createElement(StorageLocationIcon, {
        type: 'FREEZER',
        size: tabIconSize,
      }),
    },
    {
      id: 'pantry',
      label: t('pantryScreen.tabPantry'),
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
  const noPantries = isReady && !!selectedHomeId && pantries.length === 0;

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
    noPantries,

    // Store state
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
