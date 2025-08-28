import React, {useMemo} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import Icon from '@react-native-vector-icons/material-icons';
import {useNavigation} from '@react-navigation/native';
import {SwipeableItem} from '#components';
import {usePantryItems, useDefaultHome} from '#hooks';
import {useGetHomeQuery, useAddItemToShoppingListMutation} from '#generated';
import {LowStockItemsNavProp} from '#navigation/types';

export const LowStockItems: React.FC = () => {
  const {theme} = useUnistyles();
  const navigation = useNavigation<LowStockItemsNavProp>();
  const [refreshing, setRefreshing] = React.useState(false);

  const {selectedHomeId, getDefaultPantry} = useDefaultHome();
  const {data: homeData} = useGetHomeQuery({
    variables: {homeId: selectedHomeId ?? ''},
    skip: !selectedHomeId,
  });

  const pantry = getDefaultPantry(homeData);
  const {items, refetch} = usePantryItems(pantry?.id);
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
        variables: {input: {shoppingListId: '', itemId}},
      });
      Alert.alert('Success', 'Item added to shopping list');
    } catch (error) {
      Alert.alert('Error', 'Failed to add to shopping list');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Low Stock Items</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }>
        {lowStockItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="inventory" size={64} color={theme.colors.success} />
            <Text style={styles.emptyText}>
              All items are above minimum stock levels
            </Text>
          </View>
        ) : (
          lowStockItems.map(item => (
            <SwipeableItem
              key={item.id}
              onPress={() =>
                navigation.navigate('PantryItemDetail', {itemId: item.id})
              }>
              <View style={styles.itemCard}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.item?.name}</Text>
                  <Text style={styles.itemDetails}>
                    {item.currentQuantity} / {item.reservedQuantity}{' '}
                    {item.unit?.symbol}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleAddToList(item.id)}>
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
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    marginBottom: 8,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  itemDetails: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
}));
