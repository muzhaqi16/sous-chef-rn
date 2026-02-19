import React, { useCallback, useMemo, useEffect, useRef, useImperativeHandle } from 'react';
import { View, Pressable, RefreshControl } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { FlashList, type FlashListRef, ListRenderItemInfo } from '@shopify/flash-list';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { resolveImageUrl } from '#utils/imageUtils';
import { LocationFilter } from '#utils/pantryFilters';
import { SearchBar } from '../molecules/SearchBar';
import { FilterTabs } from '../molecules/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '../molecules/FilterTabs/types';
import { SectionHeader } from '../molecules/SectionHeader';
import { PantryItemCard, ItemVariant, ExpirationVariant } from './PantryItemCard';
import { PantryHeader } from './PantryHeader';
import { PantrySortModal } from './PantrySortModal';
import {
  PantryActionsProvider,
  type PantryItemActions,
} from './PantryActionsContext';
import { usePantrySorting } from './hooks/usePantrySorting';
import {
  getExpirationStatus,
  formatQuantityDisplay,
  formatPackageBreakdown,
  formatRemainingNetWeight,
  formatQuantityBreakdown,
} from '#hooks/pantry/usePantryItemTransformation';
import { StorageState } from '#generated';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import { EmptyState } from '#components/base/EmptyState';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { PantryItemSkeleton } from '#components/base/Skeleton/PantryItemSkeleton';
import { useRenderTime } from '#hooks/performance/useRenderTime';

// Stable empty array reference to avoid FlashList re-renders when showing skeletons
const EMPTY_ARRAY: PantryItem[] = [];

// Module-level flag: once pantry content has been shown, skip skeletons on remount.
// Persists across component unmount/remount (stack navigation), resets on app restart.
let hasEverShownContent = false;

// Sort types (exported for use in other components)
export type SortOption = 'name' | 'expiry' | 'quantity' | 'recent';
export type SortDirection = 'asc' | 'desc';

// Item type from pantry management
interface PantryItem {
  id: string;
  itemName?: string | null;
  expiresAt?: string | null;
  quantity: number;
  storageState?: string | null;
  storageLocation?: {
    id: string;
    name: string;
  } | null;
  createdAt?: string;
  unit?: {
    symbol: string;
  } | null;
  item?: {
    name?: string;
    netWeight?: number | null;
    displayUnit?: {
      symbol?: string;
    } | null;
    category?: {
      name?: string;
    } | null;
    imageUrl?: string | null;
    images?: unknown;
  } | null;
  netWeight?: number | null;
  remainingNetWeight?: number | null;
  netWeightUnit?: { symbol?: string | null; name?: string | null } | null;
  packageBreakdown?: {
    count: number;
    contentUnit: { name: string; symbol?: string | null };
    perUnitNetWeight?: number | null;
    perUnitNetWeightUnit?: { symbol?: string | null } | null;
    totalNetWeight?: number | null;
  } | null;
  quantityBreakdown?: {
    fullPackages: number;
    looseContentUnits: number;
    contentUnit?: { name?: string; symbol?: string | null } | null;
    totalContentUnits: number;
    remainingWeight?: number | null;
    remainingWeightUnit?: { symbol?: string | null } | null;
  } | null;
}

interface PantryContentProps {
  // User info
  userName: string;
  householdName: string;
  avatarUrl?: string | null;
  notificationCount?: number;

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
  onSettingsPress?: () => void;

  // List actions
  onRefresh?: () => void;
  onEndReached?: () => void;

  // Empty state
  totalCount?: number;
  onAddItem?: () => void;

  // State
  refreshing?: boolean;
  loading?: boolean;

  // Swipeable coordination
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
}

export interface PantryContentRef {
  scrollToTop(): void;
}

interface ItemDisplayData {
  imageUrl: string | null;
  expirationText: string | null;
  expirationVariant?: ExpirationVariant;
  variant: ItemVariant;
  quantityDisplay: string;
  location: string;
  isOutOfStock: boolean;
  packageBreakdownText: string | null;
  remainingNetWeightText: string | null;
  quantityBreakdownText: string | null;
}

