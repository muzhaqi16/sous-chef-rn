import React, { createContext, useContext, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Shared drag state for coordinating animations across list items.
 * All values are Reanimated SharedValues for 60fps UI thread animations.
 *
 * Note: We use Apollo optimisticResponse for immediate UI updates on drop,
 * so we don't need lastHoveredIndex/originalDraggedIndex for "hold-shift" logic.
 */
interface DragStateContextValue {
  /** Is any item currently being dragged? */
  isDragging: SharedValue<boolean>;
  /** Original index of the item being dragged (-1 if not dragging) */
  draggedIndex: SharedValue<number>;
  /** Current Y translation of the dragged item (for calculating hover position) */
  currentTranslateY: SharedValue<number>;
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

  // Context value is stable since SharedValue references don't change
  const value: DragStateContextValue = {
    isDragging,
    draggedIndex,
    currentTranslateY,
  };

  return (
    <DragStateContext.Provider value={value}>
      {children}
    </DragStateContext.Provider>
  );
};
