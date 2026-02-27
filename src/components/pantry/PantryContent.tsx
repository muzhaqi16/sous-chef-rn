import React, { useEffect, useRef, useImperativeHandle, useDeferredValue } from 'react';
import { View, Pressable, RefreshControl } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming } from 'react-native-reanimated';
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
  type PantryItemActions } from './PantryActionsContext';
import { usePantrySorting } from './hooks/usePantrySorting';
import {
  getExpirationStatus,
  formatPackageBreakdown,
  formatRemainingNetWeight,
  formatQuantityBreakdown } from '#hooks/pantry/usePantryItemTransformation';
import { formatQuantityDisplay } from '#/utils/formatQuantity';
import { StorageState, type PantryStats } from '#generated';
import { PantryAlertBar } from '#components/pantry/PantryAlertBar';
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

  // Stats
  stats?: Pick<PantryStats, 'totalItems' | 'expiringCount' | 'lowStockCount'> | null;

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
  expirationColor?: string;
  variant: ItemVariant;
  quantityDisplay: string;
  location: string;
  isOutOfStock: boolean;
  packageBreakdownText: string | null;
  remainingNetWeightText: string | null;
  quantityBreakdownText: string | null;
}

const getItemVariant = (isExpired: boolean, isExpiringSoon: boolean): ItemVariant => {
  if (isExpired) return 'expired';
  if (isExpiringSoon) return 'warning';
  return 'normal';
};

/**
 * Compute display data for a single pantry item.
 * Pure function — only depends on the item and shared expiration colors.
 */
function computeItemDisplay(
  item: PantryItem,
  now: number,
  expirationColors: { expired: string; warning: string; normal: string },
  getLocation: (storageState?: string | null, storageLocation?: { name: string } | null) => string,
): ItemDisplayData {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const expiresIn = item.expiresAt
    ? Math.ceil((new Date(item.expiresAt).getTime() - now) / MS_PER_DAY)
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

  return {
    imageUrl: resolveImageUrl(item),
    expirationText: hasExpiry ? expStatus.text : null,
    expirationVariant: hasExpiry ? expStatus.type : undefined,
    expirationColor,
    variant,
    quantityDisplay: formatQuantityDisplay(item.quantity, item.unit?.symbol),
    location: getLocation(item.storageState, item.storageLocation),
    isOutOfStock: item.quantity === 0,
    packageBreakdownText: formatPackageBreakdown(item.packageBreakdown, item.quantityBreakdown?.totalContentUnits),
    remainingNetWeightText: formatRemainingNetWeight(item.remainingNetWeight, item.netWeightUnit),
    quantityBreakdownText: formatQuantityBreakdown(item.quantityBreakdown, item.unit?.symbol) };
}

// Get location string from storage state (pure function — no component state dependency)
const getLocationString = (storageState?: string | null, storageLocation?: { name: string } | null): string => {
  if (storageLocation?.name) return storageLocation.name;
  switch (storageState) {
    case StorageState.Refrigerated:
      return 'Fridge';
    case StorageState.Frozen:
      return 'Freezer';
    default:
      return 'Pantry';
  }
};

/**
 * Compute display data for all items, reusing cached entries when possible.
 * Calls Date.now() internally for expiration calculations.
 */
function computeDisplayCache(
  items: PantryItem[],
  prevCache: Map<string, { item: PantryItem; data: ItemDisplayData }>,
  expirationColors: { expired: string; warning: string; normal: string },
) {
  const now = Date.now();
  const map = new Map<string, ItemDisplayData>();
  const nextCache = new Map<string, { item: PantryItem; data: ItemDisplayData }>();

  for (const item of items) {
    const cached = prevCache.get(item.id);

    if (cached && cached.item === item) {
      // Same object reference — Apollo hasn't updated this pantry item
      map.set(item.id, cached.data);
      nextCache.set(item.id, cached);
    } else {
      const data = computeItemDisplay(item, now, expirationColors, getLocationString);
      map.set(item.id, data);
      nextCache.set(item.id, { item, data });
    }
  }

  return { map, nextCache };
}

// Default filter tabs for pantry (fallback if none provided)
const DEFAULT_PANTRY_TABS: FilterTabConfig<LocationFilter>[] = [
  { id: 'all', label: 'All' },
  { id: 'fridge', label: 'Fridge', icon: 'thermometer-outline' },
  { id: 'freezer', label: 'Freezer', icon: 'snow-outline' },
  { id: 'pantry', label: 'Pantry', icon: 'cube-outline' },
];

