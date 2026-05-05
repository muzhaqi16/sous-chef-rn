import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { type PantryItemFragment } from '#features/pantry/graphql/pantryFragments.generated';
import { type StorageType } from '#/graphql/generated/schemaTypes';
import { usePantryItemActions } from '#features/pantry/hooks/usePantryItemActions';
import { ConsumePantryItemModal } from '#/components/modals/ConsumePantryItemModal';
import { RecordWastePantryItemModal } from '#/components/modals/RecordWastePantryItemModal';
import { RestockPantryItemModal } from '#/components/modals/RestockPantryItemModal';
import { AddToPantrySheet } from '#/components/modals/AddToPantrySheet/AddToPantrySheet';
import { AddStorageLocationSheet } from '#/components/modals/AddStorageLocationSheet/AddStorageLocationSheet';

/**
 * Context value for pantry modals.
 *
 * PERFORMANCE: Only contains stable references (ref-delegating functions + setState).
 * Volatile state (modal visibility, sheet visibility) is kept out of the context
 * because it's only consumed by the modals rendered inside the provider.
 * This prevents the entire pantry tree from re-rendering when a modal opens/closes.
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
  /** Show/hide the add-to-pantry sheet */
  setAddSheetVisible: (visible: boolean) => void;
  /** Show/hide the add-storage-location sheet */
  setAddLocationSheetVisible: (visible: boolean) => void;
}

const PantryModalsContext = createContext<PantryModalsContextValue | null>(
  null,
);

/**
 * Hook to access pantry modal actions from context.
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
  createLocation: (input: {
    name: string;
    type: StorageType;
  }) => Promise<unknown>;
  /** Whether a storage location is being created */
  creatingLocation: boolean;
  /** Optional callback to scroll list to top (called when items added and sheet closes) */
  onScrollToTop?: () => void;
  /** Current search query to pre-populate add sheet */
  searchQuery?: string;
  /** Callback to clear search query after item is added */
  onSearchQueryClear?: () => void;
}

/**
 * PantryModalsProvider - Consolidated provider for pantry modals
 *
 * PERFORMANCE: Uses ref-based stable callbacks (same pattern as PantryActionsContext).
 * The context value only contains stable references, so consumers never re-render
 * from modal state changes or pantryItems prop updates. The action functions
 * delegate to a ref that's updated via useEffect, ensuring they always access
 * the latest props without causing context value instability.
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
  searchQuery,
  onSearchQueryClear,
}: PantryModalsProviderProps) {
  // Add sheet visibility state
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [addLocationSheetVisible, setAddLocationSheetVisible] = useState(false);

  // Track whether items were added (for scroll-to-top on close)
  const [itemsAdded, setItemsAdded] = useState(false);

  // Force-close pantry-bound sheets when pantryId vanishes (e.g. last pantry
  // deleted locally, remote deletion in a shared home, or home switch with
  // no pantries). Use the "adjusting state during render" pattern so the
  // close happens in the same commit as the pantryId loss.
  const [prevPantryId, setPrevPantryId] = useState(pantryId);
  if (prevPantryId !== pantryId) {
    setPrevPantryId(pantryId);
    if (prevPantryId && !pantryId) {
      if (addSheetVisible) setAddSheetVisible(false);
      if (addLocationSheetVisible) setAddLocationSheetVisible(false);
      if (itemsAdded) setItemsAdded(false);
    }
  }

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

  // --- Ref-based stable callbacks (same pattern as PantryActionsContext) ---
  // Store latest action functions in ref so the context value stays stable.
  const latestActions = {
    handleConsumeItem,
    handleWasteItem,
    handleRestockItem,
    handleEditItem,
    handleDeleteItem,
  };
  const actionsRef = useRef(latestActions);
  useEffect(() => {
    actionsRef.current = latestActions;
  });

  // Context value: stable delegating functions + setState refs.
  // Delegates only capture actionsRef (not reactive), so the compiler
  // auto-memoizes them with empty reactive deps — context value stays stable.
  const value: PantryModalsContextValue = {
    handleConsumeItem: (id: string) => actionsRef.current.handleConsumeItem(id),
    handleWasteItem: (id: string) => actionsRef.current.handleWasteItem(id),
    handleRestockItem: (id: string) => actionsRef.current.handleRestockItem(id),
    handleEditItem: (id: string) => actionsRef.current.handleEditItem(id),
    handleDeleteItem: (id: string) => actionsRef.current.handleDeleteItem(id),
    setAddSheetVisible,
    setAddLocationSheetVisible,
  };

  const handleItemAdded = () => {
    setItemsAdded(true);
    onSearchQueryClear?.();
  };

  const handleAddSheetClose = () => {
    const shouldScroll = itemsAdded;
    setItemsAdded(false);
    setAddSheetVisible(false);
    if (shouldScroll && onScrollToTop) {
      onScrollToTop();
    }
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
          initialSearchQuery={searchQuery}
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
