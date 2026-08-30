import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * Shared selection context for the ingredient-picker sheets. The key is an
 * opaque string — RecipeSearch keys by ingredient name, RecipeDetail by id.
 * Props pass straight through: the value changes with the selection anyway, and
 * the React Compiler keeps it stable across unrelated renders.
 */
interface IngredientSelectionContextValue {
  selectedIngredients: Set<string>;
  toggleIngredient: (key: string) => void;
}

const IngredientSelectionContext =
  createContext<IngredientSelectionContextValue | null>(null);

export const IngredientSelectionProvider: React.FC<{
  children: ReactNode;
  selectedIngredients: Set<string>;
  toggleIngredient: (key: string) => void;
}> = ({ children, selectedIngredients, toggleIngredient }) => (
  <IngredientSelectionContext.Provider
    value={{ selectedIngredients, toggleIngredient }}
  >
    {children}
  </IngredientSelectionContext.Provider>
);

export const useIngredientSelection = (): IngredientSelectionContextValue => {
  const ctx = useContext(IngredientSelectionContext);
  if (!ctx)
    throw new Error(
      'useIngredientSelection must be used within IngredientSelectionProvider',
    );
  return ctx;
};
