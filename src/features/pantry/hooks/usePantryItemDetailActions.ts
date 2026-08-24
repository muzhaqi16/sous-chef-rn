import { useState, useEffect, useRef } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
// The module-level `t` takes a fallback string, not options, so an interpolated
// key has to go through the i18next instance directly — same split as
// src/utils/errorHandlers.ts.
import { getI18n } from '#/i18n/config';
import { errorService } from '#/services/errorService';
import { generateEntityId } from '#/utils/generateEntityId';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/screens/PantryItemDetail.generated';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  removeFromPantryItemsCache,
  adjustPantryItemCount,
} from '#/apollo/utils/pantryCacheUpdaters';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
  buildAddItemsReconcileUpdate,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { useConvertExpiredToWaste } from '#features/pantry/hooks/mutations/useConvertExpiredToWaste';
import { useConvertExpiredBatchesToWaste } from '#features/pantry/hooks/mutations/useConvertExpiredBatchesToWaste';
import { useAdjustPantryItemQuantity } from '#features/pantry/hooks/mutations/useAdjustPantryItemQuantity';
import { useCorrectPantryItemWeight } from '#features/pantry/hooks/mutations/useCorrectPantryItemWeight';

type PantryItemForActions =
  | {
      id: string;
      // `PantryItem.version` is `Int!`, and the server now requires it on every
      // update — a mutation sent without one overwrites concurrent edits.
      version: number;
      quantity?: number | null;
      unit?: {
        id: string;
        name?: string | null;
        symbol?: string | null;
      } | null;
      item?: { id?: string | null } | null;
      itemName?: string | null;
      activeBatchCount?: number | null;
    }
  | null
  | undefined;

export interface UsePantryItemDetailActionsParams {
  itemId: string;
  item: PantryItemForActions;
  selectedPantryId: string | null | undefined;
  selectedShoppingListId: string | null | undefined;
  goBack: () => void;
  onAddToShoppingListNeedsList: () => void;
}

type AddToListStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UsePantryItemDetailActionsResult {
  addToListStatus: AddToListStatus;
  adjustModalVisible: boolean;
  setAdjustModalVisible: (v: boolean) => void;
  correctWeightVisible: boolean;
  setCorrectWeightVisible: (v: boolean) => void;
  /** Server unreachable — correcting net weight has no offline replay path. */
  correctWeightUnavailable: boolean;
  handleDelete: () => void;
  handleAddToShoppingList: () => void;
  handleDiscardExpired: () => void;
  handleConfirmAdjust: (
    newQuantity: number,
    reason: string,
    remainingNetWeight?: number,
  ) => void;
  handleCorrectWeight: (
    netWeight: number,
    reason: string,
    netWeightUnitId?: string,
  ) => void;
}

/**
 * Owns every user-action handler on the pantry-item detail screen plus the
 * modal-visibility state. Splitting this off the screen lets the screen be a
 * thin layout while the action logic gets its own focused test surface.
 */
