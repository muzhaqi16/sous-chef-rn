import React, { useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { ItemCard } from './ItemCard';
import { ActionButtons } from './ActionButtons';
import { StyleSheet } from 'react-native-unistyles';
import { ApolloCache } from '@apollo/client';
import {
  useCreatePantryItemMutation,
  useAddItemToShoppingListMutation,
  GetPantryItemsDocument,
  GetPantryItemsQuery,
  GetShoppingListItemsDocument,
  GetShoppingListItemsQuery,
} from '#generated';

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
  const [addToPantry] = useCreatePantryItemMutation({
    update: (cache: ApolloCache, { data }: any) => {
      if (data?.createPantryItem && pantryId) {
        // Read the existing pantry items from cache
        const existingData = cache.readQuery<GetPantryItemsQuery>({
          query: GetPantryItemsDocument,
          variables: { pantryId },
        });

        if (existingData?.pantryItems) {
          // Add the new item to the cache
          cache.writeQuery<GetPantryItemsQuery>({
            query: GetPantryItemsDocument,
            variables: { pantryId },
            data: {
              pantryItems: [...existingData.pantryItems, data.createPantryItem],
            },
          });
        }
      }
    },
  });

  const [addToShoppingList] = useAddItemToShoppingListMutation({
    update: (cache: ApolloCache, { data }: any) => {
      if (data?.addItemToShoppingList && shoppingListId) {
        // Read the existing shopping list items from cache
        const existingData = cache.readQuery<GetShoppingListItemsQuery>({
          query: GetShoppingListItemsDocument,
          variables: { listId: shoppingListId },
        });

        if (existingData?.shoppingListItems) {
          // Add the new item to the cache
          cache.writeQuery<GetShoppingListItemsQuery>({
            query: GetShoppingListItemsDocument,
            variables: { listId: shoppingListId },
            data: {
              shoppingListItems: [
                ...existingData.shoppingListItems,
                data.addItemToShoppingList,
              ],
            },
          });
        }
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
        // Debug: Log the item structure
        console.log('Item data:', JSON.stringify(item, null, 2));

        await addToPantry({
          variables: {
            input: {
              pantryId,
              itemId: item.id,
              initialQuantity: 1,
              itemName: item.name,
              unitId: item.unitId,
            },
          },
        });
        setIsAdded(true);
      } else if (source === 'shoppingList' && shoppingListId) {
        // Get the default unit or first unit from the item
        const defaultUnit =
          item.units?.find((u: any) => u.isDefault) || item.units?.[0];
        const unitId = defaultUnit?.unitId;
        const unitName = defaultUnit?.unit?.symbol;

        await addToShoppingList({
          variables: {
            input: {
              shoppingListId,
              itemId: item.id,
              quantity: 1,
              itemName: item.name,
              unitId: unitId,
              unitName: unitName,
            },
          },
        });
        setIsAdded(true);
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
