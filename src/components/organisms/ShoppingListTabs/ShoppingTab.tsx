import React from 'react';
import { View } from 'react-native';
import { SortableShoppingList } from '../SortableShoppingList';
import type { SortableShoppingListItem } from '../SortableShoppingList';
import { SkeletonList, ShoppingListItemSkeleton } from '#components/base/Skeleton';
import { EmptyState } from '#components/base/EmptyState';
import { ShoppingEmptyIllustration } from '#components/base/ShoppingEmptyIllustration';
import { useDeferredRender } from '#hooks/performance';

interface ShoppingTabProps {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
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
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  // Pagination props
  onEndReached?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  // Permission flags
  canRemoveItems?: boolean;
  canEditItems?: boolean;
  canMarkPurchased?: boolean;
  canReorderItems?: boolean;
  // Empty state context
  purchasedCount?: number;
  onAddItem?: () => void;
}

const ShoppingTabComponent: React.FC<ShoppingTabProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onQuantityPress,
  onSortOrderUpdate,
  onRefresh,
  refreshing,
  loading: _loading,
  disabled,
  onSwipeableWillOpen,
  onSwipeableClose,
  onEndReached,
  hasMore: _hasMore,
  isLoadingMore: _isLoadingMore,
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
  canReorderItems = false,
  purchasedCount = 0,
  onAddItem,
}) => {
  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  const isReady = useDeferredRender();

  // Show skeletons until deferred render is ready
  if (!isReady) {
    return <SkeletonList SkeletonComponent={ShoppingListItemSkeleton} />;
  }

  // Empty state for shopping tab - context-aware based on purchased count
  if (items.length === 0) {
    const isShoppingComplete = purchasedCount > 0;

    return (
      <EmptyState
        icon={<ShoppingEmptyIllustration variant={isShoppingComplete ? 'complete' : 'empty'} size="medium" />}
        title={isShoppingComplete ? 'Shopping complete!' : 'Your list is empty'}
        description={
          isShoppingComplete
            ? "You've checked off everything on your list"
            : 'Add items to start your shopping list'
        }
        action={
          // Only show button for empty list state - complete state has tab bar + button
          !isShoppingComplete && onAddItem
            ? {
                label: 'Add Item',
                onPress: onAddItem,
              }
            : undefined
        }
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SortableShoppingList
        items={items}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onTogglePurchase={onTogglePurchase}
        onQuantityPress={onQuantityPress}
        onSortOrderUpdate={onSortOrderUpdate}
        disabled={disabled}
        showsVerticalScrollIndicator={true}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onEndReached={onEndReached}
        canRemoveItems={canRemoveItems}
        canEditItems={canEditItems}
        canMarkPurchased={canMarkPurchased}
        canReorderItems={canReorderItems}
      />
    </View>
  );
};

// PERFORMANCE: Memoize with shallow comparison of items array
// Items array reference changes when filter runs, but React.memo
// does shallow comparison which triggers re-render with new items
export const MemoizedShoppingTab = React.memo(ShoppingTabComponent);
MemoizedShoppingTab.displayName = 'ShoppingTab';

// Also export non-memoized for backwards compatibility
export const ShoppingTab = ShoppingTabComponent;
