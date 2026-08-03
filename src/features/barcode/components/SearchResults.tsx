import React, { useState } from 'react';
import { errorService } from '#/services/errorService';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n/t';
import { ProductResultCard } from './ProductResultCard';
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
import {
  addNewItemToShoppingListCache,
  addOptimisticShoppingListItem,
  adoptServerShoppingListItemId,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { addToPantryItemsCache } from '#hooks/home/pantry/utils';
import { buildOptimisticPantryItem } from '#hooks/home/pantry/buildOptimisticPantryItem';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  getPantryItemDuplicateFromResult,
  promptPantryDuplicate,
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
  editActionLabel?: string;
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
  editActionLabel,
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
      update: (cache, { data }, { variables }) => {
        const payload = data?.addItemsToShoppingList;
        if (
          payload?.__typename === 'AddItemsToShoppingListPayload' &&
          shoppingListId &&
          variables
        ) {
          // Single add via the batch mutation — the created/merged row is the
          // one entry in `results`. Null when that item failed.
          const maskedItem = payload.results[0]?.item;
          if (!maskedItem) return;
          // Catalog-merge: adopt the server id, evicting the optimistic cuid if
          // the server merged into an existing row.
          adoptServerShoppingListItemId(
            cache,
            maskedItem.id,
            variables.input.items[0]?.id,
          );
          const shoppingListItem =
            cache.readFragment<SearchResults_ShoppingListItemFragment>({
              fragment: SearchResults_ShoppingListItemFragmentDoc,
              fragmentName: 'SearchResults_shoppingListItem',
              from: { __typename: 'ShoppingListItem', id: maskedItem.id },
            });
          if (shoppingListItem) {
            // bumpTotalItems:false — the optimistic add already counted it.
            addNewItemToShoppingListCache(
              cache,
              shoppingListId,
              shoppingListItem,
              false,
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
          // quantity is the CONTAINER COUNT (one scanned item = 1); the
          // per-container weight goes in the separate netWeight input below.
          // (Conflating them would record remainingNetWeight = qty × netWeight =
          // netWeight², double-counting the weight.)
          const quantity = 1;
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

          // Handle duplicate pantry item — the server reports it as a typed
          // DuplicatePantryItemError member in `data` (or the legacy
          // PANTRY_ITEM_ALREADY_EXISTS error); the shared helper checks both.
          const duplicateInfo = getPantryItemDuplicateFromResult(
            result.data?.createPantryItem,
            result.error,
          );
          if (duplicateInfo) {
            setIsLoading(false);
            // Already in the pantry → the server keeps the existing row, not
            // our optimistic item. Discard the one we wrote.
            safeEvict(client.cache, 'PantryItem', id);
            promptPantryDuplicate({
              onRestock: () => {
                executeWithLoadingState(
                  async () => {
                    await restockPantryItem({
                      variables: {
                        input: {
                          id: duplicateInfo.existingPantryItemId,
                          quantity,
                          // idempotencyKey dedups the restock ledger row on replay.
                          idempotencyKey: generateEntityId(),
                        },
                      },
                      // Local-first: queued offline, replayed as the canonical
                      // mutation (deduped by its idempotencyKey).
                      context: { localFirst: true },
                    });
                    setIsAdded(true);
                    setPendingPantryScrollToTop(true);
                    onScanAnother();
                  },
                  setIsLoading,
                  () => {
                    alertService.alert(
                      t('labels.error'),
                      t('errors.restockFailedRetry'),
                    );
                  },
                );
              },
              onAddAnyway: () => {
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
                        t('labels.error'),
                        t('errors.addItemFailedRetry'),
                      );
                    }
                  },
                  setIsLoading,
                  () => {
                    alertService.alert(
                      t('labels.error'),
                      t('errors.addItemFailedRetry'),
                    );
                  },
                );
              },
            });
            return;
          }

          const outcome = classifyCreateResult(result);
          if (outcome === 'rejected') {
            // The server refused the create — discard the item we wrote.
            safeEvict(client.cache, 'PantryItem', id);
            alertService.alert(
              t('labels.error'),
              t('errors.addItemFailedRetry'),
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
          // Write the item into the cache before firing, so it's on the list
          // when it comes into view — and survives a queued (offline / API-down)
          // create that replays later.
          executeCacheUpdate(
            () =>
              addOptimisticShoppingListItem(
                client.cache,
                shoppingListId,
                createOptimisticShoppingListItem(id, {
                  itemName: item.name,
                  // One scanned item = quantity 1; the per-unit weight is the
                  // separate netWeight, not the count.
                  quantity: 1,
                  itemId: item.id,
                  unitId: item.displayUnit?.id ?? item.unitId,
                  unitName: item.displayUnit?.name,
                }),
              ),
            'Add Shopping List Item (optimistic)',
          );

          const result = await addToShoppingList({
            variables: {
              input: {
                shoppingListId,
                items: [
                  {
                    id,
                    item: { itemId: item.id },
                    quantity: 1,
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
                ],
              },
            },
            context: { localFirst: true },
          });

          // A queued create (offline / API down) resolves with no data and no
          // error — that's success, it replays. Only a real rejection should
          // surface an error instead of a false "Added". errorPolicy:'all'
          // delivers rejections to the resolved result, so the reconciler
          // classifies it (and fully reverts the item — entity + list-stat
          // scalars) rather than relying on a throw.
          if (
            reconcileShoppingCreate(
              client.cache,
              shoppingListId,
              id,
              result,
            ) === 'reverted'
          ) {
            alertService.alert(
              t('labels.error'),
              t('errors.addItemFailedRetry'),
            );
            return;
          }
          setIsAdded(true);
          onScanAnother();
        } else {
          alertService.alert(
            t('labels.error'),
            t('errors.missingRequiredInfo'),
          );
        }
      },
      setIsLoading,
      error => {
        errorService.reportError(error, { operation: 'addItemFromSearch' });
        alertService.alert(t('labels.error'), t('errors.addItemFailed'));
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
      <ProductResultCard
        item={item}
        format={format}
        onEditItem={onEditItem}
        onCreateVariant={onCreateVariant}
        editActionLabel={editActionLabel}
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
