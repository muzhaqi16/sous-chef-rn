import React, { createContext, useContext, type ReactNode } from 'react';
import { createActionsContext } from '#hooks/utils/createActionsContext';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { MoveToPantryModal } from '#features/shoppingList/components/moveToPantry/MoveToPantryModal';
import { AddToShoppingListSheet } from '#features/shoppingList/components/AddToShoppingListSheet/AddToShoppingListSheet';
import { QuantityEditSheet } from '#features/shoppingList/components/QuantityEditSheet/QuantityEditSheet';
import { PurchaseAmountSheet } from '#features/shoppingList/components/PurchaseAmountSheet/PurchaseAmountSheet';
import { useAddItemSheet } from '#features/shoppingList/hooks/useAddItemSheet';
import { useQuantityEditModal } from '#features/shoppingList/hooks/useQuantityEditModal';
import {
  usePurchaseAmountModal,
  type RecordPurchaseAmounts,
} from '#features/shoppingList/hooks/usePurchaseAmountModal';
import { useMoveToPantryModal } from '#features/shoppingList/hooks/useMoveToPantryModal';
import { useShoppingListTutorialActions } from '#features/shoppingList/context/ShoppingListTutorialContext';

/**
 * The four sheets are opened from all over the screen and read back in exactly
 * one place, so they are two contexts: stable commands, and the single boolean
 * that place needs. Handing out the hook results instead gave a tab scene a
 * value whose identity changed every time any sheet opened.
 */
interface ShoppingListModalActions {
  openAddItemSheet: () => void;
  openQuantityEdit: (itemId: string) => void;
  openPurchaseAmount: (itemId: string) => void;
  openMoveToPantry: (itemId: string) => void;
}

const {
  Provider: ShoppingListModalActionsProvider,
  useActions: useShoppingListModalActions,
} = createActionsContext<ShoppingListModalActions>('ShoppingListModalsContext');

export { useShoppingListModalActions };

const AnySheetVisibleContext = createContext(false);

/** True while any of the four sheets is on screen. */
export function useAnyShoppingListSheetVisible(): boolean {
  return useContext(AnySheetVisibleContext);
}

interface ShoppingListModalsProviderProps {
  children: ReactNode;
  currentListId: string | undefined;
  items: ShoppingListItemDisplayFragment[];
  /** Owned by `useToggleShoppingItem`, threaded down via the screen facade. */
  recordPurchase: (
    itemId: string,
    amounts: RecordPurchaseAmounts,
  ) => Promise<boolean>;
  searchQuery: string;
  onSearchQueryClear: () => void;
  onNavigateToListSettings: () => void;
}

/** Owns every shopping-list modal's state, and renders the modals itself. */
export function ShoppingListModalsProvider({
  children,
  currentListId,
  items,
  recordPurchase,
  searchQuery,
  onSearchQueryClear,
  onNavigateToListSettings,
}: ShoppingListModalsProviderProps) {
  const tutorial = useShoppingListTutorialActions();

  const addItemSheet = useAddItemSheet({
    currentListId,
    onNavigateToListSettings,
  });

  const quantityEdit = useQuantityEditModal({
    items,
  });

  const purchaseAmount = usePurchaseAmountModal({
    items,
    recordPurchase,
  });

  const moveToPantry = useMoveToPantryModal({
    currentListId,
    items,
  });

  const actions: ShoppingListModalActions = {
    openAddItemSheet: addItemSheet.open,
    openQuantityEdit: quantityEdit.openForItem,
    openPurchaseAmount: purchaseAmount.openForItem,
    openMoveToPantry: moveToPantry.openForItem,
  };

  const anyVisible =
    addItemSheet.visible ||
    quantityEdit.visible ||
    purchaseAmount.visible ||
    moveToPantry.visible;

  return (
    <ShoppingListModalActionsProvider actions={actions}>
      <AnySheetVisibleContext.Provider value={anyVisible}>
        {children}
      </AnySheetVisibleContext.Provider>

      <MoveToPantryModal
        visible={moveToPantry.visible}
        shoppingListItemId={moveToPantry.selectedItemId}
        pantries={moveToPantry.pantries}
        selectedPantryId={moveToPantry.selectedPantryId}
        onClose={moveToPantry.close}
        onConfirm={moveToPantry.confirm}
      />

      <AddToShoppingListSheet
        visible={addItemSheet.visible}
        shoppingListId={currentListId}
        onClose={() => {
          addItemSheet.close();
          tutorial?.notifySheetClosed();
        }}
        initialSearchQuery={searchQuery}
        onItemAdded={onSearchQueryClear}
      />

      <QuantityEditSheet
        visible={quantityEdit.visible}
        item={quantityEdit.selectedItem}
        onClose={quantityEdit.close}
        onSave={quantityEdit.save}
        loading={quantityEdit.isLoading}
      />

      <PurchaseAmountSheet
        visible={purchaseAmount.visible}
        item={purchaseAmount.selectedItem}
        onClose={() => {
          purchaseAmount.close();
          tutorial?.notifyLongPressPriceSeen();
        }}
        onConfirm={async (quantity, price) => {
          await purchaseAmount.confirm(quantity, price);
          tutorial?.notifyLongPressPriceSeen();
        }}
        loading={purchaseAmount.isLoading}
      />
    </ShoppingListModalActionsProvider>
  );
}
