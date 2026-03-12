import React, { createContext, useContext, useEffect, useRef, useImperativeHandle } from 'react';
import { View, Pressable, RefreshControl, Dimensions } from 'react-native';
import {
  FlashList,
  type FlashListRef,
  ListRenderItemInfo,
} from '@shopify/flash-list';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { resolveImageUrl } from '#utils/imageUtils';
import { LocationFilter } from '#utils/pantryFilters';
import { SearchBar } from '../molecules/SearchBar';
import { FilterTabs } from '../molecules/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '../molecules/FilterTabs/types';
import { SectionHeader } from '../molecules/SectionHeader';
import { PantryItemCard, type ItemVariant } from './PantryItemCard';
import { PantryHeader } from './PantryHeader';
import { PantrySortModal } from './PantrySortModal';
import {
  PantryActionsProvider,
  type PantryItemActions,
} from './PantryActionsContext';
import { usePantrySorting } from './hooks/usePantrySorting';
import {
  getExpirationStatus,
  formatPackageBreakdown,
  formatRemainingNetWeight,
  formatQuantityBreakdown,
} from '#hooks/pantry/usePantryItemTransformation';
import { formatQuantityDisplay } from '#/utils/formatQuantity';
import { type PantryStats } from '#generated';
import { PantryAlertBar } from '#components/pantry/PantryAlertBar';
import { EmptyState } from '#components/base/EmptyState';
import { PaginationFooter } from '#components/organisms/PaginationFooter';
import { PantryScreenSkeleton } from '#components/base/Skeleton/PantryScreenSkeleton';
import { AnimatedCellRenderer } from '#components/atoms/AnimatedCellRenderer';
import { preloadImages } from '#components/atoms/CachedImage';
import { useRenderTime } from '#hooks/performance/useRenderTime';
import { useFlashListPerformance } from '#hooks/performance/useFlashListPerformance';
import { useDataReferenceTracker } from '#hooks/performance/useDataReferenceTracker';
import { differenceInCalendarDays } from 'date-fns';
import { PantryItem } from '#generated';
import type { ExpirationVariant } from './PantryItemCard';

// Stable empty array reference to avoid FlashList re-renders when showing skeletons
const EMPTY_ARRAY: PantryItem[] = [];

// Screen-relative draw distance: scales with viewport so buffer stays ~7-10 items
// regardless of device size (vs fixed 250 which is 37% on SE but 27% on Pro Max)
const DRAW_DISTANCE = Math.round(Dimensions.get('window').height * 0.75);

// Module-level flag: once pantry content has been shown, skip skeletons on remount.
// Persists across component unmount/remount (stack navigation), resets on app restart.
let hasEverShownContent = false;

// Sort types (exported for use in other components)
export type SortOption = 'name' | 'expiry' | 'quantity' | 'recent';
export type SortDirection = 'asc' | 'desc';

interface PantryContentProps {
  // User info
  userName: string;
  householdName: string;
  avatarUrl?: string | null;
  notificationCount?: number;

  // Stats
  stats?: Pick<
    PantryStats,
    'totalItems' | 'expiringCount' | 'lowStockCount'
  > | null;

  // Items
  items: PantryItem[];

  // Location filter
  locationFilter: LocationFilter;
  onLocationFilterChange: (filter: LocationFilter) => void;
  locationCounts: Record<string, number>;

  // Dynamic filter tabs (optional - falls back to default tabs if not provided)
  tabs?: FilterTabConfig<LocationFilter>[];
  onAddLocation?: () => void;

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Sort (initial values from store, callbacks to persist changes)
  initialSortOption?: SortOption;
  initialSortDirection?: SortDirection;
  onSortChange?: (option: SortOption, direction: SortDirection) => void;

  // Hybrid sort/search: when true, server handles sort+search; when false, local
  useServerSort?: boolean;

  // Actions (passed to context provider)
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;

  // Header actions
  onAvatarPress?: () => void;
  onHomePress?: () => void;
  onNotificationPress?: () => void;
  onSettingsPress?: () => void;
  onAnalyticsPress?: () => void;
  onLowStockNavigate?: () => void;

