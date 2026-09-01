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
  addPantryItemLocally,
  revertOptimisticPantryItem,
} from '#/apollo/utils/pantryCacheUpdaters';
import { buildOptimisticPantryItem } from '#features/pantry/hooks/buildOptimisticPantryItem';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
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
          // Publishing and withdrawing the optimistic row are a pair, and the
          // force-add retry below has to do both again after the duplicate
          // branch has withdrawn it. Named so the halves cannot drift.
          const applyOptimisticPantryItem = () => {
            try {
              // Publishes the row AND counts it: the header's "N items" reads
              // `Pantry.stats.totalItems`, which the mutation's `update:`
              // callback never touches when the create is queued offline.
              addPantryItemLocally(
                client.cache,
                pantryId,
                optimisticPantryItem,
              );
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
            } catch (cacheError) {
              errorService.reportError(cacheError, {
                operation: 'Add Pantry Item (optimistic)',
              });
            }
          };
          const revertPantryItem = () => {
            revertOptimisticPantryItem(client.cache, pantryId, id);
          };

          applyOptimisticPantryItem();

          // `confirm` must run on every outcome, throws included, or the id
          // stays unconfirmed and suppresses the detail query for a visible row.
          // The helper is how a finalizer is written here: a bare `try/finally`
          // bails the React Compiler out of the whole component.
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
            // Already in the pantry: the server REFUSES the create and writes
            // nothing, so withdraw the row we published — count included.
            revertPantryItem();
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
                    // The duplicate branch withdrew the optimistic row; put it
                    // back before firing, or a force-add that queues offline
                    // shows nothing until the replay lands. The id is reused on
                    // purpose — the refusal committed no row, and reusing it is
                    // what makes the replay idempotent. Re-marking is required
                    // because the first attempt's cleanup already confirmed it.
                    unconfirmedCreates.mark(id);
                    applyOptimisticPantryItem();
                    const retryResult = await addToPantry({
                      variables: {
                        input: { ...mutationInput, forceAdd: true },
                      },
                      // Same local-first contract as the first attempt: without
                      // it the force-add is the one add here that cannot queue.
                      context: { localFirst: true },
                    });
                    // `alertIfRejected`, not a payload-typename check: a reused
                    // id whose first attempt did commit returns
                    // ConflictError(IDEMPOTENT_REPLAY), a successful no-op, and
                    // a queued create must keep its row.
                    if (
                      alertIfRejected(
                        retryResult,
                        t('errors.addItemFailedRetry'),
                      )
                    ) {
                      revertPantryItem();
                      return;
                    }
                    setIsAdded(true);
                    setPendingPantryScrollToTop(true);
                    onScanAnother();
                  },
                  setIsLoading,
                  () => {
                    alertService.alert(
                      t('labels.error'),
                      t('errors.addItemFailedRetry'),
                    );
                  },
                  // Released on EVERY outcome of the retry, a throw included —
                  // a mark left standing suppresses the detail query for a row
                  // the user can see, for the rest of the session.
                  () => unconfirmedCreates.confirm(id),
                );
              },
            });
            return;
          }

          const outcome = classifyCreateResult(result);
          if (outcome === 'rejected') {
            // The server refused the create — discard the item we wrote,
            // count included.
            revertPantryItem();
            // The document selects `... on ValidationError { field }`, so route
            // the refusal to its localized `errors.field.*` copy instead of a
            // fixed string. `alertIfRejected` because this mutation has no
            // `onError` — the resolved-`error` case needs telling too.
            alertIfRejected(result, t('errors.addItemFailedRetry'));
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
         * No source means no destination for the item. Only a deep link
         * (`scan/result`) can land here without one, and a button that silently
         * no-ops is worse than none.
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
