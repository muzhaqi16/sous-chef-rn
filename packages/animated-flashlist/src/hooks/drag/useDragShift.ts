import {
  useSharedValue,
  useDerivedValue,
  useAnimatedReaction,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useDragState } from '../../contexts/DragStateContext';
import type { UseDragShiftConfig, UseDragShiftResult } from '../../types';

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
    config: dragConfig,
  } = useDragState();

  // Shift animation SharedValue
  const shiftY = useSharedValue(0);

  // Calculate target shift using useDerivedValue
  const targetShiftY = useDerivedValue(() => {
    'worklet';
    // Force re-evaluation on every drag state change
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    dragUpdateTrigger.value;

    // During drop transition, freeze shift values
    if (isDropping.value) {
      return shiftY.value;
    }

    const currentDraggedIndex = draggedIndex.value;
    const isDraggingNow = globalIsDragging.value;
    const translateYNow = currentTranslateY.value;
    const currentDraggedItemId = draggedItemId.value;

    // If I'm the dragged item, no shift needed
    if (currentDraggedItemId === itemId) return 0;

    // If not dragging, reset to 0
    if (!isDraggingNow) return 0;

    // Use dynamically measured height + margins, or fall back to config
    const itemHeight =
      measuredItemHeight.value > 0
        ? measuredItemHeight.value + dragConfig.itemVerticalMargin
        : dragConfig.itemHeight;

    // Calculate effective translateY including scroll delta
    const scrollDelta = scrollOffset.value - dragStartScrollOffset.value;
    const effectiveTranslateY = translateYNow + scrollDelta;

    // Calculate which index the dragged item is hovering over
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

  // Animate shift when target changes
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
