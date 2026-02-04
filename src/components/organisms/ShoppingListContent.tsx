import React, { useMemo } from 'react';
import { ScrollView, RefreshControl } from 'react-native-gesture-handler';
import { SortableShoppingList } from '#components/organisms/SortableShoppingList/SortableList';
import { CollapsiblePurchasedSection } from '#components/molecules/CollapsiblePurchasedSection';
import { EmptyState } from '#components/base/EmptyState';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import type { SortableShoppingListItem } from '#components/organisms/SortableShoppingList/types';

interface ShoppingListContentProps {
  items: SortableShoppingListItem[];
  loading?: boolean;
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
  emptyState?: any;
  onClearAllPurchased?: () => Promise<void>;
  onSwipeableWillOpen?: (ref: any) => void;
}

/**
 * Wrapper component that conditionally renders EmptyState or SortableShoppingList
 *
 * Handles three states:
 * 1. Loading with no items - shows skeleton screens
 * 2. No items with empty state - shows empty state message
 * 3. Has items - shows sortable list with purchased/unpurchased sections
 */
export const ShoppingListContent: React.FC<ShoppingListContentProps> = ({
  items,
  loading,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onRefresh,
  refreshing,
  disabled,
  emptyState,
  onClearAllPurchased,
  onSwipeableWillOpen,
}) => {
  // Separate items by purchased status (memoized to prevent unnecessary re-renders)
  // Must be called before any early returns to comply with React hooks rules
  const unpurchasedItems = useMemo(
    () => items.filter(item => !item.isPurchased),
    [items],
  );
  const purchasedItems = useMemo(
    () => items.filter(item => item.isPurchased),
    [items],
  );

  // Show skeleton screens during initial load
  if (loading && items.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {[1, 2, 3, 4, 5].map(key => (
          <ShoppingListItemSkeleton key={key} />
        ))}
      </ScrollView>
    );
  }

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
    <>
      {/* Unpurchased Items */}
      <SortableShoppingList
        items={unpurchasedItems}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onTogglePurchase={onTogglePurchase}
        disabled={disabled}
        showsVerticalScrollIndicator={true}
        onSwipeableWillOpen={onSwipeableWillOpen}
        ListFooterComponent={
          /* Collapsible Purchased Section */
          <CollapsiblePurchasedSection
            purchasedItems={purchasedItems}
            onItemPress={onItemPress}
            onItemEdit={onItemEdit}
            onItemDelete={onItemDelete}
            onTogglePurchase={onTogglePurchase}
            onClearAll={onClearAllPurchased}
            disabled={disabled}
            onSwipeableWillOpen={onSwipeableWillOpen}
          />
        }
      />
    </>
  );
};
