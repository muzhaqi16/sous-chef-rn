import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { RefreshControl } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { TabView, TabRoute } from '#/components/molecules/TabView';
import { MemoizedShoppingTab } from './ShoppingTab';
import { MemoizedPurchasedTab } from './PurchasedTab';
import { EmptyState } from '#components/base/EmptyState';
import type { SortableShoppingListItem } from '../SortableShoppingList';

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
}

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
  canAddItems = true,
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
  canReorderItems = false,
}) => {
  // Track open swipeable across both tabs
  const openSwipeableRef = useRef<any>(null);

  // Track if any swipeable is open to disable tab swipe (prevents gesture conflict)
  const [isSwipeableOpen, setIsSwipeableOpen] = useState(false);

  // PERFORMANCE: Use refs for callbacks to prevent renderScene recreation
  // This avoids expensive scene re-creation when parent callbacks change
  const callbacksRef = useRef({
    onItemPress,
    onItemEdit,
    onItemDelete,
    onTogglePurchase,
    onMoveToPantry,
    onQuantityPress,
    onSortOrderUpdate,
    onRefresh,
    onClearAllPurchased,
    onSwipeableClose,
    onEndReachedUnpurchased,
    onEndReachedPurchased,
  });

  // PERFORMANCE: Store state props in ref to prevent renderScene recreation
  const stateRef = useRef({
    loading,
    disabled,
    refreshing,
    canAddItems,
    canRemoveItems,
    canEditItems,
    canMarkPurchased,
    canReorderItems,
  });

  // Keep refs updated with latest callbacks and state
  useEffect(() => {
    callbacksRef.current = {
      onItemPress,
      onItemEdit,
      onItemDelete,
      onTogglePurchase,
      onMoveToPantry,
      onQuantityPress,
      onSortOrderUpdate,
      onRefresh,
      onClearAllPurchased,
      onSwipeableClose,
      onEndReachedUnpurchased,
      onEndReachedPurchased,
    };
    stateRef.current = {
      loading,
      disabled,
      refreshing,
      canAddItems,
      canRemoveItems,
      canEditItems,
      canMarkPurchased,
      canReorderItems,
    };
  });

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

  // Tab routes with badge counts
  // PERFORMANCE: Only recreate when badge counts actually change
  const routes: TabRoute[] = useMemo(
    () => [
      {
        key: 'shopping',
        title: 'Shopping',
        badge: unpurchasedCount,
      },
      {
        key: 'purchased',
        title: 'Purchased',
        badge: purchasedCount,
      },
    ],
    [unpurchasedCount, purchasedCount],
  );

  // Handle tab index change - close any open swipeable
  const handleIndexChange = useCallback((_newIndex: number) => {
    if (openSwipeableRef.current) {
      openSwipeableRef.current.current?.close();
      openSwipeableRef.current = null;
    }
    setIsSwipeableOpen(false);
  }, []);

  // Wrap swipeable handlers to use shared ref across tabs
  const handleSwipeableWillOpen = useCallback(
    (ref: any) => {
      if (openSwipeableRef.current && openSwipeableRef.current !== ref) {
        openSwipeableRef.current.current?.close();
      }
      openSwipeableRef.current = ref;
      setIsSwipeableOpen(true);
      onSwipeableWillOpen?.(ref);
    },
    [onSwipeableWillOpen],
  );

  // Handle swipeable close - reset state to re-enable tab swipe
  const handleSwipeableClose = useCallback(() => {
    openSwipeableRef.current = null;
    setIsSwipeableOpen(false);
    callbacksRef.current.onSwipeableClose?.();
  }, []);

  // Render scene for each tab
  // PERFORMANCE: Use refs for callbacks, items, AND state to prevent scene recreation
  // renderScene only recreates when stable handlers change (never for state/data changes)
  // All dynamic data accessed via refs - child components re-render via their own React.memo
  const renderScene = useCallback(
    ({ route }: { route: TabRoute }) => {
      // Access latest callbacks and state from refs to avoid stale closures
      const callbacks = callbacksRef.current;
      const state = stateRef.current;

      switch (route.key) {
        case 'shopping':
          return (
            <MemoizedShoppingTab
              items={unpurchasedItems}
              onItemPress={callbacks.onItemPress}
              onItemEdit={callbacks.onItemEdit}
              onItemDelete={callbacks.onItemDelete}
              onTogglePurchase={callbacks.onTogglePurchase}
              onQuantityPress={callbacks.onQuantityPress}
              onSortOrderUpdate={callbacks.onSortOrderUpdate}
              onRefresh={callbacks.onRefresh}
              refreshing={refreshing}
              loading={state.loading}
              disabled={state.disabled}
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableClose={handleSwipeableClose}
              onEndReached={callbacks.onEndReachedUnpurchased}
              hasMore={hasMoreUnpurchased}
              isLoadingMore={isLoadingMoreUnpurchased}
              canRemoveItems={state.canRemoveItems}
              canEditItems={state.canEditItems}
              canMarkPurchased={state.canMarkPurchased}
              canReorderItems={state.canReorderItems}
            />
          );

        case 'purchased':
          return (
            <MemoizedPurchasedTab
              items={purchasedItems}
              onItemPress={callbacks.onItemPress}
              onItemEdit={callbacks.onItemEdit}
              onItemDelete={callbacks.onItemDelete}
              onTogglePurchase={callbacks.onTogglePurchase}
              onMoveToPantry={callbacks.onMoveToPantry}
              onQuantityPress={callbacks.onQuantityPress}
              onClearAll={callbacks.onClearAllPurchased}
              onRefresh={callbacks.onRefresh}
              refreshing={refreshing}
              disabled={state.disabled}
              loading={state.loading}
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableClose={handleSwipeableClose}
              onEndReached={callbacks.onEndReachedPurchased}
              hasMore={hasMorePurchased}
              isLoadingMore={isLoadingMorePurchased}
              canRemoveItems={state.canRemoveItems}
              canEditItems={state.canEditItems}
              canMarkPurchased={state.canMarkPurchased}
            />
          );

        default:
          return null;
      }
    },
    // PERFORMANCE: Include filtered arrays to ensure tabs update when items change
    // The memoized filter functions ensure these only change when items actually change
    // NOTE: refreshing must be in deps so RefreshControl updates when refresh completes
    [
      unpurchasedItems,
      purchasedItems,
      refreshing,
      hasMoreUnpurchased,
      hasMorePurchased,
      isLoadingMoreUnpurchased,
      isLoadingMorePurchased,
      handleSwipeableWillOpen,
      handleSwipeableClose,
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
    <TabView
      routes={routes}
      renderScene={renderScene}
      initialTabIndex={0}
      lazy={true}
      lazyPreloadDistance={0}
      onIndexChange={handleIndexChange}
      swipeEnabled={!isSwipeableOpen}
    />
  );
};

// PERFORMANCE: Memoize with shallow comparison
// Since we use refs internally for callbacks and items, we only need to check:
// - items array reference
// - loading/disabled/refreshing state
// Callbacks are accessed via refs so changing references don't matter
const MemoizedShoppingListTabs = React.memo(ShoppingListTabs);

// Export memoized version as default to ensure it's always used with optimization
export { MemoizedShoppingListTabs as ShoppingListTabs };
