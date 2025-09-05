import React from 'react';
import {View, Text, Alert} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  useGetPantryItemQuery,
  useRemoveItemFromPantryMutation,
  useAddItemToShoppingListMutation,
} from '#generated';
import {DetailTemplate} from '#components/templates/DetailTemplate';
import {useStore} from '#/store';
import {PantryItemDetailNavProp} from '#/navigation';
import {commonStyles} from '#styles';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';

export const PantryItemDetail: React.FC = () => {
  const navigation = useNavigation<PantryItemDetailNavProp>();
  const route = useRoute();
  const {theme} = useUnistyles();
  const {itemId} = route.params as {itemId: string};
  const {selectedShoppingListId} = useStore();

  const {data, loading} = useGetPantryItemQuery({
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
            itemId: data?.pantryItem?.item?.id || '',
            quantity: data?.pantryItem?.currentQuantity || 1,
            unitId: data?.pantryItem?.unit?.id || '',
            itemName: data?.pantryItem?.item?.name || '',
          },
        },
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to add to shopping list');
    }
  };

  const item = data?.pantryItem;

  const sections = [
    {
      content: (
        <View>
          <Text style={[commonStyles.title, styles.itemName]}>
            {item?.item?.name}
          </Text>
          {item?.item?.brands && item.item.brands.length > 0 && (
            <Text style={[commonStyles.subtitle, styles.brandName]}>
              {item.item.brands
                .filter(brand => brand.isPrimary)
                .map(brand => brand?.brand?.name)
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
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Quantity
            </Text>
            <Text style={styles.detailValue}>
              {item?.currentQuantity} {item?.unit?.symbol}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Minimum Stock
            </Text>
            <Text style={styles.detailValue}>
              {item?.reservedQuantity} {item?.unit?.symbol}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Storage
            </Text>
            <Text style={styles.detailValue}>{item?.storageState}</Text>
          </View>
          {item?.storageLocation && (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                Location
              </Text>
              <Text style={styles.detailValue}>{item.storageLocation}</Text>
            </View>
          )}
          {item?.expiresAt && (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                Expires
              </Text>
              <Text style={styles.detailValue}>
                {new Date(item.expiresAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      ),
    },
  ];

  if (item?.storageNotes) {
    sections.push({
      title: 'Notes',
      content: (
        <Text style={[commonStyles.body, styles.notes]}>
          {item.storageNotes}
        </Text>
      ),
    });
  }

  return (
    <DetailTemplate
      title="Item Details"
      onBack={() => navigation.goBack()}
      headerActions={[
        {
          icon: 'edit',
          onPress: () => navigation.navigate('PantryItem', {itemId}),
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

const styles = StyleSheet.create(theme => ({
  itemName: {
    fontSize: theme.fonts.size['2xl'],
  },
  brandName: {
    marginTop: theme.spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailLabel: {
    flex: 1,
  },
  detailValue: {
    fontSize: theme.fonts.size.sm,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
  },
  notes: {
    lineHeight: theme.fonts.size.base * theme.typography.lineHeight.relaxed,
  },
}));
