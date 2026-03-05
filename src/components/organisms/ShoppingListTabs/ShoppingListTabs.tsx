import React, { useRef, useState } from 'react';
import { RefreshControl, Alert, useWindowDimensions, View, Platform } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { TabView, type Route } from 'react-native-tab-view';
import { FilterTabBar } from './FilterTabBar';
import type { FilterTabActionButton } from '#components/molecules/FilterTabs/types';
import { ShoppingTab } from './ShoppingTab';
import { PurchasedTab } from './PurchasedTab';
import { EmptyState } from '#components/base/EmptyState';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import type { SortableShoppingListItem } from '../SortableShoppingList/types';
import {
  ShoppingListTabsActionsProvider,
  type ShoppingListTabsActions,
} from './ShoppingListTabsActionsContext';
import {
  ShoppingListDataProvider,
  type ShoppingListTabData,
} from './ShoppingListDataContext';

type ShoppingListTabId = 'shopping' | 'purchased';

interface TabRoute extends Route {
  key: ShoppingListTabId;
  title: string;
}

interface ShoppingListTabsProps {
  items: SortableShoppingListItem[];
  // PERFORMANCE: Pre-filtered items with stable references from useShoppingListScreen
  // When provided, skip internal filtering to prevent new array references
  unpurchasedItems?: SortableShoppingListItem[];
  purchasedItems?: SortableShoppingListItem[];
  // Total counts from GraphQL (not array length) for accurate tab badge counts
  totalCountUnpurchased?: number;
  totalCountPurchased?: number;
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  loading?: boolean;
  disabled?: boolean;
  emptyState?: any;
  onClearAllPurchased?: () => Promise<void>;
  onClearAllShopping?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  // Pagination props for shopping tab
  onEndReachedUnpurchased?: () => void;
  hasMoreUnpurchased?: boolean;
  isLoadingMoreUnpurchased?: boolean;
  // Pagination props for purchased tab
  onEndReachedPurchased?: () => void;
  hasMorePurchased?: boolean;
  isLoadingMorePurchased?: boolean;
  // Permission flags for conditional rendering of item actions
  canAddItems?: boolean;
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
  canReorderItems?: boolean;
  // Transition state for showing skeletons during list switches
  isTransitioning?: boolean;
  // Batch move purchased items to pantry
  onBatchMoveToPantry?: () => void;
  batchMoveToPantryLoading?: boolean;
  // List header (e.g. SearchBar) rendered inside FlashList for correct RefreshControl position
  listHeaderComponent?: React.ReactElement | null;
}

const ROUTES: TabRoute[] = [
  { key: 'shopping', title: 'Shopping' },
  { key: 'purchased', title: 'Purchased' },
];

// Module-level renderScene — data-free so TabView never re-calls it on data changes.
// Each tab reads its data from ShoppingListDataContext instead of props.
const renderSceneDataFree = ({ route }: { route: TabRoute }) => {
  switch (route.key) {
    case 'shopping':
      return <ShoppingTab />;
    case 'purchased':
      return <PurchasedTab />;
    default:
      return null;
  }
};

