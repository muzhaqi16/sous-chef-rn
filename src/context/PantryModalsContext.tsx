import React, { createContext, useContext, useState, type ReactNode } from 'react';
import type { PantryItemFragment, StorageType } from '#generated';
import { usePantryItemActions } from '#/hooks/pantry/usePantryItemActions';
import { ConsumePantryItemModal } from '#/components/modals/ConsumePantryItemModal';
import { RecordWastePantryItemModal } from '#/components/modals/RecordWastePantryItemModal';
import { RestockPantryItemModal } from '#/components/modals/RestockPantryItemModal';
import { AddToPantrySheet } from '#/components/modals/AddToPantrySheet/AddToPantrySheet';
import { AddStorageLocationSheet } from '#/components/modals/AddStorageLocationSheet/AddStorageLocationSheet';

/**
 * Context value for pantry modals.
 * Provides access to all modal state and actions.
 */
interface PantryModalsContextValue {
  /** Open consume modal for a pantry item */
  handleConsumeItem: (itemId: string) => void;
  /** Open waste modal for a pantry item */
  handleWasteItem: (itemId: string) => void;
  /** Open restock modal for a pantry item */
  handleRestockItem: (itemId: string) => void;
  /** Navigate to edit a pantry item */
  handleEditItem: (itemId: string) => void;
  /** Delete a pantry item */
  handleDeleteItem: (itemId: string) => Promise<void>;
  /** Whether the add-to-pantry sheet is visible */
  addSheetVisible: boolean;
  /** Show/hide the add-to-pantry sheet */
  setAddSheetVisible: (visible: boolean) => void;
  /** Whether the add-storage-location sheet is visible */
  addLocationSheetVisible: boolean;
  /** Show/hide the add-storage-location sheet */
  setAddLocationSheetVisible: (visible: boolean) => void;
  /** Close the add sheet (scrolls to top if items were added) */
  handleAddSheetClose: () => void;
  /** Track that an item was added (for scroll-to-top on close) */
  handleItemAdded: () => void;
}

const PantryModalsContext = createContext<PantryModalsContextValue | null>(null);

/**
 * Hook to access pantry modals from context.
 * Must be used within PantryModalsProvider.
 *
 * @example
 * ```tsx
 * const { handleConsumeItem, setAddSheetVisible } = usePantryModals();
 *
 * // Open consume modal for an item
 * handleConsumeItem(itemId);
 *
 * // Open add-to-pantry sheet
 * setAddSheetVisible(true);
 * ```
 */
export function usePantryModals() {
  const context = useContext(PantryModalsContext);
  if (!context) {
    throw new Error('usePantryModals must be used within PantryModalsProvider');
  }
  return context;
}

interface PantryModalsProviderProps {
  children: ReactNode;
  /** Current pantry ID */
  pantryId: string | undefined;
  /** Items array for modal item lookup */
  pantryItems: PantryItemFragment[];
  /** Remove a pantry item by ID */
  removeItem: (id: string) => Promise<void>;
  /** Navigation callbacks */
  navigateTo: { pantryItem: (params: { itemId: string }) => void };
  /** Create a new storage location */
  createLocation: (input: { name: string; type: StorageType }) => Promise<unknown>;
  /** Whether a storage location is being created */
  creatingLocation: boolean;
  /** Optional callback to scroll list to top (called when items added and sheet closes) */
  onScrollToTop?: () => void;
}

/**
 * PantryModalsProvider - Consolidated provider for pantry modals
 *
 * Combines all pantry modal hooks into a single provider:
 * - ConsumePantryItemModal
 * - RecordWastePantryItemModal
 * - RestockPantryItemModal
 * - AddToPantrySheet
 * - AddStorageLocationSheet
 *
 * Benefits:
 * - Single source of truth for modal state
 * - Modals render inside provider (not in PantryMain)
 * - Prevents multiple modals opening simultaneously
 * - Reduces hook count in consuming component
 *
 * @example
 * ```tsx
 * // In PantryMain.tsx
 * return (
 *   <PantryModalsProvider
 *     pantryId={pantry?.id}
 *     pantryItems={pantryItems}
 *     removeItem={handleRemoveItem}
 *     navigateTo={stableNavigateTo}
 *     createLocation={createLocation}
 *     creatingLocation={creatingLocation}
 *   >
 *     <View>
 *       {/* Screen content - modals render inside provider *\/}
 *     </View>
 *   </PantryModalsProvider>
 * );
 *
 * // In child component
 * const { handleConsumeItem, setAddSheetVisible } = usePantryModals();
 * ```
 */
export function PantryModalsProvider({
  children,
  pantryId,
  pantryItems,
  removeItem,
  navigateTo,
  createLocation,
  creatingLocation,
  onScrollToTop,
}: PantryModalsProviderProps) {
  // Add sheet visibility state
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [addLocationSheetVisible, setAddLocationSheetVisible] = useState(false);

  // Track whether items were added (for scroll-to-top on close)
  const [itemsAdded, setItemsAdded] = useState(false);

  // Initialize pantry item actions hook
  const {
    consumeModal,
    wasteModal,
    restockModal,
    handleConfirmConsume,
    handleConfirmWaste,
    handleConfirmRestock,
    handleConsumeItem,
    handleWasteItem,
    handleRestockItem,
    handleEditItem,
    handleDeleteItem,
  } = usePantryItemActions({
    pantryItems,
    removeItem,
    navigateTo,
  });

  const handleItemAdded = () => {
    setItemsAdded(true);
  };

  const handleAddSheetClose = () => {
    const shouldScroll = itemsAdded;
    setItemsAdded(false);
    setAddSheetVisible(false);
    if (shouldScroll && onScrollToTop) {
      onScrollToTop();
    }
  };

  const value: PantryModalsContextValue = {
    handleConsumeItem,
    handleWasteItem,
    handleRestockItem,
    handleEditItem,
    handleDeleteItem,
    addSheetVisible,
    setAddSheetVisible,
    addLocationSheetVisible,
    setAddLocationSheetVisible,
    handleAddSheetClose,
    handleItemAdded,
  };

  return (
    <PantryModalsContext.Provider value={value}>
      {children}

      {/* Consume Pantry Item Modal */}
      {!!consumeModal.visible && (
        <ConsumePantryItemModal
          visible={consumeModal.visible}
          pantryItem={consumeModal.item}
          onClose={consumeModal.close}
          onConfirm={handleConfirmConsume}
        />
      )}

      {/* Record Waste Pantry Item Modal */}
      {!!wasteModal.visible && (
        <RecordWastePantryItemModal
          visible={wasteModal.visible}
          pantryItem={wasteModal.item}
          onClose={wasteModal.close}
          onConfirm={handleConfirmWaste}
        />
      )}

      {/* Restock Pantry Item Modal */}
      {!!restockModal.visible && (
        <RestockPantryItemModal
          visible={restockModal.visible}
          pantryItem={restockModal.item}
          onClose={restockModal.close}
          onConfirm={handleConfirmRestock}
        />
      )}

      {/* Add to Pantry Sheet */}
      {!!addSheetVisible && (
        <AddToPantrySheet
          visible={addSheetVisible}
          pantryId={pantryId}
          onClose={handleAddSheetClose}
          onItemAdded={handleItemAdded}
        />
      )}

      {/* Add Storage Location Sheet */}
      {!!addLocationSheetVisible && (
        <AddStorageLocationSheet
          visible={addLocationSheetVisible}
          onClose={() => setAddLocationSheetVisible(false)}
          onCreateLocation={createLocation}
          creating={creatingLocation}
        />
      )}
    </PantryModalsContext.Provider>
  );
}
