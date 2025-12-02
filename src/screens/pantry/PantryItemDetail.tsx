import React from 'react';
import { View, Text, Alert, Image } from 'react-native';
import {
  useGetPantryItemQuery,
  useDeletePantryItemMutation,
  useAddItemToShoppingListMutation,
} from '#generated';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { FormattedItemSubtitle } from '#components';
import { useAppStore, selectSelectedShoppingListId } from '#store/useAppStore';
import { commonStyles } from '#styles';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { useAppNavigation } from '#hooks';
import { PantryStackParamList } from '#navigation/stacks/PantryStack';
import { getItemImageUrl } from '#utils/imageUtils';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';

export const PantryItemDetail: React.FC<{
  route: { params: PantryStackParamList['PantryItemDetail'] };
}> = ({ route }) => {
  const itemId = route.params.itemId;
  const { goBack, navigateTo } = useAppNavigation();
  const { theme } = useUnistyles();
  const selectedShoppingListId = useAppStore(selectSelectedShoppingListId);

  // Use cache-first policy - offlineQueryLink will handle offline behavior automatically
  const { data } = useGetPantryItemQuery({
    variables: { id: itemId },
    fetchPolicy: 'cache-first',
  });

  const [deleteItem] = useDeletePantryItemMutation();
  const [addToShoppingList] = useAddItemToShoppingListMutation({
    update: (cache, { data }) => {
      if (!data?.addItemToShoppingList || !selectedShoppingListId) return;

      try {
        const addToShoppingListItemsCache = createAddToParentConnectionUpdater(
          'ShoppingList',
          'itemsConnection',
          'ShoppingListItem',
        );
        addToShoppingListItemsCache(
          cache,
          selectedShoppingListId,
          data.addItemToShoppingList,
        );
      } catch (error) {
        console.warn('Cache update failed for addToShoppingList:', error);
      }
    },
  });

  const handleDelete = () => {
    Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
      { text: 'Cancel', style: 'cancel' },
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
            goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const handleAddToShoppingList = async () => {
    // Validate that a shopping list is selected
    if (!selectedShoppingListId) {
      Alert.alert(
        'No Shopping List Selected',
        'Please select a shopping list first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Go to Shopping Lists',
            onPress: () => navigateTo.shoppingListMain(),
          },
        ],
      );
      return;
    }

    try {
      await addToShoppingList({
        variables: {
          input: {
            shoppingListId: selectedShoppingListId,
            itemId: data?.pantryItem?.item?.id || '',
            quantity: data?.pantryItem?.currentQuantity || 1,
            unitId: data?.pantryItem?.unit?.id || '',
            itemName: data?.pantryItem?.item?.name || '',
          },
        },
      });
    } catch (error) {
      console.error('Failed to add to shopping list:', error);
      Alert.alert('Error', 'Failed to add to shopping list');
    }
  };

  const item = data?.pantryItem;

  // Use actualNetWeight if set (user override), otherwise fall back to catalog item weight
  const effectiveNetWeight = item?.actualNetWeight ?? item?.item?.netWeight;
  const effectiveWeightUnit = item?.actualNetWeightUnit ?? item?.item?.displayUnit;

  // Helper function to format item type
  const formatItemType = (type?: string) => {
    if (!type) return 'N/A';
    return type
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const imageUrl = getItemImageUrl(item?.item);

  const sections = [
    {
      content: (
        <View>
          {imageUrl && (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.itemImage}
                resizeMode="contain"
              />
            </View>
          )}
          <Text style={[commonStyles.title, styles.itemName]}>
            {item?.item?.name}
          </Text>
          {item?.item?.brands && item.item.brands.length > 0 && (
            <Text style={[commonStyles.subtitle, styles.brandName]}>
              {item.item.brands.map(brand => brand?.brand?.name).join(', ')}
            </Text>
          )}
          {item?.currentQuantity != null && (
            <View style={styles.quantityDescription}>
              <FormattedItemSubtitle
                quantity={item.currentQuantity}
                initialQuantity={item.initialQuantity}
                netWeight={effectiveNetWeight}
                unitSymbol={effectiveWeightUnit?.symbol || item.unit?.symbol}
                additionalInfo={item.storageState}
              />
            </View>
          )}
        </View>
      ),
    },
    {
      title: 'Quantity Details',
      content: (
        <View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Current
            </Text>
            <View>
              <FormattedItemSubtitle
                quantity={item?.currentQuantity}
                initialQuantity={item?.initialQuantity}
                netWeight={effectiveNetWeight}
                unitSymbol={effectiveWeightUnit?.symbol || item?.unit?.symbol}
              />
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Initial
            </Text>
            <View>
              <FormattedItemSubtitle
                quantity={item?.initialQuantity}
                netWeight={effectiveNetWeight}
                unitSymbol={effectiveWeightUnit?.symbol || item?.unit?.symbol}
              />
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Consumed
            </Text>
            <Text style={styles.detailValue}>
              {item?.consumedQuantity ?? 0} {item?.unit?.symbol ?? ''}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Minimum Stock
            </Text>
            <Text style={styles.detailValue}>
              {item?.reservedQuantity ?? 0} {item?.unit?.symbol ?? ''}
            </Text>
          </View>
          {effectiveNetWeight != null && effectiveWeightUnit && (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                Net Weight
              </Text>
              <Text style={styles.detailValue}>
                {effectiveNetWeight} {effectiveWeightUnit.symbol} per item
              </Text>
            </View>
          )}
        </View>
      ),
    },
    {
      title: 'Storage & Status',
      content: (
        <View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Storage
            </Text>
            <Text style={styles.detailValue}>
              {item?.storageState || 'N/A'}
            </Text>
          </View>
          {item?.storageLocation && (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                Location
              </Text>
              <Text style={styles.detailValue}>
                {typeof item.storageLocation === 'string'
                  ? item.storageLocation
                  : item.storageLocation.name}
              </Text>
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
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Added
            </Text>
            <Text style={styles.detailValue}>
              {new Date(item?.createdAt || '').toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[commonStyles.caption, styles.detailLabel]}>
              Item Type
            </Text>
            <Text style={styles.detailValue}>
              {formatItemType(item?.item?.type)}
            </Text>
          </View>
          {item?.isAutoReorder && (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                Auto-Reorder
              </Text>
              <Text style={styles.detailValue}>
                Enabled (at {item.autoReorderPoint ?? 0}{' '}
                {item?.unit?.symbol ?? ''})
              </Text>
            </View>
          )}
        </View>
      ),
    },
  ];

  // Add Item Info section if description or categories exist
  if (
    item?.item?.description ||
    (item?.item?.categories && item.item.categories.length > 0)
  ) {
    sections.push({
      title: 'Item Information',
      content: (
        <View>
          {item?.item?.description && (
            <View style={styles.descriptionContainer}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                Description
              </Text>
              <Text style={[commonStyles.body, styles.descriptionText]}>
                {item.item.description}
              </Text>
            </View>
          )}
          {item?.item?.categories && item.item.categories.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={[commonStyles.caption, styles.detailLabel]}>
                Categories
              </Text>
              <Text style={styles.detailValue}>
                {item.item.categories
                  .filter(cat => cat.isPrimary)
                  .map(cat => cat?.category?.name)
                  .join(', ') ||
                  item.item.categories
                    .map(cat => cat?.category?.name)
                    .join(', ')}
              </Text>
            </View>
          )}
        </View>
      ),
    });
  }

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
      onBack={() => goBack()}
      headerActions={[
        {
          icon: 'edit',
          onPress: () => navigateTo.pantryItem({ itemId }),
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
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  itemImage: {
    width: 200,
    height: 200,
  },
  itemName: {
    fontSize: theme.fonts.size['2xl'],
  },
  brandName: {
    marginTop: theme.spacing.xs,
  },
  quantityDescription: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
  descriptionContainer: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  descriptionText: {
    marginTop: theme.spacing.xs,
    lineHeight: theme.fonts.size.base * theme.typography.lineHeight.relaxed,
    color: theme.colors.textSecondary,
  },
}));
