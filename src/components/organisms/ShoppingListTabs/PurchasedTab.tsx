import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SortableShoppingList } from '../SortableShoppingList';
import type { SortableShoppingListItem } from '../SortableShoppingList';
import { SkeletonList, ShoppingListItemSkeleton } from '#components/base/Skeleton';
import { EmptyState } from '#components/base/EmptyState';
import { useDeferredRender } from '#hooks/performance';

interface PurchasedTabProps {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
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
}

const PurchasedTabComponent: React.FC<PurchasedTabProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onMoveToPantry,
  onQuantityPress,
  onRefresh,
  refreshing,
  loading: _loading,
  disabled,
  onSwipeableWillOpen,
  onSwipeableClose,
  onEndReached,
  canRemoveItems = true,
  canEditItems = true,
  canMarkPurchased = true,
}) => {
  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  const isReady = useDeferredRender();

  // Show skeletons until deferred render is ready
  if (!isReady) {
    return <SkeletonList SkeletonComponent={ShoppingListItemSkeleton} />;
  }

  // Empty state for purchased tab
  if (items.length === 0) {
    return (
      <EmptyState
        icon="shopping-cart"
        iconLibrary="MaterialIcons"
        title="No purchased items yet"
        description="Check off items as you shop to see them here"
      />
    );
  }

  return (
    <View style={styles.container}>
      <SortableShoppingList
        items={items}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onTogglePurchase={onTogglePurchase}
        onMoveToPantry={onMoveToPantry}
        onQuantityPress={onQuantityPress}
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
      />
    </View>
  );
};

// PERFORMANCE: Memoize with shallow comparison of items array
// Items array reference changes when filter runs, but React.memo
// does shallow comparison which triggers re-render with new items
export const MemoizedPurchasedTab = React.memo(PurchasedTabComponent);
MemoizedPurchasedTab.displayName = 'PurchasedTab';

// Also export non-memoized for backwards compatibility
export const PurchasedTab = PurchasedTabComponent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
