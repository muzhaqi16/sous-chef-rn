import React, { useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { ItemCard } from './ItemCard';
import { ActionButtons } from './ActionButtons';
import { StyleSheet } from 'react-native-unistyles';
import {
  useCreatePantryItemMutation,
  useAddItemToShoppingListMutation,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useAppStore } from '#store/useAppStore';

// Cache updater for Pantry.itemsConnection
const addToPantryItemsConnection = createAddToParentConnectionUpdater<any>(
  'Pantry',
  'itemsConnection',
  'PantryItem',
);

// Cache updater for ShoppingList.itemsConnection
const addToShoppingListItemsConnection = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

interface SearchResultsProps {
  item: any;
  format?: string;
  onScanAnother: () => void;
  source?: 'pantry' | 'shoppingList';
  pantryId?: string;
  shoppingListId?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  item,
  format,
  onScanAnother,
  source,
  pantryId,
  shoppingListId,
}) => {
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const setPendingPantryScrollToTop = useAppStore(s => s.setPendingPantryScrollToTop);
  const [addToPantry] = useCreatePantryItemMutation({
    update: (cache, { data }: any) => {
      if (data?.createPantryItem && pantryId) {
        addToPantryItemsConnection(cache, pantryId, data.createPantryItem);
      }
    },
  });

  const [addToShoppingList] = useAddItemToShoppingListMutation({
    update: (cache, { data }) => {
      if (data?.addItemToShoppingList && shoppingListId) {
        // Add item to ShoppingList.itemsConnection using parent connection pattern
        addToShoppingListItemsConnection(cache, shoppingListId, data.addItemToShoppingList);
      }
    },
  });

  const handleAddItem = async () => {
    if (!source || isAdded) {
      return;
    }

    setIsLoading(true);

    try {
      if (source === 'pantry' && pantryId) {
        await addToPantry({
          variables: {
            input: {
              pantryId,
              itemId: item.id,
              quantity: item.netWeight ?? 1,
              itemName: item.name,
              itemUpc: item.upc || item.primaryUpc,
              itemDisplayUnitId: item.displayUnit?.id,
              itemNetWeight: item.netWeight,
              itemBrand: item.brandName,
              // NEW: netWeight fields for PantryItem
              netWeight: item.netWeight,
              netWeightUnitId: item.displayUnit?.id,
            },
          },
        });
        setIsAdded(true);
        setPendingPantryScrollToTop(true);
        onScanAnother();
      } else if (source === 'shoppingList' && shoppingListId) {
        await addToShoppingList({
          variables: {
            input: {
              shoppingListId,
              itemId: item.id,
              quantity: item.netWeight ?? 1,
              itemName: item.name,
              unitId: item.displayUnit?.id ?? item.unitId,
              unitName: item.displayUnit?.name,
              // NEW: brand and netWeight fields for ShoppingListItem
              brandId: item.brandId,
              brandName: item.brandName,
              netWeight: item.netWeight,
              netWeightUnitId: item.displayUnit?.id,
            },
          },
        });
        setIsAdded(true);
        onScanAnother();
      } else {
        Alert.alert('Error', 'Missing required information');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Determine button label based on source and state
  const getButtonLabel = () => {
    if (isAdded) {
      return 'Added';
    }

    switch (source) {
      case 'pantry':
        return 'Add to Pantry';
      case 'shoppingList':
        return 'Add to Shopping List';
      default:
        return 'Add Item';
    }
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
    >
      <ItemCard item={item} format={format} />

      <ActionButtons
        primaryAction={{
          label: getButtonLabel(),
          onPress: handleAddItem,
          disabled: isAdded,
          loading: isLoading,
        }}
        secondaryAction={{
          label: 'Scan Another',
          onPress: onScanAnother,
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create(theme => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
}));
