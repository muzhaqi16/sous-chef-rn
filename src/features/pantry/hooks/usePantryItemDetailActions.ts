import { useState, useEffect, useRef } from 'react';
import { alertService } from '#services/alertService';
import { toastService } from '#services/toastService';
import { t } from '#i18n';
import { errorService } from '#services/errorService';
import { typedItemRef } from '#utils/refInput';
import { useAddShoppingRows } from '#features/shoppingList/hooks/useAddShoppingRows';
import { useConvertExpiredToWaste } from '#features/pantry/hooks/mutations/useConvertExpiredToWaste';
import { useAdjustPantryItemQuantity } from '#features/pantry/hooks/mutations/useAdjustPantryItemQuantity';
import { useCorrectPackageSize } from '#features/pantry/hooks/mutations/useCorrectPackageSize';
import { useRecordPantryUsage } from '#features/pantry/hooks/mutations/useRecordPantryUsage';
import type { SettleStatus } from '#apollo/utils/settleMutation';
import { usePantryItemMutations } from '#features/pantry/hooks/mutations/usePantryItemMutations';
import {
  formatQuantityForDisplay,
  resolveQuantityNotation,
  unitLabel,
} from '#utils/formatQuantity';
import { destructiveConfirm } from '#services/destructiveConfirm';
import { useBatchWaste } from '#features/pantry/hooks/useBatchWaste';
import type {
  PackageSizeCorrectionInput,
  RecountUnits,
  StatedUse,
} from '#features/pantry/types';

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
  /** The batch a use is being taken from, if any. */
  usingBatchId: string | null;
  setUsingBatchId: (batchId: string | null) => void;
  handleConfirmBatchUse: (use: StatedUse) => Promise<SettleStatus | undefined>;
  /** The batch being thrown out from, if any. */
  wastingBatchId: string | null;
  setWastingBatchId: (batchId: string | null) => void;
  handleConfirmBatchWaste: ReturnType<
    typeof useBatchWaste
  >['confirmBatchWaste'];
  handleDelete: () => void;
  handleAddToShoppingList: () => Promise<void>;
  handleDiscardExpired: () => void;
  handleConfirmAdjust: (
    newQuantity: number,
    reason: string,
    remainingNetWeight?: number,
    units?: RecountUnits,
  ) => void;
  handleCorrectPackageSize: (
    input: PackageSizeCorrectionInput,
  ) => Promise<string | null>;
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
  const [correctingBatchId, setCorrectingBatchId] = useState<string | null>(
    null,
  );
  const [usingBatchId, setUsingBatchId] = useState<string | null>(null);
  const {
    wastingBatchId,
    setWastingBatchId,
    confirmBatchWaste: handleConfirmBatchWaste,
  } = useBatchWaste();

  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  // The item's OWN pantry drives the removal; '' makes it return early.
  const resolvedPantryId = item?.pantryId ?? selectedPantryId ?? null;

  const { removeItem } = usePantryItemMutations({
    pantryId: resolvedPantryId ?? '',
  });

  const { addRow } = useAddShoppingRows();

  const { convertExpiredToWaste } = useConvertExpiredToWaste({
    onSuccess: ({ hasBatches }) => {
      toastService.success(
        hasBatches
          ? t('success.expiredBatchesDiscarded')
          : t('success.expiredItemDiscarded'),
      );
    },
  });

  const { adjustQuantity } = useAdjustPantryItemQuantity();
  const { correctPackageSize } = useCorrectPackageSize();
  const { recordUsage } = useRecordPantryUsage();

  const confirmDelete = async () => {
    if (!resolvedPantryId) {
      // Neither source resolved: there is nothing to delete from. Say so rather
      // than dismissing the screen as though it worked.
      alertService.alert(t('labels.error'), t('errors.deleteItemFailed'));
      return;
    }
    try {
      // Leaves only once the item is gone: a refusal resolves as DATA, and
      // `removeItem` has already told the user.
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
    const name = item?.itemName;
    alertService.alert(
      // Names what goes, so the confirmation can't be read against another item.
      name ? t('labels.deleteNamed', { name }) : t('labels.delete'),
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
    const created = await addRow({
      listId: selectedShoppingListId,
      row: {
        itemName,
        quantity,
        unitId: item?.unit?.id,
        unitName: unitLabel(item?.unit, { quantity }),
      },
      line: {
        item: catalogItemId
          ? { itemId: catalogItemId }
          : typedItemRef(itemName),
        quantity,
        unit: item?.unit?.id ? { id: item.unit.id } : undefined,
      },
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
    const notation = resolveQuantityNotation(item.unit?.displayAsFraction);
    const title = hasBatches
      ? t('pantryItemDetail.discardBatchesTitle')
      : t('pantryItemDetail.discardItemTitle');
    const body = hasBatches
      ? t('pantryItemDetail.discardBatchesBody')
      : t('pantryItemDetail.discardItemBody', {
          quantity: formatQuantityForDisplay(item.quantity, { notation }),
          unit: unitLabel(item.unit, { quantity: item.quantity, notation }),
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
    units?: RecountUnits,
  ) => {
    if (!item) return;
    void adjustQuantity(
      item.id,
      newQuantity,
      reason,
      item.version,
      remainingNetWeight,
      units,
    );
  };

  const handleCorrectPackageSize = async (
    input: PackageSizeCorrectionInput,
  ): Promise<string | null> => {
    if (!correctingBatchId) return null;
    return correctPackageSize({
      ...input,
      pantryItemId: itemId,
      batchId: correctingBatchId,
    });
  };

  // Taken from the batch picked, which the server never swaps for another.
  const handleConfirmBatchUse = async ({
    quantity,
    all,
    purpose,
    notes,
    usageUnitId,
  }: StatedUse): Promise<SettleStatus | undefined> => {
    if (!usingBatchId) return undefined;
    const status = await recordUsage({
      pantryItemId: itemId,
      quantity,
      all,
      usageUnitId,
      usage: { purpose, notes: notes || undefined },
      batchId: usingBatchId,
      fallback: t('errors.recordUsageFailedRetry'),
    });
    if (status !== 'failed') setUsingBatchId(null);
    return status;
  };

  return {
    addToListStatus,
    adjustModalVisible,
    setAdjustModalVisible,
    correctingBatchId,
    setCorrectingBatchId,
    usingBatchId,
    setUsingBatchId,
    handleConfirmBatchUse,
    wastingBatchId,
    setWastingBatchId,
    handleConfirmBatchWaste,
    handleDelete,
    handleAddToShoppingList,
    handleDiscardExpired,
    handleConfirmAdjust,
    handleCorrectPackageSize,
  };
}
