import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

/**
 * Shared selection context for the recipes feature's ingredient-picker
 * sheets (RecipeSearch's pantry picker and RecipeDetail's add-to-list
 * picker). The selection key is an opaque string — RecipeSearch keys by
 * ingredient name, RecipeDetail by ingredient id.
 *
 * `toggleIngredient` is ref-stabilized so FlashList rows re-render off
 * `extraData` (selection size) rather than a new callback identity.
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
}> = ({ children, selectedIngredients, toggleIngredient }) => {
  const toggleRef = useRef(toggleIngredient);
  useEffect(() => {
    toggleRef.current = toggleIngredient;
  });

  const stableToggle = (key: string) => toggleRef.current(key);

  const value: IngredientSelectionContextValue = {
    selectedIngredients, // pass through directly — extraData handles re-renders
    toggleIngredient: stableToggle,
  };

  return (
    <IngredientSelectionContext.Provider value={value}>
      {children}
    </IngredientSelectionContext.Provider>
  );
};

export const useIngredientSelection = (): IngredientSelectionContextValue => {
  const ctx = useContext(IngredientSelectionContext);
  if (!ctx)
    throw new Error(
      'useIngredientSelection must be used within IngredientSelectionProvider',
    );
  return ctx;
};