export const PantryContent = React.forwardRef<PantryContentRef, PantryContentProps>(({
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
  onRefresh,
  onEndReached,
  refreshing = false,
  loading = false,
  // onSwipeableWillOpen and onSwipeableClose are handled by PantryActionsContext
}, ref) => {
  useRenderTime('PantryContent');
  const { theme } = useUnistyles();
  const flashListRef = useRef<FlashListRef<PantryItem>>(null);

  useImperativeHandle(ref, () => ({
    scrollToTop() {
      flashListRef.current?.scrollToTop({ animated: true });
    } }));

  // PERFORMANCE: Defer heavy list render until after navigation animation
  const isReady = useDeferredRender(500);

  // Derive latch from module-level flag + current conditions — no setState needed.
  // Once true, hasEverShownContent persists across unmount/remount (module scope).
  const hasShownContent = hasEverShownContent || (!loading && isReady && items.length > 0);

  // Sync the module-level flag so it persists across unmount/remount.
  useEffect(() => {
    if (hasShownContent) {
      hasEverShownContent = true;
    }
  }, [hasShownContent]);

  // Show skeletons only on the very first data load.
  // awaitingDeferredItems bridges the gap where Apollo finished (loading=false)
  // but useDeferredValue hasn't propagated items yet (items=[] while totalCount>0).
  const awaitingDeferredItems = items.length === 0 && (totalCount ?? 0) > 0 && !loading;
  const showSkeletons = !hasShownContent && (!isReady || loading || awaitingDeferredItems);

  // On return visits (hasEverShownContent === true) the animated style is bypassed
  // entirely, avoiding a 1-frame Reanimated worklet initialisation delay.
  // Plain variable is safe: the latch only transitions false→true, so once content
  // has been shown the animated wrapper is permanently skipped.
  const skipCrossfade = hasEverShownContent;

  // Crossfade animation - opacity-based transition to avoid gap
  // When content was previously shown, start with content visible immediately
  // to avoid a blank white flash on tab switch / remount.
  const skeletonOpacity = useSharedValue(hasEverShownContent ? 0 : 1);
  const contentOpacity = useSharedValue(hasEverShownContent ? 1 : 0);

  useEffect(() => {
    const duration = 200;
    if (showSkeletons) {
      skeletonOpacity.set(withTiming(1, { duration }));
      contentOpacity.set(withTiming(0, { duration }));
    } else {
      skeletonOpacity.set(withTiming(0, { duration }));
      contentOpacity.set(withTiming(1, { duration }));
    }
  }, [showSkeletons, skeletonOpacity, contentOpacity]);

  const skeletonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: skeletonOpacity.value }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value }));

  // Use sorting hook for sort state and logic
  const {
    sortOption,
    sortDirection,
    sortModalVisible,
    openSortModal,
    closeSortModal,
    handleSortSelect,
    sortItems } = usePantrySorting<PantryItem>({
    initialSortOption,
    initialSortDirection,
    onSortChange });

  // Actions for context provider
  const itemActions: PantryItemActions = {
    onItemPress,
    onItemEdit,
    onItemDelete,
    onItemConsume,
    onItemWaste,
    onItemRestock,
  };

  // Sorted items - filter out any null/undefined items to prevent FlashList layout crashes
  const sortedItems = (() => {
    const sorted = sortItems(items);
    return sorted.filter(item => item?.id);
  })();

  // Defer sorted items so FlashList keeps showing old content during transitions
  const deferredSortedItems = useDeferredValue(sortedItems);

  // Precomputed expiration colors — avoids per-item useUnistyles in ExpirationText
  const expirationColors = ({
    expired: theme.colors.expiration.expiredText,
    warning: theme.colors.expiration.warningText,
    normal: theme.colors.textSecondary });

  // PERFORMANCE: Compute display data for all items. The React Compiler auto-memoizes
  // this expression — recomputation only happens when deferredSortedItems changes.
  const itemDisplayMap = computeDisplayCache(deferredSortedItems, new Map(), expirationColors).map;

  // Stable ref for callbacks — avoids FlashList re-rendering all visible items on data changes
  const itemDisplayMapRef = useRef(itemDisplayMap);
  useEffect(() => {
    itemDisplayMapRef.current = itemDisplayMap;
  });

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
      flashListRef.current?.scrollToTop({ animated: false });
      prevLocationFilter.current = locationFilter;
      prevSortOption.current = sortOption;
      prevSortDirection.current = sortDirection;
    }
  }, [locationFilter, sortOption, sortDirection]);

  // Render list item — stable callback via ref pattern to avoid FlashList full re-renders
  const renderItem = ({ item }: ListRenderItemInfo<PantryItem>) => {
      if (!item) return null;
      const display = itemDisplayMapRef.current.get(item.id);
      if (!display) return null;

      return (
        <PantryItemCard
          id={item.id}
          name={item.itemName || 'Unknown Item'}
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
        />
      );
    };

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
        isAction: true },
    ];
  })();

  const sectionTitle = (() => {
    const activeTab = tabs.find(tab => tab.id === locationFilter);
    const label = activeTab?.label ?? 'All';
    return `${label.toUpperCase()} ITEMS`;
  })();

  // Stable keyExtractor - sortedItems already guarantees every item has an id
  const keyExtractor = (item: PantryItem) => item.id;

  // Item type function for better FlashList cell recycling
  // Items with different variants have different visual layouts
  const getItemType = (item: PantryItem) => {
      const display = itemDisplayMapRef.current.get(item.id);
      return display?.variant ?? 'normal';
    };

  // Stable extraData — string avoids new array reference every render
  const extraData = `${sortOption}-${sortDirection}-${locationFilter}`;

  const isEmpty = !showSkeletons && deferredSortedItems.length === 0;

  // Use flexGrow when empty so ListEmptyComponent can center properly;
  // drop the large paddingBottom that creates excess space below the empty state
  const listContentStyle = (isEmpty ? styles.listContentEmpty : styles.listContent);

  // Empty state for FlashList — varies by context
  const emptyStateContent = (() => {
    // Don't show empty state while skeletons are visible
    if (showSkeletons) return null;

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

    if (totalCount != null && totalCount > 0 && items.length === 0) {
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
        action={onAddItem ? { label: 'Add Items', onPress: onAddItem } : undefined}
      />
    );
  })();

  // Memoize the settings icon separately so it doesn't cause listHeaderComponent to re-create
  const settingsIcon = (
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
    );

  // Memoized list header — SearchBar, AlertBar, FilterTabs, SectionHeader scroll with the list
  const listHeaderComponent = (
      <>
        <View style={styles.searchContainer}>
          <SearchBar
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search your pantry..."
            showSearchIcon={true}
            testID="pantry-search-input"
            innerRightIcon={settingsIcon}
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
        <SectionHeader
          title={sectionTitle}
          variant="default"
          actionLabel={`Sort ${sortDirection === 'asc' ? '↑' : '↓'}`}
          onActionPress={openSortModal}
          testID="pantry-sort-button"
        />
      </>
    );

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

        {/* Content List - Crossfade between skeleton and content */}
        <View style={styles.listContainer}>
          {/* Content layer - flex:1 normal flow so FlashList can measure properly */}
          <Animated.View
            style={[styles.contentFill, skipCrossfade ? null : contentAnimatedStyle]}
            pointerEvents={showSkeletons ? 'none' : 'auto'}
          >
            <FlashList<PantryItem>
              ref={flashListRef}
              testID="pantry-list"
              data={showSkeletons ? EMPTY_ARRAY : deferredSortedItems}
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
              ListHeaderComponent={listHeaderComponent}
              ListEmptyComponent={emptyStateContent}
              getItemType={getItemType}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.5}
              drawDistance={400}
            />
          </Animated.View>

          {/* Skeleton layer (absolute on top, fades out) */}
          {!!showSkeletons && (
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
});

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background },
  header: {
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs },
  searchContainer: {
    paddingHorizontal: theme.spacing.md },
  listContainer: {
    flex: 1 },
  contentFill: {
    flex: 1 },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0 },
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: theme.spacing['3xl'] * 2 },
  listContentEmpty: {
    paddingHorizontal: 0,
    flexGrow: 1 },
  skeletonListContent: {
    paddingHorizontal: 0,
    paddingTop: 0 } }));