// Default filter tabs for pantry (fallback if none provided)
const DEFAULT_PANTRY_TABS: FilterTabConfig<LocationFilter>[] = [
  { id: 'all', label: 'All' },
  { id: 'fridge', label: 'Fridge', icon: 'kitchen', iconLibrary: 'MaterialIcons' },
  { id: 'freezer', label: 'Freezer', icon: 'ac-unit', iconLibrary: 'MaterialIcons' },
  { id: 'pantry', label: 'Pantry', icon: 'inventory-2', iconLibrary: 'MaterialIcons' },
];

export const PantryContent = React.memo(React.forwardRef<PantryContentRef, PantryContentProps>(({
  userName,
  householdName,
  avatarUrl,
  notificationCount = 0,
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
  onItemPress,
  onItemEdit,
  onItemDelete,
  onItemConsume,
  onItemWaste,
  onItemRestock,
  onAvatarPress,
  onHomePress,
  onSettingsPress,
  totalCount,
  onAddItem,
  onRefresh,
  onEndReached,
  refreshing = false,
  loading = false,
  onSwipeableWillOpen: _onSwipeableWillOpen,
  onSwipeableClose: _onSwipeableClose,
}, ref) => {
  useRenderTime('PantryContent');
  const { theme } = useUnistyles();
  const flashListRef = useRef<FlashListRef<PantryItem>>(null);

  useImperativeHandle(ref, () => ({
    scrollToTop() {
      flashListRef.current?.scrollToTop({ animated: true });
    },
  }));

  // PERFORMANCE: Defer heavy list render until after navigation animation
  const isReady = useDeferredRender(500);

  // Once content has been shown, latch the module-level flag so skeletons
  // never reappear on remounts or stack navigation (only resets on app restart).
  if (!loading && isReady && items.length > 0) {
    hasEverShownContent = true;
  }

  // Show skeletons only on the very first data load
  const showSkeletons = !hasEverShownContent && (!isReady || loading);

  // Crossfade animation - opacity-based transition to avoid gap
  const skeletonOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    const duration = 200;
    if (showSkeletons) {
      skeletonOpacity.value = withTiming(1, { duration });
      contentOpacity.value = withTiming(0, { duration });
    } else {
      skeletonOpacity.value = withTiming(0, { duration });
      contentOpacity.value = withTiming(1, { duration });
    }
  }, [showSkeletons, skeletonOpacity, contentOpacity]);

  const skeletonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: skeletonOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

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

  // Memoize actions for context provider
  const itemActions = useMemo<PantryItemActions>(
    () => ({
      onItemPress,
      onItemEdit,
      onItemDelete,
      onItemConsume,
      onItemWaste,
      onItemRestock,
    }),
    [
      onItemPress,
      onItemEdit,
      onItemDelete,
      onItemConsume,
      onItemWaste,
      onItemRestock,
    ],
  );

  // Get location string from storage state
  const getLocationString = useCallback(
    (storageState?: string | null, storageLocation?: { name: string } | null): string => {
      if (storageLocation?.name) return storageLocation.name;
      switch (storageState) {
        case StorageState.Refrigerated:
          return 'Fridge';
        case StorageState.Frozen:
          return 'Freezer';
        default:
          return 'Pantry';
      }
    },
    [],
  );

  // Sorted items - filter out any null/undefined items to prevent FlashList layout crashes
  const sortedItems = useMemo(() => {
    const sorted = sortItems(items);
    return sorted.filter(item => item?.id);
  }, [items, sortItems]);

  // Pre-compute ALL per-item display data once to avoid per-render Date allocations and string formatting
  const itemDisplayMap = useMemo(() => {
    const map = new Map<string, ItemDisplayData>();
    const now = Date.now();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    for (const item of sortedItems) {
      const expiresIn = item.expiresAt
        ? Math.ceil((new Date(item.expiresAt).getTime() - now) / MS_PER_DAY)
        : null;
      const expStatus = getExpirationStatus(expiresIn);
      const isExpired = expiresIn !== null && expiresIn < 0;
      const isExpiringSoon = expiresIn !== null && expiresIn >= 0 && expiresIn <= 3;
      const variant: ItemVariant = (item as any).condition === 'EXPIRED' || isExpired ? 'expired' : isExpiringSoon ? 'warning' : 'normal';
      const hasExpiry = item.expiresAt != null;

      const quantityDisplay = formatQuantityDisplay(item.quantity, item.unit?.symbol);
      const pkgBreakdownText = formatPackageBreakdown(item.packageBreakdown, item.quantityBreakdown?.totalContentUnits);
      const remainingNetWeightText = formatRemainingNetWeight(item.remainingNetWeight, item.netWeightUnit);
      const qtyBreakdownText = formatQuantityBreakdown(item.quantityBreakdown, item.unit?.symbol);

      map.set(item.id, {
        imageUrl: resolveImageUrl(item),
        expirationText: hasExpiry ? expStatus.text : null,
        expirationVariant: hasExpiry ? expStatus.type : undefined,
        variant,
        quantityDisplay,
        location: getLocationString(item.storageState, item.storageLocation),
        isOutOfStock: item.quantity === 0,
        packageBreakdownText: pkgBreakdownText,
        remainingNetWeightText,
        quantityBreakdownText: qtyBreakdownText,
      });
    }
    return map;
  }, [sortedItems, getLocationString]);

  // Stable ref for callbacks — avoids FlashList re-rendering all visible items on data changes
  const itemDisplayMapRef = useRef(itemDisplayMap);
  itemDisplayMapRef.current = itemDisplayMap;

  // Scroll to top when filter or sort changes — FlashList v2's
  // maintainVisibleContentPosition causes layout corruption on data reorder
  const prevLocationFilter = useRef(locationFilter);
  const prevSortOption = useRef(sortOption);
  const prevSortDirection = useRef(sortDirection);
  useEffect(() => {
    const changed =
      prevLocationFilter.current !== locationFilter ||
      prevSortOption.current !== sortOption ||
      prevSortDirection.current !== sortDirection;

    if (changed) {
      flashListRef.current?.scrollToTop({ animated: false });
      prevLocationFilter.current = locationFilter;
      prevSortOption.current = sortOption;
      prevSortDirection.current = sortDirection;
    }
  }, [locationFilter, sortOption, sortDirection]);

  // Render list item — stable callback via ref pattern to avoid FlashList full re-renders
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PantryItem>) => {
      if (!item) return null;
      const display = itemDisplayMapRef.current.get(item.id);
      if (!display) return null;

      return (
        <PantryItemCard
          id={item.id}
          name={item.itemName || 'Unknown Item'}
          expirationText={display.expirationText}
          expirationVariant={display.expirationVariant}
          quantity={display.quantityDisplay}
          location={display.location}
          storageState={item.storageState}
          variant={display.variant}
          imageUrl={display.imageUrl}
          isOutOfStock={display.isOutOfStock}
          packageBreakdownText={display.packageBreakdownText}
          remainingNetWeightText={display.remainingNetWeightText}
          quantityBreakdownText={display.quantityBreakdownText}
        />
      );
    },
    [],
  );

  // Build tabs with optional add button at the end
  const tabsWithAddButton = useMemo((): FilterTabConfig<LocationFilter>[] => {
    if (!onAddLocation) return tabs;
    return [
      ...tabs,
      {
        id: '__add__' as LocationFilter,
        label: '',
        icon: 'add',
        iconLibrary: 'MaterialIcons',
        onPress: onAddLocation,
        isAction: true,
      },
    ];
  }, [tabs, onAddLocation]);

  const sectionTitle = useMemo(() => {
    const activeTab = tabs.find(tab => tab.id === locationFilter);
    const label = activeTab?.label ?? 'All';
    return `${label.toUpperCase()} ITEMS`;
  }, [tabs, locationFilter]);

  // Stable keyExtractor - sortedItems already guarantees every item has an id
  const keyExtractor = useCallback(
    (item: PantryItem) => item.id,
    [],
  );

  // Item type function for better FlashList cell recycling
  // Items with different variants have different visual layouts
  const getItemType = useCallback(
    (item: PantryItem) => {
      const display = itemDisplayMapRef.current.get(item.id);
      return display?.variant ?? 'normal';
    },
    [],
  );

  // Memoize extraData to avoid new array reference every render
  const extraData = useMemo(
    () => [sortOption, sortDirection, locationFilter],
    [sortOption, sortDirection, locationFilter],
  );

  const isEmpty = !showSkeletons && sortedItems.length === 0;

  // Use flexGrow when empty so ListEmptyComponent can center properly;
  // drop the large paddingBottom that creates excess space below the empty state
  const listContentStyle = useMemo(
    () => (isEmpty ? styles.listContentEmpty : styles.listContent),
    [isEmpty],
  );

  // Empty state for FlashList — varies by context
  const emptyStateContent = useMemo(() => {
    // Don't show empty state while skeletons are visible
    if (showSkeletons) return null;

    if (searchQuery) {
      return (
        <EmptyState
          testID="pantry-empty-state"
          icon="search-off"
          iconLibrary="MaterialIcons"
          title="No items found"
          description="Try a different search term"
        />
      );
    }

    if (totalCount != null && totalCount > 0 && items.length === 0) {
      const activeTab = tabs.find(tab => tab.id === locationFilter);
      const tabName = activeTab?.label ?? 'this location';
      return (
        <EmptyState
          testID="pantry-empty-state"
          icon="kitchen"
          iconLibrary="MaterialIcons"
          title={`No items in ${tabName}`}
          description="Items stored here will appear in this tab"
        />
      );
    }

    return (
      <EmptyState
        testID="pantry-empty-state"
        icon="kitchen"
        iconLibrary="MaterialIcons"
        title="Your pantry is empty"
        description="Start tracking your food to reduce waste"
        action={onAddItem ? { label: 'Add Items', onPress: onAddItem } : undefined}
      />
    );
  }, [showSkeletons, searchQuery, totalCount, items.length, tabs, locationFilter, onAddItem]);

  return (
    <PantryActionsProvider actions={itemActions}>
      <View style={styles.container}>
        {/* Header Section */}
        <View style={styles.header}>
          <PantryHeader
            userName={userName}
            householdName={householdName}
            avatarUrl={avatarUrl}
            notificationCount={notificationCount}
            onAvatarPress={onAvatarPress}
            onHomePress={onHomePress}
          />

          {/* Search Bar */}
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
                  name="settings"
                  size={18}
                  color={theme.colors.textTertiary}
                  library="Feather"
                />
              </Pressable>
            }
          />
        </View>

        {/* Always visible — not part of crossfade */}
        <FilterTabs<LocationFilter>
          tabs={tabsWithAddButton}
          activeTabId={locationFilter}
          onTabChange={onLocationFilterChange}
          counts={locationCounts}
          testIDPrefix="pantry-location-tab"
        />
        <SectionHeader
          title={sectionTitle}
          variant="default"
          actionLabel={`Sort ${sortDirection === 'asc' ? '↑' : '↓'}`}
          onActionPress={openSortModal}
          testID="pantry-sort-button"
        />

        {/* Content List - Crossfade between skeleton and content */}
        <View style={styles.listContainer}>
          {/* Content layer - flex:1 normal flow so FlashList can measure properly */}
          <Animated.View
            style={[styles.contentFill, contentAnimatedStyle]}
            pointerEvents={showSkeletons ? 'none' : 'auto'}
          >
            <FlashList<PantryItem>
              ref={flashListRef}
              testID="pantry-list"
              data={showSkeletons ? EMPTY_ARRAY : sortedItems}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
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
              ListEmptyComponent={emptyStateContent}
              getItemType={getItemType}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.5}
              drawDistance={400}
            />
          </Animated.View>

          {/* Skeleton layer (absolute on top, fades out) */}
          {showSkeletons && (
            <Animated.View
              testID="pantry-loading"
              style={[styles.absoluteFill, skeletonAnimatedStyle]}
              pointerEvents="none"
            >
              <SkeletonList
                SkeletonComponent={PantryItemSkeleton}
                count={6}
                containerStyle={styles.skeletonListContent}
              />
            </Animated.View>
          )}
        </View>

        {/* Sort Modal */}
        <PantrySortModal
          visible={sortModalVisible}
          sortOption={sortOption}
          sortDirection={sortDirection}
          onSelect={handleSortSelect}
          onClose={closeSortModal}
        />
      </View>
    </PantryActionsProvider>
  );
}));

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
  listContainer: {
    flex: 1,
  },
  contentFill: {
    flex: 1,
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: theme.spacing['3xl'] * 2,
  },
  listContentEmpty: {
    paddingHorizontal: 0,
    flexGrow: 1,
  },
  skeletonListContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
}));
