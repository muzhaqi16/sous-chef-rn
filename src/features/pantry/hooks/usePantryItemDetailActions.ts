import { useState, useEffect, useRef } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n';
import { errorService } from '#/services/errorService';
import { typedItemRef } from '#/utils/refInput';
import { AddItemToShoppingListFromPantryItemDocument } from './usePantryItemDetailActions.generated';
import { GetPantryDocument } from '#features/pantry/graphql/pantry.generated';
import { buildAddItemsReconcileUpdate } from '#features/shoppingList/cache/items';
import { createShoppingListRow } from '#features/shoppingList/cache/createShoppingListRow';
import { useConvertExpiredToWaste } from '#features/pantry/hooks/mutations/useConvertExpiredToWaste';
import { useAdjustPantryItemQuantity } from '#features/pantry/hooks/mutations/useAdjustPantryItemQuantity';
import { useCorrectPackageSize } from '#features/pantry/hooks/mutations/useCorrectPackageSize';
import { usePantryItemMutations } from '#features/pantry/hooks/mutations/usePantryItemMutations';
import {
  formatQuantityForDisplay,
  resolveQuantityNotation,
} from '#/utils/formatQuantity';
import { destructiveConfirm } from '#/services/destructiveConfirm';
import type { PackageSizeCorrectionInput } from '#features/pantry/types';

