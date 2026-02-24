import React, { useMemo, useCallback, useRef, useState } from 'react';
import { RefreshControl, Alert, useWindowDimensions, View, Platform } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { TabView, type Route } from 'react-native-tab-view';
import { FilterTabBar } from './FilterTabBar';
import { MemoizedShoppingTab } from './ShoppingTab';
import { MemoizedPurchasedTab } from './PurchasedTab';
import { EmptyState } from '#components/base/EmptyState';
import type { SortableShoppingListItem } from '../SortableShoppingList/types';

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
  listHeaderComponent,
}) => {
  const layout = useWindowDimensions();

  // Track open swipeable across both tabs
  const openSwipeableRef = useRef<any>(null);

  // TabView navigation state
  const [index, setIndex] = useState(0);

  // PERFORMANCE: Use pre-filtered items when provided (stable references from useShoppingListScreen)
  // Fall back to internal filtering for backwards compatibility
  const unpurchasedItems = useMemo(() => {
    if (preFilteredUnpurchased) return preFilteredUnpurchased;
    return items.filter(item => !item.isPurchased);
  }, [preFilteredUnpurchased, items]);

  const purchasedItems = useMemo(() => {
    if (preFilteredPurchased) return preFilteredPurchased;
    return items.filter(item => item.isPurchased);
  }, [preFilteredPurchased, items]);

  // Use GraphQL totalCount for accurate counts (handles pagination)
  // Fall back to array length for backwards compatibility
  const unpurchasedCount = totalCountUnpurchased ?? unpurchasedItems.length;
  const purchasedCount = totalCountPurchased ?? purchasedItems.length;

  // Handle tab change - close any open swipeable
  const handleIndexChange = useCallback((newIndex: number) => {
    if (openSwipeableRef.current) {
      openSwipeableRef.current.current?.close();
      openSwipeableRef.current = null;
    }
    setIndex(newIndex);
  }, []);

  // Wrap swipeable handlers to use shared ref across tabs
  const handleSwipeableWillOpen = useCallback(
    (ref: any) => {
      if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
        openSwipeableRef.current.current?.close();
      }
      openSwipeableRef.current = ref;
      onSwipeableWillOpen?.(ref);
    },
    [onSwipeableWillOpen],
  );

  // Handle swipeable close
  const handleSwipeableClose = useCallback(() => {
    openSwipeableRef.current = null;
    onSwipeableClose?.();
  }, [onSwipeableClose]);

  // Handle clear all purchased with confirmation dialog
  const handleClearAllWithConfirmation = useCallback(() => {
    if (purchasedItems.length === 0) return;

    Alert.alert(
      'Clear All Purchased Items',
      `Are you sure you want to remove ${purchasedItems.length === 1 ? '1 purchased item' : `all ${purchasedItems.length} purchased items`} from this list?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await onClearAllPurchased?.();
          },
        },
      ],
    );
  }, [purchasedItems.length, onClearAllPurchased]);

  // Handle batch move purchased items to pantry with confirmation dialog
  const handleBatchMoveToPantryWithConfirmation = useCallback(() => {
    if (purchasedItems.length === 0 || !onBatchMoveToPantry) return;

    Alert.alert(
      'Move All to Pantry',
      `Move ${purchasedItems.length === 1 ? '1 purchased item' : `all ${purchasedItems.length} purchased items`} to your pantry?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Move All',
          onPress: () => {
            onBatchMoveToPantry();
          },
        },
      ],
    );
  }, [purchasedItems.length, onBatchMoveToPantry]);

  // Handle clear all shopping (unpurchased) items with confirmation dialog
  const handleClearAllShoppingWithConfirmation = useCallback(() => {
    if (unpurchasedItems.length === 0) return;

    Alert.alert(
      'Clear All Shopping Items',
      `Are you sure you want to remove ${unpurchasedItems.length === 1 ? '1 item' : `all ${unpurchasedItems.length} items`} from your shopping list?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await onClearAllShopping?.();
          },
        },
      ],
    );
  }, [unpurchasedItems.length, onClearAllShopping]);

  // Get the current clear handler based on active tab (by index)
  const currentClearHandler =
    index === 0
      ? handleClearAllShoppingWithConfirmation
      : handleClearAllWithConfirmation;

  // Get current items count for the active tab
  const currentItems = index === 0 ? unpurchasedItems : purchasedItems;
  const showClear = canRemoveItems && currentItems.length > 0;

  // Tab badge counts
  const counts = useMemo(
    () => ({
      shopping: unpurchasedCount,
      purchased: purchasedCount,
    }),
    [unpurchasedCount, purchasedCount],
  );

  // Standalone jumpTo for FilterTabBar inside ListHeaderComponent
  const jumpTo = useCallback((key: string) => {
    const routeIndex = ROUTES.findIndex(r => r.key === key);
    if (routeIndex >= 0) handleIndexChange(routeIndex);
  }, [handleIndexChange]);

  // Render FilterTabBar as the TabView's tab bar so it's always visible,
  // even when a tab's FlashList is replaced by an empty state
  const renderTabBar = useCallback(
    () => (
      <FilterTabBar
        navigationState={{ index, routes: ROUTES }}
        jumpTo={jumpTo}
        counts={counts}
        actionButton={
          showClear
            ? {
                label: 'Clear',
                onPress: currentClearHandler,
                testID: 'shopping-list-clear-all',
              }
            : undefined
        }
      />
    ),
    [index, jumpTo, counts, showClear, currentClearHandler],
  );

  // Render scene for TabView
  const renderScene = useCallback(
    ({ route }: { route: TabRoute }) => {
      switch (route.key) {
        case 'shopping':
          return (
            <MemoizedShoppingTab
              items={unpurchasedItems}
              onItemPress={onItemPress}
              onItemEdit={onItemEdit}
              onItemDelete={onItemDelete}
              onTogglePurchase={onTogglePurchase}
              onQuantityPress={onQuantityPress}
              onSortOrderUpdate={onSortOrderUpdate}
              onRefresh={onRefresh}
              refreshing={refreshing}
              loading={loading}
              disabled={disabled}
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableClose={handleSwipeableClose}
              onEndReached={onEndReachedUnpurchased}
              hasMore={hasMoreUnpurchased}
              isLoadingMore={isLoadingMoreUnpurchased}
              canRemoveItems={canRemoveItems}
              canEditItems={canEditItems}
              canMarkPurchased={canMarkPurchased}
              canReorderItems={canReorderItems}
              isTransitioning={isTransitioning}
              ListHeaderComponent={listHeaderComponent}
            />
          );
        case 'purchased':
          return (
            <MemoizedPurchasedTab
              items={purchasedItems}
              onItemPress={onItemPress}
              onItemEdit={onItemEdit}
              onItemDelete={onItemDelete}
              onTogglePurchase={onTogglePurchase}
              onMoveToPantry={onMoveToPantry}
              onQuantityPress={onQuantityPress}
              onRefresh={onRefresh}
              refreshing={refreshing}
              disabled={disabled}
              loading={loading}
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableClose={handleSwipeableClose}
              onEndReached={onEndReachedPurchased}
              hasMore={hasMorePurchased}
              isLoadingMore={isLoadingMorePurchased}
              canRemoveItems={canRemoveItems}
              canEditItems={canEditItems}
              canMarkPurchased={canMarkPurchased}
              isTransitioning={isTransitioning}
              onBatchMoveToPantry={onBatchMoveToPantry ? handleBatchMoveToPantryWithConfirmation : undefined}
              batchMoveToPantryLoading={batchMoveToPantryLoading}
              ListHeaderComponent={listHeaderComponent}
            />
          );
        default:
          return null;
      }
    },
    [
      unpurchasedItems,
      purchasedItems,
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
      handleSwipeableWillOpen,
      handleSwipeableClose,
      onEndReachedUnpurchased,
      hasMoreUnpurchased,
      isLoadingMoreUnpurchased,
      onEndReachedPurchased,
      hasMorePurchased,
      isLoadingMorePurchased,
      canRemoveItems,
      canEditItems,
      canMarkPurchased,
      canReorderItems,
      isTransitioning,
      onBatchMoveToPantry,
      handleBatchMoveToPantryWithConfirmation,
      batchMoveToPantryLoading,
      listHeaderComponent,
    ],
  );

  // If no items at all AND not loading, show empty state
  // Don't show empty state while loading - that's when skeletons should appear
  if (items.length === 0 && emptyState && !loading) {
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

  return (
    <View style={{ flex: 1, ...(Platform.OS === 'android' && { elevation: 0 }) }}>
      <TabView
        navigationState={{ index, routes: ROUTES }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={handleIndexChange}
        initialLayout={{ width: layout.width }}
        swipeEnabled={true}
        lazy={false}
        overScrollMode="never"
      />
    </View>
  );
};

export { ShoppingListTabs };
