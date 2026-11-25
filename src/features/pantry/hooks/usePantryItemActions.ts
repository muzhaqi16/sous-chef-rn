import { useRef, useState } from 'react';
import { useTranslation } from '#i18n';
import { useApolloClient } from '@apollo/client/react';
import { errorService } from '#services/errorService';
import type { SettleStatus } from '#apollo/utils/settleMutation';
import { dropRankedUnits } from '#features/pantry/cache/rankedUnits';
import type { WasteReason } from '#graphql/generated/schemaTypes';
import {
  TopLevelErrorCode,
  UsagePurpose,
} from '#graphql/generated/schemaTypes';
import { Telemetry } from '#services/telemetry';
import { UsePantryItemActions_IdFragmentDoc } from './usePantryItemActions.generated';
import { toDateKey } from '#utils/dateUtils';
import { stockAmountOf, type RestockContents } from '#domain/stockAmount';
import { usePantryRestock } from '#features/pantry/hooks/usePantryRestock';
import {
  useRecordPantryUsage,
  type PantryUsage,
} from '#features/pantry/hooks/mutations/useRecordPantryUsage';

interface UsePantryItemActionsOptions {
  pantryId: string | undefined;
  removeItem: (id: string) => Promise<void>;
  navigateTo: {
    pantryItem: (params: { itemId: string }) => void;
  };
}

// One modal at a time, holding only the id: the modal reads the item through
// `useFragment`, so a write to it shows in the open modal.
type ModalType = 'consume' | 'waste' | 'restock';
type ActiveModal =
  | { type: null }
  | { type: ModalType; itemId: string; reason?: string };

const CLOSED_MODAL: ActiveModal = { type: null };

export function usePantryItemActions({
  pantryId,
  removeItem,
  navigateTo,
}: UsePantryItemActionsOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { restock } = usePantryRestock(pantryId);
  // Single state for all modals — only one can be open at a time
  const [activeModal, setActiveModal] = useState<ActiveModal>(CLOSED_MODAL);

  // Uses in flight, by sheet and stack: a second confirm of one is the same
  // use, while another stack's goes ahead (a waste's sheet closes at once).
  const usagesPending = useRef(new Set<string>());

  const closeModal = () => setActiveModal(CLOSED_MODAL);

  const refetchRankedUnits = () => dropRankedUnits(client.cache);

  const { recordUsage: sendUsage } = useRecordPantryUsage();

  /** Consume and waste are one usage write; `purpose` tells them apart. */
  const recordUsage = async (
    modal: Exclude<ModalType, 'restock'>,
    usage: Omit<PantryUsage, 'pantryItemId'>,
  ): Promise<SettleStatus | undefined> => {
    if (activeModal.type !== modal) return;
    const itemId = activeModal.itemId;
    const pendingKey = `${modal}:${itemId}`;
    if (usagesPending.current.has(pendingKey)) return;
    usagesPending.current.add(pendingKey);
    const status = await sendUsage({ ...usage, pantryItemId: itemId });
    usagesPending.current.delete(pendingKey);
    if (status !== 'failed') {
      setActiveModal(current =>
        current === activeModal ? CLOSED_MODAL : current,
      );
    }
    return status;
  };

  const handleConfirmConsume = (
    quantityUsed: number,
    _quantityInput: string,
    purpose: UsagePurpose,
    notes: string,
    usageUnitId?: string,
  ) =>
    recordUsage('consume', {
      quantity: quantityUsed,
      usageUnitId,
      usage: { purpose, notes: notes || undefined },
      fallback: t('errors.recordUsageFailedRetry'),
    });

  const handleConfirmWaste = (
    wasteAmount: number,
    wasteReason: WasteReason,
    isComposted: boolean,
    isRecycled: boolean,
    notes: string,
    wasteUnitId?: string,
  ) =>
    recordUsage('waste', {
      quantity: wasteAmount,
      usageUnitId: wasteUnitId,
      usage: {
        purpose: UsagePurpose.Waste,
        notes: notes || undefined,
        wasteReason,
        isComposted,
        isRecycled,
      },
      fallback: t('errors.recordWasteFailedRetry'),
    });

  // Handler to confirm restock
  const handleConfirmRestock = async (
    quantity: number,
    _quantityInput: string,
    notes: string,
    unitId?: string,
    costPerUnit?: number,
    totalCost?: number,
    expiresAt?: Date | null,
    contents: RestockContents | null = null,
  ): Promise<string | null> => {
    if (activeModal.type !== 'restock') return null;

    const { packageSize = null, ...stated } = contents ?? {};
    const settled = await restock(activeModal.itemId, {
      amount: stockAmountOf(quantity, {
        asPackages: packageSize !== null,
        packageSize,
        unitId,
      }),
      ...stated,
      notes: notes || undefined,
      costPerUnit,
      totalCost,
      expiresOn: expiresAt ? toDateKey(expiresAt) : null,
      present: contents ? 'none' : 'alert',
      on: { [TopLevelErrorCode.UnitInvalid]: refetchRankedUnits },
    });
    if (settled.status === 'rejected') {
      if (!contents) return null;
      // The size was stated, so a refusal of it is about its kind of unit.
      return settled.sizeRefusal === null
        ? t('errors.restockFailedRetry')
        : t('errors.field.packageSize');
    }

    closeModal();
    return null;
  };

  // Opens the modal only when the cache holds the item.
  const hasItemInCache = (itemId: string): boolean => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (!cacheId) return false;
    const data = client.cache.readFragment<{ id: string }>({
      id: cacheId,
      fragment: UsePantryItemActions_IdFragmentDoc,
      optimistic: true,
    });
    return !!data?.id;
  };

  // Swipe actions: each opens its modal only when the cache holds the item.
  const opensModal = (type: ModalType) => (itemId: string) => {
    if (hasItemInCache(itemId)) setActiveModal({ type, itemId });
  };

  /** The restock form, asking for the amount for `reason`; false when it cannot open. */
  const openRestockAsking = (itemId: string, reason: string): boolean => {
    if (!hasItemInCache(itemId)) return false;
    setActiveModal({ type: 'restock', itemId, reason });
    return true;
  };

  // Handler to edit item (for swipe action)
  const handleEditItem = (itemId: string) => {
    navigateTo.pantryItem({ itemId });
  };

  // Handler to delete item (for swipe action)
  const handleDeleteItem = async (itemId: string) => {
    try {
      await removeItem(itemId);
      Telemetry.trackEvent('delete_pantry_item_success', { item_id: itemId });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Error deleting pantry item:',
      });
    }
  };

  const modalState = (type: ModalType) => ({
    visible: activeModal.type === type,
    itemId: activeModal.type === type ? activeModal.itemId : null,
    close: closeModal,
  });

  return {
    // Modal states with close handlers
    consumeModal: modalState('consume'),
    wasteModal: modalState('waste'),
    restockModal: {
      ...modalState('restock'),
      reason: activeModal.type === 'restock' ? activeModal.reason : undefined,
    },

    // Confirmation handlers (for modal submit)
    handleConfirmConsume,
    handleConfirmWaste,
    handleConfirmRestock,

    // Swipe action handlers
    handleConsumeItem: opensModal('consume'),
    handleWasteItem: opensModal('waste'),
    handleRestockItem: opensModal('restock'),
    openRestockAsking,
    handleEditItem,
    handleDeleteItem,
  };
}
