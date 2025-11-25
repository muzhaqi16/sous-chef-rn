import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SortableShoppingList } from '../SortableShoppingList';
import type { SortableShoppingListItem } from '../SortableShoppingList';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';
import { useDeferredRender } from '#hooks/performance';
import { Icon } from '#utils';

interface PurchasedTabProps {
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
  const isReady = useDeferredRender(150);

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

  // Skeleton-first approach: Show skeletons during navigation transition
  if (loading || !isReady) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {[1, 2, 3].map(key => (
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
        <Text
          style={[styles.emptyTitle, { color: theme.colors.textPrimary }]}
        >
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
    <View style={styles.container}>
      <SortableShoppingList
        items={items}
        onItemPress={onItemPress}
        onItemEdit={onItemEdit}
        onItemDelete={onItemDelete}
        onTogglePurchase={onTogglePurchase}
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
                style={[
                  styles.clearButton,
                  { backgroundColor: theme.colors.warning },
                ]}
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
    </View>
  );
};

// PERFORMANCE: Memoize with shallow comparison
export const PurchasedTab = React.memo(PurchasedTabComponent);
PurchasedTab.displayName = 'PurchasedTab';

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
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
    borderRadius: theme.spacing.sm,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}));
