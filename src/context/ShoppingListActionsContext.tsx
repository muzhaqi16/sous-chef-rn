import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
} from 'react';

interface ShoppingListActionsContextValue {
  onIncrementQuantity: (itemId: string) => void;
  onDecrementQuantity: (itemId: string) => void;
}

const ShoppingListActionsContext = createContext<ShoppingListActionsContextValue | null>(
  null,
);

export const useShoppingListActions = () => {
  const context = useContext(ShoppingListActionsContext);
  if (!context) {
    throw new Error(
      'useShoppingListActions must be used within ShoppingListActionsProvider',
    );
  }
  return context;
};

interface ShoppingListActionsProviderProps {
  children: React.ReactNode;
  onIncrementQuantity: (itemId: string) => void;
  onDecrementQuantity: (itemId: string) => void;
}

export const ShoppingListActionsProvider: React.FC<
  ShoppingListActionsProviderProps
> = ({ children, onIncrementQuantity, onDecrementQuantity }) => {
  // Use refs to maintain stable callback identity
  const onIncrementRef = useRef(onIncrementQuantity);
  const onDecrementRef = useRef(onDecrementQuantity);

  // Update refs synchronously before render completes
  useLayoutEffect(() => {
    onIncrementRef.current = onIncrementQuantity;
    onDecrementRef.current = onDecrementQuantity;
  });

  // Create stable callbacks with empty dependencies
  const handleIncrementQuantity = useCallback((itemId: string) => {
    onIncrementRef.current(itemId);
  }, []);

  const handleDecrementQuantity = useCallback((itemId: string) => {
    onDecrementRef.current(itemId);
  }, []);

  const value = useMemo(
    () => ({
      onIncrementQuantity: handleIncrementQuantity,
      onDecrementQuantity: handleDecrementQuantity,
    }),
    [handleIncrementQuantity, handleDecrementQuantity],
  );

  return (
    <ShoppingListActionsContext.Provider value={value}>
      {children}
    </ShoppingListActionsContext.Provider>
  );
};
