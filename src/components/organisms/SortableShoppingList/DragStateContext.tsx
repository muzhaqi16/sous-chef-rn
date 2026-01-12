import React, { createContext, useContext, useCallback, useRef, type ReactNode } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { FlashListRef } from '@shopify/flash-list';

/**
 * Centralized drag state for coordinating animations across list items.
 * All animation values are Reanimated SharedValues for 60fps UI thread performance.
 *
 * Architecture:
 * - Single source of truth for all drag state (no per-item local state)
 * - Dragged item identified by draggedIndex, reads/writes centralized values
 * - Non-dragged items read draggedIndex/currentTranslateY to calculate shift
 * - Scroll state enables viewport-aware hover calculations and autoscroll
 */
interface DragStateContextValue {
  /** Is any item currently being dragged? */
  isDragging: SharedValue<boolean>;
  /** Original index of the item being dragged (-1 if not dragging) */
  draggedIndex: SharedValue<number>;
  /** ID of the item being dragged (for stable identity across FlashList recycling) */
  draggedItemId: SharedValue<string>;
  /** Current Y translation of the dragged item (for calculating hover position) */
  currentTranslateY: SharedValue<number>;
  /** Scale of the dragged item (1.0 = normal, 1.03 = dragging) */
  draggedScale: SharedValue<number>;
  /** Current scroll offset of the list (updated via onScroll) */
  scrollOffset: SharedValue<number>;
  /** Scroll offset when drag started (for scroll delta calculation during autoscroll) */
  dragStartScrollOffset: SharedValue<number>;
  /** Total content height of the list (updated via onContentSizeChange) */
  contentHeight: SharedValue<number>;
  /** Visible viewport height (updated via onLayout) */
  visibleHeight: SharedValue<number>;
  /** Y position of FlashList top on screen (for autoscroll coordinate conversion) */
  listTopY: SharedValue<number>;
  /** Counter incremented on every drag state change to force useDerivedValue re-evaluation.
   * Reanimated v4 has issues tracking SharedValue changes through Context,
   * so this counter forces re-evaluation when drag state changes. */
  dragUpdateTrigger: SharedValue<number>;
  /** Measured height of the dragged item (for dynamic height calculations) */
  measuredItemHeight: SharedValue<number>;
  /** Flag to freeze shift values during drop transition (prevents collapse before re-render) */
  isDropping: SharedValue<boolean>;
  /** Register the FlashList ref for autoscroll operations */
  setListRef: (ref: FlashListRef<any> | null) => void;
  /** Scroll the list to a specific offset (for autoscroll during drag) */
  scrollToOffset: (offset: number, animated?: boolean) => void;
  /** Reset drag state after drop animation completes */
  resetDragState: () => void;
}

const DragStateContext = createContext<DragStateContextValue | null>(null);

/**
 * Hook to access shared drag state from context.
 * Must be used within DragStateProvider.
 *
 * Used by SortableItem to:
 * 1. Update drag state when this item is being dragged
 * 2. Read drag state to calculate shift animation for non-dragged items
 * 3. Trigger autoscroll when dragging near edges
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
 * - Scroll state enables viewport-aware hover calculations
 *
 * Using SharedValues ensures animations run on the UI thread at 60fps.
 */
export const DragStateProvider: React.FC<DragStateProviderProps> = ({ children }) => {
  // Shared values are created once and persist for the lifetime of the provider
  const isDragging = useSharedValue(false);
  const draggedIndex = useSharedValue(-1);
  const draggedItemId = useSharedValue('');
  const currentTranslateY = useSharedValue(0);
  const draggedScale = useSharedValue(1);

  // Scroll state for viewport-aware calculations and autoscroll
  const scrollOffset = useSharedValue(0);
  const dragStartScrollOffset = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const visibleHeight = useSharedValue(0);
  const listTopY = useSharedValue(0);

  // Counter to force useDerivedValue re-evaluation on every drag state change
  // Reanimated v4 has issues tracking SharedValue changes through Context
  const dragUpdateTrigger = useSharedValue(0);

  // Measured height of dragged item (0 = use fallback DRAG_ITEM_HEIGHT)
  const measuredItemHeight = useSharedValue(0);

  // Flag to freeze shift values during drop transition
  const isDropping = useSharedValue(false);

  // Ref to FlashList for autoscroll operations
  const listRef = useRef<FlashListRef<any> | null>(null);

  // Register the FlashList ref
  const setListRef = useCallback((ref: FlashListRef<any> | null) => {
    listRef.current = ref;
  }, []);

  // Scroll to offset (called via scheduleOnRN from worklet for autoscroll)
  const scrollToOffset = useCallback((offset: number, animated = false) => {
    listRef.current?.scrollToOffset({ offset, animated });
  }, []);

  // Reset drag state after drop
  const resetDragState = useCallback(() => {
    isDragging.value = false;
    draggedIndex.value = -1;
    draggedItemId.value = '';
    currentTranslateY.value = 0;
    draggedScale.value = 1;
    dragStartScrollOffset.value = 0;
    measuredItemHeight.value = 0;
    isDropping.value = false;
  }, [isDragging, draggedIndex, draggedItemId, currentTranslateY, draggedScale, dragStartScrollOffset, measuredItemHeight, isDropping]);

  // Context value is stable since SharedValue references don't change
  const value: DragStateContextValue = {
    isDragging,
    draggedIndex,
    draggedItemId,
    currentTranslateY,
    draggedScale,
    scrollOffset,
    dragStartScrollOffset,
    contentHeight,
    visibleHeight,
    listTopY,
    dragUpdateTrigger,
    measuredItemHeight,
    isDropping,
    setListRef,
    scrollToOffset,
    resetDragState,
  };

  return (
    <DragStateContext.Provider value={value}>
      {children}
    </DragStateContext.Provider>
  );
};
