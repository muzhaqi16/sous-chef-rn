import React, { createContext, useContext, type ReactNode } from 'react';
import type {
  SwipeAction,
  SwipeableRef,
} from '#components/molecules/SwipeableItem/types';

/**
 * Actions available for item list items
 */
export interface ItemListActions {
  onItemPress: (id: string) => void;
  /**
   * The swipe actions for one row, built by the caller.
   *
   * A factory rather than five named handlers (`onItemEdit`, `onItemConsume`,
   * `onItemWaste`, …): those were one feature's verbs sitting in a shared list,
   * and a list that wanted a sixth had to add it here.
   */
  itemSwipeActions?: (id: string) => {
    left?: SwipeAction[];
    right?: SwipeAction[];
  };
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  testIDPrefix?: string;
}

interface ItemListActionsContextValue {
  actions: ItemListActions;
}

const ItemListActionsContext =
  createContext<ItemListActionsContextValue | null>(null);

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
export const ItemListActionsProvider: React.FC<
  ItemListActionsProviderProps
> = ({ children, actions }) => {
  // React Compiler auto-memoizes `value` based on `actions` identity —
  // no manual ref/effect/wrapper needed. Optional actions that are `undefined`
  // stay `undefined`, so downstream truthiness checks correctly gate rendering.
  const value: ItemListActionsContextValue = { actions };

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
    throw new Error(
      'useItemListActions must be used within an ItemListActionsProvider',
    );
  }
  return context;
};
