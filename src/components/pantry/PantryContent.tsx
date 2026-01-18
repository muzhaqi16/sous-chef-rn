import React, { useCallback, useMemo } from 'react';
import {
  View,
  Pressable,
  FlatList,
  RefreshControl,
  ListRenderItemInfo,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';
import { getItemImageUrl } from '#utils/imageUtils';
import { LocationFilter } from '#utils/pantryFilters';
import { SearchBar, FilterTabs, FilterTabConfig } from '../molecules';
import { SectionHeader } from '../molecules/SectionHeader';
import { PantryItemCard, ItemVariant } from './PantryItemCard';
import { PantryHeader } from './PantryHeader';
import { PantrySortModal } from './PantrySortModal';
import { PantryActionsProvider, type PantryItemActions } from './PantryActionsContext';
import { usePantrySorting } from './hooks/usePantrySorting';
import {
  getExpirationStatus,
  formatQuantityDisplay,
  calculateExpiresIn,
} from '#hooks/pantry/usePantryItemTransformation';
import { StorageState } from '#generated';

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

// Section type for SectionList-like rendering
interface ListSection {
  type: 'header' | 'expiringSoon' | 'allItemsHeader' | 'item';
  data?: PantryItem;
  key: string;
}

interface PantryContentProps {
  // User info
  userName: string;
  householdName: string;
  avatarUrl?: string | null;
  notificationCount?: number;

  // Items
  items: PantryItem[];
  expiringSoonItems: PantryItem[];
  normalItems: PantryItem[];

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
  items: _items,
  expiringSoonItems,
  normalItems,
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
  loading: _loading = false,
  onSwipeableWillOpen,
  onSwipeableClose: _onSwipeableClose,
}) => {
  const { theme } = useUnistyles();

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
    [onItemPress, onItemEdit, onItemDelete, onItemConsume, onItemWaste, onItemRestock],
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

  // Sorted items
  const sortedExpiringSoonItems = useMemo(
    () => sortItems(expiringSoonItems),
    [expiringSoonItems, sortItems],
  );
  const sortedNormalItems = useMemo(
    () => sortItems(normalItems),
    [normalItems, sortItems],
  );

  // Build flat list data with section markers
  const listData = useMemo((): ListSection[] => {
    const data: ListSection[] = [];

    // Expiring soon items with header
    if (sortedExpiringSoonItems.length > 0) {
      data.push({ type: 'expiringSoon', key: 'expiring-header' });
      sortedExpiringSoonItems.forEach(item => {
        data.push({ type: 'item', data: item, key: `expiring-${item.id}` });
      });
    }

    // All items with header
    if (sortedNormalItems.length > 0 || sortedExpiringSoonItems.length === 0) {
      data.push({ type: 'allItemsHeader', key: 'all-header' });
      sortedNormalItems.forEach(item => {
        data.push({ type: 'item', data: item, key: `normal-${item.id}` });
      });
    }

    return data;
  }, [sortedExpiringSoonItems, sortedNormalItems]);

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

  // Render list item
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListSection>) => {
      switch (item.type) {
        case 'expiringSoon':
          return (
            <SectionHeader
              icon="⏰"
              title="EXPIRING SOON"
              count={sortedExpiringSoonItems.length}
              variant="warning"
            />
          );
        case 'allItemsHeader':
          return (
            <SectionHeader
              title="ALL ITEMS"
              count={sortedNormalItems.length}
              variant="default"
              actionLabel={`Sort ${sortDirection === 'asc' ? '↑' : '↓'}`}
              onActionPress={openSortModal}
            />
          );
        case 'item':
          if (!item.data) return null;
          const expiresIn = calculateExpiresIn(item.data.expiresAt);
          const isExpired = expiresIn !== null && expiresIn < 0;
          const isExpiringSoon =
            expiresIn !== null && expiresIn >= 0 && expiresIn <= 3;
          return renderItemCard(
            item.data,
            isExpired ? 'expired' : isExpiringSoon ? 'warning' : 'normal',
          );
        default:
          return null;
      }
    },
    [
      sortedExpiringSoonItems.length,
      sortedNormalItems.length,
      sortDirection,
      openSortModal,
      renderItemCard,
    ],
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

  // Header component with filter tabs
  const ListHeader = useMemo(
    () => (
      <View>
        <FilterTabs<LocationFilter>
          tabs={tabsWithAddButton}
          activeTabId={locationFilter}
          onTabChange={onLocationFilterChange}
          counts={locationCounts}
          testIDPrefix="pantry-location-tab"
        />
      </View>
    ),
    [tabsWithAddButton, locationFilter, onLocationFilterChange, locationCounts],
  );

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

        {/* Content List */}
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={item => item.key}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
        />

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
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: theme.spacing['3xl'] * 2,
  },
}));
