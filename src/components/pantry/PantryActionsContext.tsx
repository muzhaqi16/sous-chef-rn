import React, { createContext, useContext, useRef, type ReactNode } from 'react';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

/**
 * Actions available for pantry items
 */
export interface PantryItemActions {
  onItemPress: (id: string) => void;
  onItemEdit?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onItemConsume?: (id: string) => void;
  onItemWaste?: (id: string) => void;
  onItemRestock?: (id: string) => void;
}

/**
 * Swipeable coordination for closing other swipeables
 */
export interface SwipeableCoordination {
  onSwipeableWillOpen: (ref: React.RefObject<SwipeableMethods>) => void;
}

/**
 * Combined context value
 */
interface PantryActionsContextValue {
  actions: PantryItemActions;
  swipeable: SwipeableCoordination;
}

const PantryActionsContext = createContext<PantryActionsContextValue | null>(null);

interface PantryActionsProviderProps {
  children: ReactNode;
  actions: PantryItemActions;
}

/**
 * PantryActionsProvider - Context provider for pantry item actions
 *
 * Eliminates prop drilling by providing item actions through context.
 * Also manages swipeable coordination to close other swipeables when one opens.
 *
 * @example
 * ```tsx
 * <PantryActionsProvider actions={{ onItemPress, onItemEdit, onItemDelete }}>
 *   <PantryItemList items={items} />
 * </PantryActionsProvider>
 * ```
 */
export const PantryActionsProvider: React.FC<PantryActionsProviderProps> = ({
  children,
  actions,
}) => {
  // Track currently open swipeable
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);

  // Swipeable coordination
  const swipeable: SwipeableCoordination = {
    onSwipeableWillOpen: (ref: React.RefObject<SwipeableMethods>) => {
      if (
        openSwipeableRef.current &&
        openSwipeableRef.current !== ref.current
      ) {
        openSwipeableRef.current?.close();
      }
      openSwipeableRef.current = ref.current;
    },
  };

  const value: PantryActionsContextValue = { actions, swipeable };

  return (
    <PantryActionsContext.Provider value={value}>
      {children}
    </PantryActionsContext.Provider>
  );
};

/**
 * Hook to access pantry item actions from context
 *
 * @throws Error if used outside PantryActionsProvider
 */
export const usePantryActions = (): PantryActionsContextValue => {
  const context = useContext(PantryActionsContext);
  if (!context) {
    throw new Error('usePantryActions must be used within a PantryActionsProvider');
  }
  return context;
};

/**
 * Optional hook that returns null if outside provider
 */
export const usePantryActionsOptional = (): PantryActionsContextValue | null => {
  return useContext(PantryActionsContext);
};
