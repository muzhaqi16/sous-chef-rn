import { useState } from 'react';
import { Alert } from 'react-native';
import { useApolloClient } from '@apollo/client/react';
import {
  useCreatePantryItemUsageMutation,
  useRestockPantryItemMutation,
  UsagePurpose,
  WasteReason,
  PantryItemFragment,
} from '#generated';
import { isNetworkError } from '#/utils/isNetworkError';
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
        if (canOptimistic) {
          revertQuantity(item.id, originalQty);
        }
        if (!isNetworkError(error)) {
          const errorMessage =
            error.message || 'Failed to record item usage. Please try again.';
          console.error('Error consuming pantry item:', error);
          Alert.alert('Error', errorMessage);
        }
      },
    );
    if (!consumeResult) return;

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
        if (canOptimistic) {
          revertQuantity(item.id, originalQty);
        }
        if (!isNetworkError(error)) {
          const errorMessage =
            error.message || 'Failed to record item waste. Please try again.';
          console.error('Error recording pantry item waste:', error);
          Alert.alert('Error', errorMessage);
        }
      },
    );
    if (!wasteResult) return;

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

    const restockNotes = notes || undefined;
    const expiresAtValue = expiresAt ? expiresAt.toISOString() : null;
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
        if (canOptimistic) {
          revertQuantity(item.id, originalQty);
        }
        if (!isNetworkError(error)) {
          const errorMessage =
            error.message || 'Failed to restock item. Please try again.';
          console.error('Error restocking pantry item:', error);
          Alert.alert('Error', errorMessage);
        }
      },
    );
    if (!restockResult) return;

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