  // List actions
  onRefresh?: () => void;
  onEndReached?: () => void;

  // Empty state
  totalCount?: number;
  onAddItem?: () => void;

  // No-home states
  noHomeSelected?: boolean;
  noHomes?: boolean;
  onSelectHome?: () => void;

  // Pagination
  isLoadingMore?: boolean;
  hasMore?: boolean;

  // State
  refreshing?: boolean;
  loading?: boolean;

}

export interface PantryContentRef {
  scrollToTop(): void;
}

const getItemVariant = (
  isExpired: boolean,
  isExpiringSoon: boolean,
): ItemVariant => {
  if (isExpired) return 'expired';
  if (isExpiringSoon) return 'warning';
  return 'normal';
};

/** Pre-computed display data for a single pantry item. */
interface ItemDisplayData {
  id: string;
  name: string;
  imageUrl: string | null | undefined;
  expirationText: string | null;
  expirationVariant: ExpirationVariant | undefined;
  expirationColor: string | undefined;
  variant: ItemVariant;
  quantityDisplay: string;
  location: string | null;
  isOutOfStock: boolean;
  packageBreakdownText: string | null | undefined;
  remainingNetWeightText: string | null | undefined;
  quantityBreakdownText: string | null | undefined;
  activeBatchCount: number | undefined;
}

/** Returns true when at least one usage has been recorded for the item. */
function hasConsumptionStarted(item: PantryItem): boolean {
  if (item.lastUsedAt != null) return true;
  // Fallback: weight differs from original means consumption occurred
  if (
    item.netWeight != null &&
    item.remainingNetWeight != null &&
    item.remainingNetWeight !== item.netWeight
  )
    return true;
  return false;
}

/**
 * Pre-compute display data for all pantry items at list level.
 * Module-level so the React Compiler doesn't flag Date usage as impure in render.
 * Called once per list render (only when items/colors change), NOT per-item.
 */
function computeDisplayMap(
  items: PantryItem[],
  expirationColors: { expired: string; warning: string; normal: string },
  getLocation: (
    storageState?: string | null,
    storageLocation?: { name: string } | null,
  ) => string | null,
): Map<string, ItemDisplayData> {
  const map = new Map<string, ItemDisplayData>();
  for (const item of items) {
    const expiresIn = item.expiresAt
      ? differenceInCalendarDays(new Date(item.expiresAt), new Date())
      : null;
    const expStatus = getExpirationStatus(expiresIn);
    const isExpired = expiresIn !== null && expiresIn < 0;
    const isExpiringSoon = expiresIn !== null && expiresIn >= 0 && expiresIn <= 3;
    const variant: ItemVariant = getItemVariant(isExpired, isExpiringSoon);
    const hasExpiry = item.expiresAt != null;

    let expirationColor: string | undefined;
    if (hasExpiry) {
      const expType = expStatus.type;
      if (expType === 'expired' || expType === 'critical') {
        expirationColor = expirationColors.expired;
      } else if (expType === 'warning') {
        expirationColor = expirationColors.warning;
      } else {
        expirationColor = expirationColors.normal;
      }
    }

    map.set(item.id, {
      id: item.id,
      name: item.itemName || 'Unknown Item',
      imageUrl: resolveImageUrl(item),
      expirationText: hasExpiry ? expStatus.text : null,
      expirationVariant: hasExpiry ? expStatus.type : undefined,
      expirationColor,
      variant,
      quantityDisplay: formatQuantityDisplay(item.quantity, item.unit?.symbol),
      location: getLocation(item.storageState, item.storageLocation),
      isOutOfStock: item.quantity === 0,
      packageBreakdownText: formatPackageBreakdown(
        item.packageBreakdown,
        item.quantityBreakdown?.totalContentUnits,
      ),
      remainingNetWeightText: hasConsumptionStarted(item)
        ? formatRemainingNetWeight(item.remainingNetWeight, item.netWeightUnit)
        : null,
      quantityBreakdownText: formatQuantityBreakdown(
        item.quantityBreakdown,
      ),
      activeBatchCount: item.activeBatchCount,
    });
  }
  return map;
}

