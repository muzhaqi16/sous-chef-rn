import React from 'react';
import {View, Text, Alert} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import {
  usePantryItemQuery,
  useRemoveItemFromPantryMutation,
  useAddItemToShoppingListMutation,
} from '#generated';
import {DetailTemplate} from '#components/templates/DetailTemplate';
import {useStore} from '#/store';
import {PantryItemDetailNavProp} from '#/navigation';

export const PantryItemDetail: React.FC = () => {
  const {styles, theme} = useStyles(detailStyles);
  const navigation = useNavigation<PantryItemDetailNavProp>();
  const route = useRoute();
  const {itemId} = route.params as {itemId: string};
  const {selectedShoppingListId} = useStore();

  const {data, loading} = usePantryItemQuery({
    variables: {id: itemId},
  });

  const [deleteItem] = useRemoveItemFromPantryMutation();
  const [addToShoppingList] = useAddItemToShoppingListMutation();

  const handleDelete = () => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem({
              variables: {
                id: itemId,
              },
            });
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const handleAddToShoppingList = async () => {
    try {
      await addToShoppingList({
        variables: {
          input: {
            shoppingListId: selectedShoppingListId || '',
            itemId: itemId,
            quantity: data?.pantryItem?.currentQuantity || 1,
            unitId: data?.pantryItem?.unit?.id || '',
            itemName: data?.pantryItem?.item?.name || '',
          },
        },
      });
      Alert.alert('Success', 'Item added to shopping list');
    } catch (error) {
      Alert.alert('Error', 'Failed to add to shopping list');
    }
  };

  const item = data?.pantryItem;

  const sections = [
    {
      content: (
        <View>
          <Text style={styles.itemName}>{item?.item?.name}</Text>
          {item?.item?.brands && (
            <Text style={styles.brandName}>
              {item.item.brands
                .filter(brand => brand.isPrimary)
                .map(brand => brand.brand.name)
                .join(', ')}
            </Text>
          )}
        </View>
      ),
    },
    {
      title: 'Details',
      content: (
        <View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Quantity</Text>
            <Text style={styles.detailValue}>
              {item?.currentQuantity} {item?.unit?.symbol}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Minimum Stock</Text>
            <Text style={styles.detailValue}>
              {item?.reservedQuantity} {item?.unit?.symbol}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Storage</Text>
            <Text style={styles.detailValue}>{item?.storageState}</Text>
          </View>
          {item?.storageLocation && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location</Text>
              <Text style={styles.detailValue}>{item.storageLocation}</Text>
            </View>
          )}
          {item?.expiresAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expires</Text>
              <Text style={styles.detailValue}>
                {new Date(item.expiresAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      ),
    },
  ];

  return (
    <DetailTemplate
      title="Item Details"
      onBack={() => navigation.goBack()}
      headerActions={[
        {
          icon: 'edit',
          onPress: () => navigation.navigate('EditPantryItem', {itemId}),
        },
        {
          icon: 'delete',
          onPress: handleDelete,
          color: theme.colors.error,
        },
      ]}
      sections={sections}
      primaryAction={{
        label: 'Add to Shopping List',
        icon: 'add-shopping-cart',
        onPress: handleAddToShoppingList,
      }}
    />
  );
};

const detailStyles = createStyleSheet(theme => ({
  itemName: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  brandName: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
  },
  notes: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    lineHeight: 24,
  },
}));
