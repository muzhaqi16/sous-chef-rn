import { useState, useEffect, useRef } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n/t';
import { errorService } from '#/services/errorService';
import {
  executeCacheUpdate,
  executeMutation,
} from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/screens/PantryItemDetail.generated';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { removeFromPantryItemsCache } from '#hooks/home/pantry/utils';
import {
  addOptimisticShoppingListItem,
  createOptimisticShoppingListItem,
  reconcileShoppingCreate,
  reconcileShoppingItemCreateUpdate,
} from '#/apollo/utils/shoppingListCacheUpdaters';
import { useConvertExpiredToWaste } from '#features/pantry/hooks/mutations/useConvertExpiredToWaste';
import { useConvertExpiredBatchesToWaste } from '#features/pantry/hooks/mutations/useConvertExpiredBatchesToWaste';
import { useAdjustPantryItemQuantity } from '#features/pantry/hooks/mutations/useAdjustPantryItemQuantity';
import { useCorrectPantryItemWeight } from '#features/pantry/hooks/mutations/useCorrectPantryItemWeight';

type PantryItemForActions =
  | {
      id: string;
      version?: number | null;
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
      cache.modify({
        id: cache.identify({ __typename: 'Pantry', id: selectedPantryId }),
        fields: {
          stats(existingStats?: {
            totalItems?: number;
            readonly __ref?: string;
          }) {
            if (!existingStats) return existingStats;
            return {
              ...existingStats,
              totalItems: Math.max(0, (existingStats.totalItems || 0) - 1),
            };
          },
        },
      });
    },
  });

  const [addToShoppingList] = useMutation(
    AddItemToShoppingListFromPantryItemDocument,
    {
      update: (cache, { data: mutationData }, { variables }) => {
        const payload = mutationData?.addItemsToShoppingList;
        if (
          payload?.__typename !== 'AddItemsToShoppingListPayload' ||
          !selectedShoppingListId ||
          !variables
        ) {
          return;
        }
        // Single add via the batch mutation — the created/merged row is the one
        // entry in `results`. Null when that item failed.
        const shoppingListItem = payload.results[0]?.item;
        if (!shoppingListItem) return;
        // Swallows its own errors internally, so no try/catch is needed here
        // (wrapping would bail the React Compiler out of this hook).
        reconcileShoppingItemCreateUpdate(
          cache,
          selectedShoppingListId,
          shoppingListItem,
          variables.input.items[0]?.id,
        );
      },
    },
  );

  const { convertExpiredToWaste } = useConvertExpiredToWaste({
    onSuccess: () => {
      alertService.alert('Done', 'Expired item has been discarded.');
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
  const { correctWeight } = useCorrectPantryItemWeight();

  const handleDelete = () => {
    alertService.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            executeMutation(
              async () => {
                await deleteItem({ variables: { input: { id: itemId } } });
                goBack();
              },
              error => {
                errorService.reportError(error, {
                  operation: 'PantryItemDetail.deleteItem',
                });
                alertService.alert(
                  t('labels.error'),
                  t('errors.deleteItemFailed'),
                );
              },
            );
          },
        },
      ],
    );
  };

  const handleAddToShoppingList = () => {
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
    executeCacheUpdate(
      () =>
        addOptimisticShoppingListItem(
          client.cache,
          selectedShoppingListId,
          createOptimisticShoppingListItem(id, {
            itemName,
            quantity,
            itemId: catalogItemId || undefined,
            unitId: item?.unit?.id,
            unitName: item?.unit?.name,
          }),
        ),
      'Add Shopping List Item (optimistic)',
    );

    executeMutation(
      async () => {
        const result = await addToShoppingList({
          variables: {
            input: {
              shoppingListId: selectedShoppingListId,
              items: [
                {
                  id,
                  itemId: catalogItemId,
                  quantity,
                  unit: unitInput,
                  itemName,
                },
              ],
            },
          },
          context: { localFirst: true },
        });
        // Queued (offline / API down) counts as success — it replays. Only a
        // real rejection is an error; don't show the success check on a refused
        // create (and discard the item we wrote). errorPolicy:'all' resolves
        // rejections, so the reconciler classifies the result rather than relying
        // on a throw.
        if (
          reconcileShoppingCreate(
            client.cache,
            selectedShoppingListId,
            id,
            result,
          ) === 'reverted'
        ) {
          setAddToListStatus('error');
        } else {
          setAddToListStatus('success');
        }
        statusTimeoutRef.current = setTimeout(
          () => setAddToListStatus('idle'),
          3000,
        );
      },
      error => {
        errorService.reportError(error, {
          operation: 'PantryItemDetail.addToShoppingList',
        });
        setAddToListStatus('error');
        statusTimeoutRef.current = setTimeout(
          () => setAddToListStatus('idle'),
          3000,
        );
      },
    );
  };

  const handleDiscardExpired = () => {
    if (!item) return;

    const hasBatches = (item.activeBatchCount ?? 0) > 0;

    if (hasBatches) {
      alertService.alert(
        'Discard Expired Batches',
        'This will mark all expired batches as wasted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => convertExpiredBatches(item.id),
          },
        ],
      );
    } else {
      alertService.alert(
        'Discard Expired Item',
        `This will mark the remaining ${item.quantity} ${
          item.unit?.name || ''
        } as wasted due to expiration.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
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
      item.version ?? undefined,
      remainingNetWeight,
    );
  };

  const handleCorrectWeight = (
    netWeight: number,
    reason: string,
    netWeightUnitId?: string,
  ) => {
    if (!item) return;
    correctWeight(
      item.id,
      netWeight,
      reason,
      item.version ?? 0,
      netWeightUnitId,
    );
  };

  return {
    addToListStatus,
    adjustModalVisible,
    setAdjustModalVisible,
    correctWeightVisible,
    setCorrectWeightVisible,
    handleDelete,
    handleAddToShoppingList,
    handleDiscardExpired,
    handleConfirmAdjust,
    handleCorrectWeight,
  };
}
