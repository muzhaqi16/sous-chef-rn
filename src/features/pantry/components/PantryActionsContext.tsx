import React, { createContext, useContext, type ReactNode } from 'react';
import type { SwipeableRef } from '#components/organisms/SwipeableItem/types';
import { createActionsContext } from '#hooks/utils/createActionsContext';
import { useSwipeableCoordinator } from '#hooks/ui/useSwipeableCoordinator';

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

export const PantryActionsProvider: React.FC<{
  children: ReactNode;
  actions: PantryItemActions;
}> = ({ children, actions }) => {
  const { handleSwipeableWillOpen } = useSwipeableCoordinator();

  return (
    <actionsContext.Provider actions={actions}>
      <SwipeableContext.Provider
        value={{ onSwipeableWillOpen: handleSwipeableWillOpen }}
      >
        {children}
      </SwipeableContext.Provider>
    </actionsContext.Provider>
  );
};

/** Throws outside a `PantryActionsProvider`. */
export const usePantryActions = (): PantryActionsContextValue => {
  const actions = actionsContext.useActions();
  const swipeable = useContext(SwipeableContext);
  if (!swipeable) {
    throw new Error('PantryActionsProvider is missing its provider');
  }
  return { actions, swipeable };
};

/** Same, but returns null outside the provider instead of throwing. */
export const usePantryActionsOptional =
  (): PantryActionsContextValue | null => {
    const actions = actionsContext.useOptionalActions();
    const swipeable = useContext(SwipeableContext);
    return actions && swipeable ? { actions, swipeable } : null;
  };
