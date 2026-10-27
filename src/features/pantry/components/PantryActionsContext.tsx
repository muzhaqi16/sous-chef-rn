import React, { createContext, useContext, type ReactNode } from 'react';
import type { SwipeableRef } from '#components/organisms/SwipeableItem/types';
import { createActionsContext } from '#hooks/utils/createActionsContext';
import { createValueContext } from '#hooks/utils/createValueContext';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';
import { useReadingSystem } from '#hooks/settings/useReadingSystem';
import type { ReadingSystem } from '#domain/measure';

export interface PantryItemActions {
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;
}

export interface SwipeableCoordination {
  onSwipeableWillOpen: (ref: SwipeableRef) => void;
}

interface PantryActionsContextValue {
  actions: PantryItemActions;
  swipeable: SwipeableCoordination;
}

const actionsContext = createActionsContext<PantryItemActions>(
  'PantryActionsProvider',
);

// Ref-backed and stable for the provider's lifetime, so it rides in its own
// context: merging it into the actions value would mean rebuilding that value
// to change either half.
const SwipeableContext = createContext<SwipeableCoordination | null>(null);

// Read once for the list, not once per row: each row would otherwise watch the
// settings query on its own.
const readingSystemContext = createValueContext<ReadingSystem>(
  'PantryReadingSystem',
);

export const PantryActionsProvider: React.FC<{
  children: ReactNode;
  actions: PantryItemActions;
}> = ({ children, actions }) => {
  const { handleSwipeableWillOpen } = useSwipeableCoordinator();
  const readingSystem = useReadingSystem();

  return (
    <actionsContext.Provider actions={actions}>
      <SwipeableContext.Provider
        value={{ onSwipeableWillOpen: handleSwipeableWillOpen }}
      >
        <readingSystemContext.Provider value={readingSystem}>
          {children}
        </readingSystemContext.Provider>
      </SwipeableContext.Provider>
    </actionsContext.Provider>
  );
};

/** The unit system the list's rows read amounts in. Throws outside the provider. */
export const usePantryReadingSystem = readingSystemContext.useValue;

/** Throws outside a `PantryActionsProvider`. */
export const usePantryActions = (): PantryActionsContextValue => {
  const actions = actionsContext.useActions();
  const swipeable = useContext(SwipeableContext);
  if (!swipeable) {
    throw new Error('PantryActionsProvider is missing its provider');
  }
  return { actions, swipeable };
};
