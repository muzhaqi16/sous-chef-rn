import React, { useEffect } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { SortableShoppingList } from '../SortableShoppingList/SortableList';
import type { SortableShoppingListItem } from '../SortableShoppingList/types';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { EmptyState } from '#components/base/EmptyState';
import { ShoppingEmptyIllustration } from '#components/base/ShoppingEmptyIllustration';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import {
  StaggeredEntryProvider,
  useStaggeredEntry,
} from '#context/StaggeredEntryContext';
import { staggeredEntryAnimation } from '#constants/animations';

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
  // Transition state for showing skeletons during list switches
  isTransitioning?: boolean;
  // List header (e.g. SearchBar) rendered inside FlashList for correct RefreshControl position
  ListHeaderComponent?: React.ReactElement | null;
}

// Inner component that uses stagger context
interface StaggeredListContentProps {
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
  disabled?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  onEndReached?: () => void;
  canRemoveItems: boolean;
  canEditItems: boolean;
  canMarkPurchased: boolean;
  canReorderItems: boolean;
  ListHeaderComponent?: React.ReactElement | null;
}

const StaggeredListContent: React.FC<StaggeredListContentProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onQuantityPress,
  onSortOrderUpdate,
  onRefresh,
  refreshing,
  disabled,
  onSwipeableWillOpen,
  onSwipeableClose,
  onEndReached,
  canRemoveItems,
  canEditItems,
  canMarkPurchased,
  canReorderItems,
  ListHeaderComponent,
}) => {
  const staggerCtx = useStaggeredEntry();

  // Mark initial render complete after stagger animation window
  useEffect(() => {
    const totalStaggerTime =
      staggeredEntryAnimation.initialDelay +
      staggeredEntryAnimation.maxItems * staggeredEntryAnimation.delayPerItem +
      staggeredEntryAnimation.duration;

    const timer = setTimeout(() => {
      staggerCtx?.markInitialRenderComplete();
    }, totalStaggerTime);

    return () => clearTimeout(timer);
  }, [staggerCtx]);

  return (
    <View style={styles.container}>
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
        ListHeaderComponent={ListHeaderComponent}
      />
    </View>
  );
};

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
  isTransitioning = false,
  ListHeaderComponent,
}) => {
  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  const isReady = useDeferredRender();

  // Show skeletons during initial render OR during list transitions
  if (!isReady || isTransitioning) {
    return <SkeletonList SkeletonComponent={ShoppingListItemSkeleton} />;
  }

  // Empty state for shopping tab
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingEmptyIllustration size="medium" />}
        title="Your list is empty"
        description="Add items to start your shopping list"
      />
    );
  }

  return (
    <StaggeredEntryProvider>
      <StaggeredListContent
        items={items}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onTogglePurchase={onTogglePurchase}
        onQuantityPress={onQuantityPress}
        onSortOrderUpdate={onSortOrderUpdate}
        onRefresh={onRefresh}
        refreshing={refreshing}
        disabled={disabled}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
        onEndReached={onEndReached}
        canRemoveItems={canRemoveItems}
        canEditItems={canEditItems}
        canMarkPurchased={canMarkPurchased}
        canReorderItems={canReorderItems}
        ListHeaderComponent={ListHeaderComponent}
      />
    </StaggeredEntryProvider>
  );
};

export const MemoizedShoppingTab = ShoppingTabComponent;
MemoizedShoppingTab.displayName = 'ShoppingTab';

// Also export non-memoized for backwards compatibility
export const ShoppingTab = ShoppingTabComponent;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
