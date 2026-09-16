import React, { type ReactNode } from 'react';
import { createActionsContext } from '#hooks/utils/createActionsContext';
import { createValueContext } from '#hooks/utils/createValueContext';
import type { SwipeableRef } from '#components/organisms/SwipeableItem/types';

export interface ItemListActions {
  onItemPress: (id: string) => void;
  onSwipeableWillOpen?: (ref: SwipeableRef) => void;
  /** Run by a row before a `removesRow` action fires. */
  onBeforeRowRemoved?: () => void;
}

const actionsContext = createActionsContext<ItemListActions>(
  'ItemListActionsProvider',
);

// A row reads the prefix while rendering, so it is a value, not a command.
const testIDPrefixContext = createValueContext<string | undefined>(
  'ItemListTestIDPrefixProvider',
);

interface ItemListActionsProviderProps {
  children: ReactNode;
  actions: ItemListActions;
  testIDPrefix: string | undefined;
}

export const ItemListActionsProvider: React.FC<
  ItemListActionsProviderProps
> = ({ children, actions, testIDPrefix }) => (
  <actionsContext.Provider actions={actions}>
    <testIDPrefixContext.Provider value={testIDPrefix}>
      {children}
    </testIDPrefixContext.Provider>
  </actionsContext.Provider>
);

export const useItemListActions = actionsContext.useActions;

export const useItemListTestIDPrefix = testIDPrefixContext.useValue;
