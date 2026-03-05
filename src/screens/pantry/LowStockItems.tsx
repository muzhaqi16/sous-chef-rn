import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  RefreshControl,
  Alert } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '#utils/iconUtils';
import { SwipeableItem } from '#components/molecules/SwipeableItem/SwipeableItem';
import { Header } from '#components/molecules/Header';
import { PantryItemSkeleton } from '#components/base/Skeleton/PantryItemSkeleton';
import { usePantryManagement } from '#hooks/home/pantry/usePantryManagement';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useAddItemToShoppingListMutation } from '#generated';
import { useCurrentPantry } from '#hooks/pantry/useCurrentPantry';
import { useAddLowStockToShoppingList } from '#hooks/pantry/useAddLowStockToShoppingList';
import { commonStyles } from '#/styles/commonStyles';

const keyExtractor = (item: { id: string }) => item.id;

export const LowStockItems: React.FC = () => {
  const { theme } = useUnistyles();

  const { goBack, navigateTo } = useAppNavigation();

  const [refreshing, setRefreshing] = React.useState(false);

  // Use cache-only hook for pantry resolution (no network requests)
  // This prevents query cascade when switching between pantry screens
  const { pantry, selectedHomeId } = useCurrentPantry();

  const { addLowStockToShoppingList, loading: addAllLoading } =
    useAddLowStockToShoppingList({ homeId: selectedHomeId ?? undefined });

  const { items: allItems, loading, refetch, loadMore, hasMore, isLoadingMore } = usePantryManagement(pantry?.id);
  const [addToShoppingList] = useAddItemToShoppingListMutation();

  // Progressively load all pages so the isLowStock filter sees every item
  useEffect(() => {
    if (hasMore && !isLoadingMore && !loading) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loading, loadMore]);

  const lowStockItems = (() => {
    if (!allItems) return [];

    return allItems.filter(item => item.isLowStock);
  })();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAddToList = async (itemId: string) => {
    try {
      await addToShoppingList({
        variables: { input: { shoppingListId: '', itemId } } });
    } catch {
      Alert.alert('Error', 'Failed to add to shopping list');
    }
  };

  const renderLowStockItem = 
    ({ item }: { item: (typeof lowStockItems)[number] }) => (
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
          <Pressable
            onPress={() => handleAddToList(item.id)}
            style={({pressed}) => [styles.actionButton, pressed && styles.pressed]}
          >
            <Icon
              name="cart-outline"
              size={20}
              color={theme.colors.primary}
            />
          </Pressable>
        </View>
      </SwipeableItem>
    );

  return (
    <View style={commonStyles.container}>
      <Header
        title="Low Stock Items"
        onBack={goBack}
        centerTitle
        rightActions={[
          {
            icon: 'cart-outline',
            onPress: addLowStockToShoppingList,
            loading: addAllLoading,
            testID: 'add-all-low-stock' },
        ]}
      />

      <FlashList
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        data={lowStockItems}
        keyExtractor={keyExtractor}
        drawDistance={200}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          loading || !allItems ? (
            <View style={styles.skeletonContainer}>
              {[1, 2, 3, 4, 5].map(key => (
                <PantryItemSkeleton key={key} />
              ))}
            </View>
          ) : (
            <View style={[commonStyles.center, styles.emptyState]}>
              <Icon name="cube-outline" size={64} color={theme.colors.success} />
              <Text style={[commonStyles.body, styles.emptyText]}>
                All items are above minimum stock levels
              </Text>
            </View>
          )
        }
        renderItem={renderLowStockItem}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1 },
  scrollContent: {
    padding: theme.spacing.md },
  emptyState: {
    padding: theme.spacing['2xl'] },
  emptyText: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    textAlign: 'center' },
  loadingContainer: {
    padding: theme.spacing['2xl'] },
  skeletonContainer: {
    gap: theme.spacing.sm },
  itemCard: {
    ...commonStyles.rowSpaceBetween,
    marginBottom: theme.spacing.sm },
  itemInfo: {
    flex: 1 },
  itemName: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary },
  itemDetails: {
    marginTop: theme.spacing.xs },
  actionButton: {
    padding: theme.spacing.xs },
  pressed: {
    opacity: theme.opacity.pressed } }));
