import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useCreatePantryItemUsageMutation,
  useRecordPantryItemWasteMutation,
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

  // Consume item mutation
  const [createPantryItemUsage] = useCreatePantryItemUsageMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Failed to create pantry item usage:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to record item consumption. Please try again.',
      );
    },
  });

  // Waste item mutation
  const [recordPantryItemWaste] = useRecordPantryItemWasteMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Failed to record pantry item waste:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to record waste. Please try again.',
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
      weightUsed?: number,
      weightUsedUnitId?: string,
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
              weightUsed,
              weightUsedUnitId,
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

  // Handler to confirm waste recording
  const handleConfirmWaste = useCallback(
    async (
      wasteAmount: number,
      wasteReason: WasteReason,
      isComposted: boolean,
      isRecycled: boolean,
      _notes: string,
      wasteUnitId?: string,
      wasteWeight?: number,
      wasteWeightUnitId?: string,
    ) => {
      if (!selectedItemForWaste) return;

      try {
        await recordPantryItemWaste({
          variables: {
            id: selectedItemForWaste.id,
            wasteAmount,
            wasteReason,
            wasteUnitId,
            wasteWeight,
            wasteWeightUnitId,
            isComposted,
            isRecycled,
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
    [selectedItemForWaste, recordPantryItemWaste, refetch],
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
      weight?: number,
      weightUnitId?: string,
      costPerUnit?: number,
      totalCost?: number,
    ) => {
      if (!selectedItemForRestock) return;

      try {
        await restockPantryItem({
          variables: {
            id: selectedItemForRestock.id,
            input: {
              quantity,
              unitId,
              weight,
              weightUnitId,
              notes: notes || undefined,
              costPerUnit,
              totalCost,
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
  const handleConsumeItem = useCallback(
    (itemId: string) => {
      const item = pantryItems.find(p => p.id === itemId);
      if (item) {
        setSelectedItemForConsume(item);
        setConsumeModalVisible(true);
      }
    },
    [pantryItems],
  );

  // Handler to open waste modal (for swipe action)
  const handleWasteItem = useCallback(
    (itemId: string) => {
      const item = pantryItems.find(p => p.id === itemId);
      if (item) {
        setSelectedItemForWaste(item);
        setWasteModalVisible(true);
      }
    },
    [pantryItems],
  );

  // Handler to open restock modal (for swipe action)
  const handleRestockItem = useCallback(
    (itemId: string) => {
      const item = pantryItems.find(p => p.id === itemId);
      if (item) {
        setSelectedItemForRestock(item);
        setRestockModalVisible(true);
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
