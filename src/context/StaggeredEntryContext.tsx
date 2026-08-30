import React, { createContext, useContext, useRef, ReactNode } from 'react';
import { staggeredEntryAnimation } from '#constants/animations';

interface StaggeredEntryContextType {
  getEntryDelay: (index: number) => number;
  markInitialRenderComplete: () => void;
}

const StaggeredEntryContext = createContext<StaggeredEntryContextType | null>(
  null,
);

interface StaggeredEntryProviderProps {
  children: ReactNode;
}

/**
 * Staggered entry delays for list items during the INITIAL render only — after
 * `markInitialRenderComplete` they are disabled, or FlashList's view recycling
 * would replay the animation on every scroll.
 */
export const StaggeredEntryProvider: React.FC<StaggeredEntryProviderProps> = ({
  children,
}) => {
  const initialRenderCompleteRef = useRef(false);

  const getEntryDelay = (index: number): number => {
    if (initialRenderCompleteRef.current) return 0;
    return (
      staggeredEntryAnimation.initialDelay +
      Math.min(index, staggeredEntryAnimation.maxItems) *
        staggeredEntryAnimation.delayPerItem
    );
  };

  const markInitialRenderComplete = () => {
    initialRenderCompleteRef.current = true;
  };

  const contextValue = {
    getEntryDelay,
    markInitialRenderComplete,
  };

  return (
    <StaggeredEntryContext.Provider value={contextValue}>
      {children}
    </StaggeredEntryContext.Provider>
  );
};

/** Returns null outside a provider. */
export const useStaggeredEntry = (): StaggeredEntryContextType | null => {
  return useContext(StaggeredEntryContext);
};
