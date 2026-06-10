import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * Shared selection context for the recipes feature's ingredient-picker
 * sheets (RecipeSearch's pantry picker and RecipeDetail's add-to-list
 * picker). The selection key is an opaque string — RecipeSearch keys by
 * ingredient name, RecipeDetail by ingredient id.
 *
 * The props pass straight through: the context value changes whenever the
 * selection changes anyway (the Set is part of it), and the React Compiler
 * keeps the value object stable across unrelated renders — no manual
 * callback stabilization needed.
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