// Context for passing pre-computed display map to module-scope renderItem
const DisplayMapContext = createContext<Map<string, ItemDisplayData>>(new Map());

// Get location string — only returns custom storage location names.
// Default storage states (Fridge/Freezer/Pantry) are already represented by filter tabs.
const getLocationString = (
  _storageState?: string | null,
  storageLocation?: { name: string } | null,
): string | null => {
  if (storageLocation?.name) return storageLocation.name;
  return null;
};

// Module-scope getItemType — separate recycling pools by layout shape
const getItemType = (item: PantryItem): string => {
  if (item.quantity === 0) return 'out-of-stock';
  if (!item.expiresAt) return 'no-expiry';
  return 'with-expiry';
};

// Module-scope keyExtractor — zero runtime overhead (no compiler tracking/comparison)
const keyExtractor = (item: PantryItem) => item.id;

// Module-scope renderItem — stable reference, no closure recreation per render
const renderItem = ({ item }: ListRenderItemInfo<PantryItem>) => {
  if (!item) return null;
  return <PantryRenderItem itemId={item.id} />;
};

// Module-scope bridge component — looks up pre-computed display data from context.
// React.memo is required because this is a FlashList renderItem (module-scope,
// parent not compiled by React Compiler). The custom comparator checks the itemId
// primitive; display data changes propagate via context re-render only when the
// map reference changes (i.e., when items actually change).
const PantryRenderItemInner: React.FC<{ itemId: string }> = ({ itemId }) => {
  const displayMap = useContext(DisplayMapContext);
  const display = displayMap.get(itemId);
  if (!display) return null;
  return (
    <PantryItemCard
      id={display.id}
      name={display.name}
      expirationText={display.expirationText}
      expirationVariant={display.expirationVariant}
      expirationColor={display.expirationColor}
      quantity={display.quantityDisplay}
      location={display.location}
      variant={display.variant}
      imageUrl={display.imageUrl}
      isOutOfStock={display.isOutOfStock}
      packageBreakdownText={display.packageBreakdownText}
      remainingNetWeightText={display.remainingNetWeightText}
      quantityBreakdownText={display.quantityBreakdownText}
      activeBatchCount={display.activeBatchCount}
    />
  );
};

const PantryRenderItem = React.memo(PantryRenderItemInner);

// Default filter tabs for pantry (fallback if none provided)
const DEFAULT_PANTRY_TABS: FilterTabConfig<LocationFilter>[] = [
  { id: 'all', label: 'All' },
  { id: 'fridge', label: 'Fridge', icon: 'thermometer-outline' },
  { id: 'freezer', label: 'Freezer', icon: 'snow-outline' },
  { id: 'pantry', label: 'Pantry', icon: 'cube-outline' },
];

// --- Extracted sub-components (compiler auto-memoizes) ---

interface PantryEmptyStateProps {
  showSkeletons: boolean;
  searchQuery: string;
  itemCount: number;
  locationFilter: LocationFilter;
  tabs: FilterTabConfig<LocationFilter>[];
  onAddItem?: () => void;
  noHomeSelected?: boolean;
  noHomes?: boolean;
  onSelectHome?: () => void;
}

