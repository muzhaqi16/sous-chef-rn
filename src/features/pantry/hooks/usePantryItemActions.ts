import { useState } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import {
  CreatePantryItemUsageDocument,
  RestockPantryItemDocument,
} from '#features/pantry/graphql/pantry.generated';
import { UsagePurpose, WasteReason } from '#/graphql/generated/schemaTypes';
import { isNetworkError } from '#/utils/isNetworkError';
import {
  isInvalidUnitError,
  isInvalidUnitPayload,
  getInvalidUnitMessage,
} from '#/utils/errors/invalidUnit';
import {
  isVersionConflictError,
  isVersionConflictPayload,
  getVersionConflictMessage,
} from '#/utils/errors/versionConflict';
import {
  isNotFoundErrorPayload,
  getNotFoundMessage,
} from '#/utils/errors/notFound';
import { Telemetry } from '#services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  _UsePantryItemActionsTrackingUnitFragmentDoc,
  _UsePantryItemActionsQuantityFragmentDoc,
  _UsePantryItemActionsIdFragmentDoc,
} from './usePantryItemActions.generated';

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
 * Pantry Item Actions Hook
 * Extracts modal state, mutations, and handlers from PantryMain for better separation of concerns
 *
 * Handles:
 * - Consume item (modal + mutation)
 * - Waste item (modal + mutation)
 * - Restock item (modal + mutation)
 * - Edit item (navigation)
 * - Delete item (mutation)
 */
