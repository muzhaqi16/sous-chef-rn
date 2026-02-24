import { useState, useCallback, useMemo } from 'react';
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

interface UsePantryItemActionsOptions {
  pantryItems: PantryItemFragment[];
  removeItem: (id: string) => Promise<void>;
  navigateTo: {
    pantryItem: (params: { itemId: string }) => void;
  };
}

interface ModalState {
  visible: boolean;
  item: PantryItemFragment | null;
  close: () => void;
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

  const closeModal = useCallback(() => setActiveModal(CLOSED_MODAL), []);

  /**
   * Optimistically update a pantry item's quantity in cache for instant UI feedback.
   */
  const optimisticUpdateQuantity = useCallback(
    (itemId: string, newQuantity: number) => {
      const cacheId = client.cache.identify({ __typename: 'PantryItem', id: itemId });
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
    },
    [client.cache],
  );

  /**
   * Revert a pantry item's quantity in cache on mutation error.
   */
  const revertQuantity = useCallback(
    (itemId: string, originalQty: number) => {
      const cacheId = client.cache.identify({ __typename: 'PantryItem', id: itemId });
      if (!cacheId) return;

      client.cache.modify({
        id: cacheId,
        fields: {
          quantity() {
            return originalQty;
          },
        },
      });
    },
    [client.cache],
  );

  // Consume/Waste item mutation (both use createPantryItemUsage)
  const [createPantryItemUsage] = useCreatePantryItemUsageMutation({
    errorPolicy: 'all',
  });

  // Restock item mutation
  const [restockPantryItem] = useRestockPantryItemMutation({
    errorPolicy: 'all',
  });

  // Handler to confirm consumption
  const handleConfirmConsume = useCallback(
    async (
      quantityUsed: number,
      _quantityInput: string,
      purpose: UsagePurpose,
      notes: string,
      usageUnitId?: string,
    ) => {
      if (activeModal.type !== 'consume') return;

      // Optimistically decrease quantity for instant UI feedback
      const item = activeModal.item;
      const originalQty = item.quantity;
      optimisticUpdateQuantity(item.id, originalQty - quantityUsed);

      try {
        await createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: item.id,
              quantityUsed,
              purpose,
              notes: notes || undefined,
              usageUnitId,
            },
          },
        });

        closeModal();
      } catch (error: any) {
        revertQuantity(item.id, originalQty);
        if (!isNetworkError(error)) {
          console.error('Error consuming pantry item:', error);
          Alert.alert('Error', error.message || 'Failed to record item usage. Please try again.');
        }
      }
    },
    [activeModal, createPantryItemUsage, closeModal, optimisticUpdateQuantity, revertQuantity],
  );

  // Handler to confirm waste recording (uses createPantryItemUsage with purpose: WASTE)
  const handleConfirmWaste = useCallback(
    async (
      wasteAmount: number,
      wasteReason: WasteReason,
      isComposted: boolean,
      isRecycled: boolean,
      notes: string,
      wasteUnitId?: string,
    ) => {
      if (activeModal.type !== 'waste') return;

      // Optimistically decrease quantity for instant UI feedback
      const item = activeModal.item;
      const originalQty = item.quantity;
      optimisticUpdateQuantity(item.id, originalQty - wasteAmount);

      try {
        await createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: item.id,
              quantityUsed: wasteAmount,
              purpose: UsagePurpose.Waste,
              notes: notes || undefined,
              usageUnitId: wasteUnitId,
              wasteReason,
              isComposted,
              isRecycled,
            },
          },
        });

        closeModal();
      } catch (error: any) {
        revertQuantity(item.id, originalQty);
        if (!isNetworkError(error)) {
          console.error('Error recording pantry item waste:', error);
          Alert.alert('Error', error.message || 'Failed to record item waste. Please try again.');
        }
      }
    },
    [activeModal, createPantryItemUsage, closeModal, optimisticUpdateQuantity, revertQuantity],
  );

  // Handler to confirm restock
  const handleConfirmRestock = useCallback(
    async (
      quantity: number,
      _quantityInput: string,
      notes: string,
      unitId?: string,
      costPerUnit?: number,
      totalCost?: number,
      expiresAt?: Date | null,
    ) => {
      if (activeModal.type !== 'restock') return;

      // Optimistically increase quantity for instant UI feedback
      const item = activeModal.item;
      const originalQty = item.quantity;
      optimisticUpdateQuantity(item.id, originalQty + quantity);

      try {
        await restockPantryItem({
          variables: {
            id: item.id,
            input: {
              quantity,
              unitId,
              notes: notes || undefined,
              costPerUnit,
              totalCost,
              expiresAt: expiresAt ? expiresAt.toISOString() : null,
            },
          },
        });

        closeModal();
      } catch (error: any) {
        revertQuantity(item.id, originalQty);
        if (!isNetworkError(error)) {
          console.error('Error restocking pantry item:', error);
          Alert.alert('Error', error.message || 'Failed to restock item. Please try again.');
        }
      }
    },
    [activeModal, restockPantryItem, closeModal, optimisticUpdateQuantity, revertQuantity],
  );

  // Handler to open consume modal (for swipe action)
  const handleConsumeItem = useCallback(
    (itemId: string) => {
      const item = pantryItems.find(p => p.id === itemId);
      if (item) {
        setActiveModal({ type: 'consume', item });
      }
    },
    [pantryItems],
  );

  // Handler to open waste modal (for swipe action)
  const handleWasteItem = useCallback(
    (itemId: string) => {
      const item = pantryItems.find(p => p.id === itemId);
      if (item) {
        setActiveModal({ type: 'waste', item });
      }
    },
    [pantryItems],
  );

  // Handler to open restock modal (for swipe action)
  const handleRestockItem = useCallback(
    (itemId: string) => {
      const item = pantryItems.find(p => p.id === itemId);
      if (item) {
        setActiveModal({ type: 'restock', item });
      }
    },
    [pantryItems],
  );

  // Handler to edit item (for swipe action)
  const handleEditItem = useCallback(
    (itemId: string) => {
      navigateTo.pantryItem({ itemId });
    },
    [navigateTo],
  );

  // Handler to delete item (for swipe action)
  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      try {
        await removeItem(itemId);
      } catch (error) {
        console.error('Error deleting pantry item:', error);
      }
    },
    [removeItem],
  );

  // Derive modal states from the single activeModal for backward compatibility
  const consumeModal = useMemo<ModalState>(() => ({
    visible: activeModal.type === 'consume',
    item: activeModal.type === 'consume' ? activeModal.item : null,
    close: closeModal,
  }), [activeModal, closeModal]);

  const wasteModal = useMemo<ModalState>(() => ({
    visible: activeModal.type === 'waste',
    item: activeModal.type === 'waste' ? activeModal.item : null,
    close: closeModal,
  }), [activeModal, closeModal]);

  const restockModal = useMemo<ModalState>(() => ({
    visible: activeModal.type === 'restock',
    item: activeModal.type === 'restock' ? activeModal.item : null,
    close: closeModal,
  }), [activeModal, closeModal]);

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
