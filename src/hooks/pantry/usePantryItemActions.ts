import { useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import { alertService } from '#/services/alertService';
import {
  useCreatePantryItemUsageMutation,
  useRestockPantryItemMutation,
  UsagePurpose,
  WasteReason,
  PantryItemFragment,
} from '#generated';
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
import { Telemetry } from '#services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';

interface UsePantryItemActionsOptions {
  pantryItems: PantryItemFragment[];
  removeItem: (id: string) => Promise<void>;
  navigateTo: {
    pantryItem: (params: { itemId: string }) => void;
  };
}

// Discriminated union: only one modal can be open at a time
type ActiveModal =
  | { type: null }
  | { type: 'consume'; item: PantryItemFragment }
  | { type: 'waste'; item: PantryItemFragment }
  | { type: 'restock'; item: PantryItemFragment };

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
  pantryItems,
  removeItem,
  navigateTo,
}: UsePantryItemActionsOptions) {
  const client = useApolloClient();
  // Single state for all modals — only one can be open at a time
  const [activeModal, setActiveModal] = useState<ActiveModal>(CLOSED_MODAL);

  const closeModal = () => setActiveModal(CLOSED_MODAL);

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
   */
  const handlePayloadError = (
    payload: {
      success: boolean;
      code: string;
      message: string;
      validUnits?: string[] | null;
    },
    revertFn?: () => void,
  ): boolean => {
    if (payload.success) return false;

    revertFn?.();

    if (isInvalidUnitPayload(payload)) {
      const validList = payload.validUnits?.join(', ');
      const detail = validList
        ? `${payload.message}\n\nValid units: ${validList}`
        : payload.message;
      alertService.alert('Invalid Unit', detail);
    } else if (isVersionConflictPayload(payload)) {
      alertService.alert('Item Updated', payload.message);
    } else {
      alertService.alert('Error', payload.message);
    }

    return true;
  };

  // Consume/Waste item mutation (both use createPantryItemUsage)
  const [createPantryItemUsage] = useCreatePantryItemUsageMutation({
    errorPolicy: 'all',
  });

  // Restock item mutation
  const [restockPantryItem] = useRestockPantryItemMutation({
    errorPolicy: 'all',
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

    const item = activeModal.item;
    const originalQty = item.quantity;
    // Only apply optimistic update when using the tracking unit (same unit = direct subtraction)
    // When using a converted unit, the server response will update the cache
    const canOptimistic = !usageUnitId || usageUnitId === item.unit?.id;
    if (canOptimistic) {
      optimisticUpdateQuantity(item.id, originalQty - quantityUsed);
    }

    const consumeNotes = notes || undefined;
    const revertOptimistic = canOptimistic
      ? () => revertQuantity(item.id, originalQty)
      : undefined;

    const consumeResult = await executeMutation(
      () =>
        createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: item.id,
              quantityUsed,
              purpose,
              notes: consumeNotes,
              usageUnitId,
            },
          },
        }),
      (error: any) => {
        revertOptimistic?.();
        if (!isNetworkError(error)) {
          if (isVersionConflictError(error)) {
            alertService.alert(
              'Item Updated',
              getVersionConflictMessage(error),
            );
            return;
          }
          if (isInvalidUnitError(error)) {
            alertService.alert('Invalid Unit', getInvalidUnitMessage(error));
            return;
          }
          const errorMessage =
            error.message || 'Failed to record item usage. Please try again.';
          console.error('Error consuming pantry item:', error);
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

    const item = activeModal.item;
    const originalQty = item.quantity;
    const canOptimistic = !wasteUnitId || wasteUnitId === item.unit?.id;
    if (canOptimistic) {
      optimisticUpdateQuantity(item.id, originalQty - wasteAmount);
    }

    const wasteNotes = notes || undefined;
    const revertOptimistic = canOptimistic
      ? () => revertQuantity(item.id, originalQty)
      : undefined;

    const wasteResult = await executeMutation(
      () =>
        createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: item.id,
              quantityUsed: wasteAmount,
              purpose: UsagePurpose.Waste,
              notes: wasteNotes,
              usageUnitId: wasteUnitId,
              wasteReason,
              isComposted,
              isRecycled,
            },
          },
        }),
      (error: any) => {
        revertOptimistic?.();
        if (!isNetworkError(error)) {
          if (isVersionConflictError(error)) {
            alertService.alert(
              'Item Updated',
              getVersionConflictMessage(error),
            );
            return;
          }
          if (isInvalidUnitError(error)) {
            alertService.alert('Invalid Unit', getInvalidUnitMessage(error));
            return;
          }
          const errorMessage =
            error.message || 'Failed to record item waste. Please try again.';
          console.error('Error recording pantry item waste:', error);
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

    const item = activeModal.item;
    const originalQty = item.quantity;
    const canOptimistic = !unitId || unitId === item.unit?.id;
    if (canOptimistic) {
      optimisticUpdateQuantity(item.id, originalQty + quantity);
    }

    // Optimistically increment activeBatchCount for instant UI feedback
    const cacheIdForBatch = client.cache.identify({
      __typename: 'PantryItem',
      id: item.id,
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
        revertQuantity(item.id, originalQty);
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
            id: item.id,
            input: {
              quantity,
              unitId,
              notes: restockNotes,
              costPerUnit,
              totalCost,
              expiresAt: expiresAtValue,
            },
          },
        }),
      (error: any) => {
        revertOptimistic();
        if (!isNetworkError(error)) {
          if (isVersionConflictError(error)) {
            alertService.alert(
              'Item Updated',
              getVersionConflictMessage(error),
            );
            return;
          }
          if (isInvalidUnitError(error)) {
            alertService.alert('Invalid Unit', getInvalidUnitMessage(error));
            return;
          }
          const errorMessage =
            error.message || 'Failed to restock item. Please try again.';
          console.error('Error restocking pantry item:', error);
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

  // Handler to open consume modal (for swipe action)
  const handleConsumeItem = (itemId: string) => {
    const item = pantryItems.find(p => p.id === itemId);
    if (item) {
      setActiveModal({ type: 'consume', item });
    }
  };

  // Handler to open waste modal (for swipe action)
  const handleWasteItem = (itemId: string) => {
    const item = pantryItems.find(p => p.id === itemId);
    if (item) {
      setActiveModal({ type: 'waste', item });
    }
  };

  // Handler to open restock modal (for swipe action)
  const handleRestockItem = (itemId: string) => {
    const item = pantryItems.find(p => p.id === itemId);
    if (item) {
      setActiveModal({ type: 'restock', item });
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
    item: activeModal.type === 'consume' ? activeModal.item : null,
    close: closeModal,
  };

  const wasteModal = {
    visible: activeModal.type === 'waste',
    item: activeModal.type === 'waste' ? activeModal.item : null,
    close: closeModal,
  };

  const restockModal = {
    visible: activeModal.type === 'restock',
    item: activeModal.type === 'restock' ? activeModal.item : null,
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
