import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { SortableShoppingList } from '../SortableShoppingList';
import type { SortableShoppingListItem } from '../SortableShoppingList';
import { Icon } from '#utils';
import { ShoppingListItemSkeleton } from '#components/base/Skeleton/ShoppingListItemSkeleton';

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

export const PurchasedTab: React.FC<PurchasedTabProps> = React.memo(
  ({
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

    // Skeleton-first approach: Show skeletons whenever loading, regardless of cached items
    // This ensures smooth UX when switching between lists
    if (loading) {
      return (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {[1, 2, 3, 4, 5].map(key => (
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
      </View>
    );
  },
);

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
