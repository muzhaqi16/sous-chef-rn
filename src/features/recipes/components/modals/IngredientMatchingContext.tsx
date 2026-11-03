import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import type { MatchUpdate } from '#features/recipes/hooks/useRecipeIngredientMatching';
import { createValueContext } from '#hooks/utils/createValueContext';
import type { ReadingSystem } from '#domain/measure';

const readingSystemContext = createValueContext<ReadingSystem>(
  'MatchReadingSystemProvider',
);

/** The one read of the unit system, for the rows below. */
export const MatchReadingSystemProvider = readingSystemContext.Provider;
export const useMatchReadingSystem = readingSystemContext.useValue;

interface IngredientMatchingContextValue {
  onUpdate: (index: number, updates: MatchUpdate) => void;
}

const IngredientMatchingContext =
  createContext<IngredientMatchingContextValue | null>(null);

export const IngredientMatchingProvider: React.FC<{
  children: ReactNode;
  onUpdate: IngredientMatchingContextValue['onUpdate'];
}> = ({ children, onUpdate }) => {
  const ref = useRef(onUpdate);
  useEffect(() => {
    ref.current = onUpdate;
  });

  const stable: IngredientMatchingContextValue = {
    onUpdate: (index, updates) => ref.current(index, updates),
  };

  return (
    <IngredientMatchingContext.Provider value={stable}>
      {children}
    </IngredientMatchingContext.Provider>
  );
};

export const useIngredientMatchingActions =
  (): IngredientMatchingContextValue => {
    const ctx = useContext(IngredientMatchingContext);
    if (!ctx)
      throw new Error(
        'useIngredientMatchingActions must be used within IngredientMatchingProvider',
      );
    return ctx;
  };
