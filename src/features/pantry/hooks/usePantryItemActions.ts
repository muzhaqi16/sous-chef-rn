import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { errorService } from '#/services/errorService';
import { settleMutation } from '#/apollo/utils/settleMutation';
import {
  ConsumptionUnitsForPantryItemDocument,
  CreatePantryItemUsageDocument,
  RestockPantryItemDocument,
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
import {
  UsePantryItemActions_TrackingUnitFragmentDoc,
  UsePantryItemActions_QuantityFragmentDoc,
  UsePantryItemActions_IdFragmentDoc,
  type UsePantryItemActions_QuantityFragment,
} from './usePantryItemActions.generated';
import { toDateKey } from '#/utils/dateUtils';
import { writeHeldStock } from '#features/pantry/cache/stock';

interface UsePantryItemActionsOptions {
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

type StockSnapshot = UsePantryItemActions_QuantityFragment;

export function usePantryItemActions({
  removeItem,
  navigateTo,
}: UsePantryItemActionsOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();
  // Single state for all modals — only one can be open at a time
  const [activeModal, setActiveModal] = useState<ActiveModal>(CLOSED_MODAL);

  const closeModal = () => setActiveModal(CLOSED_MODAL);

  const refetchRankedUnits = () => {
    for (const fieldName of RANKED_UNIT_FIELDS) {
      client.cache.evict({ id: 'ROOT_QUERY', fieldName });
    }
    client.cache.gc();
  };

  /**
   * Read the tracking-unit id for an item from the cache. Used by mutation
   * handlers to decide whether an optimistic same-unit update is safe.
   */
  const readTrackingUnitId = (itemId: string): string | undefined => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (!cacheId) return undefined;
    const data = client.cache.readFragment<{
      unit: { id: string } | null;
    }>({
      id: cacheId,
      fragment: UsePantryItemActions_TrackingUnitFragmentDoc,
    });
    return data?.unit?.id ?? undefined;
  };

  /** The stock as cached, to restore if the write is refused. */
  const readCurrentStock = (itemId: string): StockSnapshot | null => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (!cacheId) return null;
    return client.cache.readFragment<StockSnapshot>({
      id: cacheId,
      fragment: UsePantryItemActions_QuantityFragmentDoc,
    });
  };

  /**
   * Moves the cached stock by `delta` tracking units for instant feedback.
   * `heldQuantity` is what the screens show; `quantity` counts packages and is
   * settled by the response.
   */
  const optimisticUpdateStock = (itemId: string, delta: number) => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (!cacheId) return;

    client.cache.modify({
      id: cacheId,
      fields: {
        quantity(existing: number) {
          return Math.max(0, existing + delta);
        },
        updatedAt() {
          return new Date().toISOString();
        },
        lastUsedAt() {
          return new Date().toISOString();
        },
      },
    });
    writeHeldStock(client.cache, itemId, held => Math.max(0, held + delta));
  };

  /** Restores the stock snapshot taken before a refused write. */
  const revertStock = (itemId: string, original: StockSnapshot | null) => {
    if (!original) return;
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (!cacheId) return;

    client.cache.modify({
      id: cacheId,
      fields: {
        quantity() {
          return original.quantity;
        },
      },
    });
    writeHeldStock(
      client.cache,
      itemId,
      original.heldQuantity,
      original.displayAmount,
    );
  };

  // Consume/Waste item mutation (both use createPantryItemUsage)
  const [createPantryItemUsage] = useMutation(
    CreatePantryItemUsageDocument,
    {},
  );

  // Restock item mutation
  const [restockPantryItem] = useMutation(RestockPantryItemDocument, {});

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
    const original = readCurrentStock(itemId);
    const trackingUnitId = readTrackingUnitId(itemId);
    // Only apply optimistic update when using the tracking unit (same unit = direct subtraction)
    // When using a converted unit, the server response will update the cache
    const canOptimistic = !usageUnitId || usageUnitId === trackingUnitId;
    if (canOptimistic) {
      optimisticUpdateStock(itemId, -quantityUsed);
    }

    const consumeNotes = notes || undefined;
    const revertOptimistic = canOptimistic
      ? () => revertStock(itemId, original)
      : undefined;

    const settled = await settleMutation(
      () =>
        createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: itemId,
              amount: { quantity: quantityUsed },
              purpose,
              notes: consumeNotes,
              usageUnitId,
              today: toDateKey(new Date()),
              // idempotencyKey dedups the usage ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
          // Local-first: queue offline; replays as the canonical mutation,
          // deduped by its idempotencyKey.
          context: { localFirst: true },
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
    const original = readCurrentStock(itemId);
    const trackingUnitId = readTrackingUnitId(itemId);
    const canOptimistic = !wasteUnitId || wasteUnitId === trackingUnitId;
    if (canOptimistic) {
      optimisticUpdateStock(itemId, -wasteAmount);
    }

    const wasteNotes = notes || undefined;
    const revertOptimistic = canOptimistic
      ? () => revertStock(itemId, original)
      : undefined;

    const settled = await settleMutation(
      () =>
        createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: itemId,
              amount: { quantity: wasteAmount },
              purpose: UsagePurpose.Waste,
              notes: wasteNotes,
              usageUnitId: wasteUnitId,
              wasteReason,
              isComposted,
              isRecycled,
              today: toDateKey(new Date()),
              // idempotencyKey dedups the usage ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
          // Local-first: queue offline; replays as the canonical mutation,
          // deduped by its idempotencyKey.
          context: { localFirst: true },
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

    const itemId = activeModal.itemId;
    const original = readCurrentStock(itemId);
    const trackingUnitId = readTrackingUnitId(itemId);
    const canOptimistic = !unitId || unitId === trackingUnitId;
    if (canOptimistic) {
      optimisticUpdateStock(itemId, quantity);
    }

    // Optimistically increment activeBatchCount for instant UI feedback
    const cacheIdForBatch = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (cacheIdForBatch) {
      client.cache.modify({
        id: cacheIdForBatch,
        fields: {
          activeBatchCount(existing: number = 0) {
            return existing + 1;
          },
        },
      });
    }

    const restockNotes = notes || undefined;
    const expiresOn = expiresAt ? toDateKey(expiresAt) : null;
    const revertOptimistic = () => {
      if (canOptimistic) {
        revertStock(itemId, original);
      }
      if (cacheIdForBatch) {
        client.cache.modify({
          id: cacheIdForBatch,
          fields: {
            activeBatchCount(existing: number = 0) {
              return Math.max(0, existing - 1);
            },
          },
        });
      }
    };

    const settled = await settleMutation(
      () =>
        restockPantryItem({
          variables: {
            input: {
              id: itemId,
              quantity,
              unitId,
              notes: restockNotes,
              costPerUnit,
              totalCost,
              expiresOn,
              // idempotencyKey dedups the restock ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
          // Local-first: queue offline; replays as the canonical mutation,
          // deduped by its idempotencyKey.
          context: { localFirst: true },
        }),
      {
        document: RestockPantryItemDocument,
        fallback: t('errors.restockFailedRetry'),
        onFailed: revertOptimistic,
        on: { [TopLevelErrorCode.UnitInvalid]: refetchRankedUnits },
      },
    );
    if (settled.status === 'failed') return;

    // The new batch row is the server's to build, so drop the connection and
    // let the screen refetch it — but only once the server answered. A queued
    // write has no response, and nothing would refill it.
    if (settled.status === 'applied') {
      client.cache.evict({
        id: 'ROOT_QUERY',
        fieldName: 'pantryItemBatchesConnection',
        args: { pantryItemId: itemId },
      });
    }

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
