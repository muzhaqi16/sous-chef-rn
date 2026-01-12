import React, { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Centralized drag state for coordinating animations across list items.
 * All animation values are Reanimated SharedValues for 60fps UI thread performance.
 *
 * Architecture:
 * - Single source of truth for all drag state (no per-item local state)
 * - Dragged item identified by draggedIndex, reads/writes centralized values
 * - Non-dragged items read draggedIndex/currentTranslateY to calculate shift
 * - isSettling prevents shift animations during cache update window
 */
interface DragStateContextValue {
  /** Is any item currently being dragged? */
  isDragging: SharedValue<boolean>;
  /** Original index of the item being dragged (-1 if not dragging) */
  draggedIndex: SharedValue<number>;
  /** Current Y translation of the dragged item (for calculating hover position) */
  currentTranslateY: SharedValue<number>;
  /** Scale of the dragged item (1.0 = normal, 1.03 = dragging) */
  draggedScale: SharedValue<number>;
  /**
   * True during the "settling" window after drop:
   * - Gesture ends → isSettling = true
   * - Cache updates → animations settle
   * - isSettling = false
   *
   * Prevents shift animations from re-applying during cache update.
   */
  isSettling: SharedValue<boolean>;
  /** Call when cache update completes to end settling period */
  endSettling: () => void;
}

const DragStateContext = createContext<DragStateContextValue | null>(null);

/**
 * Hook to access shared drag state from context.
 * Must be used within DragStateProvider.
 *
 * Used by SortableItem to:
 * 1. Update drag state when this item is being dragged
 * 2. Read drag state to calculate shift animation for non-dragged items
 */
export const useDragState = () => {
  const context = useContext(DragStateContext);
  if (!context) {
    throw new Error('useDragState must be used within DragStateProvider');
  }
  return context;
};

interface DragStateProviderProps {
  children: ReactNode;
}

/**
 * Provider that creates shared Reanimated values for drag state.
 *
 * These values are shared across all list items:
 * - The dragged item writes to them during drag gestures
 * - Non-dragged items read them to calculate their shift offset
 *
 * Using SharedValues ensures animations run on the UI thread at 60fps.
 */
export const DragStateProvider: React.FC<DragStateProviderProps> = ({ children }) => {
  // Shared values are created once and persist for the lifetime of the provider
  const isDragging = useSharedValue(false);
  const draggedIndex = useSharedValue(-1);
  const currentTranslateY = useSharedValue(0);
  const draggedScale = useSharedValue(1);
  const isSettling = useSharedValue(false);

  // Call this after cache update completes to end the settling window
  const endSettling = useCallback(() => {
    isSettling.value = false;
    draggedIndex.value = -1;
    currentTranslateY.value = 0;
    draggedScale.value = 1;
  }, [isSettling, draggedIndex, currentTranslateY, draggedScale]);

  // Context value is stable since SharedValue references don't change
  const value: DragStateContextValue = {
    isDragging,
    draggedIndex,
    currentTranslateY,
    draggedScale,
    isSettling,
    endSettling,
  };

  return (
    <DragStateContext.Provider value={value}>
      {children}
    </DragStateContext.Provider>
  );
};
