import React, { useState } from 'react';
import { ScrollView, Alert } from 'react-native';
import { ItemCard } from './ItemCard';
import { ActionButtons } from './ActionButtons';
import { StyleSheet } from 'react-native-unistyles';
import {
  useCreatePantryItemMutation,
  useRestockPantryItemMutation,
  useAddItemToShoppingListMutation,
  type CreatePantryItemInput,
  type PantryItemDisplayFragment,
} from '#generated';
import { createAddToParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
import { useAppStore } from '#store/useAppStore';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import type { ScannedItem } from '#/store/slices/barcodeScannerSlice';
import type { BarcodeSource } from '#/types/navigation';

// Cache updater for Pantry.itemsConnection
const addToPantryItemsConnection =
  createAddToParentConnectionUpdater<PantryItemDisplayFragment>(
    'Pantry',
    'itemsConnection',
    'PantryItem',
  );

export interface SearchResultsProps {
  item: ScannedItem;
  format?: string;
  onScanAnother: () => void;
  onEditItem?: () => void;
  onCreateVariant?: () => void;
  source?: BarcodeSource;
  pantryId?: string;
  shoppingListId?: string;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  item,
  format,
  onScanAnother,
  onEditItem,
  onCreateVariant,
  source,
  pantryId,
  shoppingListId,
}) => {
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const setPendingPantryScrollToTop = useAppStore(
    s => s.setPendingPantryScrollToTop,
  );
  const [addToPantry] = useCreatePantryItemMutation({
    errorPolicy: 'all',
    update: (cache, { data }) => {
      const pantryItem = data?.createPantryItem?.pantryItem;
      if (pantryItem && pantryId) {
        addToPantryItemsConnection(cache, pantryId, pantryItem);
      }
    },
  });

  const [restockPantryItem] = useRestockPantryItemMutation({
    errorPolicy: 'all',
  });

  const [addToShoppingList] = useAddItemToShoppingListMutation({
    update: (cache, { data }) => {
      const shoppingListItem = data?.addItemToShoppingList?.shoppingListItem;
      if (shoppingListItem && shoppingListId) {
        addNewItemToShoppingListCache(cache, shoppingListId, shoppingListItem);
      }
    },
  });

  const handleAddItem = () => {
    if (!source || isAdded) {
      return;
    }

    executeWithLoadingState(
      async () => {
        if (source === 'pantry' && pantryId) {
          const quantity = item.netWeight ?? 1;
          const mutationInput: CreatePantryItemInput = {
            pantryId,
            itemId: item.id,
            quantity,
            ...(item.netWeight != null && item.displayUnit?.id
              ? {
                  netWeight: {
                    netWeight: item.netWeight,
                    netWeightUnitId: item.displayUnit.id,
                  },
                }
              : {}),
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
                    onPress: () => {
                      executeWithLoadingState(
                        async () => {
                          await restockPantryItem({
                            variables: {
                              id: duplicateInfo.existingPantryItemId,
                              input: { quantity },
                            },
                          });
                          setIsAdded(true);
                          setPendingPantryScrollToTop(true);
                          onScanAnother();
                        },
                        setIsLoading,
                        () => {
                          Alert.alert(
                            'Error',
                            'Failed to restock item. Please try again.',
                          );
                        },
                      );
                    },
                  },
                  {
                    text: 'Add Anyway',
                    onPress: () => {
                      executeWithLoadingState(
                        async () => {
                          const retryResult = await addToPantry({
                            variables: {
                              input: { ...mutationInput, forceAdd: true },
                            },
                          });
                          if (retryResult.data?.createPantryItem?.success) {
                            setIsAdded(true);
                            setPendingPantryScrollToTop(true);
                            onScanAnother();
                          } else {
                            Alert.alert(
                              'Error',
                              'Failed to add item. Please try again.',
                            );
                          }
                        },
                        setIsLoading,
                        () => {
                          Alert.alert(
                            'Error',
                            'Failed to add item. Please try again.',
                          );
                        },
                      );
                    },
                  },
                ],
              );
              return;
            }
          }

          if (result.data?.createPantryItem?.success) {
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
                brand:
                  item.brandId || item.brandName
                    ? { brandId: item.brandId, brandName: item.brandName }
                    : undefined,
                netWeight: item.netWeight
                  ? {
                      netWeight: item.netWeight,
                      netWeightUnitId: item.displayUnit?.id,
                    }
                  : undefined,
              },
            },
          });
          setIsAdded(true);
          onScanAnother();
        } else {
          Alert.alert('Error', 'Missing required information');
        }
      },
      setIsLoading,
      error => {
        console.error('Error adding item:', error);
        Alert.alert('Error', 'Failed to add item. Please try again.');
      },
    );
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
      <ItemCard
        item={item}
        format={format}
        onEditItem={onEditItem}
        onCreateVariant={onCreateVariant}
      />

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
