import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SortableShoppingList } from '../SortableShoppingList';
import type { SortableShoppingListItem } from '../SortableShoppingList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { useDeferredRender } from '#hooks/performance';
import { Icon } from '#utils';

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
    afterSortOrder: string | null,
    beforeSortOrder: string | null,
  ) => Promise<void>;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  loading?: boolean;
  disabled?: boolean;
  isDragging?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  onDragBegin?: () => void;
  onDragRelease?: () => void;
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
  loading,
  disabled,
  isDragging,
  onSwipeableWillOpen,
  onSwipeableClose,
  onDragBegin,
  onDragRelease,
}) => {
  const { theme } = useUnistyles();

  // PERFORMANCE: Defer heavy SortableShoppingList render until after navigation completes
  // This ensures smooth screen transitions by showing skeletons during navigation animation
  const isReady = useDeferredRender();

  // Show skeletons only during initial load when no data is available
  // If we have cached items from a previous visit, show them immediately
  // This prevents the skeleton from showing on subsequent navigations back to the screen
  if ((loading || !isReady) && items.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {[1, 2, 3, 4, 5, 6].map(key => (
          <ShoppingListItemSkeleton key={key} />
        ))}
      </ScrollView>
    );
  }

  // After transition complete, show skeleton only during initial load with no cached data
  if (loading && items.length === 0) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {[1, 2, 3, 4, 5, 6].map(key => (
          <ShoppingListItemSkeleton key={key} />
        ))}
      </ScrollView>
    );
  }

  // Empty state for shopping tab
  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon
          name="shopping-cart"
          size={64}
          color={theme.colors.textSecondary}
          library="MaterialIcons"
        />
        <Text style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}>
          All caught up!
        </Text>
        <Text
          style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}
        >
          Add items to your list or unmark purchased items to see them here
        </Text>
      </View>
    );
  }

  return (
    <SortableShoppingList
      items={items}
      onItemPress={onItemPress}
      onItemEdit={onItemEdit}
      onItemDelete={onItemDelete}
      onTogglePurchase={onTogglePurchase}
      onQuantityPress={onQuantityPress}
      onSortOrderUpdate={onSortOrderUpdate}
      disabled={disabled}
      isDragging={isDragging}
      showsVerticalScrollIndicator={true}
      onSwipeableWillOpen={onSwipeableWillOpen}
      onSwipeableClose={onSwipeableClose}
      onRefresh={onRefresh}
      refreshing={refreshing}
      onDragBegin={onDragBegin}
      onDragRelease={onDragRelease}
    />
  );
};

// PERFORMANCE: Memoize with shallow comparison of items array
// Items array reference changes when filter runs, but React.memo
// does shallow comparison which triggers re-render with new items
export const MemoizedShoppingTab = React.memo(ShoppingTabComponent);
MemoizedShoppingTab.displayName = 'ShoppingTab';

// Also export non-memoized for backwards compatibility
export const ShoppingTab = ShoppingTabComponent;

const styles = StyleSheet.create(theme => ({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg + 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: theme.typography.fontSize.md,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.normal,
  },
}));
