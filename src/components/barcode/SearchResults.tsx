import React, { useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { ItemCard } from './ItemCard';
import { ActionButtons } from './ActionButtons';
import { StyleSheet } from 'react-native-unistyles';
import {
  useCreatePantryItemMutation,
  useAddItemToShoppingListMutation,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils';

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
  const [addToPantry] = useCreatePantryItemMutation({
    update: (cache, { data }: any) => {
      if (data?.createPantryItem && pantryId) {
        try {
          // Modify the Pantry.itemsConnection field in the cache
          const pantryCacheId = cache.identify({
            __typename: 'Pantry',
            id: pantryId,
          });

          if (!pantryCacheId) return;

          cache.modify({
            id: pantryCacheId,
            fields: {
              itemsConnection(
                existingConnection: any = {},
                { readField, toReference }: any,
              ) {
                const newItemRef = toReference(data.createPantryItem);
                const existingEdges = existingConnection?.edges || [];

                // Check if item already exists (avoid duplicates)
                const exists = existingEdges.some(
                  (edge: any) =>
                    readField('id', edge?.node) === data.createPantryItem.id,
                );

                if (exists) {
                  return existingConnection;
                }

                // Add new item at the beginning of the list
                const newEdge = {
                  __typename: 'PantryItemEdge',
                  node: newItemRef,
                  cursor: '', // Will be populated on next fetch
                };

                return {
                  ...existingConnection,
                  edges: [newEdge, ...existingEdges],
                  totalCount: (existingConnection?.totalCount || 0) + 1,
                };
              },
            },
          });
        } catch (error) {
          console.warn('Cache update failed:', error);
        }
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
        // Build weight input from catalog item if available
        const weightInput =
          item.netWeight && item.displayUnit?.id
            ? {
                packageWeight: item.netWeight,
                packageWeightUnitId: item.displayUnit.id,
              }
            : {};

        await addToPantry({
          variables: {
            input: {
              pantryId,
              itemId: item.id,
              initialQuantity: 1,
              itemName: item.name,
              unitId: item.unitId,
              itemUpc: item.upc || item.primaryUpc, // Include UPC from barcode scan
              ...weightInput, // Include weight info from catalog item
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
