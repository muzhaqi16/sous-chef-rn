import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '#utils';
import { SwipeableItem, ScreenHeader } from '#components';
import { usePantryItems, useDefaultHome, useAppNavigation } from '#hooks';
import { useGetHomeQuery, useAddItemToShoppingListMutation } from '#generated';
import { commonStyles } from '#styles';
import { useStore } from '#store';

export const LowStockItems: React.FC = () => {
  const { theme } = useUnistyles();

  const { goBack, navigateTo } = useAppNavigation();

  const [refreshing, setRefreshing] = React.useState(false);

  const { selectedHomeId, getDefaultPantry } = useDefaultHome();
  const isLoggingOut = useStore(state => state.isLoggingOut);
  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId || isLoggingOut,
  });

  const pantry = getDefaultPantry(homeData);
  const { items, loading, refetch } = usePantryItems(pantry?.id);
  const [addToShoppingList] = useAddItemToShoppingListMutation();

  const lowStockItems = useMemo(() => {
    if (!items) return [];

    return items.filter(item => {
      if (!item.reservedQuantity) return false;
      return item.currentQuantity <= item.reservedQuantity;
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
      Alert.alert('Success', 'Item added to shopping list');
    } catch (error) {
      Alert.alert('Error', 'Failed to add to shopping list');
    }
  };

  return (
    <View style={commonStyles.container}>
      <ScreenHeader
        title="Low Stock Items"
        onBack={goBack}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        {loading || !items ? (
          <View style={[commonStyles.center, styles.loadingContainer]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : lowStockItems.length === 0 ? (
          <View style={[commonStyles.center, styles.emptyState]}>
            <Icon name="inventory" size={64} color={theme.colors.success} />
            <Text style={[commonStyles.body, styles.emptyText]}>
              All items are above minimum stock levels
            </Text>
          </View>
        ) : (
          lowStockItems.map(item => (
            <SwipeableItem
              key={item.id}
              onPress={() => navigateTo.pantryItemDetail({ itemId: item.id })}
            >
              <View style={[commonStyles.card, styles.itemCard]}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.item?.name}</Text>
                  <Text style={[commonStyles.caption, styles.itemDetails]}>
                    {item.currentQuantity} / {item.reservedQuantity}{' '}
                    {item.unit?.symbol}
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
          ))
        )}
      </ScrollView>
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
