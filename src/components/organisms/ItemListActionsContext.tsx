import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

/**
 * Actions available for item list items
 */
export interface ItemListActions {
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;
  onSwipeableWillOpen?: (ref: any) => void;
  testIDPrefix?: string;
}

interface ItemListActionsContextValue {
  actions: ItemListActions;
}

const ItemListActionsContext = createContext<ItemListActionsContextValue | null>(null);

interface ItemListActionsProviderProps {
  children: ReactNode;
  actions: ItemListActions;
}

/**
 * ItemListActionsProvider - Context provider for item list actions
 *
 * Eliminates prop drilling by providing item actions through context.
 * Uses ref-based stable callbacks so the context value stays stable
 * and does not trigger re-renders when parent callbacks change.
 *
 * @example
 * ```tsx
 * <ItemListActionsProvider actions={{ onItemPress, onItemEdit, onItemDelete }}>
 *   <FlashList ... />
 * </ItemListActionsProvider>
 * ```
 */
export const ItemListActionsProvider: React.FC<ItemListActionsProviderProps> = ({
  children,
  actions,
}) => {
  // Store latest actions in ref (effect updates — no re-renders)
  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; });

  // Stable delegating callbacks — compiler sees only ref captures (not reactive),
  // so it auto-memoizes these with empty reactive deps. Context value stays stable.
  const stableActions: ItemListActions = {
    onItemPress: (id: string) => actionsRef.current.onItemPress(id),
    onItemEdit: (id: string) => actionsRef.current.onItemEdit?.(id),
    onItemDelete: (id: string) => actionsRef.current.onItemDelete?.(id),
    onItemConsume: (id: string) => actionsRef.current.onItemConsume?.(id),
    onItemWaste: (id: string) => actionsRef.current.onItemWaste?.(id),
    onItemRestock: (id: string) => actionsRef.current.onItemRestock?.(id),
    onSwipeableWillOpen: (ref: any) => actionsRef.current.onSwipeableWillOpen?.(ref),
    testIDPrefix: actions.testIDPrefix,
  };

  // value only captures stableActions (auto-memoized) — stable
  const value: ItemListActionsContextValue = { actions: stableActions };

  return (
    <ItemListActionsContext.Provider value={value}>
      {children}
    </ItemListActionsContext.Provider>
  );
};

/**
 * Hook to access item list actions from context
 *
 * @throws Error if used outside ItemListActionsProvider
 */
export const useItemListActions = (): ItemListActionsContextValue => {
  const context = useContext(ItemListActionsContext);
  if (!context) {
    throw new Error('useItemListActions must be used within an ItemListActionsProvider');
  }
  return context;
};
