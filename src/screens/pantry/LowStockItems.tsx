import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '#utils/iconUtils';
import { SwipeableItem } from '#components/molecules/SwipeableItem/SwipeableItem';
import { ScreenHeader } from '#components/molecules/ScreenHeader';
import { PantryItemSkeleton } from '#components/base/Skeleton/PantryItemSkeleton';
import { usePantryManagement } from '#hooks/home/pantry/usePantryManagement';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAddItemToShoppingListMutation } from '#generated';
import { useCurrentPantry } from '#hooks/pantry/useCurrentPantry';
import { commonStyles } from '#/styles/commonStyles';

export const LowStockItems: React.FC = () => {
  const { theme } = useUnistyles();

  const { goBack, navigateTo } = useAppNavigation();

  const [refreshing, setRefreshing] = React.useState(false);

  // Use cache-only hook for pantry resolution (no network requests)
  // This prevents query cascade when switching between pantry screens
  const { pantry } = useCurrentPantry();

  const { items, loading, refetch } = usePantryManagement(pantry?.id);
  const [addToShoppingList] = useAddItemToShoppingListMutation();

  const lowStockItems = useMemo(() => {
    if (!items) return [];

    // Match the low stock logic used in usePantryManagement stats
    return items.filter(item => {
      return item.quantity <= 1 || item.lowStockAlert;
    });
  }, [items]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAddToList = async (itemId: string) => {
    try {
      await addToShoppingList({
        variables: { input: { shoppingListId: '', itemId } },
      });
    } catch {
      Alert.alert('Error', 'Failed to add to shopping list');
    }
  };

  return (
    <View style={commonStyles.container}>
      <ScreenHeader title="Low Stock Items" onBack={goBack} />

      <FlatList
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        data={lowStockItems}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          loading || !items ? (
            <View style={styles.skeletonContainer}>
              {[1, 2, 3, 4, 5].map(key => (
                <PantryItemSkeleton key={key} />
              ))}
            </View>
          ) : (
            <View style={[commonStyles.center, styles.emptyState]}>
              <Icon name="inventory" size={64} color={theme.colors.success} />
              <Text style={[commonStyles.body, styles.emptyText]}>
                All items are above minimum stock levels
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <SwipeableItem
            onPress={() => navigateTo.pantryItemDetail({ itemId: item.id })}
          >
            <View style={[commonStyles.card, styles.itemCard]}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.itemName}</Text>
                <Text style={[commonStyles.caption, styles.itemDetails]}>
                  {item.quantity} {item.unit?.symbol} remaining
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleAddToList(item.id)}
                style={styles.actionButton}
              >
                <Icon
                  name="add-shopping-cart"
                  size={20}
                  color={theme.colors.primary}
                />
              </TouchableOpacity>
            </View>
          </SwipeableItem>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  emptyState: {
    padding: theme.spacing['2xl'],
  },
  emptyText: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: theme.spacing['2xl'],
  },
  skeletonContainer: {
    gap: theme.spacing.sm,
  },
  itemCard: {
    ...commonStyles.rowSpaceBetween,
    marginBottom: theme.spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  itemDetails: {
    marginTop: theme.spacing.xs,
  },
  actionButton: {
    padding: theme.spacing.xs,
  },
}));
