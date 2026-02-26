import { createContext, useContext } from 'react';
import type React from 'react';

/**
 * Action callbacks for shopping list item interactions.
 * Provided via context to avoid threading through renderScene's dependency array,
 * which would cause TabView to re-call renderScene for all tabs on any callback change.
 */
export interface ShoppingListTabsActions {
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;
  onSwipeableWillOpen?: (ref: any) => void;
  onSwipeableClose?: () => void;
}

const ShoppingListTabsActionsContext =
  createContext<ShoppingListTabsActions | null>(null);

interface ProviderProps {
  children: React.ReactNode;
  actions: ShoppingListTabsActions;
}

export const ShoppingListTabsActionsProvider: React.FC<ProviderProps> = ({
  children,
  actions,
}) => {
  return (
    <ShoppingListTabsActionsContext.Provider value={actions}>
      {children}
    </ShoppingListTabsActionsContext.Provider>
  );
};

export function useShoppingListTabsActions(): ShoppingListTabsActions {
  const ctx = useContext(ShoppingListTabsActionsContext);
  if (!ctx) {
    throw new Error(
      'useShoppingListTabsActions must be used within ShoppingListTabsActionsProvider',
    );
  }
  return ctx;
}
