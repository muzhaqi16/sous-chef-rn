import { useLayoutEffect } from 'react';
import {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { useRecyclingState } from '@shopify/flash-list';
import { useDragState } from '#/components/organisms/SortableShoppingList/DragStateContext';
import { DRAG_ITEM_HEIGHT } from '#/constants/drag';

/**
 * Configuration for useDropCompensation hook
 */
export interface UseDropCompensationConfig {
  /** Item ID for stable identity check */
  itemId: string;
  /** Current index in list */
  index: number;
  /** This item's translateY SharedValue (from useDragGesture) */
  translateY: SharedValue<number>;
  /** This item's shiftY SharedValue (from useDragShift) */
  shiftY: SharedValue<number>;
}

/**
 * Hook that handles index change compensation after drag reorder.
 *
 * When an item is dropped and the cache updates, React re-renders with new indices.
 * This causes a visual jump because items suddenly have different positions.
 * This hook compensates by:
 * 1. Detecting index changes (via useRecyclingState for FlashList recycling)
 * 2. Adjusting translateY to compensate for the position delta
 * 3. Animating the dragged item back to 0 (settle animation)
 * 4. Resetting global drag state after animation completes
 * 5. Resetting shiftY on UI thread via useAnimatedReaction (avoids JS↔UI frame gap)
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

  // Track index on UI thread for synchronized shift reset (avoids JS↔UI frame gap)
  const indexShared = useSharedValue(index);

  // Global drag state
  const {
    isDragging: globalIsDragging,
    draggedIndex,
    draggedItemId,
    measuredItemHeight,
    isDropping,
    dragUpdateTrigger,
  } = useDragState();

  // Use FlashList's useRecyclingState for automatic reset on view recycling
  // This replaces manual tracking with prevItemIdRef/prevIndexRef
  // When item.id changes (view recycled), state resets automatically
  const [prevIndex, setPrevIndex] = useRecyclingState(index, [itemId]);

  // Handle index changes after cache updates (drop compensation)
  // useRecyclingState auto-resets prevIndex when item.id changes (view recycling)
  // useLayoutEffect runs synchronously before paint to prevent visual flash
  useLayoutEffect(() => {
    if (index !== prevIndex) {
      // Compensate for index change by adjusting translateY
      // This creates a smooth transition instead of a visual jump
      const indexDelta = index - prevIndex;
      const heightDelta = indexDelta * DRAG_ITEM_HEIGHT;

      // Check if this is the dragged item completing its drop
      const isTheDraggedItem = draggedItemId.value === itemId;

      // Compensate translateY for position change
      const compensatedY = translateY.value - heightDelta;

      if (isTheDraggedItem) {
        // Dragged item: Set compensated value immediately (cancels any pending fallback animation)
        // then animate smoothly to 0 from the compensated position
        translateY.value = compensatedY;
        translateY.value = withTiming(
          0,
          { duration: 150, easing: Easing.out(Easing.ease) },
          finished => {
            'worklet';
            if (finished) {
              // Reset ALL global state here (including isDropping and globalIsDragging)
              // This happens AFTER the settle animation completes
              isDropping.value = false;
              globalIsDragging.value = false;
              draggedIndex.value = -1;
              draggedItemId.value = '';
              measuredItemHeight.value = 0;
              // Force final update to ensure all items see the reset
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

      // NOTE: shiftY reset is handled by useAnimatedReaction below (UI thread sync)
      // This avoids the JS↔UI thread frame gap that caused brief flicker

      // Update tracked index
      setPrevIndex(index);
    }
    // SharedValues from context (draggedIndex, draggedItemId, etc.) are stable refs - don't need in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, prevIndex, translateY, setPrevIndex, itemId]);

  // Sync JS index to SharedValue for UI thread access
  useLayoutEffect(() => {
    indexShared.value = index;
  }, [index, indexShared]);

  // Reset shiftY on UI thread when index changes (avoids JS↔UI frame gap)
  // This ensures the shift reset and dragAnimatedStyle read happen on the SAME thread
  useAnimatedReaction(
    () => indexShared.value,
    (currentIndex, prevIdx) => {
      'worklet';
      // When index changes (during drop), reset shift immediately on UI thread
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
