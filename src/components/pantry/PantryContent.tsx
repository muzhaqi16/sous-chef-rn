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
import { getItemImageUrl } from '#utils/imageUtils';
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
  formatNetWeight,
  formatNetWeightDisplay,
} from '#hooks/pantry/usePantryItemTransformation';
import { StorageState } from '#generated';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
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
  netWeightUnit?: { symbol?: string | null; name?: string | null } | null;
  packageBreakdown?: {
    count: number;
    contentUnit: { name: string; symbol?: string | null };
    perUnitNetWeight?: number | null;
    perUnitNetWeightUnit?: { symbol?: string | null } | null;
    totalNetWeight?: number | null;
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
  netWeightText: string | null;
}

// Default filter tabs for pantry (fallback if none provided)
const DEFAULT_PANTRY_TABS: FilterTabConfig<LocationFilter>[] = [
  { id: 'all', label: 'All' },
  { id: 'fridge', label: 'Fridge', icon: '🧊' },
  { id: 'freezer', label: 'Freezer', icon: '❄️' },
  { id: 'pantry', label: 'Pantry', icon: '🗄️' },
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
      const variant: ItemVariant = isExpired ? 'expired' : isExpiringSoon ? 'warning' : 'normal';
      const hasExpiry = item.expiresAt != null;

      const rawQuantityDisplay = formatQuantityDisplay(item.quantity, item.unit?.symbol);
      const rawNetWeightText = formatNetWeight(item.netWeight, item.netWeightUnit);
      const pkgBreakdownText = formatPackageBreakdown(item.packageBreakdown);

      // When qty=1 + netWeight available + no packageBreakdown:
      // promote net weight to primary, suppress redundant "1 unit"
      const shouldPromoteNetWeight =
        item.quantity === 1 &&
        item.netWeight != null &&
        item.netWeight > 0 &&
        !item.packageBreakdown &&
        item.netWeightUnit?.symbol === item.unit?.symbol;

      map.set(item.id, {
        imageUrl: getItemImageUrl(item.item),
        expirationText: hasExpiry ? expStatus.text : null,
        expirationVariant: hasExpiry ? expStatus.type : undefined,
        variant,
        quantityDisplay: shouldPromoteNetWeight
          ? formatNetWeightDisplay(item.netWeight, item.netWeightUnit)!
          : rawQuantityDisplay,
        location: getLocationString(item.storageState, item.storageLocation),
        isOutOfStock: item.quantity === 0,
        packageBreakdownText: pkgBreakdownText,
        netWeightText: shouldPromoteNetWeight ? null : rawNetWeightText,
      });
    }
    return map;
  }, [sortedItems, getLocationString]);

  // Stable ref for callbacks — avoids FlashList re-rendering all visible items on data changes
  const itemDisplayMapRef = useRef(itemDisplayMap);
  itemDisplayMapRef.current = itemDisplayMap;

  // Scroll to top on filter change (replaces key={locationFilter} remounting)
  const prevLocationFilter = useRef(locationFilter);
  useEffect(() => {
    if (prevLocationFilter.current !== locationFilter) {
      flashListRef.current?.scrollToTop({ animated: false });
      prevLocationFilter.current = locationFilter;
    }
  }, [locationFilter]);

  // Render list item — stable callback via ref pattern to avoid FlashList full re-renders
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PantryItem>) => {
      if (!item) return null;
      const display = itemDisplayMapRef.current.get(item.id);
      if (!display) return null;

      return (
        <PantryItemCard
          key={item.id}
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
          netWeightText={display.netWeightText}
        />
      );
    },
    [],
  );

  // Categorize items for FlashList recycling pools — items with images are taller
  const getItemType = useCallback((item: PantryItem) => {
    return itemDisplayMapRef.current.get(item.id)?.imageUrl ? 'withImage' : 'noImage';
  }, []);

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

  // Provide approximate heights per item type to reduce blank cells during fast scrolling
  const overrideItemLayout = useCallback(
    (layout: { size?: number; span?: number }, item: PantryItem) => {
      const hasImage = itemDisplayMapRef.current.get(item?.id)?.imageUrl;
      layout.size = hasImage ? 90 : 70;
    },
    [],
  );

  // Memoize extraData to avoid new array reference every render
  const extraData = useMemo(() => [sortOption, locationFilter], [sortOption, locationFilter]);

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
            innerRightIcon={
              <Pressable onPress={onSettingsPress} hitSlop={8}>
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
              data={showSkeletons ? EMPTY_ARRAY : sortedItems}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              extraData={extraData}
              getItemType={getItemType}
              overrideItemLayout={overrideItemLayout}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                ) : undefined
              }
              onEndReached={onEndReached}
              onEndReachedThreshold={0.5}
              drawDistance={750}
            />
          </Animated.View>

          {/* Skeleton layer (absolute on top, fades out) */}
          {showSkeletons && (
            <Animated.View
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
  skeletonListContent: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
}));
