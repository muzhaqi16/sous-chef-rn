import React, { createContext, useContext, type ReactNode } from 'react';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { MoveToPantryModal } from '#features/shoppingList/components/moveToPantry/MoveToPantryModal';
import { AddToShoppingListSheet } from '#features/shoppingList/components/AddToShoppingListSheet/AddToShoppingListSheet';
import { QuantityEditSheet } from '#features/shoppingList/components/QuantityEditSheet/QuantityEditSheet';
import { PurchaseAmountSheet } from '#features/shoppingList/components/PurchaseAmountSheet/PurchaseAmountSheet';
import {
  useAddItemSheet,
  type UseAddItemSheetResult,
} from '#features/shoppingList/hooks/useAddItemSheet';
import {
  useQuantityEditModal,
  type UseQuantityEditModalResult,
} from '#features/shoppingList/hooks/useQuantityEditModal';
import {
  usePurchaseAmountModal,
  type UsePurchaseAmountModalResult,
  type RecordPurchaseAmounts,
} from '#features/shoppingList/hooks/usePurchaseAmountModal';
import {
  useMoveToPantryModal,
  type UseMoveToPantryModalResult,
} from '#features/shoppingList/hooks/useMoveToPantryModal';
import { useShoppingListTutorialActions } from '#features/shoppingList/context/ShoppingListTutorialContext';

interface ShoppingListModalsContextValue {
  addItemSheet: UseAddItemSheetResult;
  quantityEdit: UseQuantityEditModalResult;
  purchaseAmount: UsePurchaseAmountModalResult;
  moveToPantry: UseMoveToPantryModalResult;
}

const ShoppingListModalsContext =
  createContext<ShoppingListModalsContextValue | null>(null);

export function useShoppingListModals() {
  const context = useContext(ShoppingListModalsContext);
  if (!context) {
    throw new Error(
      'useShoppingListModals must be used within ShoppingListModalsProvider',
    );
  }
  return context;
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

  const value: ShoppingListModalsContextValue = {
    addItemSheet,
    quantityEdit,
    purchaseAmount,
    moveToPantry,
  };

  return (
    <ShoppingListModalsContext.Provider value={value}>
      {children}

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
    </ShoppingListModalsContext.Provider>
  );
}
