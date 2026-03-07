import React, { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

interface IngredientSelectorContextValue {
  selectedIngredients: Set<string>;
  toggleIngredient: (name: string) => void;
}

const IngredientSelectorContext = createContext<IngredientSelectorContextValue | null>(null);

export const IngredientSelectorProvider: React.FC<{
  children: ReactNode;
  selectedIngredients: Set<string>;
  toggleIngredient: (name: string) => void;
}> = ({ children, selectedIngredients, toggleIngredient }) => {
  const toggleRef = useRef(toggleIngredient);
  useEffect(() => { toggleRef.current = toggleIngredient; });

  const selectedRef = useRef(selectedIngredients);
  useEffect(() => { selectedRef.current = selectedIngredients; });

  const stableToggle = (name: string) => toggleRef.current(name);

  const value: IngredientSelectorContextValue = {
    selectedIngredients,  // pass through directly — extraData handles re-renders
    toggleIngredient: stableToggle,
  };

  return (
    <IngredientSelectorContext.Provider value={value}>
      {children}
    </IngredientSelectorContext.Provider>
  );
};

export const useIngredientSelector = (): IngredientSelectorContextValue => {
  const ctx = useContext(IngredientSelectorContext);
  if (!ctx) throw new Error('useIngredientSelector must be used within IngredientSelectorProvider');
  return ctx;
};
