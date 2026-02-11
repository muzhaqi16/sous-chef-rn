import React, { useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { ItemCard } from './ItemCard';
import { ActionButtons } from './ActionButtons';
import { StyleSheet } from 'react-native-unistyles';
import {
  useCreatePantryItemMutation,
  useRestockPantryItemMutation,
  useAddItemToShoppingListMutation,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
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
    errorPolicy: 'all',
    update: (cache, { data }: any) => {
      if (data?.createPantryItem && pantryId) {
        addToPantryItemsConnection(cache, pantryId, data.createPantryItem);
      }
    },
  });

  const [restockPantryItem] = useRestockPantryItemMutation({
    errorPolicy: 'all',
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
        const mutationInput = {
          pantryId,
          itemId: item.id,
          quantity: item.netWeight ?? 1,
          itemName: item.name,
          itemUpc: item.upc || item.primaryUpc,
          itemDisplayUnitId: item.displayUnit?.id,
          itemNetWeight: item.netWeight,
          itemBrand: item.brandName,
          netWeight: item.netWeight,
          netWeightUnitId: item.displayUnit?.id,
        };

        const result = await addToPantry({
          variables: { input: mutationInput },
        });

        // Handle duplicate pantry item
        if (result.error && isPantryItemDuplicateError(result.error)) {
          const duplicateInfo = getPantryItemDuplicateInfo(result.error);
          if (duplicateInfo) {
            setIsLoading(false);
            Alert.alert(
              'Item Already in Pantry',
              'This item is already in your pantry. Would you like to restock it or add a separate entry?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Restock',
                  onPress: async () => {
                    setIsLoading(true);
                    try {
                      await restockPantryItem({
                        variables: {
                          id: duplicateInfo.existingPantryItemId,
                          input: { quantity: mutationInput.quantity },
                        },
                      });
                      setIsAdded(true);
                      setPendingPantryScrollToTop(true);
                      onScanAnother();
                    } catch {
                      Alert.alert('Error', 'Failed to restock item. Please try again.');
                    } finally {
                      setIsLoading(false);
                    }
                  },
                },
                {
                  text: 'Add Anyway',
                  onPress: async () => {
                    setIsLoading(true);
                    try {
                      const retryResult = await addToPantry({
                        variables: {
                          input: { ...mutationInput, forceAdd: true } as any,
                        },
                      });
                      if (retryResult.data?.createPantryItem) {
                        setIsAdded(true);
                        setPendingPantryScrollToTop(true);
                        onScanAnother();
                      } else {
                        Alert.alert('Error', 'Failed to add item. Please try again.');
                      }
                    } catch {
                      Alert.alert('Error', 'Failed to add item. Please try again.');
                    } finally {
                      setIsLoading(false);
                    }
                  },
                },
              ],
            );
            return;
          }
        }

        if (result.data?.createPantryItem) {
          setIsAdded(true);
          setPendingPantryScrollToTop(true);
          onScanAnother();
        } else if (result.error) {
          Alert.alert('Error', 'Failed to add item. Please try again.');
        }
      } else if (source === 'shoppingList' && shoppingListId) {
        await addToShoppingList({
          variables: {
            input: {
              shoppingListId,
              itemId: item.id,
              quantity: item.netWeight ?? 1,
              itemName: item.name,
              unit: {
                unitId: item.displayUnit?.id ?? item.unitId,
                unitName: item.displayUnit?.name,
              },
              brand: item.brandId || item.brandName
                ? { brandId: item.brandId, brandName: item.brandName }
                : undefined,
              netWeight: item.netWeight
                ? { netWeight: item.netWeight, netWeightUnitId: item.displayUnit?.id }
                : undefined,
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
