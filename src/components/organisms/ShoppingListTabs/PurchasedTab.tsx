import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SortableShoppingList } from '../SortableShoppingList';
import type { SortableShoppingListItem } from '../SortableShoppingList';
import { Icon } from '#utils';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { useDeferredRender } from '#hooks/performance';

interface PurchasedTabProps {
  items: SortableShoppingListItem[];
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onMoveToPantry?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
    afterSortOrder: string | null,
    beforeSortOrder: string | null,
  ) => Promise<void>;
  onClearAll?: () => Promise<void>;
  loading?: boolean;
  disabled?: boolean;
  isDragging?: boolean;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
  onDragBegin?: () => void;
  onDragRelease?: () => void;
}

const PurchasedTabComponent: React.FC<PurchasedTabProps> = ({
  items,
  onItemPress,
  onItemEdit,
  onItemDelete,
  onTogglePurchase,
  onMoveToPantry,
  onSortOrderUpdate,
  onClearAll,
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

  // PERFORMANCE: Memoize inline styles to avoid object recreation on every render
  const clearButtonStyle = useMemo(
    () => [styles.clearButton, { backgroundColor: theme.colors.warning }],
    [theme.colors.warning],
  );

  const handleClearAll = useCallback(() => {
    if (items.length === 0) return;

    Alert.alert(
      'Clear All Purchased Items',
      `Are you sure you want to remove all ${items.length} purchased items from this list?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await onClearAll?.();
          },
        },
      ],
    );
  }, [items.length, onClearAll]);

  // Show skeletons only during initial load when no data is available
  // If we have cached items from a previous visit, show them immediately
  // This prevents the skeleton from showing on subsequent navigations back to the screen
  if ((loading || !isReady) && items.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5, 6].map(key => (
          <ShoppingListItemSkeleton key={key} />
        ))}
      </ScrollView>
    );
  }

  // After transition complete, show skeleton only during initial load with no cached data
  if (loading && items.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5, 6].map(key => (
          <ShoppingListItemSkeleton key={key} />
        ))}
      </ScrollView>
    );
  }

  // Empty state for purchased tab
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
          No purchased items yet
        </Text>
        <Text
          style={[
            styles.emptyDescription,
            { color: theme.colors.textSecondary },
          ]}
        >
          Check off items as you shop to see them here
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
      onMoveToPantry={onMoveToPantry}
      onSortOrderUpdate={onSortOrderUpdate}
      disabled={disabled}
      isDragging={isDragging}
      showsVerticalScrollIndicator={true}
      onSwipeableWillOpen={onSwipeableWillOpen}
      onSwipeableClose={onSwipeableClose}
      onDragBegin={onDragBegin}
      onDragRelease={onDragRelease}
      ListFooterComponent={
        onClearAll ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={clearButtonStyle}
              onPress={handleClearAll}
            >
              <Icon
                name="delete-outline"
                size={20}
                color={theme.colors.surface}
                library="MaterialIcons"
              />
              <Text
                style={[
                  styles.clearButtonText,
                  { color: theme.colors.surface },
                ]}
              >
                Clear All Purchased
              </Text>
            </TouchableOpacity>
          </View>
        ) : null
      }
    />
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
  skeletonContainer: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
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
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
    alignItems: 'center',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.sm,
  },
  clearButtonText: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: '600',
  },
}));
