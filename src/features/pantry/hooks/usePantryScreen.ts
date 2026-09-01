import React, { useState } from 'react';
import { useTranslation } from '#/i18n';

import { useUser } from '#store/useAppStore';
import { useCurrentPantry } from '#features/pantry/hooks/useCurrentPantry';
import { usePantryManagement } from '#features/pantry/hooks/usePantryManagement';
import { useHybridPantrySearch } from '#features/pantry/hooks/useHybridPantrySearch';
import { useCreateStorageLocation } from '#features/catalog/hooks/useCreateStorageLocation';
import { useAppStore, useIsOnline } from '#store/useAppStore';
import { useShallow } from 'zustand/shallow';
import {
  type LocationFilter,
  locationFilterToQueryFilter,
  sortOptionToOrderBy,
  filterByLocation,
} from '#features/pantry/utils/pantryFilters';
import { PAGE_SIZE } from '#/constants/pagination';
import { logger } from '#/utils/environment';
import type { FilterTabConfig } from '#components/molecules/FilterTabs/types';
import { StorageLocationIcon } from '#features/catalog/ui/StorageLocationIcon';
import { PREFERENCE_DEFAULTS } from '#store/slices/preferenceTypes';
import type {
  PantrySortOption,
  PantrySortDirection,
} from '#store/slices/preferenceTypes';

