import { useLayoutEffect } from 'react';
import {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useRecyclingState } from '@shopify/flash-list';
import { useDragState } from '../../contexts/DragStateContext';
import type { UseDropCompensationConfig } from '../../types';

/**
 * Hook that handles index change compensation after drag reorder.
 *
 * When an item is dropped and the data updates, React re-renders with new indices.
 * This causes a visual jump because items suddenly have different positions.
 * This hook compensates by:
 * 1. Detecting index changes (via useRecyclingState for FlashList recycling)
 * 2. Adjusting translateY to compensate for the position delta
 * 3. Animating the dragged item back to 0 (settle animation)
 * 4. Resetting global drag state after animation completes
 * 5. Resetting shiftY on UI thread via useAnimatedReaction
 *
 * useLayoutEffect runs synchronously before paint to prevent visual flash.
 *
 * @example
 * ```tsx
 * useDropCompensation({
 *   itemId: item.id,
 *   index,
 *   translateY,
 *   shiftY,
 * });
 * ```
 */
export function useDropCompensation(config: UseDropCompensationConfig): void {
  const { itemId, index, translateY, shiftY } = config;

  // Track index on UI thread for synchronized shift reset
  const indexShared = useSharedValue(index);

  // Global drag state
  const {
    isDragging: globalIsDragging,
    draggedIndex,
    draggedItemId,
    measuredItemHeight,
    isDropping,
    dragUpdateTrigger,
    config: dragConfig,
  } = useDragState();

  // Use FlashList's useRecyclingState for automatic reset on view recycling
  const [prevIndex, setPrevIndex] = useRecyclingState(index, [itemId]);

  // Handle index changes after data updates (drop compensation)
  useLayoutEffect(() => {
    if (index !== prevIndex) {
      // Compensate for index change by adjusting translateY
      const indexDelta = index - prevIndex;
      const heightDelta = indexDelta * dragConfig.itemHeight;

      // Check if this is the dragged item completing its drop
      const isTheDraggedItem = draggedItemId.value === itemId;

      // Compensate translateY for position change
      const compensatedY = translateY.value - heightDelta;

      if (isTheDraggedItem) {
        // Dragged item: animate smoothly to 0 from compensated position
        translateY.value = compensatedY;
        translateY.value = withTiming(
          0,
          { duration: 150, easing: Easing.out(Easing.ease) },
          finished => {
            'worklet';
            if (finished) {
              // Reset ALL global state after settle animation
              isDropping.value = false;
              globalIsDragging.value = false;
              draggedIndex.value = -1;
              draggedItemId.value = '';
              measuredItemHeight.value = 0;
              dragUpdateTrigger.value = withTiming(dragUpdateTrigger.value + 1, {
                duration: 1,
              });
            }
          },
        );
      } else if (Math.abs(translateY.value) > 1) {
        // Non-dragged item: just compensate without animation
        translateY.value = compensatedY;
      }

      // Update tracked index
      setPrevIndex(index);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, prevIndex, translateY, setPrevIndex, itemId]);

  // Sync JS index to SharedValue for UI thread access
  useLayoutEffect(() => {
    indexShared.value = index;
  }, [index, indexShared]);

  // Reset shiftY on UI thread when index changes
  useAnimatedReaction(
    () => indexShared.value,
    (currentIndex, prevIdx) => {
      'worklet';
      if (
        prevIdx !== null &&
        currentIndex !== prevIdx &&
        Math.abs(shiftY.value) > 1
      ) {
        shiftY.value = 0;
      }
    },
  );
}
