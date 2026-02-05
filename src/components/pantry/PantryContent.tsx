import React, { useCallback, useMemo, useEffect } from 'react';
import { View, Pressable, RefreshControl } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { getItemImageUrl } from '#utils/imageUtils';
import { LocationFilter } from '#utils/pantryFilters';
import { SearchBar } from '../molecules/SearchBar';
import { FilterTabs } from '../molecules/FilterTabs/FilterTabs';
import type { FilterTabConfig } from '../molecules/FilterTabs/types';
import { SectionHeader } from '../molecules/SectionHeader';
import { PantryItemCard, ItemVariant } from './PantryItemCard';
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
  calculateExpiresIn,
} from '#hooks/pantry/usePantryItemTransformation';
import { StorageState } from '#generated';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { PantryItemSkeleton } from '#components/base/Skeleton/PantryItemSkeleton';

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
  expiresAt?: string | null;
  quantity: number;
  storageState?: string | null;
  createdAt?: string;
  unit: {
    symbol: string;
  };
  item?: {
    name?: string;
    netWeight?: number | null;
    displayUnit?: {
      symbol?: string;
    } | null;
    category?: {
      name?: string;
    } | null;
    primaryImage?: {
      url?: string;
    } | null;
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

// Default filter tabs for pantry (fallback if none provided)
const DEFAULT_PANTRY_TABS: FilterTabConfig<LocationFilter>[] = [
  { id: 'all', label: 'All' },
  { id: 'fridge', label: 'Fridge', icon: '🧊' },
  { id: 'freezer', label: 'Freezer', icon: '❄️' },
  { id: 'pantry', label: 'Pantry', icon: '🗄️' },
];

export const PantryContent: React.FC<PantryContentProps> = ({
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
  onSwipeableWillOpen,
  onSwipeableClose: _onSwipeableClose,
}) => {
  const { theme } = useUnistyles();

  // PERFORMANCE: Defer heavy list render until after navigation animation
  const isReady = useDeferredRender();

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
    (storageState?: string | null): string => {
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

  // Render a pantry item card
  const renderItemCard = useCallback(
    (item: PantryItem, variant: ItemVariant = 'normal') => {
      const expiresIn = calculateExpiresIn(item.expiresAt);
      const expStatus = getExpirationStatus(expiresIn);
      const unitSymbol = item.unit.symbol;
      const quantityDisplay = formatQuantityDisplay(item.quantity, unitSymbol);
      const location = getLocationString(item.storageState);
      const imageUrl = getItemImageUrl(item.item);
      const hasExpiry = item.expiresAt != null;
      const isOutOfStock = item.quantity === 0;

      return (
        <PantryItemCard
          key={item.id}
          id={item.id}
          name={item.item?.name || 'Unknown Item'}
          expirationText={hasExpiry ? expStatus.text : null}
          expirationVariant={hasExpiry ? expStatus.type : undefined}
          quantity={quantityDisplay}
          location={location}
          storageState={item.storageState}
          variant={variant}
          imageUrl={imageUrl}
          isOutOfStock={isOutOfStock}
          onPress={() => onItemPress(item.id)}
          onEdit={onItemEdit ? () => onItemEdit(item.id) : undefined}
          onDelete={onItemDelete ? () => onItemDelete(item.id) : undefined}
          onConsume={onItemConsume ? () => onItemConsume(item.id) : undefined}
          onWaste={onItemWaste ? () => onItemWaste(item.id) : undefined}
          onRestock={onItemRestock ? () => onItemRestock(item.id) : undefined}
          onSwipeableWillOpen={onSwipeableWillOpen}
        />
      );
    },
    [
      getLocationString,
      onItemPress,
      onItemEdit,
      onItemDelete,
      onItemConsume,
      onItemWaste,
      onItemRestock,
      onSwipeableWillOpen,
    ],
  );

  // Render list item - homogeneous list (items only)
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PantryItem>) => {
      // Guard against undefined items during concurrent rendering
      if (!item) return null;

      const expiresIn = calculateExpiresIn(item.expiresAt);
      const isExpired = expiresIn !== null && expiresIn < 0;
      const isExpiringSoon =
        expiresIn !== null && expiresIn >= 0 && expiresIn <= 3;
      return renderItemCard(
        item,
        isExpired ? 'expired' : isExpiringSoon ? 'warning' : 'normal',
      );
    },
    [renderItemCard],
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
          title="ALL ITEMS"
          count={sortedItems.length}
          variant="default"
          actionLabel={`Sort ${sortDirection === 'asc' ? '↑' : '↓'}`}
          onActionPress={openSortModal}
        />

        {/* Content List - Crossfade between skeleton and content */}
        <View style={styles.listContainer}>
          {/* Content layer - always mounted to preserve FlashList layout state */}
          <Animated.View
            style={[styles.absoluteFill, contentAnimatedStyle]}
            pointerEvents={showSkeletons ? 'none' : 'auto'}
          >
            <FlashList<PantryItem>
              data={showSkeletons ? EMPTY_ARRAY : sortedItems}
              renderItem={renderItem}
              keyExtractor={(item, index) => item?.id ?? `fallback-${index}`}
              extraData={sortOption}
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
              drawDistance={250}
            />
          </Animated.View>

          {/* Skeleton layer (on top, fades out) */}
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
};

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