function PantryEmptyState({
  showSkeletons,
  searchQuery,
  itemCount,
  locationFilter,
  tabs,
  onAddItem,
  noHomeSelected,
  noHomes,
  onSelectHome,
}: PantryEmptyStateProps) {
  if (showSkeletons) return <PantryScreenSkeleton />;

  if (noHomes) {
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="home-outline"
        title="No home yet"
        description="Create or join a home to start tracking food"
        action={
          onSelectHome
            ? { label: 'Get Started', onPress: onSelectHome }
            : undefined
        }
      />
    );
  }

  if (noHomeSelected) {
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="home-outline"
        title="No home selected"
        description="Select a home to view your pantry"
        action={
          onSelectHome
            ? { label: 'Go to My Homes', onPress: onSelectHome }
            : undefined
        }
      />
    );
  }

  if (searchQuery) {
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="search-outline"
        title="No items found"
        description="Try a different search term"
      />
    );
  }

  if (locationFilter !== 'all' && itemCount === 0) {
    const activeTab = tabs.find(tab => tab.id === locationFilter);
    const tabName = activeTab?.label ?? 'this location';
    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="basket-outline"
        title={`No items in ${tabName}`}
        description="Items stored here will appear in this tab"
      />
    );
  }

  return (
    <EmptyState
      testID="pantry-empty-state"
      icon="basket-outline"
      title="Your pantry is empty"
      description="Start tracking your food to reduce waste"
      action={
        onAddItem ? { label: 'Add Items', onPress: onAddItem } : undefined
      }
    />
  );
}

// --- Main component ---

export const PantryContent = React.forwardRef<
  PantryContentRef,
  PantryContentProps