/** Facade hook for PantryMain: the screen only renders and wires navigation. */
export function usePantryScreen() {
  const { t } = useTranslation();
  // 1. User info
  const authUser = useUser();

  // 2. Home/pantry resolution
  const {
    pantry,
    pantries,
    currentHome,
    selectedHomeId,
    setSelectedPantryId,
    homeCount,
    isReady,
  } = useCurrentPantry();

  // 3. Zustand store — consolidated selector
  const {
    pantrySortOption,
    pantrySortDirection,
    setPantrySortOption,
    setPantrySortDirection,
    pendingPantryScrollToTop,
    setPendingPantryScrollToTop,
  } = useAppStore(
    useShallow(s => ({
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

  // 4. Location filter + pantry management + hybrid search
  const [locationFilter, setLocationFilter] = useState<LocationFilter>('all');
  const isOnline = useIsOnline();

  const locationQueryFilter = locationFilterToQueryFilter(locationFilter);
  const queryFilter = locationQueryFilter;
  const orderBy = sortOptionToOrderBy(pantrySortOption, pantrySortDirection);

  // CLIENT mode keeps a STABLE query cache key (no per-sort/per-filter
  // variables), so sort/filter/search run on the loaded items with no refetch and
  // cold start always hits cache. Pantries over PAGE_SIZE.MAX fall back to SERVER
  // mode. The decision reads the argument-free `stats.totalItems` — the filtered
  // count would oscillate.
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
  } = usePantryManagement(pantry?.id, {
    filters: mainFilter,
    orderBy: mainOrderBy,
  });

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

  // 5. Create storage location + tab construction + count merging
  const { createLocation, creating: creatingLocation } =
    useCreateStorageLocation(selectedHomeId ?? undefined, pantry?.id);

  const tabIconSize = 16;
  const defaultTabs: FilterTabConfig<LocationFilter>[] = [
    { id: 'all', label: t('pantryScreen.tabAll') },
    {
      id: 'fridge',
      label: t('labels.storageRefrigerated'),
      icon: 'thermometer-outline',
      iconElement: React.createElement(StorageLocationIcon, {
        type: 'REFRIGERATOR',
        size: tabIconSize,
      }),
    },
    {
      id: 'freezer',
      label: t('labels.storageFrozen'),
      icon: 'snow-outline',
      iconElement: React.createElement(StorageLocationIcon, {
        type: 'FREEZER',
        size: tabIconSize,
      }),
    },
    {
      id: 'pantry',
      label: t('labels.storageAmbient'),
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
        ...(location.parentLocation?.name
          ? { subLabel: location.parentLocation.name }
          : undefined),
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

  // Only when something is in it. The API counts a DELIBERATE shelf-stable
  // choice as ambient, so an unassigned item has no other tab to appear
  // under — but most pantries have none, and an always-empty tab is noise.
  const unassignedTabs: FilterTabConfig<LocationFilter>[] =
    locationCounts.unassigned > 0
      ? [
          {
            id: 'unassigned',
            label: t('pantryScreen.tabUnassigned'),
            icon: 'help-circle-outline',
          },
        ]
      : [];

  const combinedTabs: FilterTabConfig<LocationFilter>[] = [
    ...defaultTabs,
    ...unassignedTabs,
    ...customTabs,
  ];

  // Ensure every custom location has a count entry (default 0) so badges always render
  const completeCounts = { ...locationCounts } as typeof locationCounts;
  for (const loc of pantryStorageLocations) {
    if (completeCounts[loc.id] === undefined) {
      completeCounts[loc.id] = 0;
    }
  }

  // 6. Derived states
  const noHomeSelected = isReady && !selectedHomeId && homeCount > 0;
  const noHomes = isReady && !selectedHomeId && homeCount === 0;
  // Requires the home itself to have resolved. `isReady` alone isn't enough:
  // `useDefaultHome` flips it early off persisted home/pantry ids, before
  // `GetHomes` lands, so there is a window where `pantries` is empty purely
  // because nothing has loaded. Treating that as "this home has no pantries"
  // flashed the create-a-pantry empty state and disabled the add button
  // mid-load — "unknown" is not "none".
  const noPantries =
    isReady && !!selectedHomeId && !!currentHome && pantries.length === 0;

  const isLoadingInitial =
    (!isReady || loading) && !pantryError && pantryItems.length === 0;

  // True while a SERVER-mode tab/sort switch re-fetches: the outgoing tab's items
  // linger until it lands, so the UI covers them with a skeleton. Client mode
  // filters locally and never refetches, so this stays false.
  const itemsFetching = serverMode && loading;

  // `undefined` rather than a fallback word: the header picks a whole no-name
  // greeting instead of interpolating one into "Hello, {{name}}!", which no
  // locale can express (Spanish would read "¡Hola, hola!").
  const userName =
    authUser?.name || authUser?.firstName || authUser?.lastName || undefined;

  // These were hardcoded English reaching JSX through a variable — invisible to
  // `i18next/no-literal-string`, which only sees literals in JSX.
  const householdName = noHomeSelected
    ? t('pantryHeader.homePromptSelect')
    : noHomes
    ? t('pantryHeader.homeNoneYet')
    : currentHome?.name || t('pantryHeader.homeFallback');

  // 7. Sort change handler
  const handleSortChange = (
    option: PantrySortOption,
    direction: PantrySortDirection,
  ) => {
    setPantrySortOption?.(option);
    setPantrySortDirection?.(direction);
  };

  // 8. handleRemoveItem (wraps removeItem + removeFromResults)
  const handleRemoveItem = async (id: string) => {
    removeFromResults(id);
    await removeItem(id);
  };

  // Handle location filter change
  const handleLocationFilterChange = (filter: LocationFilter) => {
    setLocationFilter(filter);
  };

  // No `refreshing` flag to clear — the control reads Apollo's `networkStatus`
  // (see `usePantryQuery`), which resets itself. The catch is still needed:
  // `refetch()` rejects on a network error, and an uncaught rejection here is
  // just noise on top of the error state the query already surfaces. Plain
  // statements only in the try body, so the compiler still lowers this hook.
  const handleRefresh = async () => {
    try {
      await refetch();
    } catch {
      logger.debug('Pantry pull-to-refresh failed; query error state stands');
    }
  };

  // Reset UI state on pantry switch, via adjusting-state-during-render (no
  // ref.current read). No refetch() needed — Apollo re-executes on variables.id.
  const [prevPantryId, setPrevPantryId] = useState<string | undefined>(
    pantry?.id,
  );
  if (prevPantryId !== pantry?.id) {
    setPrevPantryId(pantry?.id);
    setLocationFilter('all');
    setSearchQuery('');
  }

  // Return flat interface
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
    itemsFetching,
    serverMode,
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
