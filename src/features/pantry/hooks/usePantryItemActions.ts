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
import type { WasteReason } from '#/graphql/generated/schemaTypes';
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

// Discriminated union: only one modal can be open at a time.
// Stores only the entity id — the modal materializes the entity from the
// Apollo cache via `useFragment`, so mutations to the pantry item are
// reflected in the open modal without a re-snapshot.
type ActiveModal =
  | { type: null }
  | { type: 'consume'; itemId: string }
  | { type: 'waste'; itemId: string }
  | { type: 'restock'; itemId: string };

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

  // Handler to confirm consumption
  const handleConfirmConsume = async (
    quantityUsed: number,
    _quantityInput: string,
    purpose: UsagePurpose,
    notes: string,
    usageUnitId?: string,
  ) => {
    if (activeModal.type !== 'consume') return;

    const itemId = activeModal.itemId;
    // A converted unit moves the stock when the server answers.
    const used = inTrackingUnit(
      client.cache,
      itemId,
      quantityUsed,
      usageUnitId,
    );
    const revertOptimistic =
      used === null ? undefined : bumpStock(client.cache, itemId, -used);

    const consumeNotes = notes || undefined;

    const settled = await settleMutation(
      () =>
        createPantryItemUsage({
          variables: {
            today: todayKey(),
            input: {
              pantryItemId: itemId,
              amount: { quantity: quantityUsed },
              purpose,
              notes: consumeNotes,
              usageUnitId,
              today: todayKey(),
              // idempotencyKey dedups the usage ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
        }),
      {
        document: CreatePantryItemUsageDocument,
        fallback: t('errors.recordUsageFailedRetry'),
        onFailed: revertOptimistic,
        on: { [TopLevelErrorCode.UnitInvalid]: refetchRankedUnits },
      },
    );
    if (settled.status !== 'failed') closeModal();
  };

  // Handler to confirm waste recording (uses createPantryItemUsage with purpose: WASTE)
  const handleConfirmWaste = async (
    wasteAmount: number,
    wasteReason: WasteReason,
    isComposted: boolean,
    isRecycled: boolean,
    notes: string,
    wasteUnitId?: string,
  ) => {
    if (activeModal.type !== 'waste') return;

    const itemId = activeModal.itemId;
    const wasted = inTrackingUnit(
      client.cache,
      itemId,
      wasteAmount,
      wasteUnitId,
    );
    const revertOptimistic =
      wasted === null ? undefined : bumpStock(client.cache, itemId, -wasted);

    const wasteNotes = notes || undefined;

    const settled = await settleMutation(
      () =>
        createPantryItemUsage({
          variables: {
            today: todayKey(),
            input: {
              pantryItemId: itemId,
              amount: { quantity: wasteAmount },
              purpose: UsagePurpose.Waste,
              notes: wasteNotes,
              usageUnitId: wasteUnitId,
              wasteReason,
              isComposted,
              isRecycled,
              today: todayKey(),
              // idempotencyKey dedups the usage ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
        }),
      {
        document: CreatePantryItemUsageDocument,
        fallback: t('errors.recordWasteFailedRetry'),
        onFailed: revertOptimistic,
        on: { [TopLevelErrorCode.UnitInvalid]: refetchRankedUnits },
      },
    );
    if (settled.status !== 'failed') closeModal();
  };

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
    });
    return !!data?.id;
  };

  // Handler to open consume modal (for swipe action)
  const handleConsumeItem = (itemId: string) => {
    if (hasItemInCache(itemId)) {
      setActiveModal({ type: 'consume', itemId });
    }
  };

  // Handler to open waste modal (for swipe action)
  const handleWasteItem = (itemId: string) => {
    if (hasItemInCache(itemId)) {
      setActiveModal({ type: 'waste', itemId });
    }
  };

  // Handler to open restock modal (for swipe action)
  const handleRestockItem = (itemId: string) => {
    if (hasItemInCache(itemId)) {
      setActiveModal({ type: 'restock', itemId });
    }
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

  // Derive modal states from the single activeModal for backward compatibility
  const consumeModal = {
    visible: activeModal.type === 'consume',
    itemId: activeModal.type === 'consume' ? activeModal.itemId : null,
    close: closeModal,
  };

  const wasteModal = {
    visible: activeModal.type === 'waste',
    itemId: activeModal.type === 'waste' ? activeModal.itemId : null,
    close: closeModal,
  };

  const restockModal = {
    visible: activeModal.type === 'restock',
    itemId: activeModal.type === 'restock' ? activeModal.itemId : null,
    close: closeModal,
  };

  return {
    // Modal states with close handlers
    consumeModal,
    wasteModal,
    restockModal,

    // Confirmation handlers (for modal submit)
    handleConfirmConsume,
    handleConfirmWaste,
    handleConfirmRestock,

    // Swipe action handlers
    handleConsumeItem,
    handleWasteItem,
    handleRestockItem,
    handleEditItem,
    handleDeleteItem,
  };
}
