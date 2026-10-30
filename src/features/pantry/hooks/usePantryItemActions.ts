import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { errorService } from '#/services/errorService';
import { settleMutation } from '#/apollo/utils/settleMutation';
import {
  ConsumptionUnitsForPantryItemDocument,
  CreatePantryItemUsageDocument,
  RestockUnitsForPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { rootFieldOf } from '#/apollo/utils/documentOperation';
import type {
  CreatePantryItemUsageInput,
  WasteReason,
} from '#/graphql/generated/schemaTypes';
import {
  TopLevelErrorCode,
  UsagePurpose,
} from '#/graphql/generated/schemaTypes';
import { Telemetry } from '#services/telemetry';
import { generateEntityId } from '#/utils/generateEntityId';
import { UsePantryItemActions_IdFragmentDoc } from './usePantryItemActions.generated';
import { toDateKey, todayKey } from '#/utils/dateUtils';
import { bumpStock, inTrackingUnit } from '#features/pantry/cache/stock';
import { stockAmountOf } from '#domain/stockAmount';
import { usePantryRestock } from '#features/pantry/hooks/usePantryRestock';

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

/**
 * A unit refusal makes the cached ranked lists wrong, so they are dropped and
 * the picker refetches. `schema.graphql` directs clients here: the refusal
 * carries no list of units that WOULD work, and this query answers exactly that.
 */
const RANKED_UNIT_FIELDS = [
  ConsumptionUnitsForPantryItemDocument,
  RestockUnitsForPantryItemDocument,
].map(rootFieldOf);

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

  const closeModal = () => setActiveModal(CLOSED_MODAL);

  const refetchRankedUnits = () => {
    for (const fieldName of RANKED_UNIT_FIELDS) {
      client.cache.evict({ id: 'ROOT_QUERY', fieldName });
    }
    client.cache.gc();
  };

  // Consume/Waste item mutation (both use createPantryItemUsage)
  const [createPantryItemUsage] = useMutation(CreatePantryItemUsageDocument, {
    // Replays as the canonical mutation, deduped by its idempotencyKey.
    context: { localFirst: true },
  });

  /** Consume and waste are one usage write; `purpose` tells them apart. */
  const recordUsage = async (
    modal: Exclude<ModalType, 'restock'>,
    quantity: number,
    usageUnitId: string | undefined,
    usage: Pick<
      CreatePantryItemUsageInput,
      'purpose' | 'notes' | 'wasteReason' | 'isComposted' | 'isRecycled'
    >,
    fallback: string,
  ) => {
    if (activeModal.type !== modal) return;

    const itemId = activeModal.itemId;
    // A converted unit moves the stock when the server answers.
    const used = inTrackingUnit(client.cache, itemId, quantity, usageUnitId);
    const revertOptimistic =
      used === null ? undefined : bumpStock(client.cache, itemId, -used);

    const settled = await settleMutation(
      () =>
        createPantryItemUsage({
          variables: {
            today: todayKey(),
            input: {
              pantryItemId: itemId,
              amount: { quantity },
              usageUnitId,
              ...usage,
              today: todayKey(),
              // idempotencyKey dedups the usage ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
        }),
      {
        document: CreatePantryItemUsageDocument,
        fallback,
        onFailed: revertOptimistic,
        on: { [TopLevelErrorCode.UnitInvalid]: refetchRankedUnits },
      },
    );
    if (settled.status !== 'failed') closeModal();
  };

  const handleConfirmConsume = (
    quantityUsed: number,
    _quantityInput: string,
    purpose: UsagePurpose,
    notes: string,
    usageUnitId?: string,
  ) =>
    recordUsage(
      'consume',
      quantityUsed,
      usageUnitId,
      { purpose, notes: notes || undefined },
      t('errors.recordUsageFailedRetry'),
    );

  const handleConfirmWaste = (
    wasteAmount: number,
    wasteReason: WasteReason,
    isComposted: boolean,
    isRecycled: boolean,
    notes: string,
    wasteUnitId?: string,
  ) =>
    recordUsage(
      'waste',
      wasteAmount,
      wasteUnitId,
      {
        purpose: UsagePurpose.Waste,
        notes: notes || undefined,
        wasteReason,
        isComposted,
        isRecycled,
      },
      t('errors.recordWasteFailedRetry'),
    );

  // Handler to confirm restock
  const handleConfirmRestock = async (
    quantity: number,
    _quantityInput: string,
    notes: string,
    unitId?: string,
    costPerUnit?: number,
    totalCost?: number,
    expiresAt?: Date | null,
  ) => {
    if (activeModal.type !== 'restock') return;

    const settled = await restock(activeModal.itemId, {
      amount: stockAmountOf(quantity, { unitId }),
      notes: notes || undefined,
      costPerUnit,
      totalCost,
      expiresOn: expiresAt ? toDateKey(expiresAt) : null,
      present: 'alert',
      on: { [TopLevelErrorCode.UnitInvalid]: refetchRankedUnits },
    });
    if (settled.status === 'rejected') return;

    closeModal();
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
