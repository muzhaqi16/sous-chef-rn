import { useState, useCallback, useMemo, useRef } from 'react';
import { Alert } from 'react-native';
import {
  useCreatePantryItemUsageMutation,
  useRestockPantryItemMutation,
  UsagePurpose,
  WasteReason,
  PantryItemFragment,
} from '#generated';

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
  // Stable ref for pantryItems — read from ref in callbacks to keep them stable
  // across data changes (avoids context cascade when subscription updates the list)
  const pantryItemsRef = useRef(pantryItems);
  pantryItemsRef.current = pantryItems;

  // Single state for all modals — only one can be open at a time
  const [activeModal, setActiveModal] = useState<ActiveModal>(CLOSED_MODAL);

  const closeModal = useCallback(() => setActiveModal(CLOSED_MODAL), []);

  // Consume/Waste item mutation (both use createPantryItemUsage)
  const [createPantryItemUsage] = useCreatePantryItemUsageMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Failed to create pantry item usage:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to record item usage. Please try again.',
      );
    },
  });

  // Restock item mutation
  const [restockPantryItem] = useRestockPantryItemMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Failed to restock pantry item:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to restock item. Please try again.',
      );
    },
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

      try {
        await createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: activeModal.item.id,
              quantityUsed,
              purpose,
              notes: notes || undefined,
              usageUnitId,
            },
          },
        });

        // Reset state — Apollo cache normalization handles quantity updates
        closeModal();
      } catch (error) {
        console.error('Error consuming pantry item:', error);
      }
    },
    [activeModal, createPantryItemUsage, closeModal],
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

      try {
        await createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: activeModal.item.id,
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

        // Reset state — Apollo cache normalization handles quantity updates
        closeModal();
      } catch (error) {
        console.error('Error recording pantry item waste:', error);
      }
    },
    [activeModal, createPantryItemUsage, closeModal],
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

      try {
        await restockPantryItem({
          variables: {
            id: activeModal.item.id,
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

        // Reset state — Apollo cache normalization handles quantity updates
        closeModal();
      } catch (error) {
        console.error('Error restocking pantry item:', error);
      }
    },
    [activeModal, restockPantryItem, closeModal],
  );

  // Handler to open consume modal (for swipe action)
  // Reads from ref to avoid re-creating callback when pantryItems changes
  const handleConsumeItem = useCallback(
    (itemId: string) => {
      const item = pantryItemsRef.current.find(p => p.id === itemId);
      if (item) {
        setActiveModal({ type: 'consume', item });
      }
    },
    [],
  );

  // Handler to open waste modal (for swipe action)
  const handleWasteItem = useCallback(
    (itemId: string) => {
      const item = pantryItemsRef.current.find(p => p.id === itemId);
      if (item) {
        setActiveModal({ type: 'waste', item });
      }
    },
    [],
  );

  // Handler to open restock modal (for swipe action)
  const handleRestockItem = useCallback(
    (itemId: string) => {
      const item = pantryItemsRef.current.find(p => p.id === itemId);
      if (item) {
        setActiveModal({ type: 'restock', item });
      }
    },
    [],
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