type PantryItemForActions =
  | {
      id: string;
      /**
       * The item's OWN pantry, from `PantryItemDetail_pantryItem`,
       * authoritative whatever pantry is selected: `selectedPantryId` starts
       * null, and a deep link can land here before it resolves.
       */
      pantryId?: string | null;
      // `PantryItem.version` is `Int!`, and the server now requires it on every
      // update — a mutation sent without one overwrites concurrent edits.
      version: number;
      quantity?: number | null;
      unit?: {
        id: string;
        name?: string | null;
        symbol?: string | null;
        displayAsFraction?: boolean | null;
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
  /** The batch whose package size is being corrected, if any. */
  correctingBatchId: string | null;
  setCorrectingBatchId: (batchId: string | null) => void;
  handleDelete: () => void;
  handleAddToShoppingList: () => Promise<void>;
  handleDiscardExpired: () => void;
  handleConfirmAdjust: (
    newQuantity: number,
    reason: string,
    remainingNetWeight?: number,
  ) => void;
  handleCorrectPackageSize: (
    input: PackageSizeCorrectionInput,
  ) => Promise<boolean>;
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
  const [correctingBatchId, setCorrectingBatchId] = useState<string | null>(
    null,
  );

  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  // The shared `removeItem` evicts before firing (no `update:` runs on a queued
  // delete) and registers the pending delete that stops an echo resurrecting
  // the row. The item's OWN pantry drives it; '' makes it return early.
  const resolvedPantryId = item?.pantryId ?? selectedPantryId ?? null;

  const { removeItem } = usePantryItemMutations({
    pantryId: resolvedPantryId ?? '',
    // `removeItem` drops the row and count before firing and calls this to
    // restore them on a refusal (DATA under `errorPolicy: 'all'`). A transport
    // failure must NOT restore: the delete is queued.
    refetch: () => {
      void client.refetchQueries({ include: [GetPantryDocument] });
    },
  });

  const [addToShoppingList] = useMutation(
    AddItemToShoppingListFromPantryItemDocument,
    {
      context: { localFirst: true },
      // Reconcile swallows its own errors internally, so no wrap is needed here
      // (wrapping would bail the React Compiler out of this hook).
      update: buildAddItemsReconcileUpdate({ listId: selectedShoppingListId }),
    },
  );

  const { convertExpiredToWaste } = useConvertExpiredToWaste({
    onSuccess: ({ hasBatches }) => {
      alertService.alert(
        t('labels.done'),
        hasBatches
          ? t('success.expiredBatchesDiscarded')
          : t('success.expiredItemDiscarded'),
      );
    },
  });

  const { adjustQuantity } = useAdjustPantryItemQuantity();
  const { correctPackageSize } = useCorrectPackageSize();

  const confirmDelete = async () => {
    if (!resolvedPantryId) {
      // Neither source resolved: there is nothing to delete from. Say so rather
      // than dismissing the screen as though it worked.
      alertService.alert(t('labels.error'), t('errors.deleteItemFailed'));
      return;
    }
    try {
      // Leaves only once the item is gone: a refusal resolves as DATA, and
      // `removeItem` has already told the user and restored the row.
      if (await removeItem(itemId)) {
        goBack();
      }
    } catch (error) {
      errorService.reportError(error, {
        operation: 'PantryItemDetail.deleteItem',
      });
      alertService.alert(t('labels.error'), t('errors.deleteItemFailed'));
    }
  };

  const handleDelete = () => {
    alertService.alert(
      t('pantryItemDetail.deleteTitle'),
      t('labels.areYouSureYouWantToDeleteThisItem'),
      destructiveConfirm(t('labels.delete'), () => {
        void confirmDelete();
      }),
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

    const catalogItemId = item?.item?.id ?? '';
    const itemName = item?.itemName ?? '';
    // An out-of-stock item (quantity 0) still adds one to the list.
    const quantity = item?.quantity === 0 ? 1 : item?.quantity ?? 1;
    const created = await createShoppingListRow(client.cache, {
      listId: selectedShoppingListId,
      row: {
        itemName,
        quantity,
        unitId: item?.unit?.id,
        unitName: item?.unit?.name,
      },
      line: {
        item: catalogItemId
          ? { itemId: catalogItemId }
          : typedItemRef(itemName),
        quantity,
        unit: item?.unit?.id ? { id: item.unit.id } : undefined,
      },
      send: addToShoppingList,
      document: AddItemToShoppingListFromPantryItemDocument,
      fallback: t('errors.addItemFailed'),
    });
    if (created.failure) {
      alertService.alert(created.failure.title, created.failure.body);
    }
    setAddToListStatus(created.outcome === 'reverted' ? 'error' : 'success');
    statusTimeoutRef.current = setTimeout(
      () => setAddToListStatus('idle'),
      3000,
    );
  };

  const handleDiscardExpired = () => {
    if (!item) return;

    const hasBatches = (item.activeBatchCount ?? 0) > 0;
    const title = hasBatches
      ? t('pantryItemDetail.discardBatchesTitle')
      : t('pantryItemDetail.discardItemTitle');
    const body = hasBatches
      ? t('pantryItemDetail.discardBatchesBody')
      : t('pantryItemDetail.discardItemBody', {
          quantity: formatQuantityForDisplay(item.quantity, {
            notation: resolveQuantityNotation(
              null,
              item.unit?.displayAsFraction,
            ),
          }),
          unit: item.unit?.name ?? '',
        });

    alertService.alert(
      title,
      body,
      destructiveConfirm(t('labels.discard'), () => {
        void convertExpiredToWaste(item.id, { hasBatches });
      }),
    );
  };

  const handleConfirmAdjust = (
    newQuantity: number,
    reason: string,
    remainingNetWeight?: number,
  ) => {
    if (!item) return;
    void adjustQuantity(
      item.id,
      newQuantity,
      reason,
      item.version,
      remainingNetWeight,
    );
  };

  const handleCorrectPackageSize = async (
    input: PackageSizeCorrectionInput,
  ): Promise<boolean> => {
    if (!correctingBatchId) return false;
    return correctPackageSize({
      ...input,
      pantryItemId: itemId,
      batchId: correctingBatchId,
    });
  };

  return {
    addToListStatus,
    adjustModalVisible,
    setAdjustModalVisible,
    correctingBatchId,
    setCorrectingBatchId,
    handleDelete,
    handleAddToShoppingList,
    handleDiscardExpired,
    handleConfirmAdjust,
    handleCorrectPackageSize,
  };
}
