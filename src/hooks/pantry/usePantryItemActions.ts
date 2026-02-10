import { useState, useCallback, useRef } from 'react';
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
  refetch: () => Promise<any>;
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
  refetch,
  removeItem,
  navigateTo,
}: UsePantryItemActionsOptions) {
  // Stable ref for pantryItems — read from ref in callbacks to keep them stable
  // across data changes (avoids context cascade when subscription updates the list)
  const pantryItemsRef = useRef(pantryItems);
  pantryItemsRef.current = pantryItems;

  // Consume item state
  const [consumeModalVisible, setConsumeModalVisible] = useState(false);
  const [selectedItemForConsume, setSelectedItemForConsume] =
    useState<PantryItemFragment | null>(null);

  // Waste item state
  const [wasteModalVisible, setWasteModalVisible] = useState(false);
  const [selectedItemForWaste, setSelectedItemForWaste] =
    useState<PantryItemFragment | null>(null);

  // Restock item state
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [selectedItemForRestock, setSelectedItemForRestock] =
    useState<PantryItemFragment | null>(null);

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
      if (!selectedItemForConsume) return;

      try {
        await createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: selectedItemForConsume.id,
              quantityUsed,
              purpose,
              notes: notes || undefined,
              usageUnitId,
            },
          },
        });

        // Reset state
        setConsumeModalVisible(false);
        setSelectedItemForConsume(null);

        // Refetch to get updated quantities
        await refetch();
      } catch (error) {
        console.error('Error consuming pantry item:', error);
      }
    },
    [selectedItemForConsume, createPantryItemUsage, refetch],
  );

  // Handler to close consume modal
  const handleCloseConsumeModal = useCallback(() => {
    setConsumeModalVisible(false);
    setSelectedItemForConsume(null);
  }, []);

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
      if (!selectedItemForWaste) return;

      try {
        await createPantryItemUsage({
          variables: {
            input: {
              pantryItemId: selectedItemForWaste.id,
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

        // Reset state
        setWasteModalVisible(false);
        setSelectedItemForWaste(null);

        // Refetch to get updated quantities
        await refetch();
      } catch (error) {
        console.error('Error recording pantry item waste:', error);
      }
    },
    [selectedItemForWaste, createPantryItemUsage, refetch],
  );

  // Handler to close waste modal
  const handleCloseWasteModal = useCallback(() => {
    setWasteModalVisible(false);
    setSelectedItemForWaste(null);
  }, []);

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
      if (!selectedItemForRestock) return;

      try {
        await restockPantryItem({
          variables: {
            id: selectedItemForRestock.id,
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

        // Reset state
        setRestockModalVisible(false);
        setSelectedItemForRestock(null);

        // Refetch to get updated quantities
        await refetch();
      } catch (error) {
        console.error('Error restocking pantry item:', error);
      }
    },
    [selectedItemForRestock, restockPantryItem, refetch],
  );

  // Handler to close restock modal
  const handleCloseRestockModal = useCallback(() => {
    setRestockModalVisible(false);
    setSelectedItemForRestock(null);
  }, []);

  // Handler to open consume modal (for swipe action)
  // Reads from ref to avoid re-creating callback when pantryItems changes
  const handleConsumeItem = useCallback(
    (itemId: string) => {
      const item = pantryItemsRef.current.find(p => p.id === itemId);
      if (item) {
        setSelectedItemForConsume(item);
        setConsumeModalVisible(true);
      }
    },
    [],
  );

  // Handler to open waste modal (for swipe action)
  // Reads from ref to avoid re-creating callback when pantryItems changes
  const handleWasteItem = useCallback(
    (itemId: string) => {
      const item = pantryItemsRef.current.find(p => p.id === itemId);
      if (item) {
        setSelectedItemForWaste(item);
        setWasteModalVisible(true);
      }
    },
    [],
  );

  // Handler to open restock modal (for swipe action)
  // Reads from ref to avoid re-creating callback when pantryItems changes
  const handleRestockItem = useCallback(
    (itemId: string) => {
      const item = pantryItemsRef.current.find(p => p.id === itemId);
      if (item) {
        setSelectedItemForRestock(item);
        setRestockModalVisible(true);
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

  return {
    // Modal states with close handlers
    consumeModal: {
      visible: consumeModalVisible,
      item: selectedItemForConsume,
      close: handleCloseConsumeModal,
    } as ModalState,
    wasteModal: {
      visible: wasteModalVisible,
      item: selectedItemForWaste,
      close: handleCloseWasteModal,
    } as ModalState,
    restockModal: {
      visible: restockModalVisible,
      item: selectedItemForRestock,
      close: handleCloseRestockModal,
    } as ModalState,

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