>(
  (
    {
      userName,
      householdName,
      avatarUrl,
      notificationCount = 0,
      stats,
      items,
      locationFilter,
      onLocationFilterChange,
      locationCounts,
      tabs = DEFAULT_PANTRY_TABS,
      onAddLocation,
      searchQuery,
      onSearchChange,
      initialSortOption = 'recent',
      initialSortDirection = 'desc',
      onSortChange,
      useServerSort = false,
      onItemPress,
      onItemEdit,
      onItemDelete,
      onItemConsume,
      onItemWaste,
      onItemRestock,
      onAvatarPress,
      onHomePress,
      onNotificationPress,
      onSettingsPress,
      onAnalyticsPress,
      onLowStockNavigate,
      totalCount,
      onAddItem,
      isLoadingMore = false,
      hasMore = false,
      onRefresh,
      onEndReached,
      refreshing = false,
      loading = false,
      noHomeSelected,
      noHomes,
      onSelectHome,
    },
    ref,
  ) => {
    useRenderTime('PantryContent', { slowThreshold: 1000 });
    const { theme } = useUnistyles();
    const flashListRef = useRef<FlashListRef<PantryItem>>(null);

    const perfCallbacks = useFlashListPerformance(flashListRef, {
      componentName: 'PantryContent',
      reportInterval: 10000,
    });
    useDataReferenceTracker(items, 'PantryContent.items', perfCallbacks.onDataReferenceChange);

    useImperativeHandle(ref, () => ({
      scrollToTop() {
        // Defer to next frame to avoid FlashList v2 blank-cell regression (#1784)
        // when scroll reset races with an in-progress fling
        requestAnimationFrame(() => {
          flashListRef.current?.scrollToTop({ animated: true });
        });
      },
    }));

    // Derive latch from module-level flag + current conditions — no setState needed.
    // Once true, hasEverShownContent persists across unmount/remount (module scope).
    const hasShownContent =
      hasEverShownContent || (!loading && items.length > 0);

    // Sync the module-level flag so it persists across unmount/remount.
    useEffect(() => {
      if (hasShownContent) {
        hasEverShownContent = true;
      }
    }, [hasShownContent]);

    // Show skeletons only on the very first data load.
    // awaitingDeferredItems bridges the gap where Apollo finished (loading=false)
    // but useDeferredValue hasn't propagated items yet (items=[] while totalCount>0).
    const awaitingDeferredItems =
      items.length === 0 && (totalCount ?? 0) > 0 && !loading;
    const showSkeletons =
      !hasShownContent && (loading || awaitingDeferredItems);

    // Use sorting hook for sort state and logic
    const {
      sortOption,
      sortDirection,
      sortModalVisible,
      openSortModal,
      closeSortModal,
      handleSortSelect,
      sortItems,
    } = usePantrySorting<PantryItem>({
      initialSortOption,
      initialSortDirection,
      onSortChange,
    });

    // Actions for context provider — wrap delete to prepare FlashList for layout animation
    const itemActions: PantryItemActions = {
      onItemPress,
      onItemEdit,
      onItemDelete: onItemDelete
        ? (id: string) => {
            flashListRef.current?.prepareForLayoutAnimationRender();
            onItemDelete(id);
          }
        : undefined,
      onItemConsume,
      onItemWaste,
      onItemRestock,
    };

    // Search filtering is now handled by useHybridSearch — items arrive pre-filtered.
    const localFilteredItems = items;

    // Apply local sort only when not using server sort
    const sortedItems = useServerSort
      ? localFilteredItems
      : sortItems(localFilteredItems);

    // Precomputed expiration colors — used by computeDisplayMap
    const expirationColors = {
      expired: theme.colors.expiration.expiredText,
      warning: theme.colors.expiration.warningText,
      normal: theme.colors.textSecondary,
    };

    // Use sortedItems directly — the outer useDeferredValue in PantryMain already
    // defers Apollo cache updates. A second deferral here only desynchronizes
    // FlashList data from itemDisplayMap, causing getItemType instability.
    const deferredSortedItems = sortedItems;

    // Pre-compute display data for ALL items at list level — eliminates per-item
    // computeItemDisplay calls during scroll/recycling. React Compiler auto-memoizes
    // this when deferredSortedItems and expirationColors are stable.
    const displayMap = computeDisplayMap(deferredSortedItems, expirationColors, getLocationString);

    // Preload images for visible + upcoming items to prevent blank shimmer during fast scroll
    useEffect(() => {
      const urls: string[] = [];
      for (const item of deferredSortedItems) {
        const url = resolveImageUrl(item);
        if (url) urls.push(url);
      }
      if (urls.length > 0) preloadImages(urls);
    }, [deferredSortedItems]);

    // Scroll to top when filter or sort changes to reset position after reorder
    const prevLocationFilter = useRef(locationFilter);
    const prevSortOption = useRef(sortOption);
    const prevSortDirection = useRef(sortDirection);
    useEffect(() => {
      const changed =
        prevLocationFilter.current !== locationFilter ||
        prevSortOption.current !== sortOption ||
        prevSortDirection.current !== sortDirection;

      if (changed) {
        // Defer to next frame to avoid FlashList v2 blank-cell regression (#1784)
        // when scroll position reset races with an in-progress fling
        requestAnimationFrame(() => {
          flashListRef.current?.scrollToOffset({ offset: 0, animated: false });
        });
        prevLocationFilter.current = locationFilter;
        prevSortOption.current = sortOption;
        prevSortDirection.current = sortDirection;
      }
    }, [locationFilter, sortOption, sortDirection]);

    // Build tabs with optional add button at the end
    const tabsWithAddButton = (() => {
      if (!onAddLocation) return tabs;
      return [
        ...tabs,
        {
          id: '__add__' as LocationFilter,
          label: '',
          icon: 'add',
          onPress: onAddLocation,
          isAction: true,
        },
      ];
    })();

    const sectionTitle = (() => {
      const activeTab = tabs.find(tab => tab.id === locationFilter);
      const label = activeTab?.label ?? 'All';
      return `${label.toUpperCase()} ITEMS`;
    })();

    // Stable extraData — string avoids new array reference every render
    const extraData = `${sortOption}-${sortDirection}-${locationFilter}`;

    const isEmpty = !showSkeletons && deferredSortedItems.length === 0;

    // Use flexGrow when empty so ListEmptyComponent can center properly;
    // drop the large paddingBottom that creates excess space below the empty state
    const listContentStyle = isEmpty
      ? styles.listContentEmpty
      : styles.listContent;

    return (
      <PantryActionsProvider actions={itemActions}>
        <View style={styles.container}>
          {/* Header Section - only PantryHeader stays fixed */}
          <View style={styles.header}>
            <PantryHeader
              userName={userName}
              householdName={householdName}
              avatarUrl={avatarUrl}
              notificationCount={notificationCount}
              onAvatarPress={onAvatarPress}
              onHomePress={onHomePress}
              onNotificationPress={onNotificationPress}
            />
          </View>

          {/* Sticky section — SearchBar + AlertBar + FilterTabs pinned above list */}
          <View style={styles.stickySection}>
            <View style={styles.searchContainer}>
              <SearchBar
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholder="Search your pantry..."
                showSearchIcon={true}
                testID="pantry-search-input"
                innerRightIcon={
                  <Pressable
                    onPress={onSettingsPress}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Pantry settings"
                  >
                    <Icon
                      name="settings-outline"
                      size={18}
                      color={theme.colors.textTertiary}
                    />
                  </Pressable>
                }
              />
              {!!stats && (
                <PantryAlertBar
                  stats={stats}
                  onAnalyticsPress={onAnalyticsPress}
                  onLowStockNavigate={onLowStockNavigate}
                />
              )}
            </View>
            <FilterTabs<LocationFilter>
              tabs={tabsWithAddButton}
              activeTabId={locationFilter}
              onTabChange={onLocationFilterChange}
              counts={locationCounts}
              testIDPrefix="pantry-location-tab"
            />
          </View>

          {/* Content List */}
          <View style={styles.listContainer}>
            <View style={styles.contentFill}>
              <DisplayMapContext.Provider value={displayMap}>
                <FlashList<PantryItem>
                  ref={flashListRef}
                  CellRendererComponent={AnimatedCellRenderer}
                  testID="pantry-list"
                  data={showSkeletons ? EMPTY_ARRAY : deferredSortedItems}
                  renderItem={renderItem}
                  keyExtractor={keyExtractor}
                  getItemType={getItemType}
                  drawDistance={DRAW_DISTANCE}
                  maxItemsInRecyclePool={15}
                  extraData={extraData}
                  contentContainerStyle={listContentStyle}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    onRefresh ? (
                      <RefreshControl
                        testID="pantry-refresh-control"
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                      />
                    ) : undefined
                  }
                  ListHeaderComponent={
                    <SectionHeader
                      title={sectionTitle}
                      variant="default"
                      actionLabel={`Sort ${sortDirection === 'asc' ? '↑' : '↓'}`}
                      onActionPress={openSortModal}
                      testID="pantry-sort-button"
                    />
                  }
                  ListEmptyComponent={
                    <PantryEmptyState
                      showSkeletons={showSkeletons}
                      searchQuery={searchQuery}
                      itemCount={items.length}
                      locationFilter={locationFilter}
                      tabs={tabs}
                      onAddItem={onAddItem}
                      noHomeSelected={noHomeSelected}
                      noHomes={noHomes}
                      onSelectHome={onSelectHome}
                    />
                  }
                  ListFooterComponent={
                    <PaginationFooter
                      isLoadingMore={isLoadingMore}
                      hasMore={hasMore}
                      itemCount={deferredSortedItems.length}
                    />
                  }
                  onEndReached={onEndReached}
                  onEndReachedThreshold={0.5}
                  onLoad={perfCallbacks.onLoad}
                  onViewableItemsChanged={perfCallbacks.onViewableItemsChanged}
                  maintainVisibleContentPosition={{ disabled: true }}
                />
              </DisplayMapContext.Provider>
            </View>
          </View>

          {/* Sort Modal */}
          {!!sortModalVisible && (
            <PantrySortModal
              visible={sortModalVisible}
              sortOption={sortOption}
              sortDirection={sortDirection}
              onSelect={handleSortSelect}
              onClose={closeSortModal}
            />
          )}
        </View>
      </PantryActionsProvider>
    );
  },
);

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs,
  },
  stickySection: {
    backgroundColor: theme.colors.background,
    zIndex: theme.zIndex.sticky,
    paddingBottom: theme.spacing.sm,
    marginBottom: -theme.spacing.sm,
  },
  searchContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  listContainer: {
    flex: 1,
  },
  contentFill: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: theme.spacing['3xl'] * 2,
  },
  listContentEmpty: {
    paddingHorizontal: 0,
    flexGrow: 1,
  },
}));
