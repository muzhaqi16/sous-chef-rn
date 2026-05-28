import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { AddItemToShoppingListFromPantryItemDocument } from '#features/pantry/screens/PantryItemDetail.generated';
import { DeletePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { removeFromPantryItemsCache } from '#hooks/home/pantry/utils';
import { addNewItemToShoppingListCache } from '#/apollo/utils/shoppingListCacheUpdaters';
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
          stats(existingStats: any) {
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
      update: (cache, { data: mutationData }) => {
        const payload = mutationData?.addItemToShoppingList;
        if (
          payload?.__typename !== 'AddItemToShoppingListPayload' ||
          !selectedShoppingListId
        ) {
          return;
        }
        const shoppingListItem = payload.shoppingListItem;

        try {
          addNewItemToShoppingListCache(
            cache,
            selectedShoppingListId,
            shoppingListItem,
          );
        } catch (error) {
          console.warn('Cache update failed for addToShoppingList:', error);
        }
      },
    },
  );

  const { convertExpiredToWaste } = useConvertExpiredToWaste();

  const { convertExpiredBatches } = useConvertExpiredBatchesToWaste({
    onSuccess: () => {
      alertService.alert('Done', 'Expired batches have been discarded.');
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
                alertService.alert('Error', 'Failed to delete item');
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

    executeMutation(
      async () => {
        await addToShoppingList({
          variables: {
            input: {
              shoppingListId: selectedShoppingListId,
              itemId: catalogItemId,
              quantity,
              unit: unitInput,
              itemName,
            },
          },
        });
        setAddToListStatus('success');
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
            onPress: () =>
              executeMutation(
                async () => {
                  await convertExpiredToWaste(item.id);
                  alertService.alert(
                    'Done',
                    'Expired item has been discarded.',
                  );
                },
                (error: unknown) =>
                  alertService.alert(
                    'Error',
                    error instanceof Error
                      ? error.message
                      : 'Failed to discard expired item',
                  ),
              ),
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
