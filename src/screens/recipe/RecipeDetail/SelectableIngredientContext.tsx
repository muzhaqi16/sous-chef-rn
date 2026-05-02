import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';

interface SelectableIngredientContextValue {
  selectedIngredients: Set<string>;
  toggleIngredient: (id: string) => void;
}

const SelectableIngredientContext =
  createContext<SelectableIngredientContextValue | null>(null);

export const SelectableIngredientProvider: React.FC<{
  children: ReactNode;
  selectedIngredients: Set<string>;
  toggleIngredient: (id: string) => void;
}> = ({ children, selectedIngredients, toggleIngredient }) => {
  const toggleRef = useRef(toggleIngredient);
  useEffect(() => {
    toggleRef.current = toggleIngredient;
  });

  const stableToggle = (id: string) => toggleRef.current(id);

  const value: SelectableIngredientContextValue = {
    selectedIngredients,
    toggleIngredient: stableToggle,
  };

  return (
    <SelectableIngredientContext.Provider value={value}>
      {children}
    </SelectableIngredientContext.Provider>
  );
};

export const useSelectableIngredients =
  (): SelectableIngredientContextValue => {
    const ctx = useContext(SelectableIngredientContext);
    if (!ctx)
      throw new Error(
        'useSelectableIngredients must be used within SelectableIngredientProvider',
      );
    return ctx;
  };
