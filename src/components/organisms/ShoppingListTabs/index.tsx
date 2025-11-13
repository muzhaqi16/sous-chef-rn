import React, { useMemo, useCallback, useRef, useState } from 'react';
import { ScrollView, RefreshControl } from 'react-native-gesture-handler';
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

  // Separate items by purchased status
  const unpurchasedItems = useMemo(
    () => items.filter(item => !item.isPurchased),
    [items],
  );

  const purchasedItems = useMemo(
    () => items.filter(item => item.isPurchased),
    [items],
  );

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
    setIsDragging(true);
  }, []);

  const handleDragRelease = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Render scene for each tab
  const renderScene = useCallback(
    ({ route }: { route: TabRoute }) => {
      switch (route.key) {
        case 'shopping':
          return (
            <ShoppingTab
              items={unpurchasedItems}
              onItemPress={onItemPress}
              onItemEdit={onItemEdit}
              onItemDelete={onItemDelete}
              onTogglePurchase={onTogglePurchase}
              onSortOrderUpdate={onSortOrderUpdate}
              onRefresh={onRefresh}
              refreshing={refreshing}
              disabled={disabled}
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableClose={onSwipeableClose}
              onDragBegin={handleDragBegin}
              onDragRelease={handleDragRelease}
            />
          );

        case 'purchased':
          return (
            <PurchasedTab
              items={purchasedItems}
              onItemPress={onItemPress}
              onItemEdit={onItemEdit}
              onItemDelete={onItemDelete}
              onTogglePurchase={onTogglePurchase}
              onSortOrderUpdate={onSortOrderUpdate}
              onClearAll={onClearAllPurchased}
              disabled={disabled}
              onSwipeableWillOpen={handleSwipeableWillOpen}
              onSwipeableClose={onSwipeableClose}
              onDragBegin={handleDragBegin}
              onDragRelease={handleDragRelease}
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
      onSortOrderUpdate,
      onRefresh,
      refreshing,
      disabled,
      onClearAllPurchased,
      handleSwipeableWillOpen,
      onSwipeableClose,
      handleDragBegin,
      handleDragRelease,
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
    />
  );
};
