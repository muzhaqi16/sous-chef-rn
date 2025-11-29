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
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
    afterSortOrder: string | null,
    beforeSortOrder: string | null,
  ) => Promise<void>;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  loading?: boolean;
  disabled?: boolean;
  emptyState?: any;
  onClearAllPurchased?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
}

export const ShoppingListTabs: React.FC<ShoppingListTabsProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onSortOrderUpdate,
  onRefresh,
  refreshing,
  loading,
  disabled,
  emptyState,
  onClearAllPurchased,
  onSwipeableWillOpen,
  onSwipeableClose,
}) => {
  // Track open swipeable across both tabs
  const openSwipeableRef = useRef<any>(null);

  // Track drag state to disable tab swipe during drag
  const [isDragging, setIsDragging] = useState(false);

  // PERFORMANCE: Use refs for callbacks to prevent renderScene recreation
  // This avoids expensive scene re-creation when parent callbacks change
  const callbacksRef = useRef({
    onItemPress,
    onItemEdit,
    onItemDelete,
    onTogglePurchase,
    onSortOrderUpdate,
    onRefresh,
    onClearAllPurchased,
    onSwipeableClose,
  });

  // Keep ref updated with latest callbacks
  useEffect(() => {
    callbacksRef.current = {
      onItemPress,
      onItemEdit,
      onItemDelete,
      onTogglePurchase,
      onSortOrderUpdate,
      onRefresh,
      onClearAllPurchased,
      onSwipeableClose,
    };
  });

  // PERFORMANCE: Store filtered arrays in refs to prevent renderScene recreation
  // Refs are updated synchronously but don't trigger re-renders
  const unpurchasedItemsRef = useRef<SortableShoppingListItem[]>([]);
  const purchasedItemsRef = useRef<SortableShoppingListItem[]>([]);

  // Filter items by isPurchased value - works correctly with optimistic updates
  // Note: Can't use findIndex/slice because optimistic updates change isPurchased
  // in-place without re-sorting the array, breaking position-based assumptions
  // PERFORMANCE: Update refs synchronously for immediate access in renderScene
  const unpurchasedCount = useMemo(() => {
    const filtered = items.filter(item => !item.isPurchased);
    unpurchasedItemsRef.current = filtered;
    return filtered.length;
  }, [items]);

  const purchasedCount = useMemo(() => {
    const filtered = items.filter(item => item.isPurchased);
    purchasedItemsRef.current = filtered;
    return filtered.length;
  }, [items]);

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

  // Handle drag events - disable tab swipe during drag
  const handleDragBegin = useCallback(() => {
    if (__DEV__) console.log('🎯 Drag BEGIN - disabling tab swipe');
    setIsDragging(true);
  }, []);

  const handleDragRelease = useCallback(() => {
    if (__DEV__) console.log('🎯 Drag RELEASE - enabling tab swipe');
    setIsDragging(false);
  }, []);

  // Render scene for each tab
  // PERFORMANCE: Use refs for both callbacks AND items to prevent scene recreation
  // renderScene only recreates when truly static props change (loading, disabled, refreshing, isDragging)
  // Items are accessed via refs - child components re-render via their own React.memo when props change
  const renderScene = useCallback(
    ({ route }: { route: TabRoute }) => {
      // Access latest callbacks from ref to avoid stale closures
      const callbacks = callbacksRef.current;

      switch (route.key) {
        case 'shopping':
          // Access items from ref - ref is updated synchronously in useMemo above
          return (
            <MemoizedShoppingTab
              items={unpurchasedItemsRef.current}
              onItemPress={callbacks.onItemPress}
              onItemEdit={callbacks.onItemEdit}
              isDragging={isDragging}
              onItemDelete={callbacks.onItemDelete}
              onTogglePurchase={callbacks.onTogglePurchase}
              onSortOrderUpdate={callbacks.onSortOrderUpdate}
              onRefresh={callbacks.onRefresh}
              refreshing={refreshing}
              loading={loading}
              disabled={disabled}
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableClose={callbacks.onSwipeableClose}
              onDragBegin={handleDragBegin}
              onDragRelease={handleDragRelease}
            />
          );

        case 'purchased':
          // Access items from ref - ref is updated synchronously in useMemo above
          return (
            <MemoizedPurchasedTab
              items={purchasedItemsRef.current}
              onItemPress={callbacks.onItemPress}
              onItemEdit={callbacks.onItemEdit}
              onItemDelete={callbacks.onItemDelete}
              onTogglePurchase={callbacks.onTogglePurchase}
              onSortOrderUpdate={callbacks.onSortOrderUpdate}
              onClearAll={callbacks.onClearAllPurchased}
              disabled={disabled}
              loading={loading}
              isDragging={isDragging}
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableClose={callbacks.onSwipeableClose}
              onDragBegin={handleDragBegin}
              onDragRelease={handleDragRelease}
            />
          );

        default:
          return null;
      }
    },
    // PERFORMANCE: Only depend on truly static props - NO array dependencies
    // Items accessed via refs, callbacks accessed via callbacksRef
    // This prevents renderScene recreation when items change
    [
      loading,
      disabled,
      refreshing,
      isDragging,
      handleSwipeableWillOpen,
      handleDragBegin,
      handleDragRelease,
      // NOTE: unpurchasedCount/purchasedCount intentionally NOT included
      // Changes to items trigger TabView re-render via routes badge update
      // which causes renderScene to be called with latest ref values
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
      swipeEnabled={false}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
};
