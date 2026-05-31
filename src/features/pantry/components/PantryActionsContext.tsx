import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SwipeableRef } from '#components/molecules/SwipeableItem/types';

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
  onSwipeableWillOpen: (ref: SwipeableRef) => void;
}

/**
 * Combined context value
 */
interface PantryActionsContextValue {
  actions: PantryItemActions;
  swipeable: SwipeableCoordination;
}

const PantryActionsContext = createContext<PantryActionsContextValue | null>(
  null,
);

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
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);

  // Store latest actions in ref (effect updates — no re-renders)
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  // Stable delegating callbacks — compiler sees only ref captures (not reactive),
  // so it auto-memoizes these with empty reactive deps. Context value stays stable.
  const stableActions: PantryItemActions = {
    onItemPress: (id: string) => actionsRef.current.onItemPress(id),
    onItemEdit: (id: string) => actionsRef.current.onItemEdit?.(id),
    onItemDelete: (id: string) => actionsRef.current.onItemDelete?.(id),
    onItemConsume: (id: string) => actionsRef.current.onItemConsume?.(id),
    onItemWaste: (id: string) => actionsRef.current.onItemWaste?.(id),
    onItemRestock: (id: string) => actionsRef.current.onItemRestock?.(id),
  };

  // swipeable only captures openSwipeableRef (a ref) — compiler auto-memoizes
  const swipeable: SwipeableCoordination = {
    onSwipeableWillOpen: (ref: SwipeableRef) => {
      if (
        openSwipeableRef.current &&
        openSwipeableRef.current !== ref.current
      ) {
        openSwipeableRef.current?.close();
      }
      openSwipeableRef.current = ref.current;
    },
  };

  // value only captures stableActions + swipeable (both auto-memoized) — stable
  const value: PantryActionsContextValue = {
    actions: stableActions,
    swipeable,
  };

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
    throw new Error(
      'usePantryActions must be used within a PantryActionsProvider',
    );
  }
  return context;
};

/**
 * Optional hook that returns null if outside provider
 */
export const usePantryActionsOptional =
  (): PantryActionsContextValue | null => {
    return useContext(PantryActionsContext);
  };
