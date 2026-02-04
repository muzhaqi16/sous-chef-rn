import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
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
 * StaggeredEntryProvider
 *
 * Provides staggered entry animation delays for list items during initial render.
 * After initial render completes, delays are disabled to prevent animation
 * on scroll (FlashList recycles views).
 *
 * Usage:
 * 1. Wrap list content with StaggeredEntryProvider
 * 2. Call markInitialRenderComplete after initial items render
 * 3. Items call getEntryDelay(index) to get their delay
 */
export const StaggeredEntryProvider: React.FC<StaggeredEntryProviderProps> = ({
  children,
}) => {
  const initialRenderCompleteRef = useRef(false);

  const getEntryDelay = useCallback((index: number): number => {
    if (initialRenderCompleteRef.current) return 0;
    return (
      staggeredEntryAnimation.initialDelay +
      Math.min(index, staggeredEntryAnimation.maxItems) *
        staggeredEntryAnimation.delayPerItem
    );
  }, []);

  const markInitialRenderComplete = useCallback(() => {
    initialRenderCompleteRef.current = true;
  }, []);

  const contextValue = useMemo(
    () => ({
      getEntryDelay,
      markInitialRenderComplete,
    }),
    [getEntryDelay, markInitialRenderComplete],
  );

  return (
    <StaggeredEntryContext.Provider value={contextValue}>
      {children}
    </StaggeredEntryContext.Provider>
  );
};

/**
 * Hook to access staggered entry animation context.
 * Returns null if not within provider (safe for components outside stagger context).
 */
export const useStaggeredEntry = (): StaggeredEntryContextType | null => {
  return useContext(StaggeredEntryContext);
};
