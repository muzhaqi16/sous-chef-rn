import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  RefreshControl,
  ListRenderItemInfo,
  Image,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, IconLibrary } from '#utils';
import { getItemImageUrl } from '#utils/imageUtils';
import { LocationFilter } from '#utils/pantryFilters';
import { AlertBanner } from '../molecules';
import { PantrySectionHeader } from './PantrySectionHeader';
import { PantryItemCard, ItemVariant } from './PantryItemCard';
import {
  getExpirationStatus,
  formatQuantityDisplay,
  calculateExpiresIn,
} from '#hooks/pantry/usePantryItemTransformation';
import { StorageState } from '#generated';
import { FilterTabs } from '../molecules';

// Sort types (same as in preferencesSlice)
export type SortOption = 'name' | 'expiry' | 'quantity' | 'recent';
export type SortDirection = 'asc' | 'desc';

// Item type from pantry management
interface PantryItem {
  id: string;
  expiresAt?: string | null;
  currentQuantity: number;
  storageState?: string | null;
  unit?: {
    symbol?: string;
  } | null;
  // Package weight for display (prioritized over currentQuantity)
  packageWeight?: number | null;
  packageWeightUnit?: {
    symbol?: string;
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
  avatarInitial: string;
  avatarUrl?: string | null;
  notificationCount?: number;

  // Items
  items: PantryItem[];
  expiredCount: number;
  expiringSoonItems: PantryItem[];
  normalItems: PantryItem[];

  // Location filter
  locationFilter: LocationFilter;
  onLocationFilterChange: (filter: LocationFilter) => void;
  locationCounts: {
    all: number;
    fridge: number;
    freezer: number;
    pantry: number;
  };

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;

  // Sort (initial values from store, callbacks to persist changes)
  initialSortOption?: SortOption;
  initialSortDirection?: SortDirection;
  onSortChange?: (option: SortOption, direction: SortDirection) => void;

  // Actions
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;
  onExpiredBannerPress: () => void;
  onAvatarPress?: () => void;
  onHomePress?: () => void;
  onSettingsPress?: () => void;
  onRefresh?: () => void;
  onEndReached?: () => void;

  // State
  refreshing?: boolean;
  loading?: boolean;
}

export const PantryContent: React.FC<PantryContentProps> = ({
  userName,
  householdName,
  avatarInitial,
  avatarUrl,
  notificationCount = 0,
  items: _items,
  expiredCount,
  expiringSoonItems,
  normalItems,
  locationFilter,
  onLocationFilterChange,
  locationCounts,
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
  onExpiredBannerPress,
  onAvatarPress,
  onHomePress,
  onSettingsPress,
  onRefresh,
  onEndReached,
  refreshing = false,
  loading: _loading = false,
}) => {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();

  // Sort state (local, initialized from props)
  const [sortOption, setSortOption] = useState<SortOption>(initialSortOption);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Track open swipeable to close others
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);

  const handleClearSearch = useCallback(() => {
    onSearchChange('');
  }, [onSearchChange]);