export function usePantryItemActions({
  removeItem,
  navigateTo,
}: UsePantryItemActionsOptions) {
  const client = useApolloClient();
  // Single state for all modals — only one can be open at a time
  const [activeModal, setActiveModal] = useState<ActiveModal>(CLOSED_MODAL);

  const closeModal = () => setActiveModal(CLOSED_MODAL);

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
      fragment: _UsePantryItemActionsTrackingUnitFragmentDoc,
    });
    return data?.unit?.id ?? undefined;
  };

  /**
   * Read the current quantity from the cache, for optimistic revert.
   */
  const readCurrentQuantity = (itemId: string): number => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (!cacheId) return 0;
    const data = client.cache.readFragment<{ quantity: number }>({
      id: cacheId,
      fragment: _UsePantryItemActionsQuantityFragmentDoc,
    });
    return data?.quantity ?? 0;
  };

  /**
   * Optimistically update a pantry item's quantity in cache for instant UI feedback.
   */
  const optimisticUpdateQuantity = (itemId: string, newQuantity: number) => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (!cacheId) return;

    client.cache.modify({
      id: cacheId,
      fields: {
        quantity() {
          return Math.max(0, newQuantity);
        },
        updatedAt() {
          return new Date().toISOString();
        },
        lastUsedAt() {
          return new Date().toISOString();
        },
      },
    });
  };

  /**
   * Revert a pantry item's quantity in cache on mutation error.
   */
  const revertQuantity = (itemId: string, originalQty: number) => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (!cacheId) return;

    client.cache.modify({
      id: cacheId,
      fields: {
        quantity() {
          return originalQty;
        },
      },
    });
  };

  /**
   * Handle payload-level errors from pantry mutations.
   * Returns true if an error was detected and handled, false otherwise.
   *
   * Accepts either a payload-variant (anything with __typename ending in
   * 'Payload') or an error-variant carrying `code` + `message`.
   */
  const handlePayloadError = (
    payload: { __typename: string } & Record<string, unknown>,
    revertFn?: () => void,
  ): boolean => {
    if (payload.__typename.endsWith('Payload')) return false;

    revertFn?.();

    const code =
      typeof payload.code === 'string' ? (payload.code as string) : '';
    const message =
      typeof payload.message === 'string'
        ? (payload.message as string)
        : 'Something went wrong';

    if (isNotFoundErrorPayload(payload)) {
      const resource =
        typeof payload.resource === 'string' ? payload.resource : undefined;
      alertService.alert('Not Found', getNotFoundMessage(resource));
    } else if (isInvalidUnitPayload(code)) {
      const rawValidUnits = (payload as { validUnits?: unknown }).validUnits;
      const validList = Array.isArray(rawValidUnits)
        ? (rawValidUnits as string[]).join(', ')
        : undefined;
      const detail = validList
        ? `${message}\n\nValid units: ${validList}`
        : message;
      alertService.alert('Invalid Unit', detail);
    } else if (isVersionConflictPayload(code)) {
      alertService.alert('Item Updated', message);
    } else {
      alertService.alert('Error', message);
    }

    return true;
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
    const originalQty = readCurrentQuantity(itemId);
    const trackingUnitId = readTrackingUnitId(itemId);
    // Only apply optimistic update when using the tracking unit (same unit = direct subtraction)
    // When using a converted unit, the server response will update the cache
    const canOptimistic = !usageUnitId || usageUnitId === trackingUnitId;
    if (canOptimistic) {
      optimisticUpdateQuantity(itemId, originalQty - quantityUsed);
    }

    const consumeNotes = notes || undefined;
    const revertOptimistic = canOptimistic
      ? () => revertQuantity(itemId, originalQty)
      : undefined;

    const consumeResult = await executeMutation(
      () =>
        createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: itemId,
              quantityUsed,
              purpose,
              notes: consumeNotes,
              usageUnitId,
              // idempotencyKey dedups the usage ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
          // Local-first: queue offline; replays as the canonical mutation,
          // deduped by its idempotencyKey.
          context: { localFirst: true },
        }),
      (error: unknown) => {
        revertOptimistic?.();
        if (!isNetworkError(error)) {
          if (isVersionConflictError(error)) {
            alertService.alert('Item Updated', getVersionConflictMessage());
            return;
          }
          if (isInvalidUnitError(error)) {
            alertService.alert('Invalid Unit', getInvalidUnitMessage(error));
            return;
          }
          const errorMessage =
            (error instanceof Error && error.message) ||
            'Failed to record item usage. Please try again.';
          errorService.reportError(error, { operation: 'consumePantryItem' });
          alertService.alert('Error', errorMessage);
        }
      },
    );
    if (!consumeResult) return;

    // Check payload-level errors (API returns success: false for validation failures)
    const consumePayload = consumeResult.data?.createPantryItemUsage;
    if (
      consumePayload &&
      handlePayloadError(consumePayload, revertOptimistic)
    ) {
      return;
    }

    closeModal();
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
    const originalQty = readCurrentQuantity(itemId);
    const trackingUnitId = readTrackingUnitId(itemId);
    const canOptimistic = !wasteUnitId || wasteUnitId === trackingUnitId;
    if (canOptimistic) {
      optimisticUpdateQuantity(itemId, originalQty - wasteAmount);
    }

    const wasteNotes = notes || undefined;
    const revertOptimistic = canOptimistic
      ? () => revertQuantity(itemId, originalQty)
      : undefined;

    const wasteResult = await executeMutation(
      () =>
        createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: itemId,
              quantityUsed: wasteAmount,
              purpose: UsagePurpose.Waste,
              notes: wasteNotes,
              usageUnitId: wasteUnitId,
              wasteReason,
              isComposted,
              isRecycled,
              // idempotencyKey dedups the usage ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
          // Local-first: queue offline; replays as the canonical mutation,
          // deduped by its idempotencyKey.
          context: { localFirst: true },
        }),
      (error: unknown) => {
        revertOptimistic?.();
        if (!isNetworkError(error)) {
          if (isVersionConflictError(error)) {
            alertService.alert('Item Updated', getVersionConflictMessage());
            return;
          }
          if (isInvalidUnitError(error)) {
            alertService.alert('Invalid Unit', getInvalidUnitMessage(error));
            return;
          }
          const errorMessage =
            (error instanceof Error && error.message) ||
            'Failed to record item waste. Please try again.';
          errorService.reportError(error, {
            operation: 'recordPantryItemWaste',
          });
          alertService.alert('Error', errorMessage);
        }
      },
    );
    if (!wasteResult) return;

    // Check payload-level errors
    const wastePayload = wasteResult.data?.createPantryItemUsage;
    if (wastePayload && handlePayloadError(wastePayload, revertOptimistic)) {
      return;
    }

    closeModal();
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
    const originalQty = readCurrentQuantity(itemId);
    const trackingUnitId = readTrackingUnitId(itemId);
    const canOptimistic = !unitId || unitId === trackingUnitId;
    if (canOptimistic) {
      optimisticUpdateQuantity(itemId, originalQty + quantity);
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
            return (existing ?? 0) + 1;
          },
        },
      });
    }

    const restockNotes = notes || undefined;
    const expiresAtValue = expiresAt ? expiresAt.toISOString() : null;
    const revertOptimistic = () => {
      if (canOptimistic) {
        revertQuantity(itemId, originalQty);
      }
      if (cacheIdForBatch) {
        client.cache.modify({
          id: cacheIdForBatch,
          fields: {
            activeBatchCount(existing: number = 0) {
              return Math.max(0, (existing ?? 0) - 1);
            },
          },
        });
      }
    };

    const restockResult = await executeMutation(
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
              expiresAt: expiresAtValue,
              // idempotencyKey dedups the restock ledger row on replay.
              idempotencyKey: generateEntityId(),
            },
          },
          // Local-first: queue offline; replays as the canonical mutation,
          // deduped by its idempotencyKey.
          context: { localFirst: true },
        }),
      (error: unknown) => {
        revertOptimistic();
        if (!isNetworkError(error)) {
          if (isVersionConflictError(error)) {
            alertService.alert('Item Updated', getVersionConflictMessage());
            return;
          }
          if (isInvalidUnitError(error)) {
            alertService.alert('Invalid Unit', getInvalidUnitMessage(error));
            return;
          }
          const errorMessage =
            (error instanceof Error && error.message) ||
            'Failed to restock item. Please try again.';
          errorService.reportError(error, { operation: 'restockPantryItem' });
          alertService.alert('Error', errorMessage);
        }
      },
    );
    if (!restockResult) return;

    // Check payload-level errors
    const restockPayload = restockResult.data?.restockPantryItem;
    if (
      restockPayload &&
      handlePayloadError(restockPayload, revertOptimistic)
    ) {
      return;
    }

    closeModal();
  };

  // Existence check helper — opens the modal only if the cache has an entry
  // for the id (mirrors the previous `materializeItem` behavior).
  const hasItemInCache = (itemId: string): boolean => {
    const cacheId = client.cache.identify({
      __typename: 'PantryItem',
      id: itemId,
    });
    if (!cacheId) return false;
    const data = client.cache.readFragment<{ id: string }>({
      id: cacheId,
      fragment: _UsePantryItemActionsIdFragmentDoc,
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
    const deleteResult = await executeMutation(async () => {
      await removeItem(itemId);
      Telemetry.trackEvent('delete_pantry_item_success', { item_id: itemId });
      return true;
    }, 'Error deleting pantry item:');
    if (!deleteResult) return;
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
