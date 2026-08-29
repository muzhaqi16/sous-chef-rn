import React, { useState } from 'react';
import { errorService } from '#/services/errorService';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
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
  adoptServerEntityId,
} from '#/apollo/utils/cacheUpdaters';
import {
  addNewItemToShoppingListCache,
  addOptimisticShoppingListItem,
  adoptServerShoppingListItemId,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import {
  addToPantryItemsCache,
  adjustPantryItemCount,
} from '#/apollo/utils/pantryCacheUpdaters';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  getPantryItemDuplicateFromResult,
  promptPantryDuplicate,
} from '#/utils/errors/pantryItemDuplicate';
import { useAppStore } from '#store/useAppStore';
import { generateEntityId } from '#/utils/generateEntityId';
import { unconfirmedCreates } from '#/apollo/offline/unconfirmedCreates';
import { writePantryItemDetailStub } from '#features/pantry/hooks/writePantryItemDetailStub';
import { AcquisitionMethod } from '#/graphql/generated/schemaTypes';
import {
  executeAsyncWithCleanup,
  executeWithLoadingState,
} from '#/utils/finallyHelpers';
import type { ScannedItem } from '#features/barcode/store/barcodeScannerStore';
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
  const { t } = useTranslation();
  const [isAdded, setIsAdded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const client = useApolloClient();
  const setPendingPantryScrollToTop = useAppStore(
    s => s.setPendingPantryScrollToTop,
  );
  const [addToPantry] = useMutation(BarcodeCreatePantryItemDocument, {
    update: (cache, { data }, { variables }) => {
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
        // The connection add dedupes BY ID, so a server-resolved id divergence
        // would leave the client cuid as a second, permanently unresolvable
        // edge. Client id read off this mutation's own variables.
        adoptServerEntityId(
          cache,
          'PantryItem',
          maskedPantryItem.id,
          variables?.input?.id,
        );
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
          // The optimistic write below publishes this id to
          // `Pantry.itemsConnection`, making the row tappable into a detail
          // screen that queries by it. See `unconfirmedCreates`.
          unconfirmedCreates.mark(id);
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
          // Built before the try: `?.`/`??` are value blocks, and the React
          // Compiler bails out of this component when one is inside a try body.
          const optimisticPantryItem = buildOptimisticPantryItem(
            id,
            {
              pantryId,
              itemName: item.name,
              itemId: item.id,
              quantity,
              unitId: item.displayUnit?.id ?? item.unitId,
            },
            client.cache,
          );
          try {
            addToPantryItemsCache(client.cache, pantryId, optimisticPantryItem);
            // Detail-shape the same row so tapping it renders from cache
            // instead of querying an id the server does not have yet. A
            // scanned add always carries a catalog item, so `item` resolves to
            // the real entity rather than a locally-minted one.
            writePantryItemDetailStub(client.cache, id, {
              itemId: item.id,
              itemName: item.name,
              acquisitionMethod: AcquisitionMethod.BarcodeScan,
              quantity,
            });
            // The connection updater moves the LIST; the header's "N items"
            // reads `Pantry.stats.totalItems`, which only the mutation's
            // `update:` callback touched — and that never runs when the create
            // is queued offline. Same defect as the add sheet had, on the third
            // create path. It sits beside the optimistic row so both move
            // together whether or not the create reaches the server.
            adjustPantryItemCount(client.cache, pantryId, 1);
          } catch (cacheError) {
            errorService.reportError(cacheError, {
              operation: 'Add Pantry Item (optimistic)',
            });
          }

          // Released on every outcome — including a THROW. `confirm` sitting
          // after a bare `await` was released on the paths that return, and on
          // none of the paths that don't: a transport throw left the id marked
          // unconfirmed for the rest of the session, which suppresses the
          // detail query for a row the user can see. The helper is how a
          // finalizer is written here at all — a bare `try/finally` bails the
          // React Compiler out of the whole component.
          let result!: Awaited<ReturnType<typeof addToPantry>>;
          await executeAsyncWithCleanup(
            async () => {
              result = await addToPantry({
                variables: { input: mutationInput },
                context: { localFirst: true },
              });
            },
            () => unconfirmedCreates.confirm(id),
            // Rethrow so the outer handler still reports it; the cleanup above
            // has already run by then.
            error => {
              throw error;
            },
          );

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
            // our optimistic item. Discard the one we wrote, count included.
            safeEvict(client.cache, 'PantryItem', id);
            adjustPantryItemCount(client.cache, pantryId, -1);
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
            // The server refused the create — discard the item we wrote,
            // count included.
            safeEvict(client.cache, 'PantryItem', id);
            adjustPantryItemCount(client.cache, pantryId, -1);
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
          // Built before the try: `?.`/`??` are value blocks, and the React
          // Compiler bails out of this component when one is inside a try body.
          const optimisticListItem = createOptimisticShoppingListItem(id, {
            shoppingListId,
            itemName: item.name,
            // One scanned item = quantity 1; the per-unit weight is the
            // separate netWeight, not the count.
            quantity: 1,
            itemId: item.id,
            unitId: item.displayUnit?.id ?? item.unitId,
            unitName: item.displayUnit?.name,
          });
          try {
            addOptimisticShoppingListItem(
              client.cache,
              shoppingListId,
              optimisticListItem,
            );
          } catch (cacheError) {
            errorService.reportError(cacheError, {
              operation: 'Add Shopping List Item (optimistic)',
            });
          }

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
      return t('barcode.added');
    }

    return source === 'pantry'
      ? t('addItemSheet.addToPantry')
      : t('labels.addToShoppingList');
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
        /*
         * No source means we do not know where the item would go. This screen is
         * only ever reached from a pantry or a shopping list, both of which pass
         * one — but the route is deep-linkable (`scan/result`), so a link can
         * land a user here with nothing to add to. Offering a button that
         * silently no-ops is worse than offering none; they can still read the
         * product card and scan another.
         */
        primaryAction={
          source
            ? {
                label: getButtonLabel(),
                onPress: handleAddItem,
                disabled: isAdded,
                loading: isLoading,
              }
            : undefined
        }
        secondaryAction={{
          label: t('labels.scanAnother'),
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
