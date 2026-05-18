import React, { createContext, useContext, type ReactNode } from 'react';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { MoveToPantryModal } from '#/components/modals/MoveToPantryModal';
import { AddToShoppingListSheet } from '#/components/modals/AddToShoppingListSheet/AddToShoppingListSheet';
import { QuantityEditSheet } from '#/components/modals/QuantityEditSheet/QuantityEditSheet';
import {
  useAddItemSheet,
  type UseAddItemSheetResult,
} from '#features/shoppingList/hooks/useAddItemSheet';
import {
  useQuantityEditModal,
  type UseQuantityEditModalResult,
} from '#features/shoppingList/hooks/useQuantityEditModal';
import {
  useMoveToPantryModal,
  type UseMoveToPantryModalResult,
} from '#features/shoppingList/hooks/useMoveToPantryModal';
import { useShoppingListTutorialActions } from '#features/shoppingList/context/ShoppingListTutorialContext';

/**
 * Context value for shopping list modals.
 * Provides access to all modal state and actions.
 */
interface ShoppingListModalsContextValue {
  /** Add item sheet state and actions */
  addItemSheet: UseAddItemSheetResult;
  /** Quantity edit modal state and actions */
  quantityEdit: UseQuantityEditModalResult;
  /** Move to pantry modal state and actions */
  moveToPantry: UseMoveToPantryModalResult;
}

const ShoppingListModalsContext =
  createContext<ShoppingListModalsContextValue | null>(null);

/**
 * Hook to access shopping list modals from context.
 * Must be used within ShoppingListModalsProvider.
 *
 * @example
 * ```tsx
 * const { addItemSheet, quantityEdit, moveToPantry } = useShoppingListModals();
 *
 * // Open add item sheet
 * addItemSheet.open();
 *
 * // Open quantity edit for an item
 * quantityEdit.openForItem(itemId);
 *
 * // Open move to pantry for an item
 * moveToPantry.openForItem(itemId);
 * ```
 */
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
  /** Current shopping list ID */
  currentListId: string | undefined;
  /** Items array for modal item lookup */
  items: ShoppingListItemDisplayFragment[];
  /** Current search query (for AddToShoppingListSheet) */
  searchQuery: string;
  /** Callback when search query should be cleared */
  onSearchQueryClear: () => void;
  /** Callback to navigate to list settings */
  onNavigateToListSettings: () => void;
}

/**
 * ShoppingListModalsProvider - Consolidated provider for shopping list modals
 *
 * Combines all three modal hooks into a single provider:
 * - AddToShoppingListSheet
 * - QuantityEditSheet
 * - MoveToPantryModal
 *
 * Benefits:
 * - Single source of truth for modal state
 * - Modals render inside provider (not in ShoppingListMain)
 * - Prevents multiple modals opening simultaneously
 * - Reduces hook count in consuming component
 *
 * @example
 * ```tsx
 * // In ShoppingListMain.tsx
 * return (
 *   <ShoppingListModalsProvider
 *     currentListId={currentListId}
 *     items={items}
 *     searchQuery={searchQuery}
 *     onSearchQueryClear={() => setSearchQuery('')}
 *     onNavigateToListSettings={() => navigate('ListSettings')}
 *   >
 *     <View>
 *       {/* Screen content - modals render inside provider *\/}
 *     </View>
 *   </ShoppingListModalsProvider>
 * );
 *
 * // In child component
 * const { addItemSheet } = useShoppingListModals();
 * <Button onPress={addItemSheet.open}>Add Item</Button>
 * ```
 */
export function ShoppingListModalsProvider({
  children,
  currentListId,
  items,
  searchQuery,
  onSearchQueryClear,
  onNavigateToListSettings,
}: ShoppingListModalsProviderProps) {
  const tutorial = useShoppingListTutorialActions();

  // Initialize all modal hooks
  const addItemSheet = useAddItemSheet({
    currentListId,
    onNavigateToListSettings,
  });

  const quantityEdit = useQuantityEditModal({
    items,
  });

  const moveToPantry = useMoveToPantryModal({
    currentListId,
    items,
  });

  const value: ShoppingListModalsContextValue = {
    addItemSheet,
    quantityEdit,
    moveToPantry,
  };

  return (
    <ShoppingListModalsContext.Provider value={value}>
      {children}

      {/* Move to Pantry Modal */}
      <MoveToPantryModal
        visible={moveToPantry.visible}
        shoppingListItemId={moveToPantry.selectedItemId}
        pantries={moveToPantry.pantries}
        selectedPantryId={moveToPantry.selectedPantryId}
        onClose={moveToPantry.close}
        onConfirm={moveToPantry.confirm}
      />

      {/* Add to Shopping List Sheet */}
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

      {/* Quantity Edit Sheet */}
      <QuantityEditSheet
        visible={quantityEdit.visible}
        item={quantityEdit.selectedItem}
        onClose={quantityEdit.close}
        onSave={quantityEdit.save}
        loading={quantityEdit.isLoading}
      />
    </ShoppingListModalsContext.Provider>
  );
}
