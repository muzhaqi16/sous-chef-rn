import React, { createContext, useContext, type ReactNode } from 'react';
import type { SwipeableRef } from '#components/organisms/SwipeableItem/types';

export interface ItemListActions {
  onItemPress: (id: string) => void;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  /** Run by a row before a `removesRow` action fires. */
  onBeforeRowRemoved?: () => void;
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

export const ItemListActionsProvider: React.FC<
  ItemListActionsProviderProps
> = ({ children, actions }) => {
  // The compiler memoizes `value` on `actions` identity. An absent action stays
  // `undefined`, so downstream truthiness checks still gate rendering.
  const value: ItemListActionsContextValue = { actions };

  return (
    <ItemListActionsContext.Provider value={value}>
      {children}
    </ItemListActionsContext.Provider>
  );
};

export const useItemListActions = (): ItemListActionsContextValue => {
  const context = useContext(ItemListActionsContext);
  if (!context) {
    throw new Error(
      'useItemListActions must be used within an ItemListActionsProvider',
    );
  }
  return context;
};
