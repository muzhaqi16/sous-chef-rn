import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { type StorageType } from '#/graphql/generated/schemaTypes';
import { usePantryItemActions } from '#features/pantry/hooks/usePantryItemActions';
import { ConsumePantryItemModal } from '#features/pantry/components/modals/ConsumePantryItemModal';
import { RecordWastePantryItemModal } from '#features/pantry/components/modals/RecordWastePantryItemModal';
import { RestockPantryItemModal } from '#features/pantry/components/modals/RestockPantryItemModal';
import { AddToPantrySheet } from '#features/pantry/components/modals/AddToPantrySheet/AddToPantrySheet';
import { AddStorageLocationSheet } from '#features/catalog/ui/AddStorageLocationSheet/AddStorageLocationSheet';

/**
 * Stable references only. Modal/sheet visibility stays out of the context — it is
 * consumed solely by the modals rendered inside the provider, so opening one does
 * not re-render the pantry tree.
 */
interface PantryModalsContextValue {
  handleConsumeItem: (itemId: string) => void;
  handleWasteItem: (itemId: string) => void;
  handleRestockItem: (itemId: string) => void;
  handleEditItem: (itemId: string) => void;
  handleDeleteItem: (itemId: string) => Promise<void>;
  setAddSheetVisible: (visible: boolean) => void;
  setAddLocationSheetVisible: (visible: boolean) => void;
}

const PantryModalsContext = createContext<PantryModalsContextValue | null>(
  null,
);

export function usePantryModals() {
  const context = useContext(PantryModalsContext);
  if (!context) {
    throw new Error('usePantryModals must be used within PantryModalsProvider');
  }
  return context;
}

interface PantryModalsProviderProps {
  children: ReactNode;
  pantryId: string | undefined;
  removeItem: (id: string) => Promise<void>;
  navigateTo: { pantryItem: (params: { itemId: string }) => void };
  createLocation: (input: {
    name: string;
    type: StorageType;
  }) => Promise<unknown>;
  creatingLocation: boolean;
  /** Called when the add sheet closes after items were added. */
  onScrollToTop?: () => void;
  searchQuery?: string;
  onSearchQueryClear?: () => void;
}

export function PantryModalsProvider({
  children,
  pantryId,
  removeItem,
  navigateTo,
  createLocation,
  creatingLocation,
  onScrollToTop,
  searchQuery,
  onSearchQueryClear,
}: PantryModalsProviderProps) {
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [addLocationSheetVisible, setAddLocationSheetVisible] = useState(false);

  const [itemsAdded, setItemsAdded] = useState(false);

  // Force-close pantry-bound sheets when pantryId vanishes. Adjusting state
  // during render closes them in the same commit as the pantryId loss.
  const [prevPantryId, setPrevPantryId] = useState(pantryId);
  if (prevPantryId !== pantryId) {
    setPrevPantryId(pantryId);
    if (prevPantryId && !pantryId) {
      setAddSheetVisible(false);
      setAddLocationSheetVisible(false);
      setItemsAdded(false);
    }
  }

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
    removeItem,
    navigateTo,
  });

  // Latest actions live in a ref so the context value stays stable.
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

  // Delegates capture only actionsRef (not reactive), so the compiler
  // auto-memoizes them with empty deps and the context value stays stable.
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

      {!!consumeModal.visible && (
        <ConsumePantryItemModal
          visible={consumeModal.visible}
          pantryItemId={consumeModal.itemId}
          onClose={consumeModal.close}
          onConfirm={handleConfirmConsume}
        />
      )}

      {!!wasteModal.visible && (
        <RecordWastePantryItemModal
          visible={wasteModal.visible}
          pantryItemId={wasteModal.itemId}
          onClose={wasteModal.close}
          onConfirm={handleConfirmWaste}
        />
      )}

      {!!restockModal.visible && (
        <RestockPantryItemModal
          visible={restockModal.visible}
          pantryItemId={restockModal.itemId}
          onClose={restockModal.close}
          onConfirm={handleConfirmRestock}
        />
      )}

      {!!addSheetVisible && (
        <AddToPantrySheet
          visible={addSheetVisible}
          pantryId={pantryId}
          onClose={handleAddSheetClose}
          onItemAdded={handleItemAdded}
          initialSearchQuery={searchQuery}
        />
      )}

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
