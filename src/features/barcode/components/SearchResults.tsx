import React, { useState } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { ItemCard } from './ItemCard';
import { ActionButtons } from './ActionButtons';
import { StyleSheet } from 'react-native-unistyles';
import {
  BarcodeAddItemToShoppingListDocument,
  BarcodeCreatePantryItemDocument,
  BarcodeRestockPantryItemDocument,
  SearchResults_PantryItemFragmentDoc,
  SearchResults_ShoppingListItemFragmentDoc,
  type SearchResults_PantryItemFragment,
  type SearchResults_ShoppingListItemFragment,
} from './SearchResults.generated';
import type { CreatePantryItemInput } from '#/graphql/generated/schemaTypes';
import {
  createAddToParentConnectionUpdater,
  safeEvict,
} from '#/apollo/utils/cacheUpdaters';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import { addToPantryItemsCache } from '#hooks/home/pantry/utils';
import { buildOptimisticPantryItem } from '#hooks/home/pantry/buildOptimisticPantryItem';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  isPantryItemDuplicateError,
  getPantryItemDuplicateInfo,
} from '#/utils/errors/pantryItemDuplicate';
import { useAppStore } from '#store/useAppStore';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  executeCacheUpdate,
  executeWithLoadingState,
} from '#/utils/compilerSafeWrappers';
import type { ScannedItem } from '#store/slices/barcodeScannerSlice';
import type { BarcodeSource } from '#/types/navigation';
import { ScrollView } from 'react-native';

// Cache updater for Pantry.itemsConnection — only reads `{ id }` from the
// new item, so the local SearchResults_pantryItem fragment is sufficient.
const addToPantryItemsConnection =
  createAddToParentConnectionUpdater<SearchResults_PantryItemFragment>(
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
  const client = useApolloClient();
  const setPendingPantryScrollToTop = useAppStore(
    s => s.setPendingPantryScrollToTop,
  );
  const [addToPantry] = useMutation(BarcodeCreatePantryItemDocument, {
    update: (cache, { data }) => {
      const payload = data?.createPantryItem;
      if (payload?.__typename === 'CreatePantryItemPayload' && pantryId) {
        const maskedPantryItem = payload.pantryItem;
        // Materialize the masked fragment ref so the cache updater can read
        // `id`. Use the cache-key form — passing the masked ref directly
        // silently returns partial/null data under dataMasking.
        const pantryItem = cache.readFragment<SearchResults_PantryItemFragment>(
          {
            fragment: SearchResults_PantryItemFragmentDoc,
            fragmentName: 'SearchResults_pantryItem',
            from: { __typename: 'PantryItem', id: maskedPantryItem.id },
          },
        );
        if (pantryItem) {
          addToPantryItemsConnection(cache, pantryId, pantryItem);
        }
      }
    },
  });

  const [restockPantryItem] = useMutation(BarcodeRestockPantryItemDocument, {});

  const [addToShoppingList] = useMutation(
    BarcodeAddItemToShoppingListDocument,
    {
      update: (cache, { data }) => {
        const payload = data?.addItemToShoppingList;
        if (
          payload?.__typename === 'AddItemToShoppingListPayload' &&
          shoppingListId
        ) {
          const maskedItem = payload.shoppingListItem;
          const shoppingListItem =
            cache.readFragment<SearchResults_ShoppingListItemFragment>({
              fragment: SearchResults_ShoppingListItemFragmentDoc,
              fragmentName: 'SearchResults_shoppingListItem',
              from: { __typename: 'ShoppingListItem', id: maskedItem.id },
            });
          if (shoppingListItem) {
            addNewItemToShoppingListCache(
              cache,
              shoppingListId,
              shoppingListItem,
            );
          }
        }
      },
    },
  );

  const handleAddItem = () => {
    if (!source || isAdded) {
      return;
    }

    executeWithLoadingState(
      async () => {
        if (source === 'pantry' && pantryId) {
          const quantity = item.netWeight ?? 1;
          // Generate the item's id so a create that gets queued (API blips after
          // the barcode lookup) replays idempotently, keyed by this id.
          const id = generateEntityId();
          const mutationInput: CreatePantryItemInput = {
            id,
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

          // Write the item into the cache before firing, so it's already there
          // when the pantry comes into view — and survives a queued create.
          executeCacheUpdate(
            () =>
              addToPantryItemsCache(
                client.cache,
                pantryId,
                buildOptimisticPantryItem(id, {
                  pantryId,
                  itemName: item.name,
                  itemId: item.id,
                  quantity,
                  unitId: item.displayUnit?.id ?? item.unitId,
                }),
              ),
            'Add Pantry Item (optimistic)',
          );

          const result = await addToPantry({
            variables: { input: mutationInput },
            context: { localFirst: true },
          });

          // Handle duplicate pantry item
          if (result.error && isPantryItemDuplicateError(result.error)) {
            const duplicateInfo = getPantryItemDuplicateInfo(result.error);
            if (duplicateInfo) {
              setIsLoading(false);
              // Already in the pantry → the server keeps the existing row, not
              // our optimistic item. Discard the one we wrote.
              safeEvict(client.cache, 'PantryItem', id);
              alertService.alert(
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
                              input: {
                                id: duplicateInfo.existingPantryItemId,
                                quantity,
                              },
                            },
                          });
                          setIsAdded(true);
                          setPendingPantryScrollToTop(true);
                          onScanAnother();
                        },
                        setIsLoading,
                        () => {
                          alertService.alert(
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
                          if (
                            retryResult.data?.createPantryItem?.__typename ===
                            'CreatePantryItemPayload'
                          ) {
                            setIsAdded(true);
                            setPendingPantryScrollToTop(true);
                            onScanAnother();
                          } else {
                            alertService.alert(
                              'Error',
                              'Failed to add item. Please try again.',
                            );
                          }
                        },
                        setIsLoading,
                        () => {
                          alertService.alert(
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

          const outcome = classifyCreateResult(
            result,
            'createPantryItem',
            'CreatePantryItemPayload',
          );
          if (outcome === 'rejected') {
            // The server refused the create — discard the item we wrote.
            safeEvict(client.cache, 'PantryItem', id);
            alertService.alert(
              'Error',
              'Failed to add item. Please try again.',
            );
          } else {
            // 'created' or 'queued' — the item stays (and replays if it was
            // queued offline); confirm and move on.
            setIsAdded(true);
            setPendingPantryScrollToTop(true);
            onScanAnother();
          }
        } else if (source === 'shoppingList' && shoppingListId) {
          // Generate the item's id so a create that gets queued (API blips after
          // the barcode lookup) replays idempotently, keyed by this id.
          const id = generateEntityId();
          await addToShoppingList({
            variables: {
              input: {
                id,
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
            context: { localFirst: true },
          });
          setIsAdded(true);
          onScanAnother();
        } else {
          alertService.alert('Error', 'Missing required information');
        }
      },
      setIsLoading,
      error => {
        console.error('Error adding item:', error);
        alertService.alert('Error', 'Failed to add item. Please try again.');
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