export function usePantryItemDetailActions({
  itemId,
  item,
  selectedPantryId,
  selectedShoppingListId,
  goBack,
  onAddToShoppingListNeedsList,
}: UsePantryItemDetailActionsParams): UsePantryItemDetailActionsResult {
  const client = useApolloClient();
  const [addToListStatus, setAddToListStatus] =
    useState<AddToListStatus>('idle');
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [correctWeightVisible, setCorrectWeightVisible] = useState(false);

  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const [deleteItem] = useMutation(DeletePantryItemDocument, {
    update: (cache, { data: mutationData }, { variables }) => {
      const payload = mutationData?.deletePantryItem;
      if (
        payload?.__typename !== 'DeletePantryItemPayload' ||
        !selectedPantryId ||
        !variables
      ) {
        return;
      }
      removeFromPantryItemsCache(cache, selectedPantryId, variables.input.id, {
        evictItem: true,
      });
      adjustPantryItemCount(cache, selectedPantryId, -1);
    },
  });

  const [addToShoppingList] = useMutation(
    AddItemToShoppingListFromPantryItemDocument,
    {
      // Reconcile swallows its own errors internally, so no wrap is needed here
      // (wrapping would bail the React Compiler out of this hook).
      update: buildAddItemsReconcileUpdate({ listId: selectedShoppingListId }),
    },
  );

  const { convertExpiredToWaste } = useConvertExpiredToWaste({
    onSuccess: () => {
      alertService.alert(t('labels.done'), t('success.expiredItemDiscarded'));
    },
  });

  const { convertExpiredBatches } = useConvertExpiredBatchesToWaste({
    onSuccess: () => {
      alertService.alert(
        t('labels.done'),
        t('success.expiredBatchesDiscarded'),
      );
    },
  });

  const { adjustQuantity } = useAdjustPantryItemQuantity();
  const { correctWeight, isApiUnavailable: correctWeightUnavailable } =
    useCorrectPantryItemWeight();

  const handleDelete = () => {
    alertService.alert(
      t('pantryItemDetail.deleteTitle'),
      t('labels.areYouSureYouWantToDeleteThisItem'),
      [
        { text: t('labels.cancel'), style: 'cancel' },
        {
          text: t('labels.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem({ variables: { input: { id: itemId } } });
              goBack();
            } catch (error) {
              errorService.reportError(error, {
                operation: 'PantryItemDetail.deleteItem',
              });
              alertService.alert(
                t('labels.error'),
                t('errors.deleteItemFailed'),
              );
            }
          },
        },
      ],
    );
  };

  const handleAddToShoppingList = async () => {
    if (!selectedShoppingListId) {
      onAddToShoppingListNeedsList();
      return;
    }

    if (addToListStatus === 'loading' || addToListStatus === 'success') {
      return;
    }

    setAddToListStatus('loading');

    const catalogItemId = item?.item?.id || '';
    const quantity = item?.quantity || 1;
    const unitInput = item?.unit?.id ? { unitId: item.unit.id } : undefined;
    const itemName = item?.itemName || '';
    // Generate the new item's id so a create that gets queued (offline / API
    // down) replays idempotently, keyed by this id.
    const id = generateEntityId();

    // Write the item into the cache before firing so it's on the list when it
    // comes into view — and survives a queued (offline / API-down) create that
    // replays later.
    // Built before the try: the `||`/`?.` below are value blocks, and the React
    // Compiler bails out of a hook when one appears inside a try body.
    const optimisticListItem = createOptimisticShoppingListItem(id, {
      itemName,
      quantity,
      itemId: catalogItemId || undefined,
      unitId: item?.unit?.id,
      unitName: item?.unit?.name,
    });
    try {
      addOptimisticShoppingListItem(
        client.cache,
        selectedShoppingListId,
        optimisticListItem,
      );
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Add Shopping List Item (optimistic)',
      });
    }

    // Built before the try — the ternary is a value block, and the React
    // Compiler bails out of this hook when one sits inside a try body.
    const addItemsOptions: Parameters<typeof addToShoppingList>[0] = {
      variables: {
        input: {
          shoppingListId: selectedShoppingListId,
          items: [
            {
              id,
              item: catalogItemId ? { itemId: catalogItemId } : { itemName },
              quantity,
              unit: unitInput,
            },
          ],
        },
      },
      context: { localFirst: true },
    };

    let result;
    try {
      result = await addToShoppingList(addItemsOptions);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'PantryItemDetail.addToShoppingList',
      });
    }

    // Queued (offline / API down) counts as success — it replays. Only a real
    // rejection is an error; don't show the success check on a refused create
    // (and discard the item we wrote). errorPolicy:'all' resolves rejections,
    // so the reconciler classifies the result rather than relying on a throw.
    const reverted =
      !result ||
      reconcileShoppingCreate(
        client.cache,
        selectedShoppingListId,
        id,
        result,
      ) === 'reverted';
    setAddToListStatus(reverted ? 'error' : 'success');
    statusTimeoutRef.current = setTimeout(
      () => setAddToListStatus('idle'),
      3000,
    );
  };

  const handleDiscardExpired = () => {
    if (!item) return;

    const hasBatches = (item.activeBatchCount ?? 0) > 0;

    if (hasBatches) {
      alertService.alert(
        t('pantryItemDetail.discardBatchesTitle'),
        t('pantryItemDetail.discardBatchesBody'),
        [
          { text: t('labels.cancel'), style: 'cancel' },
          {
            text: t('labels.discard'),
            style: 'destructive',
            onPress: () => convertExpiredBatches(item.id),
          },
        ],
      );
    } else {
      alertService.alert(
        t('pantryItemDetail.discardItemTitle'),
        getI18n().t('pantryItemDetail.discardItemBody', {
          quantity: item.quantity,
          unit: item.unit?.name || '',
        }),
        [
          { text: t('labels.cancel'), style: 'cancel' },
          {
            text: t('labels.discard'),
            style: 'destructive',
            onPress: () => convertExpiredToWaste(item.id),
          },
        ],
      );
    }
  };

  const handleConfirmAdjust = (
    newQuantity: number,
    reason: string,
    remainingNetWeight?: number,
  ) => {
    if (!item) return;
    adjustQuantity(
      item.id,
      newQuantity,
      reason,
      item.version,
      remainingNetWeight,
    );
  };

  const handleCorrectWeight = (
    netWeight: number,
    reason: string,
    netWeightUnitId?: string,
  ) => {
    if (!item) return;
    correctWeight(item.id, netWeight, reason, item.version, netWeightUnitId);
  };

  return {
    addToListStatus,
    adjustModalVisible,
    setAdjustModalVisible,
    correctWeightVisible,
    setCorrectWeightVisible,
    correctWeightUnavailable,
    handleDelete,
    handleAddToShoppingList,
    handleDiscardExpired,
    handleConfirmAdjust,
    handleCorrectWeight,
  };
}
