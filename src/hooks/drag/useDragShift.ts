import { useSharedValue, useDerivedValue, useAnimatedReaction, withTiming, Easing } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useDragState } from '#/components/organisms/SortableShoppingList/DragStateContext';
import { DRAG_ITEM_HEIGHT, ITEM_VERTICAL_MARGIN } from '#/constants/drag';

/**
 * Configuration for useDragShift hook
 */
export interface UseDragShiftConfig {
  /** Item ID for identity check (to skip shift for the dragged item) */
  itemId: string;
  /** Current index in list */
  index: number;
}

/**
 * Return value from useDragShift hook
 */
export interface UseDragShiftResult {
  /** Animated shift value for non-dragged items */
  shiftY: SharedValue<number>;
}

/**
 * Hook that calculates shift animation for non-dragged items.
 *
 * When an item is being dragged, other items need to shift up or down
 * to make room for the dragged item at its new position. This hook
 * calculates the target shift based on:
 * - The current drag position (from context)
 * - The scroll delta (accounting for autoscroll)
 * - The item's index relative to the dragged item
 *
 * The shift is animated with timing for smooth transitions.
 *
 * @example
 * ```tsx
 * const { shiftY } = useDragShift({ itemId: item.id, index });
 * // Use shiftY.value in animated style
 * ```
 */
export function useDragShift(config: UseDragShiftConfig): UseDragShiftResult {
  const { itemId, index } = config;

  // Global drag state for coordinating animations across all items
  const {
    isDragging: globalIsDragging,
    draggedIndex,
    draggedItemId,
    currentTranslateY,
    scrollOffset,
    dragStartScrollOffset,
    dragUpdateTrigger,
    measuredItemHeight,
    isDropping,
  } = useDragState();

  // Shift animation SharedValue - animated via useAnimatedReaction to avoid
  // starting new animations every frame (which causes thrashing)
  const shiftY = useSharedValue(0);

  // Calculate target shift using useDerivedValue for better dependency tracking
  // useDerivedValue properly tracks SharedValue changes from Context (unlike useAnimatedReaction)
  const targetShiftY = useDerivedValue(() => {
    'worklet';
    // Force re-evaluation on every drag state change
    // Reanimated v4 has issues tracking SharedValue changes through Context
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dragUpdateTrigger.value;

    // During drop transition, freeze shift values - don't recalculate
    // This prevents items from collapsing back before React re-renders with new indices
    if (isDropping.value) {
      return shiftY.value; // Return current value unchanged
    }

    // Read ALL SharedValues - useDerivedValue tracks these automatically
    const currentDraggedIndex = draggedIndex.value;
    const isDraggingNow = globalIsDragging.value;
    const translateYNow = currentTranslateY.value;
    const currentDraggedItemId = draggedItemId.value;

    // If I'm the dragged item (check by ID for stable identity), no shift needed
    if (currentDraggedItemId === itemId) return 0;

    // If not dragging, reset to 0
    if (!isDraggingNow) return 0;

    // Use dynamically measured height + margins, or fall back to constant (which already includes margins)
    // measure() returns content height only, so we add ITEM_VERTICAL_MARGIN for proper spacing
    const itemHeight =
      measuredItemHeight.value > 0
        ? measuredItemHeight.value + ITEM_VERTICAL_MARGIN
        : DRAG_ITEM_HEIGHT;

    // Calculate effective translateY including scroll delta
    // When autoscrolling, the view scrolls but translateY stays the same
    // We need to account for how much the list has scrolled since drag started
    const scrollDelta = scrollOffset.value - dragStartScrollOffset.value;
    const effectiveTranslateY = translateYNow + scrollDelta;

    // Calculate which index the dragged item is hovering over
    // Add offset for early shift triggering (~28px instead of ~47px)
    // Offset pushes Math.round to trigger 20% earlier while keeping correct item height
    const offset =
      effectiveTranslateY > 0 ? 0.2 : effectiveTranslateY < 0 ? -0.2 : 0;
    const hoveredIndex =
      currentDraggedIndex + Math.round(effectiveTranslateY / itemHeight + offset);

    // Moving DOWN: items between original and hovered positions shift UP
    if (hoveredIndex > currentDraggedIndex) {
      if (index > currentDraggedIndex && index <= hoveredIndex) {
        return -itemHeight;
      }
    }
    // Moving UP: items between hovered and original positions shift DOWN
    else if (hoveredIndex < currentDraggedIndex) {
      if (index < currentDraggedIndex && index >= hoveredIndex) {
        return itemHeight;
      }
    }

    return 0;
  }, [index, itemId]);

  // Animate shift when target changes - useAnimatedReaction triggers withTiming only on change
  useAnimatedReaction(
    () => targetShiftY.value,
    (target, prev) => {
      'worklet';
      if (target !== prev) {
        shiftY.value = withTiming(target, {
          duration: 100,
          easing: Easing.out(Easing.ease),
        });
      }
    },
  );

  return { shiftY };
}
