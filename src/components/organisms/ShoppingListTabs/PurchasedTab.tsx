import React, { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { SortableShoppingList } from '../SortableShoppingList/SortableList';
import type { SortableShoppingListItem } from '../SortableShoppingList/types';
import { SkeletonList } from '#components/base/Skeleton/SkeletonList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { EmptyState } from '#components/base/EmptyState';
import { useDeferredRender } from '#hooks/performance/useDeferredRender';
import {
  StaggeredEntryProvider,
  useStaggeredEntry,
} from '#context/StaggeredEntryContext';
import { staggeredEntryAnimation } from '#constants/animations';

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
  // Transition state for showing skeletons during list switches
  isTransitioning?: boolean;
  // Batch move to pantry
  onBatchMoveToPantry?: () => void;
  batchMoveToPantryLoading?: boolean;
}

// Batch move to pantry action bar
const BatchMoveToPantryBar: React.FC<{
  onPress: () => void;
  loading: boolean;
}> = ({ onPress, loading }) => {
  const { theme } = useUnistyles();
  return (
    <View style={styles.batchMoveBar}>
      <Pressable
        onPress={onPress}
        disabled={loading}
        style={({ pressed }) => [
          styles.batchMoveButton,
          pressed && styles.batchMoveButtonPressed,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.white} />
        ) : (
          <Icon
            name="move-to-inbox"
            library="MaterialIcons"
            size={18}
            color={theme.colors.white}
          />
        )}
        <Text style={styles.batchMoveText}>Move All to Pantry</Text>
      </Pressable>
    </View>
  );
};

// Inner component that uses stagger context
interface StaggeredPurchasedContentProps {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  disabled?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  onEndReached?: () => void;
  canRemoveItems: boolean;
  canEditItems: boolean;
  canMarkPurchased: boolean;
}

const StaggeredPurchasedContent: React.FC<StaggeredPurchasedContentProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onMoveToPantry,
  onQuantityPress,
  onRefresh,
  refreshing,
  disabled,
  onSwipeableWillOpen,
  onSwipeableClose,
  onEndReached,
  canRemoveItems,
  canEditItems,
  canMarkPurchased,
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
  isTransitioning = false,
  onBatchMoveToPantry,
  batchMoveToPantryLoading = false,
}) => {
  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  const isReady = useDeferredRender();

  // Show skeletons during initial render OR during list transitions
  if (!isReady || isTransitioning) {
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
    <StaggeredEntryProvider>
      {onBatchMoveToPantry && items.length > 0 && (
        <BatchMoveToPantryBar
          onPress={onBatchMoveToPantry}
          loading={batchMoveToPantryLoading}
        />
      )}
      <StaggeredPurchasedContent
        items={items}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onTogglePurchase={onTogglePurchase}
        onMoveToPantry={onMoveToPantry}
        onQuantityPress={onQuantityPress}
        onRefresh={onRefresh}
        refreshing={refreshing}
        disabled={disabled}
        onSwipeableWillOpen={onSwipeableWillOpen}
        onSwipeableClose={onSwipeableClose}
        onEndReached={onEndReached}
        canRemoveItems={canRemoveItems}
        canEditItems={canEditItems}
        canMarkPurchased={canMarkPurchased}
      />
    </StaggeredEntryProvider>
  );
};

// PERFORMANCE: Memoize with shallow comparison of items array
// Items array reference changes when filter runs, but React.memo
// does shallow comparison which triggers re-render with new items
export const MemoizedPurchasedTab = React.memo(PurchasedTabComponent);
MemoizedPurchasedTab.displayName = 'PurchasedTab';

// Also export non-memoized for backwards compatibility
export const PurchasedTab = PurchasedTabComponent;

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  batchMoveBar: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  batchMoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.primary,
  },
  batchMoveButtonPressed: {
    opacity: theme.opacity.pressed,
  },
  batchMoveText: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
  },
}));
