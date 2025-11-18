import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { RefreshControl } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { TabView, TabRoute } from '#/components/molecules/TabView';
import { ShoppingTab } from './ShoppingTab';
import { PurchasedTab } from './PurchasedTab';
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

  // Separate items by purchased status (single-pass for performance)
  const { unpurchasedItems, purchasedItems } = useMemo(() => {
    const unpurchased: SortableShoppingListItem[] = [];
    const purchased: SortableShoppingListItem[] = [];

    for (const item of items) {
      if (item.isPurchased) {
        purchased.push(item);
      } else {
        unpurchased.push(item);
      }
    }

    return { unpurchasedItems: unpurchased, purchasedItems: purchased };
  }, [items]);

  // Tab routes with badge counts
  const routes: TabRoute[] = useMemo(
    () => [
      {
        key: 'shopping',
        title: 'Shopping',
        badge: unpurchasedItems.length,
      },
      {
        key: 'purchased',
        title: 'Purchased',
        badge: purchasedItems.length,
      },
    ],
    [unpurchasedItems.length, purchasedItems.length],
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
  // PERFORMANCE: Use refs for callbacks to prevent scene recreation on every parent re-render
  // Only recreate scene when truly static props change (loading, disabled, refreshing, isDragging)
  const renderScene = useCallback(
    ({ route }: { route: TabRoute }) => {
      // Access latest callbacks from ref to avoid stale closures
      const callbacks = callbacksRef.current;

      switch (route.key) {
        case 'shopping':
          return (
            <ShoppingTab
              items={unpurchasedItems}
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
          return (
            <PurchasedTab
              items={purchasedItems}
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
    // PERFORMANCE: Only depend on truly static props
    // Callbacks accessed via ref to avoid recreation
    [
      loading,
      disabled,
      refreshing,
      isDragging,
      handleSwipeableWillOpen,
      handleDragBegin,
      handleDragRelease,
      unpurchasedItems,
      purchasedItems,
    ],
  );

  // If no items at all, show empty state
  if (items.length === 0 && emptyState) {
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
      swipeEnabled={!disabled && !isDragging}
      onRefresh={onRefresh}
      refreshing={refreshing}
    />
  );
};