const ShoppingListTabs: React.FC<ShoppingListTabsProps> = ({
  items,
  unpurchasedItems: preFilteredUnpurchased,
  purchasedItems: preFilteredPurchased,
  totalCountUnpurchased,
  totalCountPurchased,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onMoveToPantry,
  onQuantityPress,
  onSortOrderUpdate,
  onRefresh,
  refreshing,
  loading,
  disabled,
  emptyState,
  onClearAllPurchased,
  onClearAllShopping,
  onSwipeableWillOpen,
  onSwipeableClose,
  // Pagination props
  onEndReachedUnpurchased,
  hasMoreUnpurchased,
  isLoadingMoreUnpurchased,
  onEndReachedPurchased,
  hasMorePurchased,
  isLoadingMorePurchased,
  // Permission props - default to true for backward compatibility
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
  canReorderItems = false,
  // Transition state
  isTransitioning = false,
  // Batch move to pantry
  onBatchMoveToPantry,
  batchMoveToPantryLoading = false,
  // List header
  listHeaderComponent }) => {
  const layout = useWindowDimensions();

  // Track open swipeable across both tabs
  const openSwipeableRef = useRef<any>(null);

  // TabView navigation state
  const [index, setIndex] = useState(0);

  // PERFORMANCE: Use pre-filtered items when provided (stable references from useShoppingListScreen)
  // Fall back to internal filtering for backwards compatibility
  const unpurchasedItems = preFilteredUnpurchased ?? items.filter(item => !item.isPurchased);

  const purchasedItems = preFilteredPurchased ?? items.filter(item => item.isPurchased);

  // Use GraphQL totalCount for accurate counts (handles pagination)
  // Fall back to array length for backwards compatibility
  const unpurchasedCount = totalCountUnpurchased ?? unpurchasedItems.length;
  const purchasedCount = totalCountPurchased ?? purchasedItems.length;

  // Handle tab change - close any open swipeable
  const handleIndexChange = (newIndex: number) => {
    if (openSwipeableRef.current) {
      openSwipeableRef.current.current?.close();
      openSwipeableRef.current = null;
    }
    setIndex(newIndex);
  };

  // Wrap swipeable handlers to use shared ref across tabs
  const handleSwipeableWillOpen = (ref: any) => {
      if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
        openSwipeableRef.current.current?.close();
      }
      openSwipeableRef.current = ref;
      onSwipeableWillOpen?.(ref);
    };

  // Handle swipeable close
  const handleSwipeableClose = () => {
    openSwipeableRef.current = null;
    onSwipeableClose?.();
  };

  // Action callbacks for context provider — consumed by ShoppingTab/PurchasedTab
  const tabActions: ShoppingListTabsActions = {
    onItemPress,
    onItemEdit,
    onItemDelete,
    onTogglePurchase,
    onMoveToPantry,
    onQuantityPress,
    onSortOrderUpdate,
    onSwipeableWillOpen: handleSwipeableWillOpen,
    onSwipeableClose: handleSwipeableClose,
  };

  const confirmAction = (
      title: string,
      message: string,
      confirmText: string,
      onConfirm: () => void,
      destructive = true,
    ) => {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: confirmText,
          style: destructive ? 'destructive' : 'default',
          onPress: onConfirm },
      ]);
    };

  const handleClearAllWithConfirmation = () => {
    if (purchasedItems.length === 0) return;
    const count = purchasedItems.length;
    confirmAction(
      'Clear All Purchased Items',
      `Are you sure you want to remove ${count === 1 ? '1 purchased item' : `all ${count} purchased items`} from this list?`,
      'Clear All',
      () => { onClearAllPurchased?.(); },
    );
  };

  const handleBatchMoveToPantryWithConfirmation = () => {
    if (purchasedItems.length === 0 || !onBatchMoveToPantry) return;
    const count = purchasedItems.length;
    confirmAction(
      'Move All to Pantry',
      `Move ${count === 1 ? '1 purchased item' : `all ${count} purchased items`} to your pantry?`,
      'Move All',
      onBatchMoveToPantry,
      false,
    );
  };

  const handleClearAllShoppingWithConfirmation = () => {
    if (unpurchasedItems.length === 0) return;
    const count = unpurchasedItems.length;
    confirmAction(
      'Clear All Shopping Items',
      `Are you sure you want to remove ${count === 1 ? '1 item' : `all ${count} items`} from your shopping list?`,
      'Clear All',
      () => { onClearAllShopping?.(); },
    );
  };

  // Get the current clear handler based on active tab (by index)
  const currentClearHandler =
    index === 0
      ? handleClearAllShoppingWithConfirmation
      : handleClearAllWithConfirmation;

  // Get current items count for the active tab
  const currentItems = index === 0 ? unpurchasedItems : purchasedItems;
  const showClear = canRemoveItems && currentItems.length > 0;

  // Tab badge counts
  const counts = {
    shopping: unpurchasedCount,
    purchased: purchasedCount,
  };

  // Standalone jumpTo for FilterTabBar inside ListHeaderComponent
  const jumpTo = (key: string) => {
    const routeIndex = ROUTES.findIndex(r => r.key === key);
    if (routeIndex >= 0) handleIndexChange(routeIndex);
  };

  // Build action buttons array: pantry icon (purchased tab only) + clear
  const actionButtons: FilterTabActionButton[] = [];

  // Show pantry move icon on purchased tab when there are items and handler exists
  if (index === 1 && purchasedItems.length > 0 && onBatchMoveToPantry) {
    actionButtons.push({
      icon: 'archive-outline',
      onPress: handleBatchMoveToPantryWithConfirmation,
      disabled: batchMoveToPantryLoading,
      testID: 'shopping-list-batch-move-pantry',
    });
  }

  if (showClear) {
    actionButtons.push({
      label: 'Clear',
      onPress: currentClearHandler,
      testID: 'shopping-list-clear-all',
    });
  }

  // Render FilterTabBar as the TabView's tab bar so it's always visible,
  // even when a tab's FlashList is replaced by an empty state
  const renderTabBar = () => (
      <FilterTabBar
        navigationState={{ index, routes: ROUTES }}
        jumpTo={jumpTo}
        counts={counts}
        actionButtons={actionButtons.length > 0 ? actionButtons : undefined}
      />
    );

  // Per-tab data for context — decoupled from renderScene so TabView doesn't
  // re-call renderScene on data changes (which would destroy FlashList recycling pools)
  const shoppingTabData: ShoppingListTabData = {
    items: unpurchasedItems,
    onRefresh,
    refreshing,
    loading,
    disabled,
    onEndReached: onEndReachedUnpurchased,
    hasMore: hasMoreUnpurchased,
    isLoadingMore: isLoadingMoreUnpurchased,
    canRemoveItems,
    canEditItems,
    canMarkPurchased,
    canReorderItems,
    isTransitioning,
  };

  const purchasedTabData: ShoppingListTabData = {
    items: purchasedItems,
    onRefresh,
    refreshing,
    loading,
    disabled,
    onEndReached: onEndReachedPurchased,
    hasMore: hasMorePurchased,
    isLoadingMore: isLoadingMorePurchased,
    canRemoveItems,
    canEditItems,
    canMarkPurchased,
    canReorderItems: false,
    isTransitioning,
  };

  const tabData = { shopping: shoppingTabData, purchased: purchasedTabData };

  // Handle all empty-items cases before the TabView so tabs never appear for empty lists.
  // During transitions (list switches), items may briefly be empty — keep TabView mounted.
  if (items.length === 0 && !isTransitioning) {
    // Initial load (loading but not refreshing): show skeletons without tabs
    if (loading && !refreshing) {
      return (
        <View style={{ flex: 1 }}>
          <SkeletonList SkeletonComponent={ShoppingListItemSkeleton} count={10} />
        </View>
      );
    }

    // After load or during refresh: show empty state (with optional RefreshControl)
    if (emptyState) {
      return (
        <ScrollView
          contentContainerStyle={{ flex: 1 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing || false}
                onRefresh={onRefresh}
              />
            ) : undefined
          }
        >
          <EmptyState {...emptyState} />
        </ScrollView>
      );
    }
  }

  return (
    <ShoppingListTabsActionsProvider actions={tabActions}>
      <ShoppingListDataProvider data={tabData}>
        <View style={{ flex: 1, ...(Platform.OS === 'android' && { elevation: 0 }) }}>
          {listHeaderComponent}
          <TabView
            navigationState={{ index, routes: ROUTES }}
            renderScene={renderSceneDataFree}
            renderTabBar={renderTabBar}
            onIndexChange={handleIndexChange}
            initialLayout={{ width: layout.width }}
            swipeEnabled={true}
            lazy={true}
            overScrollMode="never"
          />
        </View>
      </ShoppingListDataProvider>
    </ShoppingListTabsActionsProvider>
  );
};

export { ShoppingListTabs };
