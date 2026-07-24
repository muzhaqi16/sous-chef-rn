import { createContext, useContext, useRef, useEffect, useState } from 'react';
import type React from 'react';
import type { SwipeableRef } from '#/components/molecules/SwipeableItem/types';

/**
 * Action callbacks for shopping list item interactions.
 * Provided via context to avoid threading through renderScene's dependency array,
 * which would cause TabView to re-call renderScene for all tabs on any callback change.
 */
export interface ShoppingListTabsActions {
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTogglePurchase?: (id: string, opts?: { withDetails?: boolean }) => void;
  onMoveToPantry?: (id: string) => void;
  onQuantityPress?: (id: string) => void;
  onSortOrderUpdate?: (
    itemId: string,
    afterItemId: string | null,
    beforeItemId: string | null,
  ) => void;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
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
  // Store latest actions in ref — updated via effect, doesn't trigger re-renders
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  // One-time stable callbacks that delegate to ref
  // Uses useState initializer (not useMemo, which is banned by ESLint)
  const [stableActions] = useState<ShoppingListTabsActions>(() => ({
    onItemPress: (id: string) => actionsRef.current.onItemPress(id),
    onItemEdit: (id: string) => actionsRef.current.onItemEdit?.(id),
    onItemDelete: (id: string) => actionsRef.current.onItemDelete?.(id),
    onTogglePurchase: (id: string, opts?: { withDetails?: boolean }) =>
      actionsRef.current.onTogglePurchase?.(id, opts),
    onMoveToPantry: (id: string) => actionsRef.current.onMoveToPantry?.(id),
    onQuantityPress: (id: string) => actionsRef.current.onQuantityPress?.(id),
    onSortOrderUpdate: (
      itemId: string,
      afterItemId: string | null,
      beforeItemId: string | null,
    ) =>
      actionsRef.current.onSortOrderUpdate?.(itemId, afterItemId, beforeItemId),
    onSwipeableWillOpen: (ref: SwipeableRef) =>
      actionsRef.current.onSwipeableWillOpen?.(ref),
    onSwipeableClose: () => actionsRef.current.onSwipeableClose?.(),
  }));

  return (
    <ShoppingListTabsActionsContext.Provider value={stableActions}>
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