  // Handle swipeable opening
  const handleSwipeableWillOpen = useCallback(
    (ref: React.RefObject<SwipeableMethods>) => {
      if (
        openSwipeableRef.current &&
        openSwipeableRef.current !== ref.current
      ) {
        openSwipeableRef.current?.close();
      }
      openSwipeableRef.current = ref.current;
    },
    [],
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

  // Render a pantry item card
  const renderItemCard = useCallback(
    (item: PantryItem, variant: ItemVariant = 'normal') => {
      const expiresIn = calculateExpiresIn(item.expiresAt);
      const expStatus = getExpirationStatus(expiresIn);

      // FIX: Prioritize packageWeight over currentQuantity (matches detail view behavior)
      let quantity: string;
      if (item.packageWeight != null && item.packageWeight > 0) {
        quantity = formatQuantityDisplay(
          item.packageWeight,
          item.packageWeightUnit?.symbol || 'g',
        );
      } else {
        const unitSymbol =
          item.unit?.symbol || item.item?.displayUnit?.symbol || 'pcs';
        quantity = formatQuantityDisplay(item.currentQuantity, unitSymbol);
      }

      const location = getLocationString(item.storageState);
      const imageUrl = getItemImageUrl(item.item);

      // Only show expiration text if item has an expiry date
      const hasExpiry = item.expiresAt != null;

      return (
        <PantryItemCard
          key={item.id}
          id={item.id}
          name={item.item?.name || 'Unknown Item'}
          expirationText={hasExpiry ? expStatus.text : null}
          expirationVariant={hasExpiry ? expStatus.type : undefined}
          quantity={quantity}
          location={location}
          storageState={item.storageState}
          variant={variant}
          imageUrl={imageUrl}
          onPress={() => onItemPress(item.id)}
          onEdit={onItemEdit ? () => onItemEdit(item.id) : undefined}
          onDelete={onItemDelete ? () => onItemDelete(item.id) : undefined}
          onConsume={onItemConsume ? () => onItemConsume(item.id) : undefined}
          onWaste={onItemWaste ? () => onItemWaste(item.id) : undefined}
          onRestock={onItemRestock ? () => onItemRestock(item.id) : undefined}
          onSwipeableWillOpen={handleSwipeableWillOpen}
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
      handleSwipeableWillOpen,
    ],
  );

  // Sort items based on current sort option
  const sortItems = useCallback(
    (items: PantryItem[]): PantryItem[] => {
      const sorted = [...items].sort((a, b) => {
        let comparison = 0;
        switch (sortOption) {
          case 'name':
            comparison = (a.item?.name || '').localeCompare(b.item?.name || '');
            break;
          case 'expiry':
            const aExpiry = a.expiresAt
              ? new Date(a.expiresAt).getTime()
              : Infinity;
            const bExpiry = b.expiresAt
              ? new Date(b.expiresAt).getTime()
              : Infinity;
            comparison = aExpiry - bExpiry;
            break;
          case 'quantity':
            comparison = a.currentQuantity - b.currentQuantity;
            break;
          case 'recent':
            // Assuming items have createdAt or we use ID as fallback
            comparison = (a as any).createdAt
              ? new Date((b as any).createdAt).getTime() -
                new Date((a as any).createdAt).getTime()
              : 0;
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
      return sorted;
    },
    [sortOption, sortDirection],
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

  // Handle sort option selection
  const handleSortSelect = useCallback(
    (option: SortOption) => {
      let newOption = sortOption;
      let newDirection = sortDirection;

      if (sortOption === option) {
        // Toggle direction if same option selected
        newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        setSortDirection(newDirection);
      } else {
        // Set new option and reset to ascending
        newOption = option;
        newDirection = 'asc';
        setSortOption(newOption);
        setSortDirection(newDirection);
      }

      // Persist to store
      onSortChange?.(newOption, newDirection);
      setSortModalVisible(false);
    },
    [sortOption, sortDirection, onSortChange],
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

  // Render list item
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListSection>) => {
      switch (item.type) {
        case 'expiringSoon':
          return (
            <PantrySectionHeader
              icon="⏰"
              title="EXPIRING SOON"
              count={sortedExpiringSoonItems.length}
              variant="warning"
            />
          );
        case 'allItemsHeader':
          return (
            <PantrySectionHeader
              title="ALL ITEMS"
              count={sortedNormalItems.length}
              variant="default"
              actionLabel={`Sort ${sortDirection === 'asc' ? '↑' : '↓'}`}
              onActionPress={() => setSortModalVisible(true)}
            />
          );
        case 'item':
          if (!item.data) return null;
          // Check if this is an expiring soon item
          const expiresIn = calculateExpiresIn(item.data.expiresAt);
          const isExpiringSoon =
            expiresIn !== null && expiresIn >= 0 && expiresIn <= 3;
          return renderItemCard(
            item.data,
            isExpiringSoon ? 'warning' : 'normal',
          );
        default:
          return null;
      }
    },
    [
      sortedExpiringSoonItems.length,
      sortedNormalItems.length,
      sortDirection,
      renderItemCard,
    ],
  );

  // Header component
  const ListHeader = useMemo(
    () => (
      <View>
        {/* Location filter tabs */}
        <FilterTabs
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'fridge', label: 'Fridge', icon: '🧊' },
            { id: 'freezer', label: 'Freezer', icon: '❄️' },
            { id: 'pantry', label: 'Pantry', icon: '🗄️' },
          ]}
          activeTabId={locationFilter}
          onTabChange={onLocationFilterChange}
          counts={locationCounts}
          testIDPrefix="pantry-location-tab"
        />

        {/* Expired banner */}
        {expiredCount > 0 && (
          <AlertBanner
            title={`${expiredCount} item${expiredCount > 1 ? 's' : ''} expired`}
            subtitle="Tap to review and remove"
            icon="⚠️"
            variant="error"
            onPress={onExpiredBannerPress}
            testID="expired-banner"
          />
        )}
      </View>
    ),
    [
      locationFilter,
      onLocationFilterChange,
      locationCounts,
      expiredCount,
      onExpiredBannerPress,
    ],
  );

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        {/* Greeting Row */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingContent}>
            <Text style={styles.greeting}>
              Hello, <Text style={styles.userName}>{userName}</Text>!
            </Text>
            <Pressable onPress={onHomePress} style={styles.householdBadge}>
              <Icon
                name="home"
                size={16}
                library="Ionicons"
                color={theme.colors.primary}
              />
              <Text style={styles.householdName}>{householdName}</Text>
              <Icon name="chevron-right" size={16} color={theme.colors.textTertiary} />
            </Pressable>
          </View>

          {/* Avatar */}
          <Pressable onPress={onAvatarPress} style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarInitial}</Text>
              </View>
            )}
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationCount}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Icon
            name="search"
            size={16}
            color={theme.colors.textTertiary}
            library="Feather"
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your pantry..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={onSearchChange}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={handleClearSearch} hitSlop={8}>
              <Icon name="close" size={20} color={theme.colors.textTertiary} />
            </Pressable>
          ) : (
            <Pressable onPress={onSettingsPress} hitSlop={8}>
              <Icon
                name="settings"
                size={18}
                color={theme.colors.textTertiary}
                library="Feather"
              />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
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
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSortModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.sortModal}>
                <Text style={styles.sortModalTitle}>Sort by</Text>
                {[
                  {
                    key: 'name' as SortOption,
                    label: 'Name',
                    icon: 'sort-by-alpha',
                    library: 'MaterialIcons' as IconLibrary,
                  },
                  {
                    key: 'expiry' as SortOption,
                    label: 'Expiry Date',
                    icon: 'calendar-month',
                  },
                  {
                    key: 'quantity' as SortOption,
                    label: 'Quantity',
                    icon: 'bar-chart',
                  },
                  {
                    key: 'recent' as SortOption,
                    label: 'Recently Added',
                    icon: 'clock',
                    library: 'Feather' as IconLibrary,
                  },
                ].map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.sortOption,
                      sortOption === option.key && styles.sortOptionActive,
                    ]}
                    onPress={() => handleSortSelect(option.key)}
                  >
                    <Icon
                      name={option.icon}
                      size={18}
                      library={option.library}
                      color={theme.colors.primary}
                    />
                    <Text
                      style={[
                        styles.sortOptionLabel,
                        sortOption === option.key &&
                          styles.sortOptionLabelActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {sortOption === option.key && (
                      <Icon
                        name={
                          sortDirection === 'asc'
                            ? 'arrow-upward'
                            : 'arrow-downward'
                        }
                        size={18}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
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
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  greetingContent: {
    flex: 1,
    justifyContent: 'center',
    alignContent: 'center',
  },
  greeting: {
    fontSize: theme.typography.fontSize['2xl'] + 2,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.secondaryDark,
  },
  userName: {
    color: theme.colors.primary,
  },
  householdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs + 2,
  },
  homeEmoji: {
    fontSize: theme.typography.fontSize.xs,
  },
  householdName: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: theme.sizes.avatar.lg,
    height: theme.sizes.avatar.lg,
    borderRadius: theme.radii.xl - 2,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  avatarImage: {
    width: theme.sizes.avatar.lg,
    height: theme.sizes.avatar.lg,
    borderRadius: theme.radii.xl - 2,
    ...theme.shadows.md,
  },
  avatarText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.white,
  },
  notificationBadge: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    width: theme.spacing['5'],
    height: theme.spacing['5'],
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.white,
  },
  notificationCount: {
    fontSize: theme.typography.fontSize.xs - 1,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing['3'],
    gap: theme.spacing.sm,
  },

  searchInput: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm + 1,
    color: theme.colors.textPrimary,
    padding: 0,
  },
  settingsIcon: {
    fontSize: theme.typography.fontSize.lg,
    marginLeft: theme.spacing.sm,
  },
  listContent: {
    // Padding 0 to allow offscreen scroll elements
    paddingHorizontal: 0,
    paddingBottom: theme.spacing['3xl'] * 2, // Space for bottom navigation
  },
  // Sort modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlays.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortModal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing['5'],
    width: '80%',
    maxWidth: theme.sizes.modal.sm,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: theme.spacing.xs },
    shadowOpacity: 0.15,
    shadowRadius: theme.spacing['3'],
    elevation: 10,
  },
  sortModalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.fonts.weight.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing['3'] + 2,
    paddingHorizontal: theme.spacing['3'],
    borderRadius: theme.radii.lg,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  sortOptionActive: {
    backgroundColor: theme.colors.primaryLight,
  },
  sortOptionIcon: {
    fontSize: theme.typography.fontSize.lg,
    marginRight: theme.spacing['3'],
  },
  sortOptionLabel: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm + 1,
    color: theme.colors.textSecondary,
  },
  sortOptionLabelActive: {
    color: theme.colors.primary,
    fontWeight: theme.fonts.weight.semibold,
  },
}));
